import importlib
from types import SimpleNamespace
from unittest.mock import Mock

import mongomock
import pytest

from modules.shared.db import Session
from modules.interview.domain.models import InterviewRound
from modules.requisition.domain.models import Requisition
from modules.interview.services import company_schedule as scheduling


@pytest.fixture
def setup(monkeypatch):
    database = mongomock.MongoClient()['scheduling-test']
    factory = lambda: Session(database)
    db_module = importlib.import_module('modules.shared.db')
    interview_service = importlib.import_module('modules.interview.services.interview_service')
    monkeypatch.setattr(db_module, 'db', database)
    monkeypatch.setattr(scheduling, 'get_session', factory)
    monkeypatch.setattr(scheduling, 'sync_interview_event', lambda user, doc: {'status': 'synced', 'event_id': 'google-event'})
    monkeypatch.setattr(scheduling, 'check_availability', lambda *args, **kwargs: {'available': True, 'conflicts': []})
    mail = Mock(return_value={'status': 'failed', 'reason': 'SMTP unavailable'})
    monkeypatch.setattr(interview_service, 'send_interview_invitation_email', mail)
    def create(data, tenant_id, created_by, origin):
        assert data['suppress_email'] is True
        with factory() as session:
            interview = InterviewRound(**data, id='round-1', tenant_id=tenant_id, created_by=created_by,
                                       candidate_token='candidate-token', candidate_passcode='passcode')
            session.add(interview); session.commit()
            return interview.to_doc()
    create_mock = Mock(side_effect=create)
    monkeypatch.setattr(interview_service, 'create_interview_round', create_mock)
    user = SimpleNamespace(id='manager-1', tenant_id='company-1', role='Hiring Manager', name='Manager', email='manager@example.com')
    with factory() as session:
        session.add(Requisition(id='role-1', tenant_id=user.tenant_id, created_by=user.id, title='Backend Engineer'))
        session.commit()
    database.candidate_submissions.insert_one({'id': 'submission-1', 'requisition_id': 'role-1',
                                               'candidate_name': 'Don Binoy', 'candidate_email': 'candidate@example.com'})
    data = {'candidate_identifier': 'Don Binoy', 'round_name': 'Technical Round',
            'scheduled_date': '2099-01-05', 'scheduled_time': '15:30', 'scheduled_timezone': 'Asia/Kolkata', 'duration_minutes': 45}
    return user, data, factory, mail, create_mock


def test_dispatch_uses_real_candidate_and_official_links_reports_email_failure(setup):
    user, data, factory, mail, create = setup
    result = scheduling.save_company_interview(user, data)
    assert result['email_delivery']['status'] == 'failed'
    assert result['calendar_sync']['status'] == 'synced'
    assert result['meeting_link'] == 'https://termjobs.in/interview/room/round-1?role=candidate&token=candidate-token'
    assert mail.call_args.kwargs['candidate_email'] == 'candidate@example.com'
    assert 'Asia/Kolkata' in mail.call_args.kwargs['scheduled_time']
    assert mail.call_args.kwargs['candidate_portal_link'].startswith('https://termjobs.in/')
    with factory() as session:
        assert session.get(InterviewRound, 'round-1').google_event_id == 'google-event'


def test_reschedule_changes_fields_and_keeps_round_and_calendar_event(setup):
    user, data, factory, mail, create = setup
    scheduling.save_company_interview(user, data)
    updated = scheduling.save_company_interview(user, {**data, 'round_id': 'round-1', 'scheduled_time': '16:45', 'duration_minutes': 60})
    assert updated['id'] == 'round-1'
    assert updated['scheduled_time'] == '16:45'
    assert updated['duration_minutes'] == 60
    assert updated['calendar_sync']['event_id'] == 'google-event'
    assert updated['expires_at'].year == 2099
    assert create.call_count == 1


def test_retry_dispatch_does_not_duplicate_the_round(setup):
    user, data, factory, mail, create = setup
    scheduling.save_company_interview(user, data)
    scheduling.save_company_interview(user, data)
    assert create.call_count == 1


def test_dispatch_notifies_linked_telegram_and_persists_result(setup, monkeypatch):
    user, data, factory, mail, create = setup
    db_module = importlib.import_module('modules.shared.db')
    db_module.db.telegram_links.insert_one({'candidate_email': 'candidate@example.com', 'chat_id': '123'})
    telegram_module = importlib.import_module('modules.candidate.telegram_service')
    calls = []
    async def send(**kwargs):
        calls.append(kwargs)
        return {'ok': True}
    monkeypatch.setattr(telegram_module, 'send_candidate_interview_scheduled_alert', send)
    result = scheduling.save_company_interview(user, data)
    assert result['telegram_delivery']['status'] == 'success'
    assert calls[0]['chat_id'] == '123'
    assert 'token=candidate-token' in calls[0]['meeting_link']
    assert calls[0].get('candidate_email', '') == ''  # Email already sent by the booking service.
    with factory() as session:
        assert session.get(InterviewRound, result['id']).telegram_delivery['status'] == 'success'


def test_other_company_or_manager_cannot_dispatch(setup):
    user, data, factory, mail, create = setup
    for unauthorized in [SimpleNamespace(**{**user.__dict__, 'tenant_id': 'other-company'}),
                         SimpleNamespace(**{**user.__dict__, 'id': 'other-manager'})]:
        with pytest.raises(ValueError, match='authorized requisition'):
            scheduling.save_company_interview(unauthorized, data)
    mail.assert_not_called()
    create.assert_not_called()


def test_google_conflict_blocks_booking_before_any_email_or_round_is_created(setup, monkeypatch):
    user, data, factory, mail, create = setup
    monkeypatch.setattr(scheduling, 'check_availability', lambda *args: {'available': False})
    with pytest.raises(ValueError, match='already has a meeting'):
        scheduling.save_company_interview(user, data)
    mail.assert_not_called()
    create.assert_not_called()


def test_calendar_read_failure_does_not_allow_booking(setup, monkeypatch):
    from modules.calendar.services.google_calendar import CalendarUnavailable
    user, data, factory, mail, create = setup
    def unavailable(*args): raise CalendarUnavailable('Calendar unavailable')
    monkeypatch.setattr(scheduling, 'check_availability', unavailable)
    with pytest.raises(ValueError, match='Calendar unavailable'):
        scheduling.save_company_interview(user, data)
    mail.assert_not_called()
    create.assert_not_called()
