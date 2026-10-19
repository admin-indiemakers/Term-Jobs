import mongomock
import pytest
from fastapi import HTTPException
from modules.identity.services.contract_access import contract_issued, require_issued_contract


@pytest.fixture
def database():
    db = mongomock.MongoClient().db
    db.candidate_submissions.insert_one({'id': 'sub', 'candidate_id': 'candidate', 'requisition_id': 'req'})
    db.requisitions.insert_one({'id': 'req', 'tenant_id': 'company'})
    return db


@pytest.mark.parametrize('offer', [None, {'status': 'Draft'}, {'status': 'Offer Extended'}, {'status': 'Offer Extended', 'sent_at': '2026-10-19', 'sent_by_role': 'Hiring Manager'}, {'status': 'revoked', 'sent_at': '2026-10-19', 'sent_by_role': 'Super Admin'}])
def test_missing_draft_or_unissued_contract_blocks_access(database, offer):
    if offer:
        database.offer_letters.insert_one({'candidate_id': 'sub', **offer})
    with pytest.raises(HTTPException) as error:
        require_issued_contract(database, 'candidate', 'company')
    assert error.value.status_code == 409


def test_superadmin_dispatch_unlocks_only_correct_company(database):
    database.offer_letters.insert_one({'submission_id': 'sub', 'status': 'Offer Extended', 'sent_at': '2026-10-19', 'sent_by_role': 'Super Admin'})
    assert contract_issued(database, 'candidate', 'company')
    assert not contract_issued(database, 'candidate', 'other-company')


def test_legacy_dispatch_requires_verified_superadmin_sender(database):
    database.offer_letters.insert_one({'candidate_id': 'sub', 'status': 'Offer Extended', 'sent_at': '2026-10-19', 'sent_by': 'Issuer'})
    assert not contract_issued(database, 'candidate', 'company')
    database.users.insert_one({'name': 'Issuer', 'role': 'Super Admin'})
    assert contract_issued(database, 'candidate', 'company')


def test_contract_for_another_requisition_does_not_unlock(database):
    database.offer_letters.insert_one({'candidate_id': 'sub', 'requisition_id': 'other', 'status': 'Offer Extended', 'sent_at': '2026-10-19', 'sent_by_role': 'Super Admin'})
    assert not contract_issued(database, 'candidate', 'company')
