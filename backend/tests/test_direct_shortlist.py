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


def test_direct_shortlist_route_is_registered_under_api_prefix(setup):
    from fastapi.testclient import TestClient
    from modules.identity.router import get_current_user
    import main
    db, user = setup
    previous = main.app.dependency_overrides.get(get_current_user)
    main.app.dependency_overrides[get_current_user] = lambda: user
    try:
        response = TestClient(main.app).post('/api/candidates/one/direct-shortlist', json={'requisition_id': 'req'})
        assert response.status_code == 200, response.text
        assert response.json()['status'] == 'Shortlisted'
    finally:
        if previous is None:
            main.app.dependency_overrides.pop(get_current_user, None)
        else:
            main.app.dependency_overrides[get_current_user] = previous


@pytest.mark.parametrize('status', ['Screened', 'Rejected', 'Withdrawn'])
def test_sent_history_survives_status_changes_and_closed_requisition(setup, status):
    db, user = setup
    direct_shortlist_candidate('one', {'requisition_id': 'req'}, user)
    db.candidate_submissions.update_one({'id': 'one'}, {'$set': {'status': status}})
    db.requisitions.update_one({'id': 'req'}, {'$set': {'status': 'Closed'}})
    before = db.candidate_submissions.find_one({'id': 'one'})
    response = direct_shortlist_candidate('one', {'requisition_id': 'req'}, user)
    assert response['sent_to_hiring_manager'] is True
    assert db.candidate_submissions.find_one({'id': 'one'}) == before


def test_unsent_closed_requisition_still_rejected(setup):
    db, user = setup
    db.requisitions.update_one({'id': 'req'}, {'$set': {'status': 'Closed'}})
    with pytest.raises(HTTPException) as error:
        direct_shortlist_candidate('one', {'requisition_id': 'req'}, user)
    assert error.value.status_code == 409
    assert not db.candidate_submissions.find_one({'id': 'one'}).get('sent_to_hiring_manager_at')


def test_pool_exposes_persistent_sent_flag_after_refresh(setup):
    import main
    db, user = setup
    direct_shortlist_candidate('one', {'requisition_id': 'req'}, user)
    db.candidate_submissions.update_one({'id': 'one'}, {'$set': {'status': 'Screened'}})
    pool = main.get_superadmin_candidate_pool(search=None, source=None, vendor=None, skill=None, current_user=user)
    applications = [app for candidate in pool['candidates'] for app in candidate['applications']]
    assert next(app for app in applications if app['submission_id'] == 'one')['sent_to_hiring_manager'] is True
    assert next(app for app in applications if app['submission_id'] == 'two')['sent_to_hiring_manager'] is False


def test_pool_returns_requisition_status_without_losing_closed_history(setup):
    import main
    db, user = setup
    db.requisitions.update_one({'id': 'req'}, {'$set': {'status': 'Closed'}})
    pool = main.get_superadmin_candidate_pool(search=None, source=None, vendor=None, skill=None, current_user=user)
    applications = [app for candidate in pool['candidates'] for app in candidate['applications']]
    assert len(applications) == 2
    assert all(app['requisition_status'] == 'Closed' for app in applications)
    assert all(not app['requisition_deleted'] for app in applications)
