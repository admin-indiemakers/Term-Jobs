import importlib
from types import SimpleNamespace

import mongomock
import pytest
from fastapi import HTTPException

from modules.shared.db import Session
from modules.interview import router
from modules.interview.services import company_schedule
from modules.requisition.domain.models import Requisition
from modules.candidate.domain.models import CandidateSubmission
from modules.identity.domain.models import User


@pytest.fixture
def setup(monkeypatch):
    database = mongomock.MongoClient()['interview-ui']
    factory = lambda: Session(database)
    monkeypatch.setattr(router, 'db', database)
    monkeypatch.setattr(router, 'get_session', factory)
    monkeypatch.setattr(company_schedule, 'get_session', factory)
    actor = SimpleNamespace(id='hm', tenant_id='company', role='Hiring Manager', name='Manager', email='hm@example.com')
    with factory() as session:
        session.add(Requisition(id='req-1', tenant_id='company', created_by='hm'))
        session.add(Requisition(id='req-2', tenant_id='company', created_by='hm'))
        session.add(User(id='staff', tenant_id='company', role='HR', name='Real Staff', email='staff@example.com', is_active=True))
        session.add(User(id='foreign', tenant_id='other', role='HR', name='Other Staff', email='other@example.com', is_active=True))
        session.commit()
    return database, factory, actor


def test_interview_process_is_persisted_per_requisition(setup):
    _, _, actor = setup
    router.save_interview_process_template({'requisition_id': 'req-1', 'template': 'custom', 'rounds': [{'id': 'r1', 'title': 'HR'}]}, actor)
    assert router.get_interview_process_template('req-1', actor)['rounds'][0]['title'] == 'HR'
    assert router.get_interview_process_template('req-2', actor)['is_saved'] is False
    with pytest.raises(HTTPException):
        router.get_interview_process_template('req-1', SimpleNamespace(**{**actor.__dict__, 'tenant_id': 'other'}))


def test_interviewers_are_real_company_accounts(setup):
    _, _, actor = setup
    people = router.get_interviewers_list(actor)['interviewers']
    assert [person['email'] for person in people] == ['staff@example.com']


def test_http_routes_load_process_and_interviewers_without_generic_lookup(setup):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from modules.identity.router import get_current_user
    _, _, actor = setup
    app = FastAPI()
    app.include_router(router.router, prefix='/api')
    app.dependency_overrides[get_current_user] = lambda: actor
    client = TestClient(app)
    process = client.get('/api/interviews/process/template?requisition_id=req-1')
    assert process.status_code == 200
    assert process.json()['is_saved'] is False
    people = client.get('/api/interviews/interviewers')
    assert people.status_code == 200
    assert people.json()['interviewers'][0]['email'] == 'staff@example.com'


def test_unknown_round_cannot_generate_a_room(monkeypatch):
    monkeypatch.setattr(router, 'get_round_by_id', lambda _: None)
    with pytest.raises(HTTPException) as error:
        router.livekit_token_endpoint(SimpleNamespace(round_id='invented'))
    assert error.value.status_code == 404


def test_video_configuration_has_no_fake_credentials(monkeypatch):
    from modules.interview.services.interview_service import generate_livekit_token
    for key in ('LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET'):
        monkeypatch.delenv(key, raising=False)
    with pytest.raises(ValueError, match='not configured'):
        generate_livekit_token('room', 'identity', 'Candidate')


def test_saved_assessment_repairs_stale_status_and_keeps_review_after_expiry(setup, monkeypatch):
    database, factory, actor = setup
    from datetime import datetime, timezone, timedelta
    from modules.interview.domain.models import InterviewRound
    service = importlib.import_module('modules.interview.services.interview_service')
    monkeypatch.setattr(service, 'get_session', factory)
    with factory() as session:
        session.add(InterviewRound(id='finished', tenant_id='company', requisition_id='req-1', created_by='hm',
            status='In Progress', round_name='AI Interview', communication_analysis={'overall_score': 0, 'summary': 'Saved remarks'},
            transcript=[{'speaker': 'candidate', 'text': 'Saved answer'}], expires_at=datetime.now(timezone.utc) - timedelta(days=1)))
        session.commit()
    detail = service.get_round_by_id('finished')
    assert detail['status'] == 'Completed'
    assert detail['is_expired'] is True
    assert service.update_round_status('finished', 'In Progress')['status'] == 'Completed'
    review = service.get_round_communication_analysis('finished')
    assert review['analysis']['overall_score'] == 0
    assert review['transcript'][0]['text'] == 'Saved answer'
    assert review['remarks'] == 'Saved remarks'
    with factory() as session:
        assert session.get(InterviewRound, 'finished').status == 'Completed'


def test_partial_transcript_is_not_treated_as_completed(setup, monkeypatch):
    _, factory, _ = setup
    from modules.interview.domain.models import InterviewRound
    service = importlib.import_module('modules.interview.services.interview_service')
    monkeypatch.setattr(service, 'get_session', factory)
    with factory() as session:
        session.add(InterviewRound(id='partial', status='In Progress', transcript=[{'text': 'Partial answer'}]))
        session.commit()
    assert service.get_round_by_id('partial')['status'] == 'In Progress'
    assert service.get_round_by_id('nonexistent') is None


def test_scoring_failure_keeps_submitted_transcript_and_completion(setup, monkeypatch):
    import asyncio
    _, factory, _ = setup
    from modules.interview.domain.models import InterviewRound
    service = importlib.import_module('modules.interview.services.interview_service')
    assessment = importlib.import_module('modules.interview.services.assessment')
    monkeypatch.setattr(service, 'get_session', factory)
    monkeypatch.setattr(assessment, 'load_questions', lambda session, row: [])
    async def fail(*args):
        raise RuntimeError('Scoring temporarily unavailable')
    monkeypatch.setattr(assessment, 'evaluate_assessment', fail)
    with factory() as session:
        session.add(InterviewRound(id='submitted', status='In Progress', recording_url='/saved-video',
            recording_metadata={'size_bytes': 100, 'content_type': 'video/webm'}))
        session.commit()
    turns = [{'speaker': 'candidate', 'text': 'Final submitted answer'}]
    with pytest.raises(RuntimeError):
        asyncio.run(service.analyze_round_communication('submitted', transcript_turns=turns))
    with factory() as session:
        row = session.get(InterviewRound, 'submitted')
        assert row.status == 'Completed'
        assert row.transcript == turns
        assert row.evaluation['assessment_status'] == 'pending_review'


def test_real_round_creation_persists_room_and_candidate_access(setup, monkeypatch):
    database, factory, actor = setup
    service = importlib.import_module('modules.interview.services.interview_service')
    shared = importlib.import_module('modules.shared.db')
    monkeypatch.setattr(service, 'get_session', factory)
    monkeypatch.setattr(service, 'db', database)
    monkeypatch.setattr(shared, 'db', database)
    database.candidate_submissions.insert_one({'id': 'shortlisted', 'requisition_id': 'req-1', 'candidate_name': 'Real Candidate', 'candidate_email': 'candidate@example.com', 'status': 'Shortlisted'})
    result = service.create_interview_round({
        'candidate_submission_id': 'shortlisted', 'candidate_name': 'Real Candidate', 'candidate_email': 'candidate@example.com',
        'requisition_id': 'req-1', 'round_name': 'Technical Round', 'scheduled_date': '2099-01-05',
        'scheduled_time': '15:30', 'scheduled_timezone': 'Asia/Kolkata', 'duration_minutes': 45,
        'suppress_email': True, 'suppress_notifications': True,
    }, 'company', 'hm', origin='http://localhost:5173')
    from modules.interview.domain.models import InterviewRound
    with factory() as session:
        stored = session.get(InterviewRound, result['id'])
        assert stored.room_id
        assert stored.candidate_submission_id == 'shortlisted'
        assert f'token={stored.candidate_token}' in result['meeting_link']
        assert result['meeting_link'].startswith('https://termjobs.in/interview/room/')


def test_candidate_notes_persist_and_obey_access_rules(setup, monkeypatch):
    _, factory, actor = setup
    candidate_router = importlib.import_module('modules.candidate.router')
    monkeypatch.setattr(candidate_router, 'get_session', factory)
    with factory() as session:
        session.add(CandidateSubmission(id='submission', requisition_id='req-1', candidate_name='Real Candidate'))
        session.commit()
    result = candidate_router.add_candidate_note('submission', {'text': 'Saved feedback'}, actor)
    assert 'Manager: Saved feedback' in result['notes']
    with factory() as session:
        assert 'Saved feedback' in session.get(CandidateSubmission, 'submission').hiring_manager_notes
    other = SimpleNamespace(**{**actor.__dict__, 'id': 'other-hm', 'tenant_id': 'other'})
    with pytest.raises(HTTPException) as error:
        candidate_router.add_candidate_note('submission', {'text': 'Unauthorized'}, other)
    assert error.value.status_code == 403
