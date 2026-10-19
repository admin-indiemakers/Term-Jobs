"""Security notifications for completed account credential changes."""
import datetime
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formatdate, make_msgid

from modules.identity.mail_transport import deliver_credentials_message

logger = logging.getLogger("account_notifications")


def send_account_change_email(user, *, previous_email, password_changed=False):
    prev = (previous_email or "").strip().lower()
    curr = (user.email or "").strip().lower()
    email_changed = bool(prev and curr and prev != curr)

    if not email_changed and not password_changed:
        return {"status": "not_requested"}

    try:
        from modules.identity.router import _get_gmail_creds
        from modules.interview.services.interview_service import _resolve_interview_domain

        sender, password = _get_gmail_creds()
        if not sender or not password:
            return {"status": "failed", "reason": "Account saved, but server mail credentials are not configured."}

        domain = _resolve_interview_domain().rstrip("/")
        login_url = f"{domain}/login"

        subject = "TermJobs — Security Notice: "
        if password_changed and email_changed:
            subject += "Password and Email Updated"
            change_headline = "Your Password & Login Email Have Been Updated"
        elif password_changed:
            subject += "Password Changed"
            change_headline = "Your Password Has Been Changed"
        else:
            subject += "Login Email Updated"
            change_headline = "Your Login Email Has Been Updated"

        change_items = []
        if password_changed:
            change_items.append("Your TermJobs account password has been updated. Your old password is no longer valid.")
        if email_changed:
            change_items.append(f"Your login email address has been changed from <strong>{prev}</strong> to <strong>{curr}</strong>.")

        items_html = "".join([f'<li style="margin-bottom:8px;color:#374151;">{item}</li>' for item in change_items])
        items_plain = "\n".join([f"- {item.replace('<strong>', '').replace('</strong>', '')}" for item in change_items])

        html_body = f"""\
<html>
<body style="font-family:Arial,sans-serif;background:#f4f6f8;padding:30px;margin:0;">
  <div style="max-width:540px;margin:auto;background:#fff;border-radius:12px;
              box-shadow:0 4px 20px rgba(0,0,0,.10);overflow:hidden;">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1e293b,#0f172a);padding:32px 36px 26px;">
      <p style="color:rgba(255,255,255,.75);font-size:12px;margin:0 0 6px;letter-spacing:1px;text-transform:uppercase;">TermJobs Security Alert</p>
      <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;">
        🛡️ Account Updated
      </h1>
    </div>

    <!-- Body -->
    <div style="padding:32px 36px;">
      <h2 style="color:#111827;font-size:17px;font-weight:700;margin:0 0 12px;">
        {change_headline}
      </h2>
      <p style="color:#4b5563;font-size:14px;margin:0 0 16px;line-height:1.5;">
        Hello {user.name or "there"},
      </p>
      <p style="color:#4b5563;font-size:14px;margin:0 0 16px;line-height:1.5;">
        This is an automated notification confirming recent security updates made to your TermJobs account.
      </p>

      <div style="background:#f8fafc;border-left:4px solid #3b82f6;padding:12px 16px;border-radius:4px;margin-bottom:24px;">
        <ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.6;">
          {items_html}
        </ul>
      </div>

      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px 16px;margin-bottom:24px;">
        <span style="color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:.5px;font-weight:600;">Active Login Email</span>
        <p style="color:#111827;font-size:14px;font-weight:700;margin:4px 0 0;">{curr}</p>
      </div>

      <p style="color:#6b7280;font-size:13px;margin:0 0 24px;line-height:1.5;">
        For your security, passwords are never transmitted in notification emails.
      </p>

      <!-- CTA Button -->
      <a href="{login_url}"
         style="display:inline-block;padding:12px 28px;
                background:linear-gradient(135deg,#2563eb,#1d4ed8);
                color:#fff;border-radius:8px;text-decoration:none;
                font-size:14px;font-weight:700;letter-spacing:.3px;">
        Sign In to TermJobs →
      </a>

      <div style="margin-top:28px;padding:12px 14px;background:#fef2f2;border-radius:8px;border:1px solid #fee2e2;">
        <p style="color:#991b1b;font-size:12px;margin:0;line-height:1.5;">
          <strong>Did you not authorize this change?</strong><br/>
          If you did not request or authorize this modification, please contact your organization administrator or TermJobs support immediately.
        </p>
      </div>

      <hr style="border:none;border-top:1px solid #f3f4f6;margin:28px 0 14px;" />
      <p style="color:#9ca3af;font-size:11px;margin:0;line-height:1.6;">
        TermJobs Platform Security Notification<br/>
        &copy; {datetime.datetime.now().year} TermJobs. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>"""

        plain_text = f"""TermJobs Security Notice: {change_headline}

Hello {user.name or "there"},

This is an automated notification confirming changes to your TermJobs account:

{items_plain}

Active Login Email: {curr}
Sign in: {login_url}

For your security, passwords are never transmitted in notification emails.
If you did not authorize this change, please contact your organization administrator or TermJobs support immediately.

© {datetime.datetime.now().year} TermJobs. All rights reserved.
"""

        recipients = [user.email]
        if email_changed and prev and prev != curr:
            recipients.append(prev)

        last_delivery = {"status": "success"}
        for recipient in set(recipients):
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"TermJobs <{sender}>"
            msg["To"] = recipient
            msg["Date"] = formatdate(localtime=True)
            msg["Message-ID"] = make_msgid(domain=sender.rsplit("@", 1)[-1])
            msg["X-Mailer"] = "TermJobs Security Service"
            msg.attach(MIMEText(plain_text, "plain", "utf-8"))
            msg.attach(MIMEText(html_body, "html", "utf-8"))

            res = deliver_credentials_message(msg, sender, password, recipient)
            if res.get("status") == "failed":
                last_delivery = res

        return last_delivery
    except Exception as e:
        logger.warning(f"send_account_change_email failed: {e}")
        return {"status": "failed", "reason": f"Account saved, but security email could not be sent: {e}"}

