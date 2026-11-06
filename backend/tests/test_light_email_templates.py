from html import unescape
from html.parser import HTMLParser
from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from modules.candidate.outreach_service import build_interactive_outreach_html
from modules.candidate_screening_agent.services import email_service
from modules.interview.services import interview_service


class EmailMarkup(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.elements = []
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        self.elements.append((tag, dict(attrs)))


@pytest.fixture
def emails(monkeypatch):
    sender = Mock(return_value={'status': 'success'})
    monkeypatch.setattr(email_service, 'send_email_via_gmail', sender)
    shared = dict(candidate_name='Arjun <m>', candidate_email='candidate@example.test', requisition_title='Fullstack Developer',
                  company_name='Example & Partners', round_name='AI Interview', scheduled_date='5 November 2026',
                  scheduled_time='Immediate / On-Demand', duration_minutes=45,
                  meeting_link='https://qa.termjobs.in/interview/ai/round?role=candidate&token=test-only')
    interview_service.send_interview_invitation_email(**shared, candidate_portal_link=shared['meeting_link'], passcode='TJ-INT-TEST', instructions='Please bring <notes> & allow audio.')
    candidate = sender.call_args.args[2]
    interview_service.send_interviewer_invitation_email(**shared, interviewer_name='Hiring Manager', interviewer_email='manager@example.test', round_type='AI',
        staff_portal_link='https://qa.termjobs.in/interview/staff?token=staff-only', candidate_phone='1234567890', candidate_match_score=0,
        candidate_resume_link='https://qa.termjobs.in/resume/test')
    interviewer = sender.call_args.args[2]
    outreach = build_interactive_outreach_html('Arjun <m>', 'Fullstack Developer', 'Example & Partners', 80, ['Python', 'React & SQL'], 'test-only')
    return {'candidate': candidate, 'interviewer': interviewer, 'outreach': outreach}


def test_all_templates_have_explicit_light_sections_and_accessible_buttons(emails):
    for name, html in emails.items():
        markup = EmailMarkup(html)
        assert 'name="color-scheme" content="light only"' in html, name
        assert 'name="supported-color-schemes" content="light"' in html
        assert 'max-width:600px' in html
        assert 'Inter,' in html
        assert 'linear-gradient' not in html
        assert not any(tag in ('script', 'iframe', 'div') for tag, _ in markup.elements)
        for tag, attributes in markup.elements:
            if tag in ('body', 'table', 'td'):
                style = attributes.get('style', '')
                assert 'background-color:' in style, (name, tag, style)
                assert 'color:' in style, (name, tag, style)
            if tag == 'a' and 'display:inline-block' in attributes.get('style', ''):
                style = attributes['style']
                if 'background-color:#1E3A8A;' in style:
                    assert 'color:#FFFFFF;' in style
        backgrounds = [part.split(':', 1)[1].strip().upper() for _, attributes in markup.elements for part in attributes.get('style', '').split(';') if part.strip().startswith('background-color:')]
        assert set(backgrounds) <= {'#F4F6F8', '#FFFFFF', '#F9FAFB', '#1E3A8A'}


def test_email_dynamic_content_is_escaped_and_action_links_are_preserved(emails):
    for html in emails.values():
        assert 'Arjun &lt;m&gt;' in html
        assert '<m>' not in html
        assert 'Example &amp; Partners' in html
    assert 'TJ-INT-TEST' in emails['candidate']
    assert 'token=test-only' in emails['candidate']
    assert 'Your interview window' in emails['candidate']
    assert 'Please bring &lt;notes&gt; &amp; allow audio.' in emails['candidate']
    assert 'https://qa.termjobs.in/resume/test' in emails['interviewer']
    assert '0%' in emails['interviewer']
    assert 'action=interested' in unescape(emails['outreach'])
    assert 'action=unavailable' in unescape(emails['outreach'])
    assert 'action=declined' in unescape(emails['outreach'])


def test_requested_palette_meets_wcag_aa_for_body_footer_and_cta():
    def luminance(hex_value):
        channels = [int(hex_value[index:index + 2], 16) / 255 for index in (1, 3, 5)]
        channels = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in channels]
        return sum(c * weight for c, weight in zip(channels, (0.2126, 0.7152, 0.0722)))
    for foreground, background in [('#171717', '#FFFFFF'), ('#525252', '#FFFFFF'), ('#737373', '#F9FAFB'), ('#FFFFFF', '#1E3A8A')]:
        lighter, darker = sorted([luminance(foreground), luminance(background)], reverse=True)
        assert (lighter + 0.05) / (darker + 0.05) >= 4.5


def test_portal_preview_renders_actual_template_without_sending_mail(monkeypatch):
    import main
    sender = Mock(side_effect=AssertionError('Preview must not send email'))
    monkeypatch.setattr(email_service, 'send_email_via_gmail', sender)
    result = main.preview_superadmin_outreach_email(current_user=SimpleNamespace(role='Super Admin'))
    assert 'email-design-preview' in result['html']
    assert 'background-color:#FFFFFF' in result['html']
    sender.assert_not_called()
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as error:
        main.preview_superadmin_outreach_email(current_user=SimpleNamespace(role='Hiring Manager'))
    assert error.value.status_code == 403
