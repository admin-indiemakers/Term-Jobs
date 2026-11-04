from types import SimpleNamespace
from uuid import uuid4

import mongomock
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from modules.requisition import superadmin_router as posting
from modules.identity.router import get_current_user
from modules.identity.domain.models import User


@pytest.fixture
def setup(monkeypatch):
    database = mongomock.MongoClient().db
    monkeypatch.setattr(posting, 'db', database)
    app = FastAPI()
    app.include_router(posting.router)
    user = User(id='admin', tenant_id='platform', role='Super Admin', name='Admin')
    app.dependency_overrides[get_current_user] = lambda: user
    return database, app, TestClient(app), user


def payload(**changes):
    return dict(client_request_id=str(uuid4()), company_name='Asimovx Technology AB', title='Marketing Specialist',
                department='Sales', location='Kozhikode', work_mode='On-site', experience='3–5 years',
                duration='6 months', headcount=1, start_date='November 2099', submission_deadline='2099-11-10',
                skills=['SEO', 'Google Ads'], job_description='Build digital campaigns for our client.', **changes)


def test_publish_creates_public_company_role_without_touching_other_tenants(setup):
    database, _, client, _ = setup
    database.company_profiles.insert_one({'id': 'other-company', 'tenant_id': 'client', 'name': 'Asimovx Technology AB'})
    response = client.post('/api/superadmin/requisitions', json=payload())
    assert response.status_code == 201, response.text
    result = response.json()
    row = database.requisitions.find_one({'id': result['id']})
    assert row['status'] == 'Published'
    assert row['tenant_id'] == 'platform'
    assert row['company_profile_id'] != 'other-company'
    assert row['structured_role']['work_mode'] == 'On-site'
    assert row['generated_jd_markdown'] == 'Build digital campaigns for our client.'
    assert row['structured_role']['submission_deadline'] == '2099-11-10'
    profile = database.company_profiles.find_one({'id': row['company_profile_id']})
    assert profile['name'] == 'Asimovx Technology AB'
    assert database.company_profiles.find_one({'id': 'other-company'})['tenant_id'] == 'client'
    assert client.get('/api/superadmin/requisitions').json()[0]['company_name'] == profile['name']


def test_retry_creates_one_requisition(setup):
    database, _, client, _ = setup
    body = payload()
    first = client.post('/api/superadmin/requisitions', json=body).json()
    second = client.post('/api/superadmin/requisitions', json=body).json()
    assert first['id'] == second['id']
    assert database.requisitions.count_documents({}) == 1
    assert database.company_profiles.count_documents({}) == 1


@pytest.mark.parametrize('field,value', [('company_name', '  '), ('work_mode', ''), ('submission_deadline', ''), ('submission_deadline', '2000-01-01'), ('job_description', ''), ('skills', [' ']), ('headcount', 0)])
def test_invalid_posting_cannot_publish(setup, field, value):
    database, _, client, _ = setup
    body = payload()
    body[field] = value
    assert client.post('/api/superadmin/requisitions', json=body).status_code == 422
    assert database.requisitions.count_documents({}) == 0


@pytest.mark.parametrize('role', ['Hiring Manager', 'Admin', 'Recruiter', 'Candidate'])
def test_only_superadmin_can_manage_postings(setup, role):
    database, app, client, _ = setup
    app.dependency_overrides[get_current_user] = lambda: User(id='other', tenant_id='other', role=role)
    for method, path, kwargs in [('get', '', {}), ('post', '', {'json': payload()}), ('get', '/req/applicants', {}), ('post', '/req/close', {})]:
        assert getattr(client, method)('/api/superadmin/requisitions' + path, **kwargs).status_code == 403
    assert database.requisitions.count_documents({}) == 0


def test_applicants_are_scoped_and_in_shared_candidate_pool(setup, monkeypatch):
    import importlib
    shared_db = importlib.import_module("modules.shared.db")
    import main
    database, _, client, user = setup
    monkeypatch.setattr(shared_db, 'db', database)
    req_id = client.post('/api/superadmin/requisitions', json=payload()).json()['id']
    database.candidate_submissions.insert_many([
        {'id': 'applicant', 'requisition_id': req_id, 'candidate_name': 'Candidate', 'candidate_email': 'person@example.com',
         'vendor_name': 'Direct Applicant', 'resume_pdf': 'private-file', 'details': {'candidate_phone': '123'}, 'status': 'Submitted'},
        {'id': 'other-applicant', 'requisition_id': 'other', 'candidate_email': 'other@example.com'},
    ])
    applicants = client.get(f'/api/superadmin/requisitions/{req_id}/applicants').json()
    assert [row['id'] for row in applicants] == ['applicant']
    assert applicants[0]['has_resume'] is True
    assert 'resume_pdf' not in applicants[0]
    assert client.get('/api/superadmin/requisitions').json()[0]['applicants_count'] == 1
    pool = main.get_superadmin_candidate_pool(search=None, source=None, vendor=None, skill=None, current_user=user)
    candidate = next(row for row in pool['candidates'] if row['candidate_email'] == 'person@example.com')
    assert candidate['has_resume'] is True
    assert candidate['applications'][0]['requisition_id'] == req_id
    assert candidate['applications'][0]['company_name'] == 'Asimovx Technology AB'
    assert client.post(f'/api/superadmin/requisitions/{req_id}/close').status_code == 200
    assert database.requisitions.find_one({'id': req_id})['status'] == 'Closed'
    assert len(client.get(f'/api/superadmin/requisitions/{req_id}/applicants').json()) == 1


def test_cannot_read_or_close_unmanaged_requisition(setup):
    database, _, client, _ = setup
    database.requisitions.insert_one({'id': 'client-owned', 'status': 'Published'})
    assert client.get('/api/superadmin/requisitions/client-owned/applicants').status_code == 404
    assert client.post('/api/superadmin/requisitions/client-owned/close').status_code == 404
    assert database.requisitions.find_one({'id': 'client-owned'})['status'] == 'Published'


def test_posting_is_visible_on_public_board_with_correct_company(setup, monkeypatch):
    from contextlib import contextmanager
    from modules.shared.db import Session
    import main
    database, _, client, _ = setup
    req_id = client.post('/api/superadmin/requisitions', json=payload()).json()['id']
    @contextmanager
    def session_factory():
        yield Session(database=database)
    monkeypatch.setattr(main, 'get_session', session_factory)
    monkeypatch.setattr(main, '_auto_close_expired', lambda: None)
    main._cache.clear()
    listings = main.list_public_requisitions()
    assert len(listings) == 1
    assert listings[0]['id'] == req_id
    assert listings[0]['company_name'] == 'Asimovx Technology AB'
    detail = main.get_public_requisition(req_id)
    assert detail['generated_jd_markdown'] == 'Build digital campaigns for our client.'
    assert detail['structured_role']['work_mode'] == 'On-site'
    assert detail['structured_role']['location'] == 'Kozhikode'
    main._cache.clear()


def test_public_application_to_managed_posting_saves_resume_in_pool(setup, monkeypatch):
    import asyncio
    import base64
    import importlib
    from contextlib import contextmanager
    from modules.shared.db import Session
    from modules.candidate import telegram_service, outreach_service
    import main
    database, _, client, user = setup
    monkeypatch.setattr(importlib.import_module('modules.shared.db'), 'db', database)
    @contextmanager
    def session_factory():
        yield Session(database=database)
    monkeypatch.setattr(main, 'get_session', session_factory)
    monkeypatch.setattr(telegram_service, 'get_telegram_bot_username', lambda: 'test_bot')
    monkeypatch.setattr(outreach_service, 'create_candidate_application_outreach', lambda **kwargs: {})
    req_id = client.post('/api/superadmin/requisitions', json=payload()).json()['id']
    resume = base64.b64encode(b'%PDF original resume').decode()
    database.candidates.insert_one({'id': 'candidate', 'candidate_name': 'Candidate', 'candidate_email': 'person@example.com',
        'resume_pdf': resume, 'filename': 'resume.pdf', 'skills': ['SEO'], 'details': {}})
    result = asyncio.run(main.apply_to_requisition(req_id, name='Candidate', email='person@example.com', phone='',
        linkedin_url='', github_url='', cover_note='', resume=None))
    assert result['status'] == 'success'
    applicants = client.get(f'/api/superadmin/requisitions/{req_id}/applicants').json()
    assert len(applicants) == 1 and applicants[0]['has_resume']
    candidate = database.candidates.find_one({'candidate_email': 'person@example.com'})
    assert candidate['resume_pdf'] == resume
    pool = main.get_superadmin_candidate_pool(search=None, source=None, vendor=None, skill=None, current_user=user)
    assert len(pool['candidates']) == 1
    assert pool['candidates'][0]['applications'][0]['requisition_id'] == req_id
    assert pool['candidates'][0]['has_resume']


def test_edit_preserves_applicants_status_and_updates_public_fields(setup):
    database, _, client, _ = setup
    body = payload()
    req_id = client.post('/api/superadmin/requisitions', json=body).json()['id']
    original = database.requisitions.find_one({'id': req_id})
    database.candidate_submissions.insert_one({'id': 'application', 'requisition_id': req_id})
    database.requisitions.update_one({'id': req_id}, {'$set': {'status': 'Closed', 'structured_role.extra': 'preserved'}})
    body.pop('client_request_id')
    body.update(company_name='New Client', title='Updated Role', work_mode='Hybrid', job_description='Updated summary', submission_deadline='2099-11-12')
    response = client.put(f'/api/superadmin/requisitions/{req_id}', json=body)
    assert response.status_code == 200, response.text
    assert response.json()['applicants_count'] == 1
    row = database.requisitions.find_one({'id': req_id})
    assert row['status'] == 'Closed'
    assert row['created_at'] == original['created_at']
    assert row['tenant_id'] == original['tenant_id']
    assert row['structured_role']['extra'] == 'preserved'
    assert row['structured_role']['work_mode'] == 'Hybrid'
    assert row['structured_role']['submission_deadline'] == '2099-11-12'
    assert row['generated_jd_markdown'] == row['intent']['description'] == row['structured_role']['job_description'] == 'Updated summary'
    assert row['title'] == row['intent']['title'] == row['structured_role']['title'] == 'Updated Role'
    assert database.company_profiles.find_one({'id': row['company_profile_id']})['name'] == 'New Client'
    assert database.company_profiles.find_one({'id': original['company_profile_id']})['name'] == original['company_name']
    assert database.requisitions.count_documents({}) == 1


def test_edit_rejects_invalid_details_and_unmanaged_roles(setup):
    database, _, client, _ = setup
    body = payload()
    req_id = client.post('/api/superadmin/requisitions', json=body).json()['id']
    body.pop('client_request_id')
    assert client.put('/api/superadmin/requisitions/missing', json=body).status_code == 404
    database.requisitions.insert_one({'id': 'unmanaged'})
    assert client.put('/api/superadmin/requisitions/unmanaged', json=body).status_code == 404
    body['work_mode'] = ''
    assert client.put(f'/api/superadmin/requisitions/{req_id}', json=body).status_code == 422
    assert database.requisitions.find_one({'id': req_id})['structured_role']['work_mode'] == 'On-site'


@pytest.mark.parametrize('role', ['Hiring Manager', 'Admin', 'Recruiter', 'Candidate'])
def test_edit_requires_superadmin(setup, role):
    _, app, client, _ = setup
    app.dependency_overrides[get_current_user] = lambda: User(id='other', tenant_id='other', role=role)
    body = payload()
    body.pop('client_request_id')
    assert client.put('/api/superadmin/requisitions/req', json=body).status_code == 403
