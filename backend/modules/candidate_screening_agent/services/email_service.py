import os
import re
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any

GMAIL_SENDER_EMAIL = os.getenv("GMAIL_SENDER_EMAIL", "ashk68799@gmail.com")
GMAIL_APP_PASSWORD = os.getenv("GMAIL_APP_PASSWORD", "ivxvrrrgkjhcahda")


def extract_candidate_email(resume_text: str) -> str | None:
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
) -> dict[str, Any]:
    """Send an email to any recipient using Gmail SMTP."""
    if not to_email:
        return {"status": "skipped", "reason": "No candidate email provided"}

    clean_password = app_password.replace(" ", "")

    msg = MIMEMultipart("alternative")
    msg["From"] = f"Hiring Team <{sender_email}>"
    msg["To"] = to_email
    msg["Subject"] = subject

    msg.attach(MIMEText(html_content, "html"))

    try:
        server = smtplib.SMTP("smtp.gmail.com", 587)
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
        return {"status": "failed", "error": f"Gmail SMTP error: {e!s}"}


def send_shortlist_notification(
    candidate_name: str,
    candidate_email: str,
    job_title: str = "Position",
    notes: str | None = None
) -> dict[str, Any]:
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
    notes: str | None = None
) -> dict[str, Any]:
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
