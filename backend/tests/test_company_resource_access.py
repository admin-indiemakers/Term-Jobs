from types import SimpleNamespace
import importlib
import mongomock
import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from modules.onboarding.access import application_scope, require_application
from modules.interview.access import authorize_round


@pytest.fixture
def database():
    db = mongomock.MongoClient().isolation
    db.requisitions.insert_many([
        {'id': 'req-a', 'tenant_id': 'company-a', 'created_by': 'hm-a'},
        {'id': 'req-b', 'tenant_id': 'company-b', 'created_by': 'hm-b'},
    ])
    db.candidate_submissions.insert_many([
        {'id': 'sub-a', 'requisition_id': 'req-a', 'candidate_email': 'same@example.com'},
        {'id': 'sub-b', 'requisition_id': 'req-b', 'candidate_email': 'same@example.com'},
    ])
    for collection in ('onboarding_checklists', 'onboarding_issues'):
        db[collection].insert_many([
            {'id': 'a', 'candidate_id': 'sub-a'},
            {'id': 'b', 'candidate_id': 'sub-b'},
        ])
    db.interview_rounds.insert_one({'id': 'round-a', 'tenant_id': 'company-a', 'requisition_id': 'req-a',
        'candidate_token': 'candidate-secret', 'interviewer_token': 'staff-secret'})
    return db


def actor(role='Hiring Manager', tenant='company-a', id='hm-a'):
    return {'id': id, 'tenant_id': tenant, 'role': role, 'email': 'manager@example.com'}


@pytest.mark.parametrize('role', ['Hiring Manager', 'Admin', 'HR', 'Director'])
def test_onboarding_scope_never_contains_other_company(database, role):
    assert application_scope(database, actor(role)) == {'candidate_id': {'$in': ['sub-a']}}
    with pytest.raises(HTTPException):
        require_application(database, actor(role), 'sub-b')


def test_missing_identity_fails_closed(database):
    with pytest.raises(HTTPException) as error:
        application_scope(database, None)
    assert error.value.status_code == 401
    with pytest.raises(HTTPException):
        application_scope(database, actor(tenant=None))


@pytest.fixture
def onboarding_client(monkeypatch, database):
    router = importlib.import_module('modules.onboarding.router')
    monkeypatch.setattr(router, 'db', database)
    monkeypatch.setattr(router, '_get_current_user', lambda header: actor('Admin') if header == 'Bearer company-a' else None)
    from modules.shared.cache import cache
    cache.clear()
    app = FastAPI()
    app.include_router(router.router)
    return TestClient(app)


def test_onboarding_http_requires_auth_and_scopes_lists(onboarding_client):
    client = onboarding_client
    assert client.get('/api/onboarding').status_code == 401
    assert client.get('/api/onboarding/issues').status_code == 401
    headers = {'Authorization': 'Bearer company-a'}
    assert [r['id'] for r in client.get('/api/onboarding', headers=headers).json()] == ['a']
    assert [r['id'] for r in client.get('/api/onboarding/issues', headers=headers).json()] == ['a']
    assert client.get('/api/onboarding/sub-b', headers=headers).status_code == 403
    assert client.post('/api/onboarding/issues/b/resolve', headers=headers).status_code == 403


def test_forged_superadmin_role_cannot_escape_onboarding_assistant(onboarding_client, monkeypatch):
    from modules.requisition.llm.groq import GroqClient
    monkeypatch.setattr(GroqClient, 'generate_text', lambda *args, **kwargs: 'Scoped response')
    response = onboarding_client.post('/api/onboarding/assistant', headers={'Authorization': 'Bearer company-a'},
        json={'prompt': 'audit every company', 'user_role': 'Super Admin'})
    assert response.status_code == 200
    assert [i['id'] for i in response.json()['issues']] == ['a']


def test_round_access_checks_company_and_exact_invitation(database):
    doc = database.interview_rounds.find_one({'id': 'round-a'})
    assert authorize_round(database, doc, SimpleNamespace(**actor())) == 'interviewer'
    for user in [None, SimpleNamespace(**actor(tenant='company-b', id='hm-b'))]:
        with pytest.raises(HTTPException):
            authorize_round(database, doc, user)
    assert authorize_round(database, doc, invitation='candidate-secret') == 'candidate'
    with pytest.raises(HTTPException):
        authorize_round(database, doc, invitation='another-round-secret')


def test_interview_http_blocks_anonymous_round_data_and_recordings(monkeypatch, database):
    router = importlib.import_module('modules.interview.router')
    monkeypatch.setattr(router, 'db', database)
    app = FastAPI()
    app.include_router(router.router)
    client = TestClient(app)
    for suffix in ['', '/recording', '/chat', '/communication-analysis']:
        assert client.get('/interviews/rounds/round-a' + suffix).status_code == 403
    monkeypatch.setattr(router, 'get_round_by_id', lambda _: {'id': 'round-a', 'candidate_token': 'secret', 'interviewer_token': 'other-secret'})
    response = client.get('/interviews/rounds/round-a?token=candidate-secret')
    assert response.status_code == 200
    assert 'candidate_token' not in response.json()
    assert 'interviewer_token' not in response.json()


def test_workorder_http_rejects_foreign_ids_and_filters_autofill(monkeypatch, database):
    router = importlib.import_module('modules.workorder.router')
    monkeypatch.setattr(router, 'db', database)
    database.work_orders.insert_many([
        {'id': 'wo-a', 'workorder_id': 'sub-a', 'candidate_id': 'sub-a', 'tenant_id': 'company-a', 'requisition_id': 'req-a'},
        {'id': 'wo-b', 'workorder_id': 'sub-b', 'candidate_id': 'sub-b', 'tenant_id': 'company-b', 'requisition_id': 'req-b'},
    ])
    app = FastAPI()
    app.include_router(router.router)
    app.dependency_overrides[router.get_current_user] = lambda: SimpleNamespace(**actor('Admin'))
    client = TestClient(app)
    assert client.get('/api/work-orders/wo-b').status_code == 403
    assert client.put('/api/work-orders/wo-b', json={}).status_code == 403
    assert client.get('/api/work-orders/agreement-details/sub-b').status_code == 403
    assert client.post('/api/work-orders/sub-b/director-approve').status_code == 403
    response = client.get('/api/work-orders/available-workorders')
    assert response.status_code == 200
    assert [r['workorder_id'] for r in response.json()] == ['sub-a']


def test_superadmin_agent_http_requires_verified_superadmin(monkeypatch):
    router = importlib.import_module('modules.superadmin_agent.router')
    app = FastAPI()
    app.include_router(router.router)
    client = TestClient(app)
    assert client.get('/api/superadmin/agent/stats').status_code == 401
    assert client.post('/api/superadmin/agent/chat', json={'prompt': 'list all companies', 'user_role': 'Super Admin'}).status_code == 401
    app.dependency_overrides[router.get_current_user] = lambda: SimpleNamespace(**actor('Admin'))
    assert client.get('/api/superadmin/agent/stats').status_code == 403
    assert client.post('/api/superadmin/agent/chat', json={'prompt': 'list all companies'}).status_code == 403


def test_email_alone_is_not_an_interview_portal_credential(monkeypatch, database):
    persistence = importlib.import_module('modules.shared.db')
    monkeypatch.setattr(persistence, 'db', database)
    from modules.interview.services.interview_service import get_candidate_rounds_by_token, get_interviewer_rounds_by_token
    database.interview_rounds.update_one({'id': 'round-a'}, {'$set': {'candidate_email': 'same@example.com', 'interviewer_email': 'staff@example.com'}})
    assert get_candidate_rounds_by_token('same@example.com') == []
    assert get_interviewer_rounds_by_token('staff@example.com') == []
    candidate_rows = get_candidate_rounds_by_token('candidate-secret')
    assert [r['id'] for r in candidate_rows] == ['round-a']
    assert 'interviewer_token' not in candidate_rows[0]


def test_company_admin_agent_rejects_client_supplied_company_identity():
    router = importlib.import_module('modules.company_admin_agent.router')
    app = FastAPI()
    app.include_router(router.router)
    client = TestClient(app)
    response = client.post('/api/company-admin/agent/chat', json={'prompt': 'show company candidates',
        'current_user': {'id': 'fake', 'tenant_id': 'company-b', 'role': 'Admin'}})
    assert response.status_code == 401
    assert client.get('/api/company-admin/agent/stats').status_code == 401


def test_invite_login_does_not_return_another_company_round_for_same_email(monkeypatch, database):
    persistence = importlib.import_module('modules.shared.db')
    monkeypatch.setattr(persistence, 'db', database)
    from modules.interview.services.interview_service import authenticate_candidate_login
    database.interview_rounds.update_one({'id': 'round-a'}, {'$set': {
        'candidate_email': 'same@example.com', 'status': 'Completed', 'candidate_passcode': 'PASS-A',
    }})
    database.interview_rounds.insert_one({'id': 'round-b', 'requisition_id': 'req-b', 'tenant_id': 'company-b',
        'candidate_email': 'same@example.com', 'candidate_token': 'foreign-invite', 'candidate_passcode': 'PASS-B', 'status': 'Completed'})
    result = authenticate_candidate_login('same@example.com', token='candidate-secret')
    assert result['candidate_token'] == 'candidate-secret'
    assert result['requisition_id'] == 'req-a'
    assert result['rounds_count'] == 1
    result = authenticate_candidate_login('same@example.com', passcode='PASS-B')
    assert result['candidate_token'] == 'foreign-invite'
    assert result['rounds_count'] == 1


def test_recording_credential_cannot_authorize_other_round_or_chat(monkeypatch, database):
    router = importlib.import_module('modules.interview.router')
    monkeypatch.setattr(router, 'db', database)
    app = FastAPI()
    app.include_router(router.router)
    client = TestClient(app)
    access = client.get('/interviews/rounds/round-a/recording-access?token=candidate-secret')
    assert access.status_code == 200
    media_token = access.json()['media_token']
    from modules.identity.services.auth_service import decode_access_token
    assert 'sub' not in decode_access_token(media_token)
    monkeypatch.setattr(router, 'get_round_recording', lambda _: {'bytes': b'video', 'content_type': 'video/webm'})
    assert client.get('/interviews/rounds/round-a/recording', params={'media_token': media_token}).status_code == 200
    database.interview_rounds.insert_one({'id': 'other-round', 'tenant_id': 'company-b', 'requisition_id': 'req-b'})
    assert client.get('/interviews/rounds/other-round/recording', params={'media_token': media_token}).status_code == 403
    assert client.get('/interviews/rounds/round-a/chat', params={'media_token': media_token}).status_code == 403


def test_candidate_can_prepare_questions_after_detail_redacts_tokens(monkeypatch, database):
    persistence = importlib.import_module('modules.shared.db')
    monkeypatch.setattr(persistence, 'db', database)
    router = importlib.import_module('modules.interview.router')
    monkeypatch.setattr(router, 'db', database)
    database.requisitions.update_one({'id': 'req-a'}, {'$set': {'structured_role': {'must_have_skills': ['Python']}}})
    database.candidate_submissions.update_one({'id': 'sub-a'}, {'$set': {'resume_text': 'Built Python APIs and owned production deployments.'}})
    database.interview_rounds.update_one({'id': 'round-a'}, {'$set': {'candidate_submission_id': 'sub-a', 'candidate_email': 'same@example.com'}})
    app = FastAPI()
    app.include_router(router.router)
    client = TestClient(app)
    response = client.get('/interviews/rounds/round-a/questions?token=candidate-secret')
    assert response.status_code == 200
    assert len(response.json()['questions']) == 4
    assert client.get('/interviews/rounds/round-a/questions?token=wrong-invitation').status_code == 403
