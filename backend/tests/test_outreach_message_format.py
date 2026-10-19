from unittest.mock import Mock
from modules.candidate_screening_agent.services.email_service import send_email_via_gmail
from modules.identity import mail_transport


def test_opportunity_mail_has_headers_plain_text_and_working_links(monkeypatch):
    delivery = Mock(return_value={'status': 'success'})
    monkeypatch.setattr(mail_transport, 'deliver_credentials_message', delivery)
    result = send_email_via_gmail('candidate@example.com', 'Opportunity', '<html><head><style>.secret {color:red}</style></head><body><p>Hello José &amp; team</p><a href="https://termjobs.in/jobs">View role</a></body></html>', 'sender@example.com', 'app-password')
    assert result['status'] == 'success'
    message = delivery.call_args.args[0]
    assert message['Date'] and message['Message-ID'] and message['Reply-To']
    plain, html = message.get_payload()
    assert plain.get_content_type() == 'text/plain'
    assert html.get_content_type() == 'text/html'
    text = plain.get_payload(decode=True).decode('utf-8')
    assert 'Hello José & team' in text
    assert 'https://termjobs.in/jobs' in text
    assert '.secret' not in text
    assert 'app-password' not in message.as_string()


def test_provider_rejection_is_preserved(monkeypatch):
    monkeypatch.setattr(mail_transport, 'deliver_credentials_message', Mock(return_value={'status': 'failed', 'code': 'message_blocked'}))
    result = send_email_via_gmail('candidate@example.com', 'Opportunity', '<p>Hello</p>', 'sender@example.com', 'password')
    assert result == {'status': 'failed', 'code': 'message_blocked'}
