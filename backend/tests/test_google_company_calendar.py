from datetime import datetime, timezone
from types import SimpleNamespace
from urllib.parse import parse_qs, urlparse

import mongomock
import pytest

from modules.calendar.services import google_calendar as calendar
from modules.calendar.services import oauth


@pytest.fixture
def store(monkeypatch):
    db = mongomock.MongoClient()['calendar-test']
    monkeypatch.setattr(calendar, 'collections', lambda: (db['connections'], db['states']))
    return db


def test_connect_state_is_per_user_one_time_and_redirect_is_allowlisted(store, monkeypatch):
    monkeypatch.setattr(oauth, 'is_configured', lambda key: True)
    user = SimpleNamespace(id='manager-a', tenant_id='company-a')
    url = calendar.begin_connection(user, 'https://attacker.example')
    state = parse_qs(urlparse(url).query)['state'][0]
    saved = store.states.find_one({'state': state})
    assert saved['user_id'] == 'manager-a'
    assert saved['tenant_id'] == 'company-a'
    assert 'attacker' not in saved['return_origin']
    assert calendar.finish_connection(state, '', error='access_denied').endswith('?calendar=cancelled')
    with pytest.raises(ValueError, match='expired|already used'):
        calendar.finish_connection(state, '', error='access_denied')


def test_connection_status_does_not_leak_tokens_or_other_managers(store, monkeypatch):
    monkeypatch.setattr(oauth, 'is_configured', lambda key: True)
    store.connections.insert_one({'user_id': 'manager-a', 'tenant_id': 'company-a', 'status': 'connected',
        'email': 'manager@example.com', 'access_token': 'secret', 'refresh_token': 'secret'})
    own = calendar.connection_status(SimpleNamespace(id='manager-a', tenant_id='company-a'))
    assert own['connected'] and own['email'] == 'manager@example.com'
    assert 'access_token' not in own and 'refresh_token' not in own
    assert not calendar.connection_status(SimpleNamespace(id='manager-b', tenant_id='company-a'))['connected']


def test_scheduling_uses_explicit_timezone_and_duration():
    start, end = calendar.schedule_window('2027-01-05', '15:30', 'Asia/Kolkata', 60, now=datetime(2026, 1, 1, tzinfo=timezone.utc))
    assert start.isoformat() == '2027-01-05T15:30:00+05:30'
    assert (end - start).total_seconds() == 3600


@pytest.mark.parametrize('date,time,zone,duration', [
    ('2000-01-01', '12:00', 'Asia/Kolkata', 45), ('2027-01-05', 'bad', 'Asia/Kolkata', 45),
    ('2027-01-05', '12:00', 'not-a-zone', 45), ('2027-01-05', '12:00', 'Asia/Kolkata', 0),
])
def test_invalid_times_do_not_schedule(date, time, zone, duration):
    with pytest.raises(ValueError): calendar.schedule_window(date, time, zone, duration)


def test_disconnected_calendar_does_not_claim_sync(store):
    result = calendar.sync_interview_event(SimpleNamespace(id='manager-a', tenant_id='company-a'), {})
    assert result['status'] == 'not_connected'


def test_reschedule_updates_same_google_event_and_sends_correct_livekit_link(store, monkeypatch):
    store.connections.insert_one({'user_id': 'manager-a', 'tenant_id': 'company-a', 'status': 'connected',
        'access_token': 'test-token', 'expires_at': 9999999999, 'email': 'manager@example.com'})
    requests = []
    class Response:
        status_code = 200
        def raise_for_status(self): pass
        def json(self): return {'htmlLink': 'https://calendar.google.com/event'}
    class Client:
        def __init__(self, **kwargs): pass
        def __enter__(self): return self
        def __exit__(self, *args): pass
        def patch(self, url, **kwargs): requests.append((url, kwargs)); return Response()
    monkeypatch.setattr(calendar.httpx, 'Client', Client)
    interview = {'id': 'round-a', 'google_event_id': 'existing-event', 'round_name': 'Technical Round',
        'candidate_name': 'Candidate', 'candidate_email': 'candidate@example.com', 'interviewer_email': 'manager@example.com',
        'requisition_title': 'Backend Engineer', 'scheduled_date': '2027-01-05', 'scheduled_time': '15:30',
        'scheduled_timezone': 'Asia/Kolkata', 'duration_minutes': 60}
    result = calendar.sync_interview_event(SimpleNamespace(id='manager-a', tenant_id='company-a'), interview)
    assert result['status'] == 'synced' and result['event_id'] == 'existing-event'
    url, request = requests[0]
    assert url.endswith('/existing-event')
    assert request['params']['sendUpdates'] == 'all'
    assert request['json']['location'] == 'https://termjobs.in/interview/room/round-a?role=interviewer'
    assert request['json']['start']['dateTime'] == '2027-01-05T15:30:00+05:30'


@pytest.mark.parametrize('cluster', ['main', 'dev_qa'])
def test_callback_uses_source_cluster_and_restores_request_context(monkeypatch, cluster):
    from modules.shared.config import current_cluster_var, get_active_cluster
    monkeypatch.setattr("modules.shared.config.detect_branch_name", lambda: "main")
    stores = {key: mongomock.MongoClient()[key] for key in ('main', 'dev_qa')}
    monkeypatch.setattr(calendar, 'collections', lambda: (stores[get_active_cluster()].connections, stores[get_active_cluster()].states))
    monkeypatch.setattr(oauth, 'is_configured', lambda _: True)
    origin = 'https://term-jobs-git-qa-testteam.vercel.app' if cluster == 'dev_qa' else 'https://termjobs.in'
    user = SimpleNamespace(id='manager', tenant_id='company')
    token = current_cluster_var.set(cluster)
    try:
        state = parse_qs(urlparse(calendar.begin_connection(user, origin)).query)['state'][0]
    finally:
        current_cluster_var.reset(token)
    token = current_cluster_var.set('main')
    try:
        result = calendar.finish_connection(state, '', error='access_denied')
        assert result == origin + '/dashboard/hiring-manager?calendar=cancelled'
        assert get_active_cluster() == 'main'
        assert stores[cluster].states.count_documents({}) == 0
        with pytest.raises(ValueError, match='expired|already used'):
            calendar.finish_connection(state, '', error='access_denied')
    finally:
        current_cluster_var.reset(token)


def test_modified_cluster_cannot_consume_another_clusters_state(monkeypatch):
    from modules.shared.config import current_cluster_var, get_active_cluster
    monkeypatch.setattr("modules.shared.config.detect_branch_name", lambda: "main")
    stores = {key: mongomock.MongoClient()[key] for key in ('main', 'dev_qa')}
    monkeypatch.setattr(calendar, 'collections', lambda: (stores[get_active_cluster()].connections, stores[get_active_cluster()].states))
    from datetime import timedelta
    stores['dev_qa'].states.insert_one({'state': 'dev_qa.random-secret', 'expires_at': datetime.now(timezone.utc) + timedelta(minutes=10)})
    with pytest.raises(ValueError, match='expired|already used'):
        calendar.finish_connection('main.random-secret', '', error='access_denied')
    assert stores['dev_qa'].states.count_documents({}) == 1


def test_preview_callback_saves_credentials_only_in_preview_cluster(monkeypatch):
    from modules.shared.config import current_cluster_var, get_active_cluster
    from datetime import timedelta
    monkeypatch.setattr("modules.shared.config.detect_branch_name", lambda: "main")
    stores = {key: mongomock.MongoClient()[key] for key in ('main', 'dev_qa')}
    monkeypatch.setattr(calendar, 'collections', lambda: (stores[get_active_cluster()].connections, stores[get_active_cluster()].states))
    state = 'dev_qa.random-secret'
    origin = 'https://term-jobs-git-dev-testteam.vercel.app'
    stores['dev_qa'].states.insert_one({'state': state, 'user_id': 'manager', 'tenant_id': 'company', 'return_origin': origin, 'expires_at': datetime.now(timezone.utc) + timedelta(minutes=10)})
    monkeypatch.setattr(oauth, 'exchange_code', lambda *args: {'access_token': 'access', 'refresh_token': 'refresh', 'scope': 'https://www.googleapis.com/auth/calendar.events'})
    monkeypatch.setattr(oauth, 'fetch_user_email', lambda *args: 'manager@example.com')
    monkeypatch.setattr(oauth, 'token_expiry_epoch', lambda _: 9999999999)
    class Client:
        def __init__(self, **kwargs): pass
        def __enter__(self): return self
        def __exit__(self, *args): pass
        def get(self, *args, **kwargs):
            return SimpleNamespace(is_success=True, json=lambda: {'timeZone': 'Asia/Kolkata'})
    monkeypatch.setattr(calendar.httpx, 'Client', Client)
    token = current_cluster_var.set('main')
    try:
        assert calendar.finish_connection(state, 'code') == origin + '/dashboard/hiring-manager?calendar=connected'
        assert stores['dev_qa'].connections.find_one({'user_id': 'manager'})['status'] == 'connected'
        assert stores['main'].connections.count_documents({}) == 0
        assert get_active_cluster() == 'main'
    finally:
        current_cluster_var.reset(token)
