import asyncio
import base64
from types import SimpleNamespace
import mongomock
import pytest
from modules.candidate_profile import router


@pytest.fixture
def store(monkeypatch):
    db = mongomock.MongoClient().db
    monkeypatch.setattr(router, 'db', db)
    monkeypatch.setattr(router, 'check_candidate_email_allowed', lambda *args, **kwargs: None)
    monkeypatch.setattr(router, 'create_access_token', lambda **kwargs: 'signed-token')
    class Client:
        def __init__(self, **kwargs): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *args): pass
        async def get(self, *args, **kwargs):
            return SimpleNamespace(status_code=200, json=lambda: {'email': 'candidate@gmail.com', 'name': 'Candidate', 'sub': 'google-id'})
    monkeypatch.setattr(router.httpx, 'AsyncClient', Client)
    return db


def test_google_signup_without_resume_creates_no_account_or_token(store):
    result = asyncio.run(router.google_candidate_auth(router.GoogleAuthRequest(access_token='google-token')))
    assert result['status'] == 'resume_required'
    assert 'token' not in result
    assert store.candidates.count_documents({}) == 0


def test_google_signup_saves_resume_before_issuing_token(store):
    encoded = base64.b64encode(b'%PDF-test resume').decode()
    result = asyncio.run(router.google_candidate_auth(router.GoogleAuthRequest(access_token='google-token', resume_base64=encoded, resume_filename='resume.pdf')))
    assert result['token'] == 'signed-token'
    assert store.candidates.find_one({})['resume_pdf'] == encoded


def test_existing_google_profile_without_resume_cannot_bypass_upload(store):
    store.candidates.insert_one({'id': 'candidate', 'candidate_email': 'candidate@gmail.com', 'google_sub': 'google-id'})
    result = asyncio.run(router.google_candidate_auth(router.GoogleAuthRequest(access_token='google-token')))
    assert result['status'] == 'resume_required'
    assert 'token' not in result
