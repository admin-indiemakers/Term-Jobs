from unittest.mock import Mock, patch
from types import SimpleNamespace
import mongomock
import pytest

from modules.shared.config import settings
from modules.shared.db import Session
from modules.interview.domain.models import InterviewRound
from modules.requisition.domain.models import Requisition
from modules.interview.services import company_schedule as scheduling
from modules.interview.services.interview_service import send_interviewer_invitation_email
import modules.shared.db as db_module


def test_send_interviewer_invitation_email_structure():
    with patch("modules.candidate_screening_agent.services.email_service.send_email_via_gmail") as mock_send:
        mock_send.return_value = {"status": "success", "message": "Email sent"}

        res = send_interviewer_invitation_email(
            interviewer_name="Sreehari P S",
            interviewer_email="sreehari.ps@asimovx.se",
            candidate_name="Mohammed Hashil",
            candidate_email="mohammedhashil2018@gmail.com",
            requisition_title="Flutter Developer",
            company_name="Acme Corp",
            round_name="HR Interview",
            round_type="HR",
            scheduled_date="2026-10-17",
            scheduled_time="05:30 PM (Asia/Kolkata)",
            duration_minutes=45,
            meeting_link="https://termjobs.in/interview/room/round-hr-1?role=interviewer&token=test-tok",
            staff_portal_link="https://termjobs.in/interview/staff?token=test-tok&email=sreehari.ps@asimovx.se",
            candidate_phone="+91 8590955632",
            candidate_resume_link="/api/candidates/sub-123/resume",
            candidate_match_score=59,
            instructions="Evaluate cultural fit and team communication.",
        )

        assert res["status"] == "success"
        mock_send.assert_called_once()
        to_email, subject, html = mock_send.call_args[0]
        assert to_email == "sreehari.ps@asimovx.se"
        assert "Interview Scheduled: HR Interview with Mohammed Hashil for Flutter Developer" == subject
        assert "Sreehari P S" in html
        assert "Mohammed Hashil" in html
        assert "mohammedhashil2018@gmail.com" in html
        assert "Flutter Developer" in html
        assert "2026-10-17" in html
        assert "05:30 PM (Asia/Kolkata)" in html
        assert "45 minutes" in html
        assert "role=interviewer" in html
        assert "https://termjobs.in/interview/staff" in html
        assert "+91 8590955632" in html
        assert "59% Match" in html
        assert "Evaluate cultural fit and team communication." in html


def test_save_company_interview_dispatches_interviewer_email(monkeypatch):
    session_db = mongomock.MongoClient()['session-test']
    factory = lambda: Session(session_db)
    
    import modules.interview.services.interview_service as interview_service

    cand_doc = {
        'id': 'sub-999',
        'submission_id': 'sub-999',
        'requisition_id': 'req-100',
        'candidate_name': 'Mohammed Hashil',
        'candidate_email': 'mohammedhashil2018@gmail.com',
        'candidate_phone': '+91 8590955632',
        'match_score': 59,
    }

    session_db.candidate_submissions.insert_one(cand_doc)
    monkeypatch.setattr(db_module, 'db', session_db)
    monkeypatch.setattr(scheduling, 'get_session', factory)
    monkeypatch.setattr(scheduling, 'sync_interview_event', lambda user, doc: {'status': 'synced', 'event_id': 'google-event'})
    monkeypatch.setattr(scheduling, 'check_availability', lambda *args, **kwargs: {'available': True, 'conflicts': []})

    cand_mail = Mock(return_value={'status': 'success', 'message': 'Candidate email delivered'})
    int_mail = Mock(return_value={'status': 'success', 'message': 'Interviewer email delivered'})
    monkeypatch.setattr(interview_service, 'send_interview_invitation_email', cand_mail)
    monkeypatch.setattr(interview_service, 'send_interviewer_invitation_email', int_mail)

    def create(data, tenant_id, created_by, origin):
        with factory() as session:
            interview = InterviewRound(
                **data,
                id='round-int-1',
                tenant_id=tenant_id,
                created_by=created_by,
                candidate_token='candidate-token-123',
                interviewer_token='interviewer-token-456',
                candidate_passcode='passcode-789'
            )
            session.add(interview)
            session.commit()
            return interview.to_doc()

    create_mock = Mock(side_effect=create)
    monkeypatch.setattr(interview_service, 'create_interview_round', create_mock)

    user = SimpleNamespace(id='manager-1', tenant_id='company-1', role='Hiring Manager', name='Manager Alice', email='alice@company.com')
    with factory() as session:
        session.add(Requisition(id='req-100', tenant_id=user.tenant_id, created_by=user.id, title='Flutter Developer'))
        session.commit()

    data = {
        'candidate_identifier': 'sub-999',
        'requisition_id': 'req-100',
        'round_name': 'HR Interview',
        'round_type': 'HR',
        'scheduled_date': '2099-10-17',
        'scheduled_time': '17:30',
        'scheduled_timezone': 'Asia/Kolkata',
        'duration_minutes': 45,
        'interviewer_name': 'Sreehari P S',
        'interviewer_email': 'sreehari.ps@asimovx.se',
    }

    result = scheduling.save_company_interview(user, data)

    assert result['email_delivery']['status'] == 'success'
    assert result['interviewer_email_delivery']['status'] == 'success'
    assert 'role=interviewer' in result['interviewer_room_link']
    assert 'interviewer-token-456' in result['interviewer_room_link']
    assert 'staff?token=interviewer-token-456' in result['interviewer_portal_link']

    # Verify send_interviewer_invitation_email call kwargs
    int_mail.assert_called_once()
    kwargs = int_mail.call_args.kwargs
    assert kwargs['interviewer_email'] == 'sreehari.ps@asimovx.se'
    assert kwargs['interviewer_name'] == 'Sreehari P S'
    assert kwargs['candidate_name'] == 'Mohammed Hashil'
    assert kwargs['scheduled_date'] == '2099-10-17'
    assert '17:30' in kwargs['scheduled_time']
    assert kwargs['duration_minutes'] == 45
    assert kwargs['candidate_match_score'] == 59
    assert kwargs['candidate_phone'] == '+91 8590955632'
    assert 'round-int-1' in kwargs['meeting_link']
    assert 'role=interviewer' in kwargs['meeting_link']

    # Verify persisted in database
    with factory() as session:
        stored = session.get(InterviewRound, 'round-int-1')
        assert stored.interviewer_email_delivery == {'status': 'success', 'message': 'Interviewer email delivered'}
