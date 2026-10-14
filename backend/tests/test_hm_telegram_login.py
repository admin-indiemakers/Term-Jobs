import asyncio
import importlib
from types import SimpleNamespace
from datetime import datetime, timezone, timedelta
from urllib.parse import urlparse, parse_qs

import mongomock
import pytest
from fastapi import HTTPException
from modules.hm_telegram_bot import auth, session, handlers


@pytest.fixture
def setup(monkeypatch):
    database = mongomock.MongoClient()['bot-login']
    monkeypatch.setattr(auth, 'db', database)
    monkeypatch.setattr(handlers, 'db', database)
    monkeypatch.setattr(session, 'db', database)
    session._SESSIONS.clear()
    actor = SimpleNamespace(id='hm', tenant_id='company', role='Hiring Manager', is_active=True, name='Manager')
    database.users.insert_one({'id': 'hm', 'tenant_id': 'company', 'role': 'Hiring Manager', 'is_active': True})
    return database, actor


def state_from_link():
    url = auth.create_login_link(123, {'id': 123, 'username': 'manager'})
    assert url.startswith('https://termjobs.in/hiring-manager/telegram-login?')
    return parse_qs(urlparse(url).query)['state'][0]


def test_login_requires_active_hiring_manager_and_is_single_use(setup):
    database, actor = setup
    state = state_from_link()
    with pytest.raises(HTTPException):
        auth.complete_login(state, SimpleNamespace(**{**actor.__dict__, 'role': 'Super Admin'}))
    auth.complete_login(state, actor)
    assert auth.linked_user(123, 123)['id'] == 'hm'
    assert auth.linked_user(123, 999) is None
    with pytest.raises(HTTPException):
        auth.complete_login(state, actor)


def test_expired_login_cannot_pair(setup):
    database, actor = setup
    state = state_from_link()
    database.hm_telegram_login_states.update_many({}, {'$set': {'expires_at': datetime.now(timezone.utc) - timedelta(minutes=1)}})
    with pytest.raises(HTTPException):
        auth.complete_login(state, actor)
    assert auth.linked_user(123) is None


def test_logout_revokes_link_pending_links_and_all_cached_sessions(setup):
    database, actor = setup
    auth.complete_login(state_from_link(), actor)
    state_from_link()
    session._SESSIONS.update({'123': {'history': ['private']}, 'company:123': {'last_draft': {'private': True}}})
    auth.logout_chat(123, 123)
    assert auth.linked_user(123) is None
    assert database.hm_telegram_login_states.count_documents({}) == 0
    assert session._SESSIONS == {}


def test_commands_send_link_and_logout_confirmation(setup, monkeypatch):
    _, _actor = setup
    sent = []
    async def send(*args): sent.append(args)
    monkeypatch.setattr(handlers, 'send_telegram_message', send)
    message = {'chat': {'id': 123, 'type': 'private'}, 'from': {'id': 123}, 'text': '/login@HirMngerbot'}
    asyncio.run(handlers._handle_message_inner('fake-token', message))
    assert sent[-1][3]['inline_keyboard'][0][0]['url'].startswith('https://termjobs.in/')
    message['text'] = '/logout'
    asyncio.run(handlers._handle_message_inner('fake-token', message))
    assert 'logged out' in sent[-1][2]


def test_email_alone_cannot_pair_an_account(setup, monkeypatch):
    database, _ = setup
    database.users.update_many({}, {'$set': {'email': 'hm@example.com'}})
    async def send(*args): pass
    monkeypatch.setattr(handlers, 'send_telegram_message', send)
    asyncio.run(handlers._handle_message_inner('fake-token', {'chat': {'id': 123}, 'from': {'id': 123}, 'text': '/pair hm@example.com'}))
    assert auth.linked_user(123) is None


def test_dashboard_pairing_token_is_consumed_and_expiry_is_checked(setup, monkeypatch):
    import time
    database, _ = setup
    database.users.update_many({}, {'$set': {'bot_pairing_token': 'secure-token', 'bot_pairing_token_expires_at': time.time() + 600}})
    sent = []
    async def send(*args): sent.append(args)
    monkeypatch.setattr(handlers, 'send_telegram_message', send)
    message = {'chat': {'id': 123}, 'from': {'id': 123}, 'text': '/start link_secure-token'}
    asyncio.run(handlers._handle_message_inner('fake-token', message))
    assert auth.linked_user(123)['id'] == 'hm'
    asyncio.run(handlers._handle_message_inner('fake-token', message))
    assert 'invalid or expired' in sent[-1][2]


def test_tenant_bot_login_cannot_connect_another_company(setup):
    _, actor = setup
    url = auth.create_login_link(123, {'id': 123}, tenant_id='other-company')
    state = parse_qs(urlparse(url).query)['state'][0]
    with pytest.raises(HTTPException) as error:
        auth.complete_login(state, actor)
    assert error.value.status_code == 403


def test_logged_out_callbacks_do_not_execute_hiring_actions(setup, monkeypatch):
    async def unexpected(*args, **kwargs): pytest.fail('Must not run hiring actions after logout')
    async def send(*args): pass
    monkeypatch.setattr(handlers, '_handle_callback_query_inner', unexpected)
    monkeypatch.setattr(handlers, 'send_telegram_message', send)
    asyncio.run(handlers.handle_callback_query('fake-token', {'id': 'callback', 'from': {'id': 123}, 'message': {'chat': {'id': 123}}, 'data': 'menu:requisitions'}))
