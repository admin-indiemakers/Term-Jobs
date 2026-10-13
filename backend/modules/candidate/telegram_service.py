"""Telegram Bot Integration Service for TermJobs Candidate Talent Matching & 1-Click Outreach.

Provides:
- 1-Click Candidate Account Linking via deep-link: t.me/Termjobs_alertbot?start={candidate_id}
- Rich interactive Telegram Requisition Alerts with Inline Buttons:
    [ ✅ Yes, I am Available & Interested ]
    [ ❌ No Longer Available / Placed Elsewhere ]
- Callback query processing that automatically updates MongoDB, fast-tracks candidates,
  and updates candidate availability.
- Automatic long-polling background worker so local development works immediately
  without requiring a public domain / ngrok.
"""

import asyncio
import os
import re
import uuid
import secrets
import smtplib
import threading
import email.utils
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime, timezone
import httpx
from modules.shared.config import settings
from modules.shared.db import db

TELEGRAM_API_BASE = "https://api.telegram.org"

_GMAIL_SENDER = os.getenv("GMAIL_SENDER_EMAIL", "")
_GMAIL_APP_PW  = os.getenv("GMAIL_APP_PASSWORD", "")
_FRONTEND_URL  = os.getenv("FRONTEND_BASE_URL", "http://localhost:5173")


def _send_email_thread(to_email: str, subject: str, html_body: str, plain_text: str) -> None:
    """Fire-and-forget email sender — runs in a daemon thread."""
    sender = os.getenv("GMAIL_SENDER_EMAIL", "").strip()
    app_pw = os.getenv("GMAIL_APP_PASSWORD", "").strip()
    if not sender or not app_pw:
        from dotenv import load_dotenv
        load_dotenv(override=True)
        sender = os.getenv("GMAIL_SENDER_EMAIL", "").strip()
        app_pw = os.getenv("GMAIL_APP_PASSWORD", "").strip()

    if not sender or not app_pw or not to_email:
        return

    def _send():
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"]    = subject
            msg["From"]       = f"TermJob <{sender}>"
            msg["To"]         = to_email
            msg["Reply-To"]   = sender
            msg["Message-ID"] = email.utils.make_msgid(domain="termjob.in")
            msg["Date"]       = email.utils.formatdate(localtime=True)
            msg["X-Mailer"]   = "TermJob Notification Service"
            msg["Precedence"] = "bulk"
            msg.attach(MIMEText(plain_text, "plain", "utf-8"))
            msg.attach(MIMEText(html_body,  "html",  "utf-8"))
            with smtplib.SMTP("smtp.gmail.com", 587, timeout=15) as smtp:
                smtp.ehlo()
                smtp.starttls()
                smtp.ehlo()
                smtp.login(sender, app_pw)
                smtp.sendmail(sender, [to_email], msg.as_string())
            print(f"[TermJob EMAIL] Sent '{subject}' -> {to_email}")
        except Exception as exc:
            print(f"[TermJob EMAIL ERROR] {to_email}: {exc}")

    threading.Thread(target=_send, daemon=True).start()


def get_telegram_token() -> str:
    """Return the configured Telegram Bot Token."""
    return settings.telegram_bot_token or os.getenv("TELEGRAM_BOT_TOKEN", "").strip()


def get_telegram_bot_username() -> str:
    """Return the configured Telegram Bot Username."""
    return settings.telegram_bot_username or os.getenv("TELEGRAM_BOT_USERNAME", "Termjobs_alertbot").strip().lstrip("@")


async def get_bot_info() -> dict:
    """Check Telegram connection and retrieve bot profile."""
    token = get_telegram_token()
    if not token:
        return {"ok": False, "error": "TELEGRAM_BOT_TOKEN is not configured."}
    
    url = f"{TELEGRAM_API_BASE}/bot{token}/getMe"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get(url)
            return res.json()
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


async def send_candidate_requisition_alert(
    chat_id: int | str,
    requisition: dict,
    candidate: dict,
    outreach_token: str,
    match_score: float = 90.0,
    match_reasons: list = None
) -> dict:
    """Send a rich Telegram message with 1-click interactive RSVP buttons."""
    token = get_telegram_token()
    if not token or not chat_id:
        return {"ok": False, "error": "Missing token or chat_id."}

    req_title = requisition.get("title") or "Open Position"
    company_name = requisition.get("company_name") or "Enterprise Partner"
    cand_name = candidate.get("candidate_name") or candidate.get("name") or "there"

    # Format skills
    skills_list = requisition.get("skills") or []
    if isinstance(skills_list, list):
        skills_text = ", ".join(skills_list[:6])
    else:
        skills_text = str(skills_list)

    reasons_text = ""
    if match_reasons and len(match_reasons) > 0:
        reasons_text = f"\n💡 *Why you matched:* {match_reasons[0]}"

    message_text = (
        f"💼 *NEW MATCH: {req_title}*\n"
        f"🏢 *Organization:* {company_name}\n"
        f"⭐ *Match Fit:* {int(match_score)}% Score\n"
        f"🎯 *Key Requirements:* {skills_text}\n"
        f"{reasons_text}\n\n"
        f"Hi *{cand_name}*! Our AI talent engine ranked your profile among the *Top 20 best-fit candidates* for this requisition.\n\n"
        f"Because availability changes, please confirm with 1 tap below:"
    )

    inline_keyboard = [
        [
            {
                "text": "✅ Yes, I am Available & Interested",
                "callback_data": f"rsvp:{outreach_token}:interested"
            }
        ],
        [
            {
                "text": "❌ No Longer Available / Placed",
                "callback_data": f"rsvp:{outreach_token}:unavailable"
            }
        ]
    ]

    payload = {
        "chat_id": chat_id,
        "text": message_text,
        "parse_mode": "Markdown",
        "reply_markup": {
            "inline_keyboard": inline_keyboard
        }
    }

    url = f"{TELEGRAM_API_BASE}/bot{token}/sendMessage"
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.post(url, json=payload)
            data = res.json()
            if data.get("ok"):
                print(f"[TELEGRAM ALERT SENT] Successfully sent to chat_id={chat_id} for req={requisition.get('id')}")
                try:
                    cand_email = (candidate.get("candidate_email") or candidate.get("email") or "").lower()
                    now_iso = datetime.now(timezone.utc).isoformat()
                    db["candidate_outreach"].update_one(
                        {"token": outreach_token},
                        {"$set": {
                            "token": outreach_token,
                            "requisition_id": requisition.get("id", ""),
                            "requisition_title": req_title,
                            "company_name": company_name,
                            "candidate_id": candidate.get("id", ""),
                            "candidate_name": cand_name,
                            "candidate_email": cand_email,
                            "match_score": match_score,
                            "matched_skills": skills_list[:5] if isinstance(skills_list, list) else [],
                            "telegram_chat_id": str(chat_id),
                            "telegram_sent": True,
                            "status": "sent",
                            "created_at": now_iso
                        }},
                        upsert=True
                    )
                except Exception as out_err:
                    print(f"[TELEGRAM OUTREACH RECORD WARNING] {out_err}")
            else:
                print(f"[TELEGRAM ALERT FAILED] chat_id={chat_id}, err={data.get('description')}")

            # ── Mirror to candidate email (fire-and-forget) ─────────────────────
            cand_email = (candidate.get("candidate_email") or candidate.get("email") or "").strip()
            if cand_email:
                skills_bullets = "".join(
                    f"<li style='margin:3px 0;color:#374151;'>{s}</li>"
                    for s in (skills_list[:6] if isinstance(skills_list, list) else [])
                )
                rsvp_base = f"{_FRONTEND_URL}/rsvp/{outreach_token}"
                _html = f"""
<html><body style="font-family:Arial,sans-serif;background:#f4f6f8;padding:30px;margin:0;">
  <div style="max-width:540px;margin:auto;background:#fff;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,.10);overflow:hidden;">
    <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:30px 36px;">
      <p style="color:rgba(255,255,255,.7);font-size:11px;margin:0 0 6px;letter-spacing:1px;text-transform:uppercase;">TermJob Talent Engine</p>
      <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;">💼 New Job Match Found!</h1>
    </div>
    <div style="padding:28px 36px;">
      <div style="display:inline-block;padding:4px 12px;background:#ede9fe;border-radius:20px;margin-bottom:16px;">
        <span style="color:#5b21b6;font-size:11px;font-weight:700;">{int(match_score)}% MATCH SCORE</span>
      </div>
      <h2 style="color:#111827;font-size:18px;font-weight:700;margin:0 0 4px;">{req_title}</h2>
      <p style="color:#6b7280;font-size:13px;margin:0 0 20px;">🏢 {company_name}</p>
      <p style="color:#374151;font-size:14px;margin:0 0 8px;">Hi <strong>{cand_name}</strong>,</p>
      <p style="color:#6b7280;font-size:13px;line-height:1.6;margin:0 0 20px;">
        Our AI talent engine ranked your profile among the <strong>Top 20 best-fit candidates</strong> for this role.
      </p>
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:16px;margin-bottom:20px;">
        <p style="color:#6b7280;font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;margin:0 0 10px;">Key Requirements</p>
        <ul style="margin:0;padding-left:18px;">{skills_bullets}</ul>
      </div>
      <p style="color:#374151;font-size:14px;font-weight:600;margin:0 0 14px;">Are you available and interested?</p>
      <table style="border-collapse:collapse;"><tr>
        <td style="padding-right:10px;">
          <a href="{rsvp_base}?status=interested" style="display:inline-block;padding:12px 22px;background:#16a34a;color:#fff;border-radius:8px;text-decoration:none;font-size:13px;font-weight:700;">✅ Yes, I'm Interested</a>
        </td>
        <td>
          <a href="{rsvp_base}?status=unavailable" style="display:inline-block;padding:12px 22px;background:#dc2626;color:#fff;border-radius:8px;text-decoration:none;font-size:13px;font-weight:700;">❌ Not Available</a>
        </td>
      </tr></table>
      <hr style="border:none;border-top:1px solid #f3f4f6;margin:24px 0 14px;"/>
      <p style="color:#9ca3af;font-size:11px;margin:0;">You received this because your profile matched this role on TermJob.<br/>&copy; {datetime.now(timezone.utc).year} TermJob.</p>
    </div>
  </div>
</body></html>"""
                _plain = (
                    f"New Job Match: {req_title} at {company_name}\n\n"
                    f"Hi {cand_name},\n\n"
                    f"Your profile matched {int(match_score)}% for: {req_title} at {company_name}\n"
                    f"Key Skills: {skills_text}\n\n"
                    f"Are you available?\n"
                    f"  YES → {rsvp_base}?status=interested\n"
                    f"  NO  → {rsvp_base}?status=unavailable\n\n"
                    f"© TermJob"
                )
                _send_email_thread(
                    cand_email,
                    f"New Match: {req_title} at {company_name}",
                    _html,
                    _plain,
                )
            # ──────────────────────────────────────────────────────────
            return data
    except Exception as exc:
        print(f"[TELEGRAM SEND ERROR] {exc}")
        return {"ok": False, "error": str(exc)}


async def send_candidate_interview_scheduled_alert(
    chat_id: int | str,
    candidate_name: str,
    requisition_title: str,
    company_name: str,
    round_name: str,
    scheduled_date: str,
    scheduled_time: str,
    duration_minutes: int,
    meeting_link: str,
    passcode: str,
    candidate_email: str = "",  # optional — mirrors alert to email
) -> dict:
    """Send an instant Telegram alert + email to the candidate with their interview details."""
    token = get_telegram_token()
    if not token or not chat_id:
        return {"ok": False, "error": "Missing token or chat_id."}

    text = (
        f"📅 *INTERVIEW SCHEDULED: {round_name}*\n"
        f"🏢 *Company:* {company_name}\n"
        f"💼 *Position:* {requisition_title}\n"
        f"🗓️ *Date:* {scheduled_date or 'As Scheduled'}\n"
        f"⏰ *Time:* {scheduled_time or 'TBD'} ({duration_minutes} mins)\n"
        f"🔑 *Your Passcode:* `{passcode}`\n\n"
        f"Hi *{candidate_name}*, your interview has been confirmed on TermJobs!\n\n"
        f"Tap the button below to join your live video room:"
    )

    inline_keyboard = [
        [
            {
                "text": "🎥 Join Video Interview Room",
                "url": meeting_link
            }
        ]
    ]

    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "Markdown",
        "reply_markup": {
            "inline_keyboard": inline_keyboard
        }
    }

    url = f"{TELEGRAM_API_BASE}/bot{token}/sendMessage"
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.post(url, json=payload)
            result = res.json()

        # ── Mirror to candidate email (fire-and-forget) ──────────────────────
        if candidate_email and candidate_email.strip():
            _subj = f"Interview Confirmed: {round_name} — {requisition_title}"
            _html = f"""
<html><body style="font-family:Arial,sans-serif;background:#f4f6f8;padding:30px;margin:0;">
  <div style="max-width:540px;margin:auto;background:#fff;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,.10);overflow:hidden;">
    <div style="background:linear-gradient(135deg,#0f766e,#0891b2);padding:30px 36px;">
      <p style="color:rgba(255,255,255,.7);font-size:11px;margin:0 0 6px;letter-spacing:1px;text-transform:uppercase;">TermJob Interview</p>
      <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;">&#128197; Interview Confirmed!</h1>
    </div>
    <div style="padding:28px 36px;">
      <p style="color:#374151;font-size:15px;margin:0 0 8px;">Hi <strong>{candidate_name}</strong>,</p>
      <p style="color:#6b7280;font-size:13px;line-height:1.6;margin:0 0 24px;">
        Your interview has been scheduled on TermJob. Here are your details:
      </p>
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;margin-bottom:24px;">
        <div style="padding:12px 16px;border-bottom:1px solid #e5e7eb;">
          <span style="color:#6b7280;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;">Round</span>
          <p style="color:#111827;font-size:14px;font-weight:700;margin:4px 0 0;">{round_name}</p>
        </div>
        <div style="padding:12px 16px;border-bottom:1px solid #e5e7eb;">
          <span style="color:#6b7280;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;">Position</span>
          <p style="color:#111827;font-size:14px;font-weight:700;margin:4px 0 0;">{requisition_title} &mdash; {company_name}</p>
        </div>
        <div style="padding:12px 16px;border-bottom:1px solid #e5e7eb;">
          <span style="color:#6b7280;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;">Date &amp; Time</span>
          <p style="color:#111827;font-size:14px;font-weight:700;margin:4px 0 0;">{scheduled_date or 'As Scheduled'} &nbsp;&#8226;&nbsp; {scheduled_time or 'TBD'} ({duration_minutes} mins)</p>
        </div>
        <div style="padding:12px 16px;">
          <span style="color:#6b7280;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;">Passcode</span>
          <p style="color:#111827;font-size:16px;font-weight:700;letter-spacing:2px;margin:4px 0 0;font-family:monospace;">{passcode}</p>
        </div>
      </div>
      <a href="{meeting_link}" style="display:inline-block;padding:13px 28px;background:linear-gradient(135deg,#0f766e,#0891b2);color:#fff;border-radius:10px;text-decoration:none;font-size:14px;font-weight:700;">
        &#127909; Join Video Interview Room
      </a>
      <hr style="border:none;border-top:1px solid #f3f4f6;margin:24px 0 14px;"/>
      <p style="color:#9ca3af;font-size:11px;margin:0;">Good luck! The TermJob team is rooting for you.<br/>&copy; {datetime.now(timezone.utc).year} TermJob. All rights reserved.</p>
    </div>
  </div>
</body></html>"""
            _plain = (
                f"Interview Confirmed: {round_name}\n\n"
                f"Hi {candidate_name},\n\n"
                f"Position : {requisition_title} at {company_name}\n"
                f"Round    : {round_name}\n"
                f"Date     : {scheduled_date or 'As Scheduled'}\n"
                f"Time     : {scheduled_time or 'TBD'} ({duration_minutes} mins)\n"
                f"Passcode : {passcode}\n\n"
                f"Join here: {meeting_link}\n\n"
                f"Good luck! © TermJob"
            )
            _send_email_thread(candidate_email.strip(), _subj, _html, _plain)
        # ─────────────────────────────────────────────────────────────────────
        return result
    except Exception as exc:
        print(f"[TELEGRAM INTERVIEW ALERT ERROR] {exc}")
        return {"ok": False, "error": str(exc)}


async def process_telegram_update(update: dict) -> None:
    """Process incoming webhook or polled Telegram update."""
    token = get_telegram_token()
    if not token:
        return

    # Handle incoming messages
    if "message" in update:
        msg = update["message"]
        chat = msg.get("chat", {})
        chat_id = chat.get("id")
        text = (msg.get("text") or "").strip()
        from_user = msg.get("from", {})
        username = from_user.get("username") or from_user.get("first_name") or ""
        first_name = from_user.get("first_name") or "Candidate"

        if not chat_id:
            return

        command = text.split()[0].split('@')[0].lower() if text else ''
        if chat.get('type') != 'private':
            return
        link = db['telegram_links'].find_one({'chat_id': str(chat_id)})
        connected_candidate = db['candidates'].find_one({'telegram_chat_id': str(chat_id), 'candidate_email': link.get('candidate_email')}) if link else None
        if command in ('/job', '/jobs', '/requisitions', '/interviews', '/interview', '/applied', '/applications', '/test', '/alert', 'test', 'alert'):
            if not connected_candidate:
                await process_telegram_update({'message': {**msg, 'text': '/login'}})
                return
            if command in ('/interviews', '/interview'):
                email = connected_candidate['candidate_email']
                applications = list(db['candidate_submissions'].find({'candidate_email': email}))
                app_ids = [row.get('id') or row.get('submission_id') for row in applications]
                rows = list(db['interview_rounds'].find({'candidate_email': email, 'candidate_submission_id': {'$in': [value for value in app_ids if value]}, 'status': {'$nin': ['Cancelled', 'Completed']}}).sort('scheduled_date', 1))
                lines = ['Your scheduled interviews:']
                for row in rows[:10]:
                    application = next((app for app in applications if (app.get('id') or app.get('submission_id')) == row.get('candidate_submission_id') and app.get('requisition_id') == row.get('requisition_id')), None)
                    if not application: continue
                    req = db['requisitions'].find_one({'id': row.get('requisition_id'), 'tenant_id': row.get('tenant_id')})
                    if not req: continue
                    lines.append(f"• {req.get('title') or 'Interview'} — {row.get('round_name') or 'Company interview'}\n  {row.get('scheduled_date') or 'Date pending'} {row.get('scheduled_time') or ''} {row.get('scheduled_timezone') or ''}")
                if len(lines) == 1:
                    lines.append('No scheduled interviews were found for your applications. Applying to a job does not automatically schedule an interview. Use /applied to check your application status.')
            elif command in ('/applied', '/applications'):
                rows = list(db['candidate_submissions'].find({'candidate_email': connected_candidate['candidate_email']}).sort('created_at', -1).limit(10))
                lines = ['Your applications:']
                for row in rows:
                    req = db['requisitions'].find_one({'id': row.get('requisition_id')}) if row.get('requisition_id') else None
                    lines.append(f"• {row.get('requisition_title') or (req or {}).get('title') or 'Job application'} — {row.get('status') or 'Submitted'}")
                if not rows: lines.append('No applications were found for your connected account.')
            elif command in ('/test', '/alert', 'test', 'alert'):
                lines = ['Your candidate account is connected. Job and interview notifications are enabled.', 'Use /jobs for open jobs, /applied for your applications, and /interviews for scheduled interviews.']
            else:
                rows = list(db['requisitions'].find({'status': 'Published'}).sort('created_at', -1).limit(10))
                lines = ['Open jobs on TermJobs:']
                for row in rows:
                    lines.append(f"• {row.get('title') or 'Open role'}")
                if not rows: lines.append('No published jobs are available right now.')
            async with httpx.AsyncClient(timeout=10) as client:
                await client.post(f'{TELEGRAM_API_BASE}/bot{token}/sendMessage', json={'chat_id': chat_id, 'text': '\n'.join(lines), 'reply_markup': {'inline_keyboard': [[{'text': 'View jobs / apply', 'url': 'https://termjobs.in/open-roles'}]]}})
            return
        if command in ('/logout', '/login', '/start'):
            if chat.get('type') != 'private':
                return
            if command == '/logout':
                for collection in ('candidates', 'candidate_submissions', 'users'):
                    db[collection].update_many({'telegram_chat_id': {'$in': [str(chat_id), chat_id]}}, {'$unset': {'telegram_chat_id': '', 'telegram_username': '', 'telegram_connected_at': '', 'telegram_linked_at': ''}})
                db['telegram_links'].delete_many({'chat_id': {'$in': [str(chat_id), chat_id]}})
                db['candidate_telegram_login_states'].delete_many({'chat_id': str(chat_id)})
                payload = {'chat_id': chat_id, 'text': 'You are logged out of the TermJobs candidate bot. Job notifications to this chat are disabled. Use /login to reconnect.'}
            elif connected_candidate:
                payload = {'chat_id': chat_id, 'text': f"You are connected as {connected_candidate.get('candidate_name') or 'Candidate'}.\n\n/jobs — View open requisitions\n/applied — View your applications\n/logout — Disconnect notifications", 'reply_markup': {'inline_keyboard': [[{'text': 'Open TermJobs jobs', 'url': 'https://termjobs.in/open-roles'}]]}}
            else:
                from datetime import timedelta
                state = secrets.token_urlsafe(32)
                states = db['candidate_telegram_login_states']
                states.create_index('expires_at', expireAfterSeconds=0)
                states.delete_many({'chat_id': str(chat_id)})
                states.insert_one({'state': state, 'chat_id': str(chat_id), 'username': username, 'expires_at': datetime.now(timezone.utc) + timedelta(minutes=15)})
                payload = {'chat_id': chat_id, 'text': 'Sign in or create your TermJobs candidate account, then confirm connection to receive your job and interview notifications. This link expires in 15 minutes.', 'reply_markup': {'inline_keyboard': [[{'text': 'Sign in / Sign up', 'url': f'https://termjobs.in/candidate/telegram-login?state={state}'}]]}}
            async with httpx.AsyncClient(timeout=10) as client:
                await client.post(f'{TELEGRAM_API_BASE}/bot{token}/sendMessage', json=payload)
            return

        now_iso = datetime.now(timezone.utc).isoformat()

        # Check for email inside the message text
        email_match = re.search(r'[\w\.-]+@[\w\.-]+\.\w+', text)
        extracted_email = email_match.group(0).lower() if email_match else ""

        candidate_param = ""
        if text.startswith("/start"):
            parts = text.split(" ", 1)
            candidate_param = parts[1].strip() if len(parts) > 1 else ""

        target_email = extracted_email or (candidate_param if "@" in candidate_param else "")
        target_id = candidate_param if not target_email else ""

        # If email or candidate_param was provided:
        if target_email or target_id:
            # Typing another candidate's email is not proof of account ownership.
            await process_telegram_update({'message': {**msg, 'text': '/login'}})
            return

        if not db['telegram_links'].find_one({'chat_id': str(chat_id)}):
            await process_telegram_update({'message': {**msg, 'text': '/login'}})
        return

    if "callback_query" in update:
        cb = update["callback_query"]
        cb_id = cb.get("id")
        data = cb.get("data", "")
        message = cb.get("message", {})
        chat_id = message.get("chat", {}).get("id")
        message_id = message.get("message_id")
        from_user = cb.get("from", {})
        sender_name = from_user.get("first_name", "Candidate")
        if not db['telegram_links'].find_one({'chat_id': str(chat_id)}):
            async with httpx.AsyncClient(timeout=10) as client:
                await client.post(f'{TELEGRAM_API_BASE}/bot{token}/answerCallbackQuery', json={'callback_query_id': cb_id, 'text': 'You are logged out. Use /login to reconnect.', 'show_alert': True})
            return

        # Format: rsvp:{token}:{action}
        if data.startswith("rsvp:"):
            parts = data.split(":")
            if len(parts) >= 3:
                outreach_token = parts[1]
                action = parts[2]

                # 1. Immediately acknowledge callback query to stop Telegram button spinner instantly (<150ms)
                initial_toast = "⚡ Fast-Tracking your profile & generating link…" if action == "interested" else "Updating your profile status…"
                try:
                    async with httpx.AsyncClient(timeout=4.0) as quick_client:
                        await quick_client.post(
                            f"{TELEGRAM_API_BASE}/bot{token}/answerCallbackQuery",
                            json={"callback_query_id": cb_id, "text": initial_toast, "show_alert": False}
                        )
                except Exception as ack_err:
                    print(f"[TELEGRAM ACK ERROR] {ack_err}")

                # 2. Process RSVP on worker thread to avoid blocking asyncio event loop
                from modules.candidate.outreach_service import handle_candidate_rsvp
                rsvp_result = await asyncio.to_thread(handle_candidate_rsvp, outreach_token, action)

                cand_name = rsvp_result.get("candidate_name") or sender_name
                req_title = rsvp_result.get("requisition_title") or "the position"
                company = rsvp_result.get("company_name") or "our client"
                meeting_link = rsvp_result.get("meeting_link")
                portal_link = rsvp_result.get("candidate_portal_link")
                passcode = rsvp_result.get("candidate_passcode") or "TJ-FAST-TRACK"

                reply_markup = None
                if action == "interested":
                    interview_section = ""
                    if meeting_link:
                        interview_section = (
                            f"\n\n🎥 *Your Live Interview Room:*\n"
                            f"🔗 {meeting_link}\n\n"
                            f"🔑 *Candidate Passcode:* `{passcode}`\n\n"
                            f"_You can enter your interview room immediately or at your scheduled convenience._"
                        )

                    updated_text = (
                        f"✅ *STATUS CONFIRMED: AVAILABLE & INTERESTED*\n\n"
                        f"Awesome, *{cand_name}*! Your profile has been fast-tracked for:\n"
                        f"📌 *{req_title}* at *{company}*"
                        f"{interview_section}"
                    )

                    if meeting_link:
                        keyboard_buttons = [
                            [{"text": "🎥 Enter Video Interview Room", "url": meeting_link}]
                        ]
                        if portal_link:
                            keyboard_buttons.append([{"text": "🚀 Candidate Portal Login", "url": portal_link}])
                        reply_markup = {"inline_keyboard": keyboard_buttons}
                else:
                    updated_text = (
                        f"❌ *STATUS CONFIRMED: PLACED ELSEWHERE / UNAVAILABLE*\n\n"
                        f"Thank you for letting us know, *{cand_name}*!\n\n"
                        f"We have updated your profile so recruiters will not disturb you while you are unavailable. "
                        f"Best of luck in your current role!"
                    )

                # 3. Dispatch message edit and direct interview link concurrently in parallel
                async with httpx.AsyncClient(timeout=8.0) as client:
                    tasks = []

                    if chat_id and message_id:
                        edit_payload = {
                            "chat_id": chat_id,
                            "message_id": message_id,
                            "text": updated_text,
                            "parse_mode": "Markdown"
                        }
                        if reply_markup:
                            edit_payload["reply_markup"] = reply_markup
                        tasks.append(client.post(
                            f"{TELEGRAM_API_BASE}/bot{token}/editMessageText",
                            json=edit_payload
                        ))

                    if action == "interested" and chat_id and meeting_link:
                        new_msg = (
                            f"🎉 *Here is your Live Interview Room Link!*\n\n"
                            f"💼 *Position:* {req_title}\n"
                            f"🏢 *Company:* {company}\n"
                            f"🔑 *Passcode:* `{passcode}`\n\n"
                            f"🎥 *Meeting Room:*\n{meeting_link}\n\n"
                            f"Tap below to join the live video room:"
                        )
                        tasks.append(client.post(
                            f"{TELEGRAM_API_BASE}/bot{token}/sendMessage",
                            json={
                                "chat_id": chat_id,
                                "text": new_msg,
                                "parse_mode": "Markdown",
                                "reply_markup": reply_markup
                            }
                        ))

                    if tasks:
                        await asyncio.gather(*tasks, return_exceptions=True)

                print(f"[TELEGRAM RSVP PROCESSED] Token={outreach_token} Action={action} Candidate={cand_name} MeetingLink={meeting_link}")
                return


# --- Long Polling Background Worker ---
_polling_task = None
_is_polling = False


async def telegram_polling_loop():
    """Continuous long-polling runner to process updates without requiring public webhooks."""
    global _is_polling
    _is_polling = True
    offset = 0
    print("[TELEGRAM WORKER] Starting Telegram long-polling worker...")

    # Ensure webhook is cleared so long-polling can start cleanly without 409 webhook conflict
    token = get_telegram_token()
    if token:
        try:
            async with httpx.AsyncClient(timeout=10.0) as init_client:
                del_resp = await init_client.post(
                    f"{TELEGRAM_API_BASE}/bot{token}/deleteWebhook",
                    json={"drop_pending_updates": True}
                )
                if del_resp.status_code == 200 and del_resp.json().get("ok"):
                    print("[TELEGRAM WORKER] Verified webhook is cleared for long-polling.")
        except Exception as e:
            print(f"[TELEGRAM WORKER] Note on webhook reset: {e}")

    while _is_polling:
        token = get_telegram_token()
        if not token:
            await asyncio.sleep(5)
            continue

        try:
            url = f"{TELEGRAM_API_BASE}/bot{token}/getUpdates"
            params = {"offset": offset, "timeout": 25}

            async with httpx.AsyncClient(timeout=35.0) as client:
                res = await client.get(url, params=params)
                if res.status_code == 200:
                    data = res.json()
                    updates = data.get("result", [])
                    for update in updates:
                        offset = max(offset, update["update_id"] + 1)
                        try:
                            asyncio.create_task(process_telegram_update(update))
                        except Exception as update_err:
                            print(f"[TELEGRAM UPDATE PROCESS ERROR] {update_err}")
                elif res.status_code == 409:
                    # Conflict: another polling instance or webhook is active
                    err_msg = ""
                    try:
                        err_payload = res.json()
                        err_msg = err_payload.get("description", res.text)
                    except Exception:
                        err_msg = res.text

                    if "webhook" in err_msg.lower():
                        print(f"[TELEGRAM WORKER 409] Active webhook conflict ({err_msg}). Clearing webhook...")
                        try:
                            await client.post(
                                f"{TELEGRAM_API_BASE}/bot{token}/deleteWebhook",
                                json={"drop_pending_updates": False}
                            )
                        except Exception:
                            pass
                    else:
                        print(f"[TELEGRAM WORKER 409] Conflict: {err_msg}. Another bot instance is active. Retrying in 60s...")
                    await asyncio.sleep(60)
                else:
                    await asyncio.sleep(3)
        except asyncio.CancelledError:
            print("[TELEGRAM WORKER] Polling task cancelled.")
            break
        except Exception as err:
            # Network hiccup or timeout, wait briefly and retry
            await asyncio.sleep(4)


def start_telegram_polling():
    """Start polling loop in background event loop."""
    global _polling_task
    if _polling_task is None or _polling_task.done():
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                _polling_task = loop.create_task(telegram_polling_loop())
            else:
                print("[TELEGRAM WORKER] Event loop not running yet.")
        except RuntimeError:
            pass


def stop_telegram_polling():
    """Stop the polling loop."""
    global _is_polling, _polling_task
    _is_polling = False
    if _polling_task and not _polling_task.done():
        _polling_task.cancel()
