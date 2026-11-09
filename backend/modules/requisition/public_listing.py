"""Database-paginated public roles with global filter options and counts."""
import math
import re
from datetime import datetime
from zoneinfo import ZoneInfo

from modules.shared.db import db


def _family_expression():
    title = {'$toLower': {'$ifNull': ['$title', '']}}
    fam = {'$ifNull': ['$structured_role.job_family', '']}
    dept = {'$ifNull': ['$structured_role.department', {'$ifNull': ['$department', '']}]}
    category = {'$ifNull': ['$category', '']}

    branches = [
        # Explicit department / family mappings if clean
        {'case': {'$regexMatch': {'input': {'$toLower': dept}, 'regex': 'qa|test|quality'}}, 'then': 'Quality Assurance'},
        {'case': {'$regexMatch': {'input': {'$toLower': dept}, 'regex': 'devops|cloud|infra'}}, 'then': 'DevOps & Cloud'},
        {'case': {'$regexMatch': {'input': {'$toLower': dept}, 'regex': 'design|ui|ux'}}, 'then': 'Design & UI/UX'},
        {'case': {'$regexMatch': {'input': {'$toLower': dept}, 'regex': 'sales|business dev|account manager'}}, 'then': 'Sales & BD'},
        {'case': {'$regexMatch': {'input': {'$toLower': dept}, 'regex': 'marketing|growth'}}, 'then': 'Marketing'},
        {'case': {'$regexMatch': {'input': {'$toLower': dept}, 'regex': 'hr|human resource|talent'}}, 'then': 'Human Resources'},
        {'case': {'$regexMatch': {'input': {'$toLower': dept}, 'regex': 'research|travel|content'}}, 'then': 'Research & Content'},
        {'case': {'$regexMatch': {'input': {'$toLower': dept}, 'regex': 'software|engineer|developer|web|mobile|frontend|backend'}}, 'then': 'Engineering'},
        {'case': {'$regexMatch': {'input': {'$toLower': dept}, 'regex': 'service|operation'}}, 'then': 'Operations & Service'},

        # Explicit custom non-empty strings
        {'case': {'$not': [{'$in': [{'$toLower': dept}, ['', 'general', 'other']]}]}, 'then': dept},
        {'case': {'$not': [{'$in': [{'$toLower': fam}, ['', 'general', 'other']]}]}, 'then': fam},

        # Title pattern fallbacks
        {'case': {'$regexMatch': {'input': title, 'regex': 'qa|test|quality'}}, 'then': 'Quality Assurance'},
        {'case': {'$regexMatch': {'input': title, 'regex': 'devops|cloud|infrastructure|sre'}}, 'then': 'DevOps & Cloud'},
        {'case': {'$regexMatch': {'input': title, 'regex': 'design|ui/ux|ui / ux|ux designer|product design'}}, 'then': 'Design & UI/UX'},
        {'case': {'$regexMatch': {'input': title, 'regex': 'sales|business dev|bdm|bde|consultant|account manager'}}, 'then': 'Sales & BD'},
        {'case': {'$regexMatch': {'input': title, 'regex': 'marketing|growth|seo'}}, 'then': 'Marketing'},
        {'case': {'$regexMatch': {'input': title, 'regex': 'human resource|hr |^hr|recruiter|talent'}}, 'then': 'Human Resources'},
        {'case': {'$regexMatch': {'input': title, 'regex': 'research|travel'}}, 'then': 'Research & Content'},
        {'case': {'$regexMatch': {'input': title, 'regex': 'developer|engineer|software|frontend|front end|backend|full stack|fullstack|web|mobile|flutter'}}, 'then': 'Engineering'},
        {'case': {'$regexMatch': {'input': title, 'regex': 'service|operation|maintenance|field engineer'}}, 'then': 'Operations & Service'},
    ]
    return {'$switch': {'branches': branches, 'default': 'General'}}


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
        term = {'$regex': rf'{word_start}{escaped}', '$options': 'i'}
        search_or = [
            {'title': term},
            {'_company': term},
            {'structured_role.must_have_skills': term},
            {'structured_role.nice_to_have_skills': term},
        ]
        if len(raw_q) >= 2:
            search_or.extend([
                {'generated_jd_markdown': term},
                {'structured_role.job_description': term},
                {'structured_role.role_summary': term},
                {'structured_role.summary': term},
                {'intent.description': term},
            ])
        filters.append({'$or': search_or})
    if work_mode and work_mode != 'ALL':
        mode_pattern = r'^(on[- ]?site|in-office)$' if work_mode.lower().replace('-', '').replace(' ', '') == 'onsite' else '^' + re.escape(work_mode) + '$'
        filters.append({'structured_role.work_mode': {'$regex': mode_pattern, '$options': 'i'}})
    if family and family != 'ALL':
        filters.append({'_family': {'$regex': f'^{re.escape(family)}$', '$options': 'i'}})
    if location and location != 'ALL':
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
            '_family': _family_expression(),
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
            'families': [{'$match': {'_family': {'$ne': 'General'}}}, {'$group': {'_id': '$_family'}}],
            'locations': [{'$unwind': '$_locations'}, {'$group': {'_id': '$_locations'}}],
            'stats': [{'$group': {'_id': None, 'roles': {'$sum': 1}, 'companies': {'$addToSet': '$_company'}}}],
        }},
    ]
    result = next(db.requisitions.aggregate(pipeline))
    total = result['total'][0]['count'] if result['total'] else 0
    stats = result['stats'][0] if result['stats'] else {'roles': 0, 'companies': []}
    work_modes = {'remote', 'hybrid', 'onsite', 'on-site', 'in-office', 'wfh', 'remote / hybrid', 'hybrid / remote', 'work from home'}
    raw_items = result['items']
    if q.strip():
        def _score(row):
            t = row.get('title') or ''
            stored = row.get('structured_role') or {}
            skills = (stored.get('must_have_skills') or []) + (stored.get('nice_to_have_skills') or [])
            if re.search(rf'{word_start}{escaped}', t, re.I):
                return 100
            if any(re.search(rf'{word_start}{escaped}', str(s), re.I) for s in skills):
                return 50
            if re.search(rf'{word_start}{escaped}', row.get('_company') or '', re.I):
                return 40
            return 10
        raw_items = sorted(raw_items, key=_score, reverse=True)

    return {
        'items': [_public_item(row) for row in raw_items], 'page': page, 'page_size': page_size,
        'total': total, 'total_pages': max(1, math.ceil(total / page_size)),
        'categories': [{'id': row['_id'], 'label': row['_id'], 'count': row['count']} for row in result['categories']],
        'filtered_total': sum(row['count'] for row in result['categories']),
        'filters': {'families': sorted(row['_id'] for row in result['families'] if row['_id'] and row['_id'] != 'General'),
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
            'job_family': role['job_family'], 'work_mode': role['work_mode'] or 'Onsite',
            'due_date': deadline,
            'structured_role': role, 'generated_jd_markdown': row.get('generated_jd_markdown') or role['job_description']}
