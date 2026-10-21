"""Monthly billing identity, including dated legacy SOW records."""
import re
from datetime import datetime, timezone
from fastapi import HTTPException


def billing_period(value=None):
    value = value or datetime.now(timezone.utc).strftime('%Y-%m')
    if not isinstance(value, str) or not re.fullmatch(r'(?!0000)[0-9]{4}-(0[1-9]|1[0-2])', value):
        raise HTTPException(422, 'Billing period must be YYYY-MM with a four-digit year (0001–9999)')
    return value


def record_period(doc):
    payload = doc.get('sow_data') or {}
    for value in (doc.get('period'), payload.get('period'), payload.get('cycle_period')):
        if not value:
            continue
        value = str(value)
        match = re.match(r'^(\d{4}-\d{2})(?:$|-)', value)
        if match:
            return match[1]
        for fmt in ('%B %Y', '%b %Y', '%b %d, %Y'):
            try:
                return datetime.strptime(value.split(' - ')[0], fmt).strftime('%Y-%m')
            except ValueError:
                pass
    # A legacy submission belongs to its original submission month, never the
    # month when it was paid or last edited.
    return str(doc.get('submitted_at') or doc.get('created_at') or '')[:7]


def period_query(collection, candidate_id, period):
    period = billing_period(period)
    identity = {'$or': [{'candidate_id': candidate_id}, {'workorder_id': candidate_id}]}
    exact = {**identity, 'period': period}
    existing = collection.find_one(exact)
    if existing:
        return {'_id': existing['_id']}
    for legacy in collection.find({**identity, 'period': {'$exists': False}}):
        if record_period(legacy) == period:
            return {'_id': legacy['_id']}
    return {'candidate_id': candidate_id, 'period': period}


def require_editable(doc):
    if doc and (doc.get('status') == 'Paid' or doc.get('payment_status') == 'Paid'):
        raise HTTPException(409, 'This billing period is already paid and cannot be changed. Select another month.')


def require_resubmittable(doc):
    """Freeze the submitted billing snapshot until an explicit return for revision."""
    require_editable(doc)
    if not doc:
        return
    returned = doc.get('status') in ('Revision Requested', 'Rejected by Procurement', 'Rejected by Director', 'Rejected')
    if not returned and (
        doc.get('procurement_authorized') or doc.get('director_approved')
        or doc.get('status') in ('Pending Director Approval', 'Approved by Procurement', 'Approved by Director', 'Approved', 'ACTIVE')
    ):
        raise HTTPException(409, 'This billing period has been authorized by Procurement. Request revision with a reason before changing or resubmitting it. The existing approval status has been preserved.')


def update_billing_snapshot(collection, query, previous, update, *, upsert=False):
    """Reject stale writes instead of reverting a concurrent approval."""
    if previous:
        guarded = {**query, 'status': previous.get('status'), 'updated_at': previous.get('updated_at')}
        result = collection.update_one(guarded, update)
        if result.matched_count != 1:
            raise HTTPException(409, 'This billing period changed while you were reviewing it. Refresh and review its current approval status.')
        return result
    if upsert:
        # A concurrent request may have created and submitted this period since
        # our read. Never overwrite that submission with a first-save payload.
        result = collection.update_one(query, {'$setOnInsert': update['$set']}, upsert=True)
        if result.matched_count:
            raise HTTPException(409, 'This billing period was created by another request. Refresh before editing it.')
        return result
    return collection.update_one(query, update)
