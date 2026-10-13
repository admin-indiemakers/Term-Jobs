import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock
import mongomock
from modules.candidate import telegram_service as service
from modules.candidate_profile import router as profile


def test_logout_removes_links_and_login_issues_single_use_state(monkeypatch):
    db = mongomock.MongoClient()['telegram']
    monkeypatch.setattr(service, 'db', db)
    monkeypatch.setattr(service, 'get_telegram_token', lambda: 'test')
    client = AsyncMock()
    client.__aenter__.return_value = client
    monkeypatch.setattr(service.httpx, 'AsyncClient', lambda **kwargs: client)
    db.candidates.insert_one({'id': 'candidate', 'candidate_email': 'person@example.com', 'telegram_chat_id': '123'})
    db.telegram_links.insert_one({'chat_id': '123'})
    def update(text): return {'message': {'chat': {'id': 123, 'type': 'private'}, 'text': text, 'from': {'first_name': 'Candidate'}}}
    asyncio.run(service.process_telegram_update(update('/logout')))
    assert db.telegram_links.count_documents({}) == 0
    assert 'telegram_chat_id' not in db.candidates.find_one({})
    asyncio.run(service.process_telegram_update(update('/login')))
    state = db.candidate_telegram_login_states.find_one({})
    assert state and '/candidate/telegram-login?state=' in client.post.call_args.kwargs['json']['reply_markup']['inline_keyboard'][0][0]['url']
    monkeypatch.setattr(profile, 'db', db)
    candidate = db.candidates.find_one({})
    asyncio.run(profile.connect_candidate_telegram(profile.TelegramCandidateConnection(state=state['state']), candidate))
    assert db.candidates.find_one({})['telegram_chat_id'] == '123'
    assert db.candidate_telegram_login_states.count_documents({}) == 0


def test_connected_start_and_jobs_and_applied_use_real_account_data(monkeypatch):
    db = mongomock.MongoClient()['commands']
    monkeypatch.setattr(service, 'db', db)
    monkeypatch.setattr(service, 'get_telegram_token', lambda: 'test')
    client = AsyncMock()
    client.__aenter__.return_value = client
    monkeypatch.setattr(service.httpx, 'AsyncClient', lambda **kwargs: client)
    db.candidates.insert_one({'id': 'me', 'candidate_name': 'Me', 'candidate_email': 'me@example.com', 'telegram_chat_id': '123'})
    db.telegram_links.insert_one({'chat_id': '123', 'candidate_email': 'me@example.com'})
    db.requisitions.insert_many([{'id': 'public', 'title': 'Published job', 'status': 'Published'}, {'id': 'draft', 'title': 'Private draft', 'status': 'Draft'}])
    db.candidate_submissions.insert_many([{'candidate_email': 'me@example.com', 'requisition_title': 'My application', 'status': 'Applied'}, {'candidate_email': 'other@example.com', 'requisition_title': 'Other application', 'status': 'Applied'}])
    def send(command):
        asyncio.run(service.process_telegram_update({'message': {'chat': {'id': 123, 'type': 'private'}, 'text': command, 'from': {}}}))
        return client.post.call_args.kwargs['json']['text']
    assert 'You are connected' in send('/start')
    assert db.candidate_telegram_login_states.count_documents({}) == 0
    jobs = send('/jobs')
    assert 'Published job' in jobs and 'Private draft' not in jobs
    applied = send('/applied')
    assert 'My application' in applied and 'Other application' not in applied


def test_interviews_only_include_rounds_linked_to_candidates_actual_application(monkeypatch):
    db = mongomock.MongoClient()['interviews']
    monkeypatch.setattr(service, 'db', db)
    monkeypatch.setattr(service, 'get_telegram_token', lambda: 'test')
    client = AsyncMock()
    client.__aenter__.return_value = client
    monkeypatch.setattr(service.httpx, 'AsyncClient', lambda **kwargs: client)
    db.candidates.insert_one({'id': 'me', 'candidate_email': 'me@example.com', 'telegram_chat_id': '123'})
    db.telegram_links.insert_one({'chat_id': '123', 'candidate_email': 'me@example.com'})
    db.requisitions.insert_many([{'id': 'devops', 'tenant_id': 'company', 'title': 'DevOps Engineer'}, {'id': 'backend', 'tenant_id': 'other', 'title': 'Backend Engineer'}])
    db.candidate_submissions.insert_one({'id': 'my-app', 'candidate_email': 'me@example.com', 'requisition_id': 'devops'})
    db.interview_rounds.insert_many([{'candidate_email': 'me@example.com', 'candidate_submission_id': 'my-app', 'requisition_id': 'devops', 'tenant_id': 'company', 'status': 'Scheduled', 'round_name': 'Technical', 'scheduled_date': '2026-10-14'}, {'candidate_email': 'me@example.com', 'candidate_submission_id': 'not-my-app', 'requisition_id': 'backend', 'tenant_id': 'other', 'status': 'Scheduled'}])
    asyncio.run(service.process_telegram_update({'message': {'chat': {'id': 123, 'type': 'private'}, 'text': '/interviews', 'from': {}}}))
    text = client.post.call_args.kwargs['json']['text']
    assert 'DevOps Engineer' in text
    assert 'Backend Engineer' not in text
    assert '95%' not in text
