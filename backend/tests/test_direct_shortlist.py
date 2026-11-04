import importlib
from types import SimpleNamespace

import mongomock
import pytest
from fastapi import HTTPException
from modules.candidate.router import direct_shortlist_candidate


@pytest.fixture
def setup(monkeypatch):
    db = mongomock.MongoClient().db
    monkeypatch.setattr(importlib.import_module('modules.shared.db'), 'db', db)
    db.requisitions.insert_one({'id': 'req', 'status': 'Published', 'tenant_id': 'company'})
    db.candidate_submissions.insert_many([
        {'id': 'one', 'requisition_id': 'req', 'status': 'Submitted', 'resume_pdf': 'original'},
        {'id': 'two', 'requisition_id': 'req', 'status': 'Submitted'},
    ])
    return db, SimpleNamespace(id='admin', role='Super Admin')


def test_sends_only_selected_application_and_is_idempotent(setup):
    db, user = setup
    assert direct_shortlist_candidate('one', {'requisition_id': 'req'}, user)['status'] == 'Shortlisted'
    row = db.candidate_submissions.find_one({'id': 'one'})
    assert row['manual_shortlist'] and row['manual_shortlisted_by'] == 'admin'
    assert row['resume_pdf'] == 'original'
    assert db.candidate_submissions.find_one({'id': 'two'})['status'] == 'Submitted'
    direct_shortlist_candidate('one', {'requisition_id': 'req'}, user)
    assert db.candidate_submissions.find_one({'id': 'one'}) == row


@pytest.mark.parametrize('role', ['Candidate', 'Hiring Manager', 'Admin', 'Vendor'])
def test_rejects_non_superadmin(setup, role):
    db, user = setup
    user.role = role
    with pytest.raises(HTTPException) as error:
        direct_shortlist_candidate('one', {'requisition_id': 'req'}, user)
    assert error.value.status_code == 403
    assert db.candidate_submissions.find_one({'id': 'one'})['status'] == 'Submitted'


def test_wrong_requisition_rejected(setup):
    _, user = setup
    with pytest.raises(HTTPException) as error:
        direct_shortlist_candidate('one', {'requisition_id': 'other'}, user)
    assert error.value.status_code == 404


@pytest.mark.parametrize('status', ['Rejected', 'Withdrawn'])
def test_terminal_application_not_reopened(setup, status):
    db, user = setup
    db.candidate_submissions.update_one({'id': 'one'}, {'$set': {'status': status}})
    with pytest.raises(HTTPException) as error:
        direct_shortlist_candidate('one', {'requisition_id': 'req'}, user)
    assert error.value.status_code == 409
