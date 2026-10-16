"""Work-order ownership uses stable company/requisition IDs, never names."""
from fastapi import HTTPException


def resource_scope(database, user, submissions=False):
    if user.role == 'Super Admin':
        return {}
    if not user.tenant_id:
        raise HTTPException(status_code=403, detail='Company identity required')
    if user.role in ('Recruiter', 'Vendor'):
        return {'tenant_id': user.tenant_id}
    if user.role not in ('Hiring Manager', 'Admin', 'HR', 'Director', 'Finance', 'Finance Team', 'Procurement'):
        raise HTTPException(status_code=403, detail='Work-order access denied')
    req_query = {'tenant_id': user.tenant_id}
    if user.role == 'Hiring Manager':
        req_query['created_by'] = user.id
    reqs = [r['id'] for r in database['requisitions'].find(req_query, {'id': 1}) if r.get('id')]
    relation = {'requisition_id': {'$in': reqs}}
    if submissions or user.role == 'Hiring Manager':
        return relation
    return {'$or': [{'tenant_id': user.tenant_id}, relation]}
