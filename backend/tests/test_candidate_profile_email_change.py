import asyncio

import mongomock
import pytest
from fastapi import HTTPException

from modules.candidate_profile import router as profile
from modules.candidate_screening_agent.services import email_service
from modules.identity.services.auth_service import decode_access_token


def test_verified_change_updates_profile_session_and_submissions(monkeypatch):
    database = mongomock.MongoClient()['candidate-email-change']
    database.candidates.insert_one({
        'id': 'candidate-1', 'candidate_email': 'old@example.com',
        'google_sub': 'google-123', 'google_login_email': 'old@example.com',
        'candidate_name': 'Test Candidate',
    })
    database.candidate_submissions.insert_one({'candidate_email': 'old@example.com', 'id': 'sub-1'})
    monkeypatch.setattr(profile, 'db', database)
    monkeypatch.setattr(profile.secrets, 'randbelow', lambda _: 123456)
    sent = []
    monkeypatch.setattr(email_service, 'send_email_via_gmail',
                        lambda to, subject, body: sent.append((to, subject, body)) or {'status': 'success'})

    candidate = database.candidates.find_one({'id': 'candidate-1'})
    asyncio.run(profile.request_candidate_email_change(
        profile.EmailChangeRequest(email='NEW@example.com'), candidate,
    ))
    assert sent[0][0] == 'new@example.com'
    assert '123456' in sent[0][2]
    pending = database.candidates.find_one({'id': 'candidate-1'})
    with pytest.raises(HTTPException) as error:
        asyncio.run(profile.confirm_candidate_email_change(profile.EmailChangeConfirm(code='000000'), pending))
    assert error.value.status_code == 400
    assert database.candidates.find_one({'id': 'candidate-1'})['candidate_email'] == 'old@example.com'

    result = asyncio.run(profile.confirm_candidate_email_change(
        profile.EmailChangeConfirm(code='123456'), database.candidates.find_one({'id': 'candidate-1'}),
    ))
    assert result['candidate']['candidate_email'] == 'new@example.com'
    assert 'pending_email_hash' not in result['candidate']
    assert decode_access_token(result['token'])['sub'] == 'new@example.com'
    assert database.candidates.find_one({'id': 'candidate-1'})['google_login_email'] == 'old@example.com'
    assert database.candidate_submissions.find_one({'id': 'sub-1'})['candidate_email'] == 'new@example.com'


def test_duplicate_email_is_rejected_before_sending(monkeypatch):
    database = mongomock.MongoClient()['candidate-email-duplicate']
    database.candidates.insert_many([
        {'id': 'candidate-1', 'candidate_email': 'old@example.com'},
        {'id': 'candidate-2', 'candidate_email': 'taken@example.com'},
    ])
    monkeypatch.setattr(profile, 'db', database)
    with pytest.raises(HTTPException) as error:
        asyncio.run(profile.request_candidate_email_change(
            profile.EmailChangeRequest(email='TAKEN@example.com'),
            database.candidates.find_one({'id': 'candidate-1'}),
        ))
    assert error.value.status_code == 409


def test_google_sign_in_keeps_same_account_after_email_change(monkeypatch):
    database = mongomock.MongoClient()['google-email-change']
    database.candidates.insert_one({
        'id': 'candidate-1', 'candidate_email': 'new@example.com',
        'google_login_email': 'old@example.com', 'google_sub': 'google-123',
        'candidate_name': 'Test Candidate',
    })
    monkeypatch.setattr(profile, 'db', database)

    class GoogleClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def get(self, *args, **kwargs):
            return type('Response', (), {
                'status_code': 200,
                'json': lambda self: {'email': 'old@example.com', 'sub': 'google-123'},
            })()

    monkeypatch.setattr(profile.httpx, 'AsyncClient', lambda **kwargs: GoogleClient())
    result = asyncio.run(profile.google_candidate_auth(
        profile.GoogleAuthRequest(access_token='verified-google-token'),
    ))
    assert result['candidate']['id'] == 'candidate-1'
    assert result['candidate']['candidate_email'] == 'new@example.com'
    assert decode_access_token(result['token'])['sub'] == 'new@example.com'
    assert database.candidates.count_documents({}) == 1


def test_unverified_google_email_payload_cannot_sign_in(monkeypatch):
    database = mongomock.MongoClient()['google-unverified-email']
    database.candidates.insert_one({'id': 'candidate-1', 'candidate_email': 'victim@example.com'})
    monkeypatch.setattr(profile, 'db', database)
    with pytest.raises(HTTPException) as error:
        asyncio.run(profile.google_candidate_auth(
            profile.GoogleAuthRequest(email='victim@example.com'),
        ))
    assert error.value.status_code == 400
