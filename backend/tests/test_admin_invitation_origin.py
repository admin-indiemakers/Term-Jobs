import importlib
from types import SimpleNamespace
from urllib.parse import parse_qs, urlsplit
from unittest.mock import Mock

import mongomock
import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from modules.interview.domain import invitation_origin
from modules.candidate import admin_interview_service
from modules.interview.services import interview_service


@pytest.fixture
def environment(monkeypatch):
    for key in ('VERCEL', 'VERCEL_BRANCH_URL', 'VERCEL_URL', 'FRONTEND_BASE_URL', 'INTERVIEW_PUBLIC_DOMAIN'):
        monkeypatch.delenv(key, raising=False)
    monkeypatch.setattr(invitation_origin, 'is_dev_qa_environment', lambda: True)
    monkeypatch.setenv('INTERVIEW_PUBLIC_DOMAIN', 'https://termjobs.in')


def test_qa_uses_its_own_deployment_instead_of_production(environment, monkeypatch):
    monkeypatch.setenv('VERCEL', '1')
    monkeypatch.setenv('VERCEL_BRANCH_URL', 'termjobs-git-qa-team.vercel.app')
    monkeypatch.setenv('VERCEL_URL', 'termjobs-deployment-team.vercel.app')
    monkeypatch.setenv('FRONTEND_BASE_URL', 'http://localhost:5173')
    assert invitation_origin.resolve_admin_invitation_origin('https://termjobs-git-qa-team.vercel.app') == 'https://termjobs-git-qa-team.vercel.app'
    with pytest.raises(HTTPException):
        invitation_origin.resolve_admin_invitation_origin('https://attacker.example')


def test_backend_deployment_url_is_not_used_as_a_frontend(environment, monkeypatch):
    monkeypatch.setenv('VERCEL', '1')
    monkeypatch.setenv('VERCEL_URL', 'term-jobs-backend.vercel.app')
    monkeypatch.setenv('FRONTEND_BASE_URL', 'https://qa.termjobs.in')
    assert invitation_origin.resolve_admin_invitation_origin() == 'https://qa.termjobs.in'


def test_configured_frontend_and_localhost_stay_with_their_database(environment, monkeypatch):
    monkeypatch.setenv('FRONTEND_BASE_URL', 'https://qa.termjobs.in/dashboard/admin')
    assert invitation_origin.resolve_admin_invitation_origin('https://qa.termjobs.in') == 'https://qa.termjobs.in'
    monkeypatch.setenv('FRONTEND_BASE_URL', 'http://localhost:5173')
    assert invitation_origin.resolve_admin_invitation_origin('http://localhost:5173') == 'http://localhost:5173'
    assert invitation_origin.resolve_admin_invitation_origin('http://localhost:5174') == 'http://localhost:5174'


def test_production_stays_on_official_domain(environment, monkeypatch):
    monkeypatch.setattr(invitation_origin, 'is_dev_qa_environment', lambda: False)
    monkeypatch.setenv('VERCEL_URL', 'termjobs-git-qa-team.vercel.app')
    assert invitation_origin.resolve_admin_invitation_origin('https://attacker.example') == 'https://termjobs.in'


@pytest.mark.parametrize('frontend', ['', 'https://termjobs.in', 'https://www.termjobs.in', 'javascript:alert(1)', 'https://user:secret@evil.example'])
def test_qa_does_not_silently_mail_a_production_or_invalid_link(environment, monkeypatch, frontend):
    monkeypatch.setenv('FRONTEND_BASE_URL', frontend)
    with pytest.raises(HTTPException) as error:
        invitation_origin.resolve_admin_invitation_origin('https://attacker.example')
    assert error.value.status_code == 409


@pytest.mark.parametrize('frontend', ['https://qa.termjobs.in', 'http://localhost:5173'])
def test_real_email_link_loads_room_anonymously_in_the_owning_environment(environment, monkeypatch, frontend):
    from modules.candidate import router as candidates
    from modules.interview import router as interviews
    from modules.identity.router import get_current_user
    from modules.shared.db import Session

    qa = mongomock.MongoClient().qa
    production = mongomock.MongoClient().production
    monkeypatch.setenv('FRONTEND_BASE_URL', frontend)
    monkeypatch.setenv('VERCEL_ENV', 'preview')
    monkeypatch.setattr(importlib.import_module('modules.shared.db'), 'db', qa)
    monkeypatch.setattr(interviews, 'db', qa)
    monkeypatch.setattr(interview_service, 'get_session', lambda: Session(qa))
    sender = Mock(return_value={'status': 'success'})
    monkeypatch.setattr(importlib.import_module('modules.candidate_screening_agent.services.email_service'), 'send_email_via_gmail', sender)
    qa.requisitions.insert_one({'id': 'req', 'status': 'Published', 'title': 'Engineer'})
    qa.candidate_submissions.insert_one({'id': 'sub', 'requisition_id': 'req', 'candidate_name': 'Candidate', 'candidate_email': 'candidate@example.test', 'status': 'Submitted'})
    app = FastAPI()
    app.include_router(candidates.router, prefix='/api')
    app.include_router(interviews.router, prefix='/api')
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id='admin', role='Super Admin')
    client = TestClient(app, base_url=frontend)
    response = client.post('/api/candidates/sub/email-ai-interview', json={'requisition_id': 'req'}, headers={'Origin': frontend})
    assert response.status_code == 200, response.text
    saved = qa.interview_rounds.find_one({'id': response.json()['round_id']})
    assert production.interview_rounds.count_documents({}) == 0
    from modules.interview.domain.links import candidate_interview_link
    link = candidate_interview_link(saved, frontend)
    html = sender.call_args.args[2]
    assert link in html
    assert 'https://termjobs.in/interview/' not in html
    parsed = urlsplit(link)
    token = parse_qs(parsed.query)['token'][0]
    room = client.get(f'/api/interviews/rounds/{saved["id"]}', params={'token': token})
    assert room.status_code == 200, room.text
    assert room.json()['id'] == saved['id']
    assert room.json()['candidate_name'] == 'Candidate'
    # The fix preserves isolation: production still cannot read this QA-only room.
    monkeypatch.setattr(interviews, 'db', production)
    missing = client.get(f'/api/interviews/rounds/{saved["id"]}', params={'token': token})
    assert missing.status_code == 404


def test_local_email_template_preserves_the_explicit_environment(environment, monkeypatch):
    sender = Mock(return_value={'status': 'success'})
    monkeypatch.setattr(importlib.import_module('modules.candidate_screening_agent.services.email_service'), 'send_email_via_gmail', sender)
    link = 'http://localhost:5173/interview/ai/round?role=candidate&token=invitation'
    interview_service.send_interview_invitation_email(
        candidate_name='Candidate', candidate_email='candidate@example.test', requisition_title='Engineer',
        company_name='Company', round_name='AI Interview', scheduled_date='2026-11-05', scheduled_time='On demand',
        duration_minutes=45, meeting_link=link, candidate_portal_link=link, passcode='pass', public_origin='http://localhost:5173',
    )
    assert link in sender.call_args.args[2]


def test_unconfigured_environment_does_not_create_an_unusable_attempt(environment, monkeypatch):
    database = mongomock.MongoClient().db
    monkeypatch.setattr(importlib.import_module('modules.shared.db'), 'db', database)
    database.requisitions.insert_one({'id': 'req', 'status': 'Published'})
    database.candidate_submissions.insert_one({'id': 'sub', 'requisition_id': 'req', 'candidate_email': 'candidate@example.test'})
    with pytest.raises(HTTPException):
        admin_interview_service.email_application_interview('sub', 'req', 'admin')
    assert database.interview_rounds.count_documents({}) == 0
