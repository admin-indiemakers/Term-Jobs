import os
import re
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
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


def send_email_via_gmail(
    to_email: str,
    subject: str,
    html_content: str,
    sender_email: str = GMAIL_SENDER_EMAIL,
    app_password: str = GMAIL_APP_PASSWORD
) -> Dict[str, Any]:
    """Send an email to any recipient using Gmail SMTP."""
    if not to_email:
        return {"status": "skipped", "reason": "No candidate email provided"}

    if not sender_email or not app_password:
        return {"status": "skipped", "reason": "Gmail credentials not configured (GMAIL_SENDER_EMAIL / GMAIL_APP_PASSWORD)"}

    clean_password = app_password.replace(" ", "")

    msg = MIMEMultipart("alternative")
    msg["From"] = f"Hiring Team <{sender_email}>"
    msg["To"] = to_email
    msg["Subject"] = subject

    msg.attach(MIMEText(html_content, "html"))

    try:
        server = smtplib.SMTP("smtp.gmail.com", 587, timeout=10)
        server.starttls()
        server.login(sender_email, clean_password)
        server.send_message(msg)
        server.quit()
        
        return {
            "status": "success",
            "message": f"Email successfully delivered to {to_email} via Gmail SMTP"
        }
    except Exception as e:
        print(f"Error sending email via Gmail SMTP: {e}")
        return {"status": "failed", "error": f"Gmail SMTP error: {str(e)}"}


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
    return send_email_via_gmail(candidate_email, subject, html)


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
    return send_email_via_gmail(candidate_email, subject, html)


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
