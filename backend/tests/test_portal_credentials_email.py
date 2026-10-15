import importlib
from unittest.mock import MagicMock
import smtplib
import pytest


@pytest.mark.parametrize('reply,code', [
    (b'5.4.5 Daily user sending limit exceeded', 'sender_limit_exceeded'),
    (b'5.7.26 Unauthenticated email: DKIM failed', 'sender_authentication_rejected'),
    (b'5.7.1 Message is likely unsolicited mail', 'message_blocked'),
    (b'5.7.0 Email sending denied', 'message_rejected'),
])
def test_rejection_preserves_diagnosis_without_retrying(monkeypatch, reply, code):
    transport = importlib.import_module('modules.identity.mail_transport')
    from email.mime.text import MIMEText
    smtp = MagicMock()
    smtp.sendmail.side_effect = smtplib.SMTPDataError(550, reply)
    monkeypatch.setattr(transport.smtplib, 'SMTP_SSL', lambda *args, **kwargs: smtp)
    fallback = MagicMock()
    monkeypatch.setattr(transport.smtplib, 'SMTP', fallback)
    result = transport.deliver_credentials_message(MIMEText('test'), 'sender@example.com', 'password', 'candidate@example.com')
    assert result['code'] == code
    assert reply.decode() in result['reason']
    smtp.sendmail.assert_called_once()
    fallback.assert_not_called()


def test_rejection_redacts_secrets_and_email_addresses():
    transport = importlib.import_module('modules.identity.mail_transport')
    result = transport._rejection(smtplib.SMTPDataError(550, b'denied sender@example.com abcd efgh abcdefgh'), 'abcd efgh')
    assert 'sender@example.com' not in result['reason']
    assert 'abcd' not in result['reason']


def test_gmail_grouped_app_password_is_normalized(monkeypatch):
    router = importlib.import_module('modules.identity.router')
    monkeypatch.setenv('GMAIL_SENDER_EMAIL', 'sender@example.com')
    monkeypatch.setenv('GMAIL_APP_PASSWORD', 'abcd efgh ijkl mnop')
    assert router._get_gmail_creds() == ('sender@example.com', 'abcdefghijklmnop')


def test_portal_email_reports_actual_smtp_delivery(monkeypatch):
    router = importlib.import_module('modules.identity.router')
    monkeypatch.setattr(router, '_get_gmail_creds', lambda: ('sender@example.com', 'password'))
    smtp = MagicMock()
    monkeypatch.setattr(router.smtplib, 'SMTP', lambda *args, **kwargs: smtp)
    monkeypatch.setattr(router.smtplib, 'SMTP_SSL', lambda *args, **kwargs: smtp)
    smtp.sendmail.return_value = {}
    result = router._send_credentials_email('candidate@example.com', 'Candidate', 'Candidate', 'existing password')
    assert result['status'] == 'success'
    smtp.sendmail.assert_called_once()
    smtp.login.side_effect = smtplib.SMTPAuthenticationError(535, b'Bad credentials')
    result = router._send_credentials_email('candidate@example.com', 'Candidate', 'Candidate', 'existing password')
    assert result['status'] == 'failed'
    assert 'Gmail rejected' in result['reason']


def test_smtp_falls_back_before_sending_and_ignores_quit_failure(monkeypatch):
    transport = importlib.import_module('modules.identity.mail_transport')
    from email.mime.text import MIMEText
    monkeypatch.setattr(transport.smtplib, 'SMTP_SSL', MagicMock(side_effect=TimeoutError()))
    smtp = MagicMock()
    smtp.sendmail.return_value = {}
    smtp.quit.side_effect = OSError('Connection closed after send')
    monkeypatch.setattr(transport.smtplib, 'SMTP', lambda *args, **kwargs: smtp)
    result = transport.deliver_credentials_message(MIMEText('test'), 'sender@example.com', 'pass word', 'candidate@example.com')
    assert result['status'] == 'success'
    assert result['transport'] == 'gmail_smtp_587'
    smtp.login.assert_called_once_with('sender@example.com', 'password')
    smtp.sendmail.assert_called_once()


def test_blocked_ports_report_connection_error_without_sending(monkeypatch):
    transport = importlib.import_module('modules.identity.mail_transport')
    from email.mime.text import MIMEText
    monkeypatch.setattr(transport.smtplib, 'SMTP_SSL', MagicMock(side_effect=TimeoutError()))
    monkeypatch.setattr(transport.smtplib, 'SMTP', MagicMock(side_effect=ConnectionRefusedError()))
    result = transport.deliver_credentials_message(MIMEText('test'), 'sender@example.com', 'password', 'candidate@example.com')
    assert result['code'] == 'smtp_connection_failed'
    assert '465' in result['reason'] and '587' in result['reason']


def test_delivery_disconnect_never_retries_message(monkeypatch):
    transport = importlib.import_module('modules.identity.mail_transport')
    from email.mime.text import MIMEText
    smtp = MagicMock()
    smtp.sendmail.side_effect = transport.smtplib.SMTPServerDisconnected()
    fallback = MagicMock()
    monkeypatch.setattr(transport.smtplib, 'SMTP_SSL', lambda *args, **kwargs: smtp)
    monkeypatch.setattr(transport.smtplib, 'SMTP', fallback)
    result = transport.deliver_credentials_message(MIMEText('test'), 'sender@example.com', 'password', 'candidate@example.com')
    assert result['code'] == 'delivery_unconfirmed'
    fallback.assert_not_called()
