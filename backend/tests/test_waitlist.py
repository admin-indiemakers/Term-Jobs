from unittest.mock import Mock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from modules.waitlist import router


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv('WAITLIST_GOOGLE_SCRIPT_URL', 'https://script.google.com/macros/s/test/exec')
    monkeypatch.delenv('WAITLIST_WEBHOOK_SECRET', raising=False)
    app = FastAPI()
    app.include_router(router.router)
    return TestClient(app)


@pytest.mark.parametrize('body', [{}, {'name': ' ', 'email': 'a@example.com'}, {'name': 'A'}, {'name': 'A', 'email': 'bad'}])
def test_name_and_email_are_required(client, monkeypatch, body):
    post = Mock()
    monkeypatch.setattr(router.httpx, 'post', post)
    assert client.post('/api/waitlist', json=body).status_code == 422
    post.assert_not_called()


def test_optional_fields_can_be_empty_and_sheet_acknowledges(client, monkeypatch):
    post = Mock(return_value=Mock(json=lambda: {'status': 'success'}))
    monkeypatch.setattr(router.httpx, 'post', post)
    assert client.post('/api/waitlist', json={'name': ' Test ', 'email': 'test@example.com'}).json() == {'status': 'success'}
    sent = post.call_args.kwargs['json']
    assert sent['name'] == 'Test'
    assert sent['email'] == 'test@example.com'
    assert sent['formType'] == 'Waitlist'
    assert sent['topic'] == sent['message'] == ''
    assert sent['timestamp']
    assert 'secret' not in sent


def test_sheet_failure_never_reports_success(client, monkeypatch):
    monkeypatch.setattr(router.httpx, 'post', Mock(return_value=Mock(json=lambda: {'ok': False})))
    assert client.post('/api/waitlist', json={'name': 'Test', 'email': 'test@example.com'}).status_code == 502


@pytest.mark.parametrize('endpoint', [None, '', '   '])
def test_deployment_uses_supplied_script_without_environment(client, monkeypatch, endpoint):
    if endpoint is None:
        monkeypatch.delenv('WAITLIST_GOOGLE_SCRIPT_URL')
    else:
        monkeypatch.setenv('WAITLIST_GOOGLE_SCRIPT_URL', endpoint)
    post = Mock(return_value=Mock(json=lambda: {'status': 'success'}))
    monkeypatch.setattr(router.httpx, 'post', post)
    assert client.post('/api/waitlist', json={'name': 'Test', 'email': 'test@example.com'}).status_code == 200
    assert post.call_args.args[0] == router.DEFAULT_GOOGLE_SCRIPT_URL


def test_invalid_override_is_explicit(client, monkeypatch):
    monkeypatch.setenv('WAITLIST_GOOGLE_SCRIPT_URL', 'https://example.com/exec')
    post = Mock()
    monkeypatch.setattr(router.httpx, 'post', post)
    assert client.post('/api/waitlist', json={'name': 'Test', 'email': 'test@example.com'}).status_code == 503
    post.assert_not_called()


def test_company_and_phone_are_mapped_to_script_columns(client, monkeypatch):
    post = Mock(return_value=Mock(json=lambda: {'status': 'success'}))
    monkeypatch.setattr(router.httpx, 'post', post)
    response = client.post('/api/waitlist', json={
        'name': 'Test', 'email': 'test@example.com',
        'company_name': 'Acme', 'phone_number': '+919876543210',
    })
    assert response.status_code == 200
    sent = post.call_args.kwargs['json']
    assert sent['topic'] == 'Acme'
    assert sent['message'] == '+919876543210'


@pytest.mark.parametrize('result', [{'error': 'Permission denied'}, {'ok': True}, {'status': 'success', 'error': 'Failed'}, []])
def test_script_errors_are_not_success(client, monkeypatch, result):
    monkeypatch.setattr(router.httpx, 'post', Mock(return_value=Mock(json=lambda: result)))
    assert client.post('/api/waitlist', json={'name': 'Test', 'email': 'test@example.com'}).status_code == 502


def test_talent_pool_sends_resume_to_script(client, monkeypatch):
    import base64
    post = Mock(return_value=Mock(json=lambda: {'status': 'success'}))
    monkeypatch.setattr(router.httpx, 'post', post)
    contents = b'%PDF-1.4 test resume'
    response = client.post('/api/waitlist/talent-pool', data={'name': ' Test ', 'email': 'test@example.com'}, files={'resume': ('resume.pdf', contents, 'application/pdf')})
    assert response.json() == {'status': 'success'}
    payload = post.call_args.kwargs['json']
    assert payload['formType'] == 'Talent Network'
    assert payload['name'] == 'Test'
    assert payload['resumeName'] == 'resume.pdf'
    assert payload['resumeMimeType'] == 'application/pdf'
    assert base64.b64decode(payload['resumeBase64'].split(',')[1]) == contents


@pytest.mark.parametrize('name,email,filename,contents,status', [
    (' ', 'test@example.com', 'resume.pdf', b'pdf', 422),
    ('Test', 'bad', 'resume.pdf', b'pdf', 422),
    ('Test', 'test@example.com', 'resume.exe', b'exe', 422),
    ('Test', 'test@example.com', 'resume.pdf', b'', 422),
    ('Test', 'test@example.com', 'resume.pdf', b'x' * (2 * 1024 * 1024 + 1), 413),
])
def test_talent_pool_rejects_invalid_upload(client, monkeypatch, name, email, filename, contents, status):
    post = Mock()
    monkeypatch.setattr(router.httpx, 'post', post)
    response = client.post('/api/waitlist/talent-pool', data={'name': name, 'email': email}, files={'resume': (filename, contents)})
    assert response.status_code == status
    post.assert_not_called()


def test_talent_pool_script_failure_is_shown(client, monkeypatch):
    monkeypatch.setattr(router.httpx, 'post', Mock(return_value=Mock(json=lambda: {'error': 'Drive authorization required'})))
    response = client.post('/api/waitlist/talent-pool', data={'name': 'Test', 'email': 'test@example.com'}, files={'resume': ('resume.pdf', b'pdf')})
    assert response.status_code == 502


def test_requirements_and_referral_reach_sheet_with_legacy_compatibility(client, monkeypatch):
    post = Mock(return_value=Mock(json=lambda: {'status': 'success'}))
    monkeypatch.setattr(router.httpx, 'post', post)
    response = client.post('/api/waitlist', json={
        'name': 'Test', 'email': 'test@example.com', 'phone_number': '+919876543210',
        'requirements': '  Two React developers\nAvailable next month  ',
        'referral_source': '  LinkedIn  ',
    })
    assert response.status_code == 200
    sent = post.call_args.kwargs['json']
    assert sent['requirements'] == 'Two React developers\nAvailable next month'
    assert sent['referral_source'] == 'LinkedIn'
    assert sent['phone_number'] == '+919876543210'
    assert sent['message'] == '+919876543210\nRequirements: Two React developers\nAvailable next month\nHow did you find us?: LinkedIn'


@pytest.mark.parametrize('field,limit', [('requirements', 2000), ('referral_source', 160)])
def test_new_optional_fields_have_length_limits(client, monkeypatch, field, limit):
    post = Mock()
    monkeypatch.setattr(router.httpx, 'post', post)
    assert client.post('/api/waitlist', json={'name': 'Test', 'email': 'test@example.com', field: 'x' * (limit + 1)}).status_code == 422
    post.assert_not_called()
