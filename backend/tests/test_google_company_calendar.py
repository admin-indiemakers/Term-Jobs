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
    assert request['json']['location'] == 'https://termjobs.in/interview/room/round-a'
    assert request['json']['start']['dateTime'] == '2027-01-05T15:30:00+05:30'
