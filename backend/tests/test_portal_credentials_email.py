import importlib
from unittest.mock import MagicMock
import smtplib


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
    result = router._send_credentials_email('candidate@example.com', 'Candidate', 'Candidate', 'existing password')
    assert result['status'] == 'success'
    smtp.__enter__.return_value.sendmail.assert_called_once()
    smtp.__enter__.return_value.login.side_effect = smtplib.SMTPAuthenticationError(535, b'Bad credentials')
    result = router._send_credentials_email('candidate@example.com', 'Candidate', 'Candidate', 'existing password')
    assert result['status'] == 'failed'
    assert 'Gmail rejected' in result['reason']
