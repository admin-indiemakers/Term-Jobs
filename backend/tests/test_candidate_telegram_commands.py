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
