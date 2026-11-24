import os
import re
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formatdate, make_msgid
from html.parser import HTMLParser
from typing import Any, Dict, Optional

GMAIL_SENDER_EMAIL = os.getenv("GMAIL_SENDER_EMAIL", "")
GMAIL_APP_PASSWORD = os.getenv("GMAIL_APP_PASSWORD", "")


def extract_candidate_email(resume_text: str) -> Optional[str]:
    """Extract candidate email address from resume text using regex."""
    email_pattern = r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"
    match = re.search(email_pattern, resume_text)
    if match:
        return match.group(0).lower()
    return None


class _PlainEmail(HTMLParser):
    """Keep message content and action links in the plain-text alternative."""
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self.hidden = 0

    def handle_starttag(self, tag, attrs):
        if tag in ('style', 'script', 'head'):
            self.hidden += 1
        if self.hidden:
            return
        if tag in ('p', 'div', 'tr', 'br', 'h1', 'h2', 'li'):
            self.parts.append('\n')
        if tag == 'a':
            href = dict(attrs).get('href', '')
            if href.startswith(('https://', 'http://', 'mailto:')):
                self.parts.append(' ' + href + ' ')

    def handle_endtag(self, tag):
        if tag in ('style', 'script', 'head'):
            self.hidden = max(0, self.hidden - 1)
        elif not self.hidden and tag in ('p', 'div', 'tr', 'h1', 'h2', 'li'):
            self.parts.append('\n')

    def handle_data(self, data):
        if not self.hidden:
            self.parts.append(data)


def _plain_email(html):
    parser = _PlainEmail()
    parser.feed(html)
    return '\n'.join(line for raw in ''.join(parser.parts).splitlines() if (line := ' '.join(raw.split())))


def send_email_via_brevo(
    to_email: str,
    subject: str,
    html_content: str,
    to_name: Optional[str] = None,
    sender_email: Optional[str] = None,
    sender_name: Optional[str] = None,
    api_key: Optional[str] = None,
) -> Dict[str, Any]:
    """Send an email using Brevo's Transactional Email REST API."""
    import logging
    import httpx

    logger = logging.getLogger(__name__)

    key = (api_key or os.getenv("BREVO_API_KEY") or "").strip()
    if not key:
        from dotenv import load_dotenv
        load_dotenv(override=not bool(os.getenv("VERCEL")))
        key = (os.getenv("BREVO_API_KEY") or "").strip()

    if not key:
        return {"status": "skipped", "reason": "Brevo API key not configured"}

    s_email = (
        sender_email
        or os.getenv("EMAIL_SENDER_ADDRESS")
        or os.getenv("GMAIL_SENDER_EMAIL")
        or GMAIL_SENDER_EMAIL
        or "termjobsofficial@gmail.com"
    ).strip()
    s_name = (sender_name or os.getenv("EMAIL_SENDER_NAME") or "Termjobs").strip()

    recipient = {"email": to_email.strip()}
    if to_name and to_name.strip():
        recipient["name"] = to_name.strip()

    payload = {
        "sender": {"name": s_name, "email": s_email},
        "to": [recipient],
        "subject": subject,
        "htmlContent": html_content,
        "textContent": _plain_email(html_content),
    }
    headers = {
        "accept": "application/json",
        "api-key": key,
        "content-type": "application/json",
    }
    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.post("https://api.brevo.com/v3/smtp/email", headers=headers, json=payload)
            if resp.status_code in (200, 201, 202):
                data = resp.json()
                message_id = data.get("messageId", "")
                logger.info(f"Email sent via Brevo to {to_email}: messageId={message_id}")
                return {"status": "success", "transport": "brevo_api", "message_id": message_id}
            else:
                logger.warning(f"Brevo API error ({resp.status_code}): {resp.text}")
                return {"status": "failed", "code": f"brevo_{resp.status_code}", "reason": resp.text}
    except Exception as exc:
        logger.warning(f"Brevo dispatch exception: {exc}")
        return {"status": "failed", "reason": str(exc)}


def send_email_via_gmail(
    to_email: str,
    subject: str,
    html_content: str,
    sender_email: Optional[str] = None,
    app_password: Optional[str] = None,
    to_name: Optional[str] = None,
) -> Dict[str, Any]:
    """Send an email to any recipient. Prioritizes Brevo API if configured, falling back to Gmail SMTP."""
    if not to_email:
        return {"status": "skipped", "reason": "No candidate email provided"}

    # 1. Prioritize Brevo API unless caller explicitly provided app_password for direct SMTP testing
    if not app_password:
        brevo_key = (os.getenv("BREVO_API_KEY") or "").strip()
        if not brevo_key:
            from dotenv import load_dotenv
            load_dotenv(override=not bool(os.getenv("VERCEL")))
            brevo_key = (os.getenv("BREVO_API_KEY") or "").strip()

        if brevo_key:
            brevo_result = send_email_via_brevo(
                to_email=to_email,
                subject=subject,
                html_content=html_content,
                to_name=to_name,
                sender_email=sender_email,
                api_key=brevo_key,
            )
            if brevo_result.get("status") == "success":
                return brevo_result
            import logging
            logging.getLogger(__name__).warning(
                f"Brevo delivery failed ({brevo_result.get('reason')}), attempting Gmail SMTP fallback..."
            )

    # 2. Gmail SMTP fallback
    sender = (sender_email or os.getenv("GMAIL_SENDER_EMAIL") or GMAIL_SENDER_EMAIL or "").strip()
    pw = (app_password or os.getenv("GMAIL_APP_PASSWORD") or GMAIL_APP_PASSWORD or "").strip()
    if not sender or not pw:
        from dotenv import load_dotenv
        load_dotenv(override=not bool(os.getenv("VERCEL")))
        sender = (os.getenv("GMAIL_SENDER_EMAIL") or "").strip()
        pw = (os.getenv("GMAIL_APP_PASSWORD") or "").strip()

    if not sender or not pw:
        return {"status": "skipped", "reason": "Gmail credentials not configured (GMAIL_SENDER_EMAIL / GMAIL_APP_PASSWORD)"}

    msg = MIMEMultipart("alternative")
    msg["From"] = f"Hiring Team <{sender}>"
    msg["To"] = to_email
    msg["Subject"] = subject
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid(domain=sender.rsplit('@', 1)[-1])
    msg["Reply-To"] = sender
    msg.attach(MIMEText(_plain_email(html_content), "plain", "utf-8"))
    msg.attach(MIMEText(html_content, "html", "utf-8"))

    # Share the SMTP transport's explicit provider errors and credential redaction.
    from modules.identity.mail_transport import deliver_credentials_message
    return deliver_credentials_message(msg, sender, pw, to_email)


# Clean alias
send_email = send_email_via_gmail


def send_shortlist_notification(
    candidate_name: str,
    candidate_email: str,
    job_title: str = "Position",
    notes: Optional[str] = None
) -> Dict[str, Any]:
    """Send shortlisting email notification to candidate."""
    subject = f"Congratulations! You have been shortlisted for {job_title}"
    
    html = f"""
    <div style="font-family: Arial, sans-serif; padding: 24px; color: #1e293b; max-width: 600px; border: 1px solid #e2e8f0; border-radius: 12px;">
        <h2 style="color: #10b981; margin-top: 0;">Application Status: Shortlisted</h2>
        <p>Dear <strong>{candidate_name}</strong>,</p>
        <p>We are pleased to inform you that after reviewing your resume, you have been <strong>Shortlisted</strong> for the role of <strong>{job_title}</strong>!</p>
        {f'<div style="background: #f8fafc; padding: 12px; border-left: 4px solid #10b981; margin: 16px 0;"><strong>Hiring Manager Notes:</strong> {notes}</div>' if notes else ''}
        <p>Our recruitment team will reach out to you shortly to schedule the next interview stage.</p>
        <br>
        <p>Best regards,<br><strong>Hiring & Recruitment Team</strong></p>
    </div>
    """
    return send_email_via_gmail(candidate_email, subject, html, to_name=candidate_name)


def send_rejection_notification(
    candidate_name: str,
    candidate_email: str,
    job_title: str = "Position",
    notes: Optional[str] = None
) -> Dict[str, Any]:
    """Send candidate rejection email notification."""
    subject = f"Update regarding your application for {job_title}"
    
    html = f"""
    <div style="font-family: Arial, sans-serif; padding: 24px; color: #1e293b; max-width: 600px; border: 1px solid #e2e8f0; border-radius: 12px;">
        <h2 style="color: #64748b; margin-top: 0;">Application Status Update</h2>
        <p>Dear <strong>{candidate_name}</strong>,</p>
        <p>Thank you for applying for the <strong>{job_title}</strong> role. After careful review, we regret to inform you that we will not be moving forward with your application at this time.</p>
        {f'<div style="background: #f8fafc; padding: 12px; border-left: 4px solid #94a3b8; margin: 16px 0;"><strong>Feedback:</strong> {notes}</div>' if notes else ''}
        <p>We appreciate your time and interest in our company, and we wish you the very best in your job search.</p>
        <br>
        <p>Best regards,<br><strong>Hiring & Recruitment Team</strong></p>
    </div>
    """
    return send_email_via_gmail(candidate_email, subject, html, to_name=candidate_name)


def send_shortlist_dispatch_to_hiring_manager(
    hm_email: str,
    hm_name: str,
    job_title: str,
    req_ref: str,
    candidate_count: int,
    candidates: list,
    dispatched_by: str,
    is_auto: bool,
    notes: Optional[str] = None
) -> Dict[str, Any]:
    """Send candidate shortlist delivery email to the Hiring Manager."""
    dispatch_type = "48h Sourcing Window Complete" if is_auto else f"Instant Dispatch by {dispatched_by}"
    subject = f"[{'Automated 48h Shortlist' if is_auto else '⚡ Instant Shortlist'}] {candidate_count} Candidates for {job_title} ({req_ref})"

    rows_html = ""
    for c in (candidates or [])[:10]:
        score_val = f"{round(c.get('match_score'))}%" if c.get("match_score") is not None else "Screened"
        skills_val = ", ".join((c.get("matched_skills") or [])[:4]) or "—"
        rows_html += f"""
        <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 8px; font-weight: bold; color: #0f172a;">{c.get('name', 'Candidate')}</td>
            <td style="padding: 10px 8px; color: #475569;">{c.get('vendor', 'Direct')}</td>
            <td style="padding: 10px 8px; color: #059669; font-weight: bold;">{score_val}</td>
            <td style="padding: 10px 8px; color: #64748b; font-size: 12px;">{skills_val}</td>
        </tr>
        """

    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 28px; color: #1e293b; max-width: 650px; border: 1px solid #e2e8f0; border-radius: 16px; background: #ffffff;">
        <div style="margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between;">
            <span style="background: {'#f0fdf4' if is_auto else '#eff6ff'}; color: {'#16a34a' if is_auto else '#2563eb'}; border: 1px solid {'#bbf7d0' if is_auto else '#bfdbfe'}; font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 20px; text-transform: uppercase;">
                {'⏱ ' if is_auto else '⚡ '}{dispatch_type}
            </span>
            <span style="font-size: 12px; color: #94a3b8; font-weight: bold;">{req_ref}</span>
        </div>
        
        <h2 style="color: #0f172a; margin: 8px 0 12px 0; font-size: 20px;">Candidate Shortlist Delivered</h2>
        <p style="font-size: 14px; line-height: 1.5; color: #334155;">
            Dear <strong>{hm_name or 'Hiring Manager'}</strong>,
        </p>
        <p style="font-size: 14px; line-height: 1.5; color: #334155;">
            The candidate shortlist for <strong>{job_title}</strong> has been dispatched. 
            There {'is' if candidate_count == 1 else 'are'} <strong>{candidate_count} qualified candidate{'s' if candidate_count != 1 else ''}</strong> ready for your interview scheduling and review.
        </p>

        {f'<div style="background: #f8fafc; border-left: 4px solid #3b82f6; padding: 12px 16px; border-radius: 6px; margin: 16px 0; font-size: 13px; color: #1e293b;"><strong>Notes:</strong> {notes}</div>' if notes else ''}

        <div style="margin: 20px 0; overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left;">
                <thead>
                    <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0; color: #475569; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;">
                        <th style="padding: 8px;">Candidate</th>
                        <th style="padding: 8px;">Vendor</th>
                        <th style="padding: 8px;">Score</th>
                        <th style="padding: 8px;">Matched Skills</th>
                    </tr>
                </thead>
                <tbody>
                    {rows_html if rows_html else '<tr><td colspan="4" style="padding: 12px; text-align: center; color: #94a3b8;">No candidates in this batch</td></tr>'}
                </tbody>
            </table>
        </div>

        <div style="margin-top: 24px; text-align: center;">
            <a href="http://localhost:5173/dashboard" style="background: #0f172a; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: bold; padding: 12px 24px; border-radius: 8px; display: inline-block;">
                Review Candidates in TermJobs →
            </a>
        </div>
        <p style="font-size: 11px; color: #94a3b8; text-align: center; margin-top: 20px;">
            TermJobs AI Talent Matching & Workflow Automation
        </p>
    </div>
    """
    return send_email_via_gmail(hm_email, subject, html)


WAITLIST_EMAIL_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark light">
<title>You’re one of the first on the TermJobs list</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500&display=swap" rel="stylesheet">
<style>
body{margin:0;padding:0;background:#f2f2ef;-webkit-text-size-adjust:100%}
a{text-decoration:none}
@media (max-width:620px){.px{padding-left:24px!important;padding-right:24px!important}.h1{font-size:44px!important;line-height:46px!important}.btn a{display:block!important}}
</style>
</head>
<body style="margin:0;padding:0;background:#f2f2ef;">
<!-- Subject: You’re in. Seriously early. -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#f2f2ef;">Your spot is saved. You’ll hear from us first. &#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f2f2ef;">
<tr><td align="center" style="padding:32px 12px;">
 <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#0a0a0a;border-radius:32px;font-family:'Plus Jakarta Sans',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;">

  <tr><td class="px" style="padding:36px 48px 0;">
   <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    <td style="color:#ffffff;font-size:13px;letter-spacing:5px;font-weight:500;">TERM JOBS</td>
    <td align="right" style="color:#8d8d94;font-size:13px;">Waiting list</td>
   </tr></table>
  </td></tr>

  <tr><td class="px" style="padding:56px 48px 0;">
   <span style="display:inline-block;border:1px solid #2e2e32;border-radius:999px;padding:8px 16px;color:#c9c9ce;font-size:13px;"><span style="color:#d9a441;">&#9679;</span>&nbsp; Early access member</span>
  </td></tr>

  <tr><td class="px" style="padding:28px 48px 0;">
   <h1 class="h1" style="margin:0;font-size:64px;line-height:64px;font-weight:500;letter-spacing:-3px;color:#ffffff;">You got in<br>early<span style="color:#56565c;">.</span></h1>
  </td></tr>

  <tr><td class="px" style="padding:24px 48px 0;color:#9a9aa1;font-size:17px;line-height:27px;font-weight:300;">
   Hi {{first_name}}, you’re officially on the TermJobs waiting list, one of the first to be here. Your profile and résumé are in, and we’re already lining up verified companies hiring for contract and permanent roles.
  </td></tr>

  <tr><td class="px" style="padding:44px 48px 0;color:#ffffff;font-size:13px;letter-spacing:3px;">WHAT HAPPENS NEXT</td></tr>
  <tr><td class="px" style="padding:12px 48px 0;">
   <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:16px;color:#ffffff;">
    <tr><td width="40" style="padding:16px 0;border-top:1px solid #232327;color:#d9a441;font-size:14px;">01</td><td style="padding:16px 0;border-top:1px solid #232327;">We review your profile and résumé</td></tr>
    <tr><td width="40" style="padding:16px 0;border-top:1px solid #232327;color:#d9a441;font-size:14px;">02</td><td style="padding:16px 0;border-top:1px solid #232327;">We match you with verified companies</td></tr>
    <tr><td width="40" style="padding:16px 0;border-top:1px solid #232327;border-bottom:1px solid #232327;color:#d9a441;font-size:14px;">03</td><td style="padding:16px 0;border-top:1px solid #232327;border-bottom:1px solid #232327;">You hear from us first, right here in your inbox</td></tr>
   </table>
  </td></tr>

  <tr><td class="px btn" style="padding:40px 48px 0;">
   <a href="{{website_url}}" style="display:inline-block;background:#ffffff;color:#0a0a0a;border-radius:999px;padding:18px 36px;font-size:16px;font-weight:500;text-align:center;">Visit TermJobs &nbsp;&rarr;</a>
  </td></tr>

  <tr><td class="px" style="padding:28px 48px 0;color:#8d8d94;font-size:15px;line-height:24px;font-weight:300;">
   Nothing else to do for now. Need to update your résumé? Just reply to this email.
  </td></tr>

  <tr><td class="px" style="padding:40px 48px 0;color:#ffffff;font-size:16px;line-height:24px;">
   Thanks for being early,<br><span style="color:#9a9aa1;">Team TermJobs</span>
  </td></tr>

  <tr><td class="px" style="padding:44px 48px 40px;">
   <div style="border-top:1px solid #232327;padding-top:22px;color:#5f5f66;font-size:12px;line-height:19px;">
    You’re receiving this because you joined the TermJobs waiting list with {{email}}.
   </div>
  </td></tr>

 </table>
</td></tr>
</table>
</body>
</html>"""


def send_candidate_waitlist_welcome_email(
    candidate_name: str,
    candidate_email: str,
    website_url: Optional[str] = None
) -> Dict[str, Any]:
    """Send waiting list confirmation email to candidate with custom early-access dark template."""
    from html import escape

    clean_email = (candidate_email or "").strip().lower()
    if not clean_email:
        return {"status": "skipped", "reason": "No candidate email provided"}

    raw_name = (candidate_name or "there").strip()
    first_name = raw_name.split()[0] if raw_name else "there"

    site_url = (
        website_url
        or os.getenv("INTERVIEW_PUBLIC_DOMAIN")
        or "https://termjobs.in"
    ).strip().rstrip("/")

    html = WAITLIST_EMAIL_TEMPLATE
    html = html.replace("{{first_name}}", escape(first_name))
    html = html.replace("{{website_url}}", site_url)
    html = html.replace("{{email}}", escape(clean_email))

    subject = "You’re in. Seriously early."
    return send_email_via_gmail(
        to_email=clean_email,
        subject=subject,
        html_content=html,
        to_name=raw_name,
    )
