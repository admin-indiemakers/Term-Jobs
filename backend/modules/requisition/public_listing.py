"""Database-paginated public roles with global filter options and counts."""
import math
import re
from datetime import datetime
from zoneinfo import ZoneInfo

from modules.shared.db import db


def _category_expression():
    title = {'$toLower': {'$ifNull': ['$title', '']}}
    family = {'$ifNull': ['$structured_role.job_family', '']}
    category = {'$ifNull': ['$category', '']}
    branches = [
        {'case': {'$not': [{'$in': [{'$toLower': family}, ['', 'general', 'other']]}]}, 'then': family},
        {'case': {'$not': [{'$in': [{'$toLower': category}, ['', 'general']]}]}, 'then': category},
    ]
    for pattern, label in [
        ('qa|test|quality', 'QA & Testing'),
        ('developer|engineer|programmer|frontend|backend|full stack|web|mobile|software', 'Development'),
        ('devops|cloud|infrastructure|sre', 'DevOps'), ('design|ui|ux', 'Design'),
        ('human resource|hr |^hr|recruiter|talent', 'HR'), ('sales|business dev|marketing', 'Sales'),
        ('service|operation|ops|field service|logistics', 'Operations'),
    ]:
        branches.append({'case': {'$regexMatch': {'input': title, 'regex': pattern}}, 'then': label})
    return {'$switch': {'branches': branches, 'default': 'Other'}}


def public_listing(page=1, page_size=8, q='', work_mode='', family='', location='', category=''):
    today = datetime.now(ZoneInfo('Asia/Kolkata')).date().isoformat()
    deadline = 'structured_role.submission_deadline'
    live = {'status': 'Published', '$or': [
        {deadline: {'$exists': False}}, {deadline: None}, {deadline: ''}, {deadline: {'$gte': today}},
    ]}
    filters = []
    if q.strip():
        raw_q = q.strip()
        escaped = re.escape(raw_q)
        word_start = r'\b' if raw_q[0].isalnum() or raw_q[0] == '_' else r'(^|[^\w])'
        word_end = r'\b' if raw_q[-1].isalnum() or raw_q[-1] == '_' else r'([^\w]|$)'
        # Boundary matching prevents substring noise (e.g. searching 'AI' will not match 'email' or 'maintain')
        if len(raw_q) <= 3:
            term = {'$regex': rf'{word_start}{escaped}{word_end}', '$options': 'i'}
            desc_term = term
        else:
            term = {'$regex': rf'{word_start}{escaped}', '$options': 'i'}
            desc_term = {'$regex': rf'{word_start}{escaped}{word_end}', '$options': 'i'} if len(raw_q) <= 5 else term
        filters.append({'$or': [
            {'title': term},
            {'_company': term},
            {'structured_role.must_have_skills': term},
            {'structured_role.nice_to_have_skills': term},
            {'generated_jd_markdown': desc_term},
            {'structured_role.job_description': desc_term},
            {'structured_role.role_summary': desc_term},
            {'structured_role.summary': desc_term},
            {'intent.description': desc_term},
        ]})
    if work_mode:
        mode_pattern = r'^(on[- ]?site|in-office)$' if work_mode.lower().replace('-', '').replace(' ', '') == 'onsite' else '^' + re.escape(work_mode) + '$'
        filters.append({'structured_role.work_mode': {'$regex': mode_pattern, '$options': 'i'}})
    if family:
        filters.append({'_family': family})
    if location:
        filters.append({'_locations': {'$regex': re.escape(location), '$options': 'i'}})
    base_match = {'$and': filters} if filters else {}
    selected_match = {'$and': [base_match, {'_category': category}]} if category else base_match
    pipeline = [
        {'$match': live},
        {'$lookup': {'from': 'company_profiles', 'localField': 'company_profile_id', 'foreignField': 'id', 'as': '_profiles'}},
        {'$lookup': {'from': 'tenants', 'localField': 'tenant_id', 'foreignField': 'id', 'as': '_tenants'}},
        {'$addFields': {
            '_profile': {'$ifNull': [{'$arrayElemAt': ['$_profiles', 0]}, {}]},
            '_tenant': {'$ifNull': [{'$arrayElemAt': ['$_tenants', 0]}, {}]},
            '_family': {'$ifNull': ['$structured_role.job_family', 'General']},
            '_category': _category_expression(),
        }},
        {'$addFields': {'_company': {'$ifNull': ['$_profile.name', {'$ifNull': ['$_tenant.name', {'$ifNull': ['$company_name', 'Partner Enterprise']}]}]},
                        '_location': {'$ifNull': ['$structured_role.location', {'$ifNull': ['$_profile.location', 'Remote']}]}}},
        {'$addFields': {'_locations': {'$cond': [{'$isArray': '$_location'}, '$_location', {'$map': {'input': [0], 'as': 'unused', 'in': '$_location'}}]}}},
        {'$facet': {
            'items': [{'$match': selected_match}, {'$sort': {'created_at': -1, 'id': 1}},
                      {'$skip': (page - 1) * page_size}, {'$limit': page_size},
                      {'$project': {'_id': 0, 'id': 1, 'title': 1, 'created_at': 1, 'structured_role': 1,
                                    'generated_jd_markdown': 1, 'intent.description': 1,
                                    '_profile': 1, '_tenant': 1, '_company': 1}}],
            'total': [{'$match': selected_match}, {'$count': 'count'}],
            'categories': [{'$match': base_match}, {'$group': {'_id': '$_category', 'count': {'$sum': 1}}}, {'$sort': {'count': -1, '_id': 1}}],
            'families': [{'$group': {'_id': '$_family'}}],
            'locations': [{'$unwind': '$_locations'}, {'$group': {'_id': '$_locations'}}],
            'stats': [{'$group': {'_id': None, 'roles': {'$sum': 1}, 'companies': {'$addToSet': '$_company'}}}],
        }},
    ]
    result = next(db.requisitions.aggregate(pipeline))
    total = result['total'][0]['count'] if result['total'] else 0
    stats = result['stats'][0] if result['stats'] else {'roles': 0, 'companies': []}
    work_modes = {'remote', 'hybrid', 'onsite', 'on-site', 'in-office', 'wfh', 'remote / hybrid', 'hybrid / remote', 'work from home'}
    return {
        'items': [_public_item(row) for row in result['items']], 'page': page, 'page_size': page_size,
        'total': total, 'total_pages': max(1, math.ceil(total / page_size)),
        'categories': [{'id': row['_id'], 'label': row['_id'], 'count': row['count']} for row in result['categories']],
        'filtered_total': sum(row['count'] for row in result['categories']),
        'filters': {'families': sorted(row['_id'] for row in result['families'] if row['_id']),
                    'locations': sorted(row['_id'] for row in result['locations'] if isinstance(row['_id'], str) and row['_id'].strip() and row['_id'].lower() not in work_modes)},
        'stats': {'roles': stats['roles'], 'companies': len(stats['companies'])},
    }


def _public_item(row):
    """Only public fields leave the API; serialize descriptions for this page only."""
    stored = row.get('structured_role') or {}
    profile, tenant = row.get('_profile') or {}, row.get('_tenant') or {}
    deadline = stored.get('submission_deadline')
    role = {
        'title': stored.get('title') or row.get('title'),
        'job_description': stored.get('job_description') or stored.get('role_summary') or stored.get('summary') or (row.get('intent') or {}).get('description') or '',
        'job_family': stored.get('job_family') or 'General',
        'must_have_skills': stored.get('must_have_skills') or [], 'nice_to_have_skills': stored.get('nice_to_have_skills') or [],
        'seniority_level': stored.get('seniority_level') or 'Mid-Senior', 'experience': stored.get('experience') or '3+ years',
        'headcount': stored.get('headcount') or 1, 'work_mode': stored.get('work_mode') or '',
        'location': stored.get('location') or ['Remote'], 'engagement_type': stored.get('engagement_type') or 'Contract',
        'duration': stored.get('duration') or '6 months', 'currency': stored.get('currency') or 'INR',
        'weekly_hours': stored.get('weekly_hours') or 40, 'submission_deadline': deadline, 'due_date': deadline, 'application_due_date': deadline,
        'range_min': stored.get('range_vendor_min') or stored.get('target_rate_min'),
        'range_max': stored.get('range_vendor_max') or stored.get('target_rate_max'),
    }
    return {'id': row['id'], 'ref': f"REQ-{row['id'][:6].upper()}", 'title': row.get('title') or role['title'],
            'company_name': row['_company'], 'company_industry': profile.get('industry') or 'Technology',
            'company_location': profile.get('location') or 'India',
            'company_logo_url': profile.get('logo_url') or tenant.get('logo_url') or '',
            'status': 'Published', 'due_date': deadline, 'submission_deadline': deadline, 'application_due_date': deadline,
            'structured_role': role, 'generated_jd_markdown': row.get('generated_jd_markdown') or role['job_description'],
            'created_at': row.get('created_at')}
