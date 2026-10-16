"""Ownership checks shared by onboarding HTTP endpoints."""
import re
from fastapi import HTTPException


def application_scope(database, user):
    if not user:
        raise HTTPException(status_code=401, detail='Authentication required')
    if user.get('role') == 'Super Admin':
        return {}
    tenant = user.get('tenant_id')
    if not tenant:
        raise HTTPException(status_code=403, detail='Company identity required')
    role = user.get('role')
    if role == 'Candidate':
        # Candidate identity must come from the verified account, never request data.
        submissions = database['candidate_submissions'].find({'candidate_email': {'$regex': '^' + re.escape(user.get('email') or '\\x00') + '$', '$options': 'i'}})
    else:
        req_filter = {'tenant_id': tenant}
        if role == 'Hiring Manager':
            req_filter['created_by'] = user['id']
        elif role not in ('Admin', 'HR', 'Director', 'Recruiter'):
            raise HTTPException(status_code=403, detail='Onboarding access denied')
        req_ids = [r['id'] for r in database['requisitions'].find(req_filter, {'id': 1}) if r.get('id')]
        submissions = database['candidate_submissions'].find({'requisition_id': {'$in': req_ids}})
    ids = [s['id'] for s in submissions if s.get('id')]
    return {'candidate_id': {'$in': ids}}


def require_application(database, user, candidate_id):
    scope = application_scope(database, user)
    if scope and candidate_id not in scope['candidate_id']['$in']:
        raise HTTPException(status_code=403, detail='Candidate is outside your onboarding scope')
