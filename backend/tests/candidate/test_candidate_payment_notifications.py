from types import SimpleNamespace

import mongomock
import pytest
from fastapi import HTTPException
from modules.candidate_portal import router


@pytest.fixture
def store(monkeypatch):
    database = mongomock.MongoClient().db
    monkeypatch.setattr(router, 'db', database)
    return database


def user(**changes):
    return SimpleNamespace(**({'role': 'Candidate', 'workorder_id': 'C1', 'candidate_id': 'C1', 'tenant_id': 'T1'} | changes))


def test_internal_and_other_candidate_notifications_hidden(store):
    for kind in (*router.INTERNAL_NOTIFICATION_TYPES, 'payment_disbursed', 'assignment_started'):
        store.candidate_notifications.insert_one({'id': kind, 'candidate_id': 'C1', 'type': kind})
    store.candidate_notifications.insert_one({'id': 'other', 'candidate_id': 'C2', 'type': 'payment_disbursed'})
    result = router.list_candidate_notifications(user())
    assert {n['type'] for n in result['notifications']} == {'payment_disbursed', 'assignment_started'}
    assert result['unread_count'] == 2


def test_payment_details_exclude_other_candidates_tenants_and_approval_fields(store):
    for candidate, tenant, status in [('C1', 'T1', 'Paid'), ('C2', 'T1', 'Paid'), ('C1', 'T2', 'Paid'), ('C1', 'T1', 'Pending')]:
        store.sow_documents.insert_one({'candidate_id': candidate, 'tenant_id': tenant, 'payment_status': status, 'payment_amount': 1200, 'transaction_ref': 'TX1', 'payment_processed_at': '2026-10-21', 'period': '2026-10', 'sow_data': {'internal': 'private'}})
    payments = router.list_candidate_payments(user())['payments']
    assert payments == [{'period': '2026-10', 'amount': 1200, 'transaction_ref': 'TX1', 'disbursed_at': '2026-10-21', 'status': 'Paid'}]


@pytest.mark.parametrize('changes', [{'role': 'Director'}, {'workorder_id': '', 'candidate_id': ''}])
def test_payment_access_requires_candidate_identity(store, changes):
    with pytest.raises(HTTPException) as exc:
        router.list_candidate_payments(user(**changes))
    assert exc.value.status_code == 403
