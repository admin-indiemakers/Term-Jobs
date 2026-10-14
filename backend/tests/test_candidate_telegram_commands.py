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
    assert 'Connection successful! Hello, Me.' in send('/start')
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
    db.interview_rounds.insert_many([{'id': 'round-1', 'candidate_token': 'personal-token', 'candidate_email': 'me@example.com', 'candidate_submission_id': 'my-app', 'requisition_id': 'devops', 'tenant_id': 'company', 'status': 'Scheduled', 'round_name': 'Technical', 'scheduled_date': '2026-10-14'}, {'candidate_email': 'me@example.com', 'candidate_submission_id': 'not-my-app', 'requisition_id': 'backend', 'tenant_id': 'other', 'status': 'Scheduled'}])
    asyncio.run(service.process_telegram_update({'message': {'chat': {'id': 123, 'type': 'private'}, 'text': '/interviews', 'from': {}}}))
    text = client.post.call_args.kwargs['json']['text']
    assert 'DevOps Engineer' in text
    assert 'Backend Engineer' not in text
    assert '95%' not in text


def test_candidate_confirmation_and_jobs_include_ai_invitation_despite_legacy_submission_id(monkeypatch):
    from datetime import datetime, timezone, timedelta
    db = mongomock.MongoClient()['candidate-ai-links']
    monkeypatch.setattr(service, 'db', db)
    monkeypatch.setattr(service, 'get_telegram_token', lambda: 'test')
    client = AsyncMock()
    client.__aenter__.return_value = client
    monkeypatch.setattr(service.httpx, 'AsyncClient', lambda **kwargs: client)
    candidate = {'id': 'candidate', 'candidate_name': 'Arjun m', 'candidate_email': 'arjun@example.com', 'telegram_chat_id': '123'}
    db.candidates.insert_one(candidate)
    db.telegram_links.insert_one({'chat_id': '123', 'candidate_email': candidate['candidate_email']})
    db.requisitions.insert_one({'id': 'role', 'tenant_id': 'company', 'title': 'Senior React Developer', 'status': 'Published'})
    db.candidate_submissions.insert_one({'id': 'application', 'candidate_email': candidate['candidate_email'], 'requisition_id': 'role'})
    db.interview_rounds.insert_many([
        {'id': 'ai', 'candidate_token': 'own-token', 'candidate_submission_id': 'legacy-application', 'requisition_id': 'role', 'tenant_id': 'company', 'candidate_email': candidate['candidate_email'], 'round_name': 'AI Fast-Track Technical Interview', 'status': 'Scheduled', 'expires_at': datetime.now(timezone.utc) + timedelta(hours=2)},
        {'id': 'foreign', 'candidate_token': 'foreign-token', 'candidate_submission_id': 'application', 'requisition_id': 'role', 'tenant_id': 'company', 'candidate_email': 'other@example.com', 'round_name': 'AI Interview', 'status': 'Scheduled'},
    ])
    for command in ('/start', '/jobs', '/applied', '/interviews'):
        asyncio.run(service.process_telegram_update({'message': {'chat': {'id': 123, 'type': 'private'}, 'text': command, 'from': {}}}))
        payload = client.post.call_args.kwargs['json']
        buttons = payload['reply_markup']['inline_keyboard']
        assert '/interview/ai/ai?role=candidate&token=own-token' in buttons[0][0]['url']
        assert 'foreign-token' not in str(payload)
        if command == '/start': assert 'Connection successful! Hello, Arjun m.' in payload['text']
    db.interview_rounds.update_one({'id': 'ai'}, {'$set': {'status': 'Completed'}})
    assert service.candidate_interview_links(candidate) == []
    db.interview_rounds.update_one({'id': 'ai'}, {'$set': {'status': 'Scheduled', 'expires_at': datetime.now(timezone.utc) - timedelta(hours=1)}})
    assert service.candidate_interview_links(candidate) == []


def test_connection_sends_named_confirmation_in_background(monkeypatch):
    from fastapi import BackgroundTasks
    from datetime import datetime, timezone, timedelta
    db = mongomock.MongoClient()['connection-confirmation']
    monkeypatch.setattr(profile, 'db', db)
    notified = []
    async def notify(chat_id, candidate, database): notified.append((chat_id, candidate['candidate_name']))
    monkeypatch.setattr(service, 'send_candidate_connection_confirmation', notify)
    db.candidates.insert_one({'id': 'candidate', 'candidate_name': 'Arjun m', 'candidate_email': 'arjun@example.com'})
    candidate = db.candidates.find_one({})
    db.candidate_telegram_login_states.insert_one({'state': 'single-use', 'chat_id': '123', 'expires_at': datetime.now(timezone.utc) + timedelta(minutes=15)})
    tasks = BackgroundTasks()
    result = asyncio.run(profile.connect_candidate_telegram(profile.TelegramCandidateConnection(state='single-use'), candidate, tasks))
    assert result['candidate_name'] == 'Arjun m'
    asyncio.run(tasks())
    assert notified == [('123', 'Arjun m')]
