"""Compact platform overview; never hydrate resumes or whole domain models."""
from concurrent.futures import ThreadPoolExecutor
from contextvars import copy_context
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query

from modules.shared.cache import cache
from modules.shared.config import get_active_cluster, settings
from modules.shared.db import db
from .router import require_superadmin

router = APIRouter(prefix='/api/superadmin', dependencies=[Depends(require_superadmin)])


def _accounts(collection, field, recent_query=None):
    return next(collection.aggregate([{'$facet': {
        'counts': [{'$group': {'_id': f'${field}', 'count': {'$sum': 1}}}],
        'guests': [{'$match': {'$or': [{'is_guest': True}, {'vendor_type': 'guest'}, {'client_type': 'guest'}]}}, {'$count': 'count'}],
        'recent': [{'$match': recent_query or {}}, {'$sort': {'created_at': -1, 'id': 1}}, {'$limit': 25},
                   {'$project': {'_id': 0, 'id': 1, 'name': 1, 'tenant_type': 1, 'tenant_id': 1, 'role': 1, 'created_at': 1}}],
    }}]))


def _pool():
    people = {}
    # Same email/id normalization and bank-first precedence as Candidate Pool,
    # using only identity/source fields; no application joins or score computation.
    for collection, bank in [(db.candidates, True), (db.candidate_submissions, False)]:
        fields = {'id': 1, 'candidate_email': 1, 'vendor_name': 1, 'vendor_company_name': 1, 'candidate_id': 1, 'workorder_id': 1}
        for row in collection.find({}, fields).sort('created_at', -1):
            fallback = row.get('id') or str(row.get('_id'))
            if not bank:
                fallback = row.get('workorder_id') or row.get('candidate_id') or fallback
            key = (row.get('candidate_email') or '').strip().lower() or str(fallback)
            vendor = ((row.get('vendor_company_name') if bank else None) or row.get('vendor_name') or 'GlobalStaff Partners').strip().lower()
            people.setdefault(key, vendor in ('direct applicant', 'portal registration', 'portal applicant'))
    direct = sum(people.values())
    return {'total': len(people), 'portal_applicants': direct, 'vendor_candidates': len(people) - direct}


def _outreach():
    counts = {row['_id']: row['count'] for row in db.candidate_outreach.aggregate([
        {'$group': {'_id': '$status', 'count': {'$sum': 1}}},
    ])}
    total = sum(counts.values())
    responses = sum(counts.get(status, 0) for status in ('interested', 'unavailable', 'declined'))
    return {'total_outreach_sent': total, 'interested_count': counts.get('interested', 0),
            'response_rate_percent': round(responses / max(total, 1) * 100, 1)}


def _recent_hiring():
    submissions = list(db.candidate_submissions.find({}, {'id': 1, 'candidate_name': 1, 'vendor_name': 1, 'match_score': 1, 'status': 1, 'created_at': 1}).sort('created_at', -1).limit(25))
    requisitions = list(db.requisitions.find({}, {'id': 1, 'title': 1, 'tenant_id': 1, 'department': 1, 'status': 1, 'created_at': 1}).sort('created_at', -1).limit(25))
    return submissions, requisitions


def _date(value):
    if isinstance(value, str):
        try:
            value = datetime.fromisoformat(value.replace('Z', '+00:00'))
        except ValueError:
            return None, 0
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.isoformat(), value.timestamp()
    return None, 0


def build_overview():
    # Propagate the request's cluster context to every worker. Main and QA caches
    # and database connections must remain isolated even on production aliases.
    # Resolve the lazy Mongo client once before concurrent work starts.
    tenants_collection, users_collection = db.tenants, db.users
    with ThreadPoolExecutor(max_workers=5) as executor:
        jobs = [lambda: _accounts(tenants_collection, 'tenant_type'),
                lambda: _accounts(users_collection, 'role', {'role': {'$in': ['Admin', 'Recruiter']}}),
                _pool, _outreach, _recent_hiring]
        futures = [executor.submit(copy_context().run, job) for job in jobs]
        tenants, users, pool, outreach, (submissions, requisitions) = [future.result() for future in futures]
    tenant_counts = {row['_id']: row['count'] for row in tenants['counts']}
    user_counts = {row['_id']: row['count'] for row in users['counts']}
    tenant_ids = {row.get('tenant_id') for row in users['recent'] + requisitions if row.get('tenant_id')}
    names = {row['id']: row.get('name') for row in db.tenants.find({'id': {'$in': list(tenant_ids)}}, {'id': 1, 'name': 1})} if tenant_ids else {}
    activities = []

    def event(row, prefix, kind, title, desc, badge='Active', tone='blue'):
        date, stamp = _date(row.get('created_at'))
        activities.append({'id': f"{prefix}-{row.get('id') or row.get('_id')}", 'type': kind,
                           'title': title, 'desc': desc, 'created_at': date, 'badge': badge, 'tone': tone, '_ts': stamp})

    for row in tenants['recent']:
        if row.get('tenant_type') in ('client', 'consultancy'):
            buyer = row['tenant_type'] == 'client'
            event(row, 'tenant', 'buyer' if buyer else 'vendor', 'Buyer company onboarded' if buyer else 'Vendor consultancy onboarded', row.get('name') or 'Organization', tone='green')
    for row in users['recent']:
        admin = row.get('role') == 'Admin'
        event(row, 'admin' if admin else 'recruiter', 'admin' if admin else 'recruiter',
              'Company admin verified' if admin else 'Vendor recruiter active',
              f"{row.get('name') or 'Administrator'} ({names.get(row.get('tenant_id')) or 'Organization'})", 'Verified' if admin else 'Active', 'blue' if admin else 'purple')
    for row in submissions:
        score = f"Score: {row['match_score']}%" if row.get('match_score') is not None else 'Screened'
        event(row, 'submission', 'candidate', f"Candidate submitted: {row.get('candidate_name') or 'Applicant'}", f"Agency: {row.get('vendor_name') or 'Partner'} · {score}", row.get('status') or 'Screened', 'green' if row.get('status') in ('Shortlisted', 'Hired') else 'blue')
    for row in requisitions:
        event(row, 'req', 'requisition', f"Job opening: {row.get('title') or 'Role'}", f"{names.get(row.get('tenant_id')) or 'Enterprise'} · {row.get('department') or 'Hiring'}", row.get('status') or 'Open')
    activities.sort(key=lambda row: row['_ts'], reverse=True)
    recent = [{key: value for key, value in row.items() if key != '_ts'} for row in activities[:25]]
    guests = tenants['guests'][0]['count'] if tenants['guests'] else 0
    return {'stats': {'buyer_companies': tenant_counts.get('client', 0), 'vendor_consultancies': tenant_counts.get('consultancy', 0),
                      'total_admin_accounts': user_counts.get('Admin', 0) + user_counts.get('Recruiter', 0) + guests,
                      'platform_activities': recent}, 'pool_stats': pool, 'outreach_stats': outreach}


@router.get('/overview')
def get_overview(refresh: bool = Query(False)):
    key = f'superadmin-overview:{get_active_cluster()}:{settings.mongo_db_name}'
    result = None if refresh else cache.get(key)
    if result is None:
        result = build_overview()
        cache.set(key, result, ttl=15)
    return result
