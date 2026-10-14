import importlib
from unittest.mock import Mock

import mongomock
import pytest

from modules.shared.db import Session
from modules.interview.domain.models import InterviewRound
from modules.candidate import outreach_service as outreach


@pytest.fixture
def setup(monkeypatch):
    database = mongomock.MongoClient()['outreach-test']
    monkeypatch.setattr(outreach, 'db', database)
    db_module = importlib.import_module('modules.shared.db')
    monkeypatch.setattr(db_module, 'get_session', lambda: Session(database))
    mail = Mock(return_value={'status': 'success'})
    monkeypatch.setattr(outreach, 'send_interview_invitation_email', mail)
    database.requisitions.insert_one({'id': 'req', 'tenant_id': 'company'})
    database.candidate_outreach.insert_one({
        'token': 'invitation', 'candidate_id': 'candidate', 'candidate_email': 'candidate@example.com',
        'candidate_name': 'Candidate', 'requisition_id': 'req', 'requisition_title': 'Engineer',
        'company_name': 'Company',
    })
    return database, mail


def test_outreach_buttons_never_use_localhost(monkeypatch):
    monkeypatch.setenv('INTERVIEW_PUBLIC_DOMAIN', 'http://localhost:5173')
    html = outreach.build_interactive_outreach_html('Candidate', 'Engineer', 'Company', 90, [], 'invitation', 'http://localhost:8000')
    assert 'localhost' not in html
    assert 'https://termjobs.in/api/public/outreach/invitation/respond?action=interested' in html


def test_yes_sends_authenticated_meeting_link_and_repeat_does_not_resend(setup):
    database, mail = setup
    result = outreach.handle_candidate_rsvp('invitation', 'interested', origin='http://localhost:5173')
    assert result['success'] is True
    assert result['interview_email_delivery']['status'] == 'success'
    args = mail.call_args.kwargs
    assert args['candidate_email'] == 'candidate@example.com'
    assert args['meeting_link'].startswith('https://termjobs.in/interview/room/')
    with Session(database) as session:
        interview = session.get(InterviewRound, result['round_id'])
        assert f'token={interview.candidate_token}' in args['meeting_link']
    assert 'localhost' not in str(args)
    again = outreach.handle_candidate_rsvp('invitation', 'interested')
    assert again['round_id'] == result['round_id']
    assert mail.call_count == 1


def test_failed_email_can_be_retried_without_creating_another_round(setup):
    database, mail = setup
    mail.side_effect = [{'status': 'failed'}, {'status': 'success'}]
    first = outreach.handle_candidate_rsvp('invitation', 'interested')
    second = outreach.handle_candidate_rsvp('invitation', 'interested')
    assert first['round_id'] == second['round_id']
    assert second['interview_email_delivery']['status'] == 'success'
    assert mail.call_count == 2


@pytest.mark.parametrize('action', ['unavailable', 'declined'])
def test_negative_responses_do_not_send_meeting_email(setup, action):
    _, mail = setup
    assert outreach.handle_candidate_rsvp('invitation', action)['success']
    mail.assert_not_called()


def test_invalid_invitation_does_not_create_interview_or_send_email(setup):
    database, mail = setup
    assert outreach.handle_candidate_rsvp('invalid', 'interested')['success'] is False
    with Session(database) as session:
        assert session.query(InterviewRound).all() == []
    mail.assert_not_called()
