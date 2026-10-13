from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from zoneinfo import ZoneInfo

from contextlib import nullcontext
import mongomock
import pytest

from modules.calendar.services import google_calendar as calendar
from modules.calendar.services import assistant
from modules.interview.services import reminders


USER = SimpleNamespace(id='manager-1', tenant_id='company-1')
START = datetime(2026, 10, 13, 15, 0, tzinfo=ZoneInfo('Asia/Kolkata'))


def test_named_prospect_can_get_draft_without_application(monkeypatch):
    import importlib
    from unittest.mock import MagicMock
    shared = importlib.import_module('modules.shared.db')
    session = MagicMock()
    session.query.return_value.filter.return_value.filter.return_value.all.return_value = []
    monkeypatch.setattr(shared, 'get_session', lambda: nullcontext(session))
    monkeypatch.setattr(shared, 'db', mongomock.MongoClient()['candidate-lookup'])
    actor = SimpleNamespace(id='manager-1', tenant_id='company-1', role='Hiring Manager')
    candidate = assistant.contextual_candidate('Schedule an interview with Don Binoy', actor, [])
    assert candidate == {'candidate_name': 'Don Binoy', 'application_required': True}
    candidate = assistant.contextual_candidate('schedule interview', actor, [{'role': 'user', 'content': 'Schedule an interview with Don Binoy'}])
    assert candidate['candidate_name'] == 'Don Binoy'


def test_setup_with_pronoun_preserves_requested_slot_on_calendar_failure(monkeypatch):
    monkeypatch.setattr(assistant, 'contextual_candidate', lambda prompt, user, history: {'candidate_name': 'Don Binoy', 'id': 'application-1', 'requisition_id': 'req-1'})
    monkeypatch.setattr(assistant, 'connection_status', lambda user: {'timezone': 'Asia/Kolkata'})
    def unavailable(*args):
        raise calendar.CalendarUnavailable('Google Calendar API is disabled.')
    monkeypatch.setattr(assistant, 'check_availability', unavailable)
    result = assistant.handle_calendar_query('can u setup a interview with him today at 4pm', USER, [{'role': 'assistant', 'content': 'Don Binoy'}])
    proposal = result['executed_actions'][0]['result']
    assert proposal['candidate'] == 'Don Binoy'
    assert proposal['candidate_submission_id'] == 'application-1'
    assert proposal['proposed_time'] == '16:00'
    assert proposal['proposed_date'] == datetime.now(ZoneInfo('Asia/Kolkata')).date().isoformat()
    assert 'disabled' in result['reply']
    assert 'no interview has been booked' in result['reply']


def test_setup_requires_unambiguous_candidate(monkeypatch):
    monkeypatch.setattr(assistant, 'contextual_candidate', lambda *args: None)
    result = assistant.handle_calendar_query('set up an interview with him tomorrow at 4pm', USER, [])
    assert not result['executed_actions']
    assert 'specify one candidate' in result['reply']


@pytest.mark.parametrize('reason,message', [('accessNotConfigured', 'API is disabled'), ('ACCESS_TOKEN_SCOPE_INSUFFICIENT', 'permission is missing'), ('authError', 'authorization is no longer valid')])
def test_google_read_errors_explain_correct_recovery(monkeypatch, reason, message):
    import httpx
    monkeypatch.setattr(calendar, 'access_credentials', lambda user: ({'timezone': 'Asia/Kolkata'}, 'test-token'))
    transport = httpx.MockTransport(lambda request: httpx.Response(403, json={'error': {'errors': [{'reason': reason}]}}, request=request))
    client_type = httpx.Client
    monkeypatch.setattr(calendar.httpx, 'Client', lambda **kwargs: client_type(transport=transport, **kwargs))
    with pytest.raises(calendar.CalendarUnavailable, match=message):
        calendar.list_calendar_events(USER, START, START + timedelta(hours=1))


def event(start='2026-10-13T15:00:00+05:30', end='2026-10-13T16:00:00+05:30', **kwargs):
    return {'id': 'event-1', 'summary': 'Interview with Don', 'start': {'dateTime': start}, 'end': {'dateTime': end}, **kwargs}


def test_conflicts_include_overlaps_but_not_adjacent_or_declined_events():
    assert calendar.event_blocks_slot(event(), START, START + timedelta(minutes=45))
    assert not calendar.event_blocks_slot(event(end='2026-10-13T15:00:00+05:30'), START, START + timedelta(minutes=45))
    assert not calendar.event_blocks_slot(event(transparency='transparent'), START, START + timedelta(minutes=45))
    assert not calendar.event_blocks_slot(event(status='cancelled'), START, START + timedelta(minutes=45))
    assert not calendar.event_blocks_slot(event(attendees=[{'self': True, 'responseStatus': 'declined'}]), START, START + timedelta(minutes=45))
    assert not calendar.event_blocks_slot(event(), START, START + timedelta(minutes=45), 'event-1')


def test_all_day_busy_event_blocks_the_slot():
    all_day = {'id': 'day', 'start': {'date': '2026-10-13'}, 'end': {'date': '2026-10-14'}}
    assert calendar.event_blocks_slot(all_day, START, START + timedelta(minutes=45))


def test_unreadable_event_does_not_mean_free():
    with pytest.raises(calendar.CalendarUnavailable):
        calendar.event_blocks_slot({'id': 'bad', 'start': {}, 'end': {}}, START, START + timedelta(minutes=45))


def test_booking_lock_prevents_concurrent_reservations(monkeypatch):
    import importlib
    db = mongomock.MongoClient()['lock-test']
    monkeypatch.setattr(importlib.import_module('modules.shared.db'), 'db', db)
    with calendar.booking_lock(USER):
        with pytest.raises(ValueError, match='Another meeting reservation'):
            with calendar.booking_lock(USER): pass
    with calendar.booking_lock(USER): pass
    assert db.calendar_booking_locks.count_documents({}) == 0


def test_today_reply_contains_live_results_and_timezone(monkeypatch):
    monkeypatch.setattr(assistant, 'get_platform_rounds', lambda *args: [])
    monkeypatch.setattr(assistant, 'connection_status', lambda user: {'connected': True, 'timezone': 'Asia/Kolkata', 'email': 'manager@example.com'})
    windows = []
    monkeypatch.setattr(assistant, 'list_calendar_events', lambda user, start, end: windows.append((start, end)) or [event()])
    reply = assistant.schedule_reply(USER, 'today', True, now=START)
    assert 'Interview with Don' in reply['reply']
    assert '15:00' in reply['reply'] and 'Asia/Kolkata' in reply['reply']
    assert windows[0][0].hour == 0 and windows[0][1].day == 14


def test_empty_calendar_reply_is_explicit_and_failure_is_not_empty(monkeypatch):
    monkeypatch.setattr(assistant, 'get_platform_rounds', lambda *args: [])
    monkeypatch.setattr(assistant, 'connection_status', lambda user: {'connected': True, 'timezone': 'Asia/Kolkata', 'email': 'manager@example.com'})
    monkeypatch.setattr(assistant, 'list_calendar_events', lambda *args: [])
    assert 'No interviews found' in assistant.schedule_reply(USER, 'today', True, START)['reply']
    def fail(*args): raise calendar.CalendarUnavailable('Calendar could not be read')
    monkeypatch.setattr(assistant, 'list_calendar_events', fail)
    assert assistant.schedule_reply(USER, 'today', True, START)['reply'] == 'Calendar could not be read'


def test_chat_book_requires_candidate_date_time_and_explicit_instruction(monkeypatch):
    monkeypatch.setattr(assistant, 'connection_status', lambda user: {'timezone': 'Asia/Kolkata'})
    with pytest.raises(ValueError, match='confirm'):
        assistant.book_from_chat('do I have interview today?', USER, {'candidate_identifier': 'Don Binoy'})
    with pytest.raises(ValueError, match='date and time'):
        assistant.book_from_chat('book interview with Don Binoy', USER, {'candidate_identifier': 'Don Binoy'})


@pytest.fixture
def reminder_db(monkeypatch):
    db = mongomock.MongoClient()['reminder-test']
    monkeypatch.setattr(reminders, 'database', lambda: db)
    monkeypatch.setattr(reminders, 'booking_lock', lambda actor: nullcontext())
    return db


def interview():
    return {'id': 'round-1', 'tenant_id': 'company-1', 'candidate_email': 'candidate@example.com',
            'interviewer_email': 'manager@example.com', 'round_name': 'Technical Interview', 'status': 'Scheduled',
            'scheduled_date': '2026-10-13', 'scheduled_time': '15:00', 'scheduled_timezone': 'Asia/Kolkata',
            'calendar_sync': {'status': 'synced', 'email': 'manager@example.com'}}


def test_due_reminders_delivered_once_and_use_official_link(reminder_db, monkeypatch):
    import modules.candidate_screening_agent.services.email_service as email_service
    row = interview(); reminder_db.interview_rounds.insert_one(row)
    reminders.schedule_interview_reminders(row, now=START - timedelta(hours=2))
    sent = []
    monkeypatch.setattr(email_service, 'send_email_via_gmail', lambda *args: sent.append(args) or {'status': 'success'})
    now = START - timedelta(minutes=59)
    assert reminders.dispatch_due_interview_reminders(now)['sent'] == 1
    assert reminders.dispatch_due_interview_reminders(now)['sent'] == 0
    assert sent[0][0] == 'candidate@example.com'
    assert 'https://termjobs.in/interview/room/round-1' in sent[0][2]


def test_rescheduling_cancels_old_reminders_and_cancelled_rounds_do_not_send(reminder_db, monkeypatch):
    import modules.candidate_screening_agent.services.email_service as email_service
    row = interview(); reminder_db.interview_rounds.insert_one(row)
    reminders.schedule_interview_reminders(row, now=START - timedelta(hours=2))
    reminders.schedule_interview_reminders({**row, 'scheduled_time': '17:00'}, now=START - timedelta(hours=2))
    assert reminder_db.interview_reminders.count_documents({'status': 'cancelled'}) == 2
    reminder_db.interview_rounds.update_one({'id': row['id']}, {'$set': {'status': 'Cancelled'}})
    def no_send(*args): raise AssertionError('Cancelled rounds must not send reminders')
    monkeypatch.setattr(email_service, 'send_email_via_gmail', no_send)
    assert reminders.dispatch_due_interview_reminders(START + timedelta(hours=1))['sent'] == 0


def test_failed_calendar_reservation_does_not_schedule_reminders(reminder_db):
    result = reminders.schedule_interview_reminders({**interview(), 'calendar_sync': {'status': 'failed'}}, now=START - timedelta(hours=2))
    assert result['status'] == 'pending_calendar_sync'
    assert reminder_db.interview_reminders.count_documents({}) == 0


def test_calendar_listing_refreshes_tokens_and_reads_every_page(monkeypatch):
    monkeypatch.setattr(calendar, 'access_credentials', lambda user: ({'timezone': 'Asia/Kolkata'}, 'fresh-token'))
    calls = []
    class Response:
        def __init__(self, payload): self.payload = payload
        def raise_for_status(self): pass
        def json(self): return self.payload
    class Client:
        def __init__(self, **kwargs): pass
        def __enter__(self): return self
        def __exit__(self, *args): pass
        def get(self, url, **kwargs):
            calls.append(dict(kwargs['params']))
            assert kwargs['headers']['Authorization'] == 'Bearer fresh-token'
            return Response({'items': [event()], 'nextPageToken': 'page2'} if len(calls) == 1 else {'items': [{**event(), 'id': 'event2'}]})
    monkeypatch.setattr(calendar.httpx, 'Client', Client)
    rows = calendar.list_calendar_events(USER, START, START + timedelta(days=1))
    assert len(rows) == 2
    assert calls[1]['pageToken'] == 'page2'
    assert calls[0]['singleEvents'] == 'true'


def test_booking_from_chat_uses_user_time_not_model_invention(monkeypatch):
    from modules.interview.services import company_schedule
    monkeypatch.setattr(assistant, 'connection_status', lambda user: {'timezone': 'Asia/Kolkata'})
    captured = []
    def save(user, data):
        captured.append(data)
        return {**data, 'candidate_name': 'Don Binoy', 'calendar_sync': {'status': 'synced'},
                'email_delivery': {'status': 'success'}, 'reminders': {'status': 'scheduled'}}
    monkeypatch.setattr(company_schedule, 'save_company_interview', save)
    assistant.book_from_chat('book an interview with Don Binoy on 2099-01-05 at 3pm for 60 minutes', USER,
                            {'candidate_identifier': 'Don Binoy', 'scheduled_time': '01:00', 'scheduled_date': '2000-01-01'})
    assert captured[0]['scheduled_time'] == '15:00'
    assert captured[0]['scheduled_date'] == '2099-01-05'
    assert captured[0]['duration_minutes'] == 60


def test_followup_today_preserves_draft_candidate_and_time(monkeypatch):
    monkeypatch.setattr(assistant, 'contextual_candidate', lambda prompt, user, history: {'candidate_name': 'ARJUN', 'id': 'owned-app', 'requisition_id': 'owned-req'})
    monkeypatch.setattr(assistant, 'connection_status', lambda user: {'timezone': 'Asia/Kolkata'})
    monkeypatch.setattr(assistant, 'check_availability', lambda *args: {'available': True})
    history = [{'role': 'assistant', 'content': 'Review your proposal', 'interview_proposal': {'candidate': 'ARJUN', 'proposed_time': '16:00', 'duration_minutes': 45}}]
    result = assistant.handle_calendar_query('make it today', USER, history)
    draft = result['executed_actions'][0]['result']
    assert draft['proposed_date'] == datetime.now(ZoneInfo('Asia/Kolkata')).date().isoformat()
    assert draft['proposed_time'] == '16:00'
    assert draft['candidate'] == 'ARJUN'
    assert draft['candidate_submission_id'] == 'owned-app'
    assert 'dispatch' in result['reply']


def test_followup_without_proposal_does_not_invent_schedule():
    assert assistant.handle_calendar_query('make it today', USER, []) is None
