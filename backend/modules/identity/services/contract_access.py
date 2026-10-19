"""Candidate portal access requires a formally issued Super Admin contract."""
from fastapi import HTTPException


def contract_issued(database, candidate_id, tenant_id):
    clean = str(candidate_id or '').replace('SDC-', '').replace('SDC -', '').replace('BEAR-', '').replace('CND-', '').strip()
    identifiers = list({str(candidate_id or ''), clean} - {''})
    if not identifiers or not tenant_id:
        return False
    sub = database['candidate_submissions'].find_one({'$or': [{field: {'$in': identifiers}} for field in ('id', 'candidate_id', 'workorder_id', 'submission_id')]})
    if not sub:
        return False
    req_id = sub.get('requisition_id')
    if not req_id or not database['requisitions'].find_one({'id': req_id, 'tenant_id': tenant_id}):
        return False
    identifiers.extend(str(sub[key]) for key in ('id', 'candidate_id', 'submission_id') if sub.get(key))
    offers = database['offer_letters'].find({'$or': [{'candidate_id': {'$in': identifiers}}, {'submission_id': {'$in': identifiers}}]})
    for offer in offers:
        if offer.get('requisition_id') and offer['requisition_id'] != req_id:
            continue
        if not offer.get('sent_at') or str(offer.get('status', '')).lower() in ('draft', 'cancelled', 'revoked', 'rejected'):
            continue
        if offer.get('sent_by_role') == 'Super Admin':
            return True
        sender = offer.get('sent_by')
        if sender and database['users'].find_one({'role': 'Super Admin', 'is_deleted': {'$ne': True}, '$or': [{'name': sender}, {'email': sender}]}):
            return True
    return False


def require_issued_contract(database, candidate_id, tenant_id):
    if not contract_issued(database, candidate_id, tenant_id):
        raise HTTPException(status_code=409, detail='Portal access is locked until the TermJobs Super Admin issues the candidate contract.')
