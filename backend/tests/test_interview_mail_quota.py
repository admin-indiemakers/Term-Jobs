import smtplib
from unittest.mock import Mock

from modules.candidate_screening_agent.services import email_service
from modules.identity import mail_transport


def test_invitation_surfaces_sender_quota_and_does_not_retry_data(monkeypatch):
    smtp = Mock()
    smtp.sendmail.side_effect = smtplib.SMTPDataError(550, b'5.4.5 Daily user sending limit exceeded')
    monkeypatch.setattr(mail_transport.smtplib, 'SMTP_SSL', Mock(return_value=smtp))
    fallback = Mock(side_effect=AssertionError('Do not resend after Gmail rejects DATA'))
    monkeypatch.setattr(mail_transport.smtplib, 'SMTP', fallback)
    result = email_service.send_email_via_gmail('candidate@example.com', 'Interview invitation', '<p>Interview</p>', sender_email='sender@example.com', app_password='secret')
    assert result['status'] == 'failed'
    assert result['code'] == 'sender_limit_exceeded'
    assert 'sending limit' in result['reason']
    assert 'secret' not in result['reason']
    smtp.sendmail.assert_called_once()
    fallback.assert_not_called()
