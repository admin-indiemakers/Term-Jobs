import importlib
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import Mock

import mongomock
import pytest
from fastapi import HTTPException

from modules.candidate import admin_interview_service as service
from modules.candidate.router import email_ai_interview, direct_shortlist_candidate


@pytest.fixture
def setup(monkeypatch):
    db = mongomock.MongoClient().db
    monkeypatch.setattr(importlib.import_module('modules.shared.db'), 'db', db)
    sender = Mock(return_value={'status': 'success'})
    monkeypatch.setattr(service, 'send_interview_invitation_email', sender)
    monkeypatch.setattr(service, 'resolve_admin_invitation_origin', lambda origin=None: 'https://termjobs.test')
    db.requisitions.insert_one({'id': 'req', 'status': 'Published', 'title': 'Engineer', 'tenant_id': 'company'})
    db.candidate_submissions.insert_one({'id': 'sub', 'requisition_id': 'req', 'candidate_email': 'candidate@example.test', 'candidate_name': 'Candidate', 'status': 'Submitted', 'match_score': 55})
    return db, sender, SimpleNamespace(id='admin', role='Super Admin')


def invite(user, req='req'):
    return email_ai_interview('sub', {'requisition_id': req}, user)


def test_creates_same_flow_with_authenticated_ai_link_and_refresh_metadata(setup):
    db, sender, user = setup
    result = invite(user)
    row = db.interview_rounds.find_one({'id': result['round_id']})
    assert row['round_type'] == 'AI' and row['status'] == 'Scheduled'
    assert row['candidate_submission_id'] == 'sub'
    assert row['candidate_token'] in sender.call_args.kwargs['meeting_link']
    assert f'/interview/ai/{row["id"]}?' in sender.call_args.kwargs['meeting_link']
    assert db.candidate_submissions.find_one({'id': 'sub'})['status'] == 'Submitted'
    import main
    pool = main.get_superadmin_candidate_pool(current_user=user)
    application = pool['candidates'][0]['applications'][0]
    assert application['resume_match_score'] == 55
    assert application['ai_interview_status'] == 'Scheduled'
    assert application['ai_invitation_sent_at']
    assert 'candidate_token' not in application


def test_resend_reuses_attempt_and_token_and_blocks_double_send(setup):
    db, sender, user = setup
    first = invite(user)
    with pytest.raises(HTTPException) as error:
        invite(user)
    assert error.value.status_code == 409
    assert sender.call_count == 1
    original = db.interview_rounds.find_one({'id': first['round_id']})
    db.interview_rounds.update_one({'id': first['round_id']}, {'$set': {'admin_invite_sent_at': datetime.now(timezone.utc) - timedelta(minutes=2)}})
    assert invite(user)['round_id'] == first['round_id']
    assert db.interview_rounds.count_documents({}) == 1
    assert db.interview_rounds.find_one({})['candidate_token'] == original['candidate_token']


@pytest.mark.parametrize('status', ['Completed', 'Evaluated', 'In Progress', 'Live'])
def test_existing_attempt_not_reopened(setup, status):
    db, sender, user = setup
    db.interview_rounds.insert_one({'id': 'existing', 'requisition_id': 'req', 'candidate_submission_id': 'sub', 'round_type': 'AI', 'status': status})
    with pytest.raises(HTTPException) as error:
        invite(user)
    assert error.value.status_code == 409
    sender.assert_not_called()
    assert db.interview_rounds.count_documents({}) == 1


@pytest.mark.parametrize('role', ['Candidate', 'Admin', 'Hiring Manager', 'Vendor'])
def test_invitation_is_superadmin_only(setup, role):
    db, sender, user = setup
    user.role = role
    with pytest.raises(HTTPException) as error:
        invite(user)
    assert error.value.status_code == 403
    sender.assert_not_called()
    assert db.interview_rounds.count_documents({}) == 0


def test_wrong_application_and_closed_role_are_blocked(setup):
    db, sender, user = setup
    with pytest.raises(HTTPException) as error:
        invite(user, 'other')
    assert error.value.status_code == 404
    db.requisitions.update_one({'id': 'req'}, {'$set': {'status': 'Closed'}})
    with pytest.raises(HTTPException) as error:
        invite(user)
    assert error.value.status_code == 409
    sender.assert_not_called()


def test_failed_email_is_not_reported_sent_and_can_be_retried(setup):
    db, sender, user = setup
    sender.return_value = {'status': 'failed', 'reason': 'Delivery failed'}
    with pytest.raises(HTTPException) as error:
        invite(user)
    assert error.value.status_code == 502
    row = db.interview_rounds.find_one({})
    assert not row.get('admin_invite_sent_at')
    assert row['email_delivery']['status'] == 'failed'
    sender.return_value = {'status': 'success'}
    assert invite(user)['round_id'] == row['id']


def test_ranking_preserves_manual_shortlist_and_resume_score_on_repeat(setup, monkeypatch):
    db, _, user = setup
    from modules.candidate import shortlist_service
    monkeypatch.setattr(shortlist_service, 'db', db)
    direct_shortlist_candidate('sub', {'requisition_id': 'req'}, user)
    # Another candidate exercises the composite score without interview bypass.
    db.candidate_submissions.insert_one({'id': 'interviewed', 'requisition_id': 'req', 'candidate_email': 'other@example.test', 'match_score': 50, 'status': 'Screened'})
    db.interview_rounds.insert_one({'id': 'done', 'requisition_id': 'req', 'candidate_submission_id': 'interviewed', 'status': 'Completed', 'communication_analysis': {'overall_score': 100}})
    for _ in range(2):
        shortlist_service.generate_and_rank_requisition_shortlist('req')
        manual = db.candidate_submissions.find_one({'id': 'sub'})
        assert manual['status'] == 'Shortlisted' and manual['manual_shortlist']
        assert manual['resume_match_score'] == 55
        interviewed = db.candidate_submissions.find_one({'id': 'interviewed'})
        assert interviewed['match_score'] == 50
        assert interviewed['resume_match_score'] == 50
        assert interviewed['composite_score'] == 80


def test_direct_shortlist_visible_to_own_hiring_manager_without_interview(setup):
    db, _, user = setup
    from modules.candidate.router import list_shortlisted
    db.requisitions.update_one({'id': 'req'}, {'$set': {'created_by': 'hm'}})
    direct_shortlist_candidate('sub', {'requisition_id': 'req'}, user)
    manager = SimpleNamespace(id='hm', role='Hiring Manager', tenant_id='company')
    assert [row['id'] for row in list_shortlisted(manager)] == ['sub']
    other = SimpleNamespace(id='other', role='Hiring Manager', tenant_id='company')
    assert list_shortlisted(other) == []


def test_legacy_blended_score_is_not_relabelled_as_resume_fit(setup, monkeypatch):
    db, _, user = setup
    from modules.candidate import shortlist_service
    monkeypatch.setattr(shortlist_service, 'db', db)
    db.candidate_submissions.update_one({'id': 'sub'}, {'$set': {'interview_score': 80, 'match_score': 70}})
    shortlist_service.generate_and_rank_requisition_shortlist('req')
    import main
    application = main.get_superadmin_candidate_pool(current_user=user)['candidates'][0]['applications'][0]
    assert application['resume_match_score'] is None
    assert application['match_score'] == 70


def test_invitation_route_is_registered_and_authenticated(setup):
    import main
    from fastapi.testclient import TestClient
    from modules.identity.router import get_current_user
    _, sender, user = setup
    previous = main.app.dependency_overrides.get(get_current_user)
    main.app.dependency_overrides[get_current_user] = lambda: user
    try:
        response = TestClient(main.app).post('/api/candidates/sub/email-ai-interview', json={'requisition_id': 'req'})
        assert response.status_code == 200, response.text
        sender.assert_called_once()
    finally:
        if previous is None:
            main.app.dependency_overrides.pop(get_current_user, None)
        else:
            main.app.dependency_overrides[get_current_user] = previous
