"""
Interview Scheduling business logic and Hosted Domain Meeting Room Integration.
"""
import os
import random
import string
import time
import jwt
import urllib.parse
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
import uuid
import logging

logger = logging.getLogger(__name__)

from modules.shared.db import get_session, db
from modules.interview.domain.models import InterviewSchedule, InterviewStatus, InterviewRound, InterviewChatMessage
from modules.calendar.domain.models import CalendarConfig
from modules.candidate.domain.models import CandidateSubmission

LINK_EXPIRATION_HOURS = 10


def is_round_link_expired(round_doc_or_obj) -> bool:
    """Return True if the AI interview link has expired (strictly 10 hours validity limit)."""
    if not round_doc_or_obj:
        return True

    now = datetime.now(timezone.utc)

    # 1. Check explicit expires_at
    expires_at = getattr(round_doc_or_obj, "expires_at", None)
    if expires_at is None and isinstance(round_doc_or_obj, dict):
        expires_at = round_doc_or_obj.get("expires_at")

    if expires_at:
        if isinstance(expires_at, str):
            try:
                expires_at = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
            except Exception:
                expires_at = None
        if isinstance(expires_at, datetime):
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            return now > expires_at

    # 2. Fallback to created_at + 10 hours
    created_at = getattr(round_doc_or_obj, "created_at", None)
    if created_at is None and isinstance(round_doc_or_obj, dict):
        created_at = round_doc_or_obj.get("created_at")

    if created_at:
        if isinstance(created_at, str):
            try:
                created_at = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
            except Exception:
                created_at = None
        if isinstance(created_at, datetime):
            if created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=timezone.utc)
            return now > (created_at + timedelta(hours=LINK_EXPIRATION_HOURS))

    return False


def get_round_expiration_info(round_doc_or_obj) -> dict:
    """Compute expiration metadata for an interview round."""
    now = datetime.now(timezone.utc)
    created_at = getattr(round_doc_or_obj, "created_at", None)
    if created_at is None and isinstance(round_doc_or_obj, dict):
        created_at = round_doc_or_obj.get("created_at")

    if isinstance(created_at, str):
        try:
            created_at = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        except Exception:
            created_at = None

    if isinstance(created_at, datetime) and created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)

    expires_at = getattr(round_doc_or_obj, "expires_at", None)
    if expires_at is None and isinstance(round_doc_or_obj, dict):
        expires_at = round_doc_or_obj.get("expires_at")

    if isinstance(expires_at, str):
        try:
            expires_at = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
        except Exception:
            expires_at = None

    if isinstance(expires_at, datetime) and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if not expires_at:
        if created_at:
            expires_at = created_at + timedelta(hours=LINK_EXPIRATION_HOURS)
        else:
            expires_at = now + timedelta(hours=LINK_EXPIRATION_HOURS)

    is_expired = now > expires_at
    remaining_secs = max(0, int((expires_at - now).total_seconds())) if not is_expired else 0

    return {
        "is_expired": is_expired,
        "expires_at": expires_at.isoformat(),
        "remaining_seconds": remaining_secs,
        "valid_duration_hours": LINK_EXPIRATION_HOURS,
    }


def _generate_candidate_passcode() -> str:
    """Generate a clean, memorable candidate interview passcode like TJ-INT-5829."""
    digits = "".join(random.choices(string.digits, k=4))
    return f"TJ-INT-{digits}"


def send_interview_invitation_email(
    candidate_name: str,
    candidate_email: str,
    requisition_title: str,
    company_name: str,
    round_name: str,
    scheduled_date: str,
    scheduled_time: str,
    duration_minutes: int,
    meeting_link: str,
    candidate_portal_link: str,
    passcode: str,
    instructions: str = "",
) -> Dict[str, Any]:
    """Sends an official HTML interview invitation with hosted domain meeting link & passcode."""
    from modules.candidate_screening_agent.services.email_service import send_email_via_gmail
    
    subject = f"Interview Invitation: {round_name} for {requisition_title} at {company_name}"
    
    html = f"""<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
    <tr>
      <td style="padding: 24px 32px; background-color: #0f172a; text-align: left;">
        <span style="font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">TermJobs</span>
        <span style="font-size: 11px; font-weight: 700; color: #38bdf8; background: rgba(56,189,248,0.15); padding: 3px 8px; border-radius: 6px; margin-left: 8px; text-transform: uppercase;">Interview Portal</span>
      </td>
    </tr>
    <tr>
      <td style="padding: 32px;">
        <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 0 0 12px 0;">Interview Invitation Confirmed</h2>
        <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 20px 0;">
          Hi <strong>{candidate_name}</strong>,<br/>
          You have been scheduled for <strong>{round_name}</strong> for the <strong>{requisition_title}</strong> role at <strong>{company_name}</strong>.
        </p>

        <!-- Meeting Details Box -->
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          <table width="100%" border="0" cellspacing="0" cellpadding="6">
            <tr>
              <td style="font-size: 12px; color: #64748b; font-weight: 700; text-transform: uppercase; width: 35%;">Role</td>
              <td style="font-size: 14px; color: #0f172a; font-weight: 800;">{requisition_title}</td>
            </tr>
            <tr>
              <td style="font-size: 12px; color: #64748b; font-weight: 700; text-transform: uppercase;">Hiring Company</td>
              <td style="font-size: 14px; color: #0f172a; font-weight: 700;">{company_name}</td>
            </tr>
            <tr>
              <td style="font-size: 12px; color: #64748b; font-weight: 700; text-transform: uppercase;">Scheduled Date</td>
              <td style="font-size: 14px; color: #0f172a; font-weight: 700;">📅 {scheduled_date or 'To Be Decided'}</td>
            </tr>
            <tr>
              <td style="font-size: 12px; color: #64748b; font-weight: 700; text-transform: uppercase;">Scheduled Time</td>
              <td style="font-size: 14px; color: #0f172a; font-weight: 700;">⏰ {scheduled_time or 'TBD'} ({duration_minutes} minutes)</td>
            </tr>
            <tr>
              <td style="font-size: 12px; color: #64748b; font-weight: 700; text-transform: uppercase;">Candidate Passcode</td>
              <td style="font-size: 16px; color: #059669; font-weight: 900; font-family: monospace;">🔑 {passcode}</td>
            </tr>
          </table>
        </div>

        <!-- Link Expiration Banner -->
        <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 12px 16px; margin-bottom: 24px; font-size: 13px; color: #991b1b; line-height: 1.5;">
          ⏱️ <strong>Link Expiration Notice:</strong> This AI interview link and passcode are strictly valid for <strong>10 hours</strong> from delivery. Please complete your interview within this window.
        </div>

        <!-- Join Video Room Button -->
        <div style="text-align: center; margin-bottom: 24px;">
          <a href="{meeting_link}" target="_blank" style="background-color: #0f172a; color: #ffffff; font-size: 14px; font-weight: 800; text-decoration: none; padding: 14px 28px; border-radius: 10px; display: inline-block; box-shadow: 0 4px 10px rgba(15,23,42,0.25);">
            🎥 Join TermJobs Video Interview Room
          </a>
        </div>

        <!-- Secondary Portal Link -->
        <div style="text-align: center; margin-bottom: 24px;">
          <a href="{candidate_portal_link}" target="_blank" style="color: #2563eb; font-size: 13px; font-weight: 700; text-decoration: underline;">
            Or log in to your Candidate Interview Portal
          </a>
        </div>

        {f'<div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 6px; font-size: 13px; color: #92400e; margin-bottom: 20px;"><strong>Special Instructions:</strong> {instructions}</div>' if instructions else ''}

        <div style="font-size: 12px; color: #94a3b8; line-height: 1.5; border-top: 1px solid #e2e8f0; padding-top: 16px;">
          Please join a few minutes prior to the scheduled time using Google Chrome, Safari, or Microsoft Edge. Grant camera and microphone access when prompted.
        </div>
      </td>
    </tr>
    <tr>
      <td style="padding: 16px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8;">
        TermJobs AI Talent & Interview Platform &copy; {datetime.now().year}
      </td>
    </tr>
  </table>
</body>
</html>"""

    return send_email_via_gmail(candidate_email, subject, html)


def normalize_cal_url(raw_input: str, event_slug: str = "30min") -> tuple[str, str]:
    if not raw_input:
        return "termjobs/interview", "https://cal.com/termjobs/interview"
    trimmed = raw_input.strip().rstrip("/")
    if trimmed.startswith("https://"):
        trimmed = trimmed[8:]
    elif trimmed.startswith("http://"):
        trimmed = trimmed[7:]
        
    trimmed = trimmed.rstrip("/")
    if trimmed.startswith("cal.com/"):
        path = trimmed[8:]
    elif trimmed == "cal.com":
        path = ""
    else:
        path = trimmed
        
    segments = [s for s in path.split("/") if s]
    if not segments:
        return "termjobs/interview", "https://cal.com/termjobs/interview"
        
    if len(segments) == 1:
        slug = (event_slug or "30min").lstrip("/")
        embed_path = f"{segments[0]}/{slug}"
        full_url = f"https://cal.com/{segments[0]}/{slug}"
    else:
        embed_path = "/".join(segments)
        full_url = f"https://cal.com/{embed_path}"
        
    return embed_path, full_url


def get_company_cal_config(tenant_id: str) -> Dict[str, Any]:
    """Fetch the company's Cal.com / Cal.diy configuration."""
    with get_session() as session:
        config = session.query(CalendarConfig).filter(CalendarConfig.tenant_id == tenant_id).first()
        if config:
            return {
                "cal_link": config.cal_link or "https://cal.com/",
                "cal_username": config.cal_username or "",
                "event_slug": config.event_slug or "30min",
                "default_duration": config.default_duration or 60,
                "default_timezone": config.default_timezone or "Asia/Kolkata",
            }
    return {
        "cal_link": "https://cal.com/",
        "cal_username": "",
        "event_slug": "30min",
        "default_duration": 60,
        "default_timezone": "Asia/Kolkata",
    }


def generate_calendar_links(interview: Dict[str, Any], base_url: Optional[str] = None) -> Dict[str, str]:
    """
    Generates hosted TermJobs domain video room links + 1-click fallback sync links.
    """
    confirmed = interview.get("confirmed_slot") or (interview.get("proposed_slots") and interview["proposed_slots"][0]) or {}
    date = confirmed.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    start_time = confirmed.get("start_time", "10:00")
    end_time = confirmed.get("end_time", "11:00")
    
    cand_name = interview.get("candidate_name", "Candidate")
    cand_email = interview.get("candidate_email", "")
    req_title = interview.get("requisition_title", "Role")
    
    # Priority: Native TermJobs hosted room on our domain
    raw_base = (base_url or os.getenv("FRONTEND_BASE_URL") or os.getenv("API_PUBLIC_BASE_URL") or "https://termjobs.in").strip().rstrip("/")
    round_identifier = interview.get("round_id") or interview.get("id") or "active"
    
    meeting_link = interview.get("meeting_link")
    if not meeting_link or "cal.com" in meeting_link.lower():
        meeting_link = f"{raw_base}/interview/room/{round_identifier}"
    
    location = meeting_link
    
    desc_lines = [
        f"Role: {req_title}",
        f"Candidate: {cand_name} ({cand_email})",
        f"Interviewer: {interview.get('interviewer_name', '')} ({interview.get('interviewer_email', '')})",
        f"Company: {interview.get('company_name', 'Company')}",
        f"TermJobs Video Room: {meeting_link}",
    ]
    if interview.get("candidate_passcode"):
        desc_lines.append(f"Candidate Passcode: {interview.get('candidate_passcode')}")
    if interview.get("candidate_portal_link"):
        desc_lines.append(f"Candidate Portal: {interview.get('candidate_portal_link')}")
    if interview.get("notes"):
        desc_lines.append(f"Notes: {interview.get('notes')}")
        
    description = "\n".join(desc_lines)
    
    clean_date = date.replace("-", "")
    clean_start = start_time.replace(":", "") + "00"
    clean_end = end_time.replace(":", "") + "00"
    start_dt_str = f"{clean_date}T{clean_start}Z"
    end_dt_str = f"{clean_date}T{clean_end}Z"
    
    google_params = {
        "action": "TEMPLATE",
        "text": f"{interview.get('interview_round', 'Interview')}: {cand_name} - {req_title}",
        "details": description,
        "location": location,
        "dates": f"{start_dt_str}/{end_dt_str}",
    }
    google_url = f"https://calendar.google.com/calendar/render?{urllib.parse.urlencode(google_params)}"
    
    outlook_params = {
        "path": "/calendar/action/compose",
        "rru": "addevent",
        "subject": f"{interview.get('interview_round', 'Interview')}: {cand_name} - {req_title}",
        "body": description,
        "location": location,
        "startdt": f"{date}T{start_time}:00",
        "enddt": f"{date}T{end_time}:00",
    }
    outlook_url = f"https://outlook.live.com/calendar/0/deeplink/compose?{urllib.parse.urlencode(outlook_params)}"
    
    ics_url = f"/api/interviews/{interview.get('id')}/invite.ics"
    
    return {
        "meeting_link": meeting_link,
        "meeting_url": meeting_link,
        "cal_booking_url": meeting_link,
        "cal_path": meeting_link,
        "google": google_url,
        "outlook": outlook_url,
        "ics": ics_url,
        "provider": "termjobs_hosted",
    }


def generate_ics_content(interview: Dict[str, Any]) -> str:
    """Builds a standard RFC 5545 iCalendar (.ics) string with alarms."""
    confirmed = interview.get("confirmed_slot") or (interview.get("proposed_slots") and interview["proposed_slots"][0]) or {}
    date = confirmed.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    start_time = confirmed.get("start_time", "10:00")
    end_time = confirmed.get("end_time", "11:00")
    
    clean_date = date.replace("-", "")
    start_dt = f"{clean_date}T{start_time.replace(':', '')}00"
    end_dt = f"{clean_date}T{end_time.replace(':', '')}00"
    now_stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    
    raw_base = (os.getenv("FRONTEND_BASE_URL") or os.getenv("API_PUBLIC_BASE_URL") or "https://termjobs.in").strip().rstrip("/")
    location = interview.get("meeting_link") or f"{raw_base}/interview/room/{interview.get('round_id') or interview.get('id')}"
    if "cal.com" in location.lower():
        location = f"{raw_base}/interview/room/{interview.get('round_id') or interview.get('id')}"
    
    summary = f"{interview.get('interview_round', 'Interview')} - {interview.get('candidate_name', 'Candidate')} ({interview.get('requisition_title', 'Role')})"
    description = (
        f"Interview for {interview.get('requisition_title', 'Role')}\\n"
        f"Candidate: {interview.get('candidate_name', '')} ({interview.get('candidate_email', '')})\\n"
        f"Company: {interview.get('company_name', '')}\\n"
        f"Interviewer: {interview.get('interviewer_name', '')} ({interview.get('interviewer_email', '')})\\n"
        f"Meeting Link: {location}\\n"
        f"Notes: {interview.get('notes', '')}"
    )

    ics_payload = f"""BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//TermJobs Workforce Platform//Hosted Interview//EN
CALSCALE:GREGORIAN
METHOD:REQUEST
BEGIN:VEVENT
UID:{interview.get('id', uuid.uuid4().hex)}@termjobs.com
DTSTAMP:{now_stamp}
DTSTART:{start_dt}
DTEND:{end_dt}
SUMMARY:{summary}
DESCRIPTION:{description}
LOCATION:{location}
STATUS:CONFIRMED
BEGIN:VALARM
TRIGGER:-PT15M
ACTION:DISPLAY
DESCRIPTION:Reminder: Upcoming interview with {interview.get('candidate_name', 'candidate')} in 15 minutes
END:VALARM
END:VEVENT
END:VCALENDAR"""
    return ics_payload.strip()


def create_interview_proposal(
    data: Dict[str, Any],
    tenant_id: str,
    company_name: str = "",
    origin: Optional[str] = None
) -> Dict[str, Any]:
    """Create a new interview proposal from the Hiring Manager, generating hosted domain links and initializing the InterviewRound."""
    raw_origin = (origin or data.get("origin") or os.getenv("FRONTEND_BASE_URL") or os.getenv("API_PUBLIC_BASE_URL") or "https://termjobs.in").strip().rstrip("/")
    base_url = raw_origin
    
    cand_sub_id = data.get("candidate_submission_id", "")
    round_name = (data.get("interview_round") or "Technical Round 1").strip()
    slots = data.get("proposed_slots") or []
    slot = slots[0] if slots else {}
    date_str = slot.get("date", "")
    time_str = slot.get("start_time", "")
    cand_email = (data.get("candidate_email") or "").strip()
    cand_name = (data.get("candidate_name") or "Candidate").strip()
    
    with get_session() as session:
        # Check or create associated InterviewRound
        round_obj = session.query(InterviewRound).filter(
            InterviewRound.candidate_submission_id == cand_sub_id,
            InterviewRound.round_name == round_name,
            InterviewRound.status != "Cancelled"
        ).first()
        
        if not round_obj:
            passcode = _generate_candidate_passcode()
            cand_token = str(uuid.uuid4())
            interviewer_token = str(uuid.uuid4())
            room_id = f"room_round_{uuid.uuid4().hex[:10]}"
            now_utc = datetime.now(timezone.utc)
            expires_at_val = now_utc + timedelta(hours=LINK_EXPIRATION_HOURS)
            
            round_obj = InterviewRound(
                tenant_id=tenant_id,
                requisition_id=data.get("requisition_id", ""),
                requisition_title=data.get("requisition_title", "Untitled Role"),
                candidate_submission_id=cand_sub_id,
                candidate_name=cand_name,
                candidate_email=cand_email,
                round_number=1,
                round_name=round_name,
                round_type="Technical",
                scheduled_date=date_str,
                scheduled_time=time_str,
                duration_minutes=int(data.get("duration_minutes", 45)),
                interviewer_name=data.get("interviewer_name", ""),
                interviewer_email=data.get("interviewer_email", ""),
                interviewer_role="Interviewer",
                instructions=data.get("notes", ""),
                internal_notes="",
                candidate_passcode=passcode,
                candidate_token=cand_token,
                interviewer_token=interviewer_token,
                room_id=room_id,
                status="Scheduled",
                evaluation={},
                expires_at=expires_at_val,
                created_by=company_name or "Hiring Team",
                created_at=now_utc,
                updated_at=now_utc,
            )
            session.add(round_obj)
            session.flush()

        hosted_meeting_link = f"{base_url}/interview/room/{round_obj.id}"
        cand_portal_link = f"{base_url}/interview/candidate/login?token={round_obj.candidate_token}&email={urllib.parse.quote(cand_email)}&passcode={round_obj.candidate_passcode}"
        interviewer_link = f"{base_url}/interview/staff?token={round_obj.interviewer_token}"

        req_meeting_link = (data.get("meeting_link") or "").strip()
        if not req_meeting_link or "cal.com" in req_meeting_link.lower() or data.get("use_hosted_room", True):
            meeting_link = hosted_meeting_link
        else:
            meeting_link = req_meeting_link

        interview = InterviewSchedule(
            tenant_id=tenant_id,
            company_name=company_name or "Company",
            calendar_provider="termjobs_hosted",
            requisition_id=data.get("requisition_id"),
            requisition_title=data.get("requisition_title", "Untitled Role"),
            candidate_submission_id=cand_sub_id,
            candidate_name=cand_name,
            candidate_email=cand_email,
            vendor_id=data.get("vendor_id"),
            vendor_name=data.get("vendor_name", "Vendor"),
            interview_round=round_name,
            interviewer_name=data.get("interviewer_name", ""),
            interviewer_email=data.get("interviewer_email", ""),
            meeting_link=meeting_link,
            round_id=round_obj.id,
            candidate_passcode=round_obj.candidate_passcode,
            platform="TermJobs Video Room",
            proposed_slots=data.get("proposed_slots", []),
            confirmed_slot=data.get("confirmed_slot", {}),
            status=InterviewStatus.PROPOSED_BY_COMPANY.value,
            notes=data.get("notes", ""),
            vendor_notes="",
        )
        
        session.add(interview)
        session.flush()
        doc = interview.to_doc()
        session.commit()

    doc["round_id"] = round_obj.id
    doc["room_id"] = round_obj.room_id
    doc["candidate_passcode"] = round_obj.candidate_passcode
    doc["candidate_token"] = round_obj.candidate_token
    doc["candidate_portal_link"] = cand_portal_link
    doc["interviewer_link"] = interviewer_link
    doc["meeting_link"] = meeting_link
    doc["calendar_links"] = generate_calendar_links(doc, base_url=base_url)

    # Automatically dispatch notification to candidate
    try:
        if cand_email:
            send_interview_invitation_email(
                candidate_name=cand_name,
                candidate_email=cand_email,
                requisition_title=data.get("requisition_title", "Untitled Role"),
                company_name=company_name or "TermJobs Partner",
                round_name=round_name,
                scheduled_date=date_str,
                scheduled_time=time_str,
                duration_minutes=int(data.get("duration_minutes", 45)),
                meeting_link=meeting_link,
                candidate_portal_link=cand_portal_link,
                passcode=round_obj.candidate_passcode,
                instructions=data.get("notes", ""),
            )
    except Exception as em_err:
        print(f"[INTERVIEW EMAIL DISPATCH ERROR] {em_err}")

    # Automatically notify Telegram if connected
    try:
        cand_doc = db["candidates"].find_one({"$or": [{"candidate_email": cand_email.lower()}, {"id": cand_sub_id}]}) if cand_email else None
        tg_chat = cand_doc.get("telegram_chat_id") if cand_doc else None
        if not tg_chat and cand_email:
            tlink = db["telegram_links"].find_one({"candidate_email": cand_email.lower()})
            if tlink:
                tg_chat = tlink.get("chat_id")
        if tg_chat:
            import asyncio
            from modules.candidate.telegram_service import send_candidate_interview_scheduled_alert
            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                loop = None
            if loop and loop.is_running():
                asyncio.create_task(
                    send_candidate_interview_scheduled_alert(
                        chat_id=tg_chat,
                        candidate_name=cand_name,
                        requisition_title=data.get("requisition_title", "Untitled Role"),
                        company_name=company_name or "TermJobs Partner",
                        round_name=round_name,
                        scheduled_date=date_str,
                        scheduled_time=time_str,
                        duration_minutes=int(data.get("duration_minutes", 45)),
                        meeting_link=meeting_link,
                        passcode=round_obj.candidate_passcode,
                    )
                )
            else:
                asyncio.run(
                    send_candidate_interview_scheduled_alert(
                        chat_id=tg_chat,
                        candidate_name=cand_name,
                        requisition_title=data.get("requisition_title", "Untitled Role"),
                        company_name=company_name or "TermJobs Partner",
                        round_name=round_name,
                        scheduled_date=date_str,
                        scheduled_time=time_str,
                        duration_minutes=int(data.get("duration_minutes", 45)),
                        meeting_link=meeting_link,
                        passcode=round_obj.candidate_passcode,
                    )
                )
    except Exception as tg_err:
        print(f"[INTERVIEW TELEGRAM DISPATCH ERROR] {tg_err}")

    return doc


def confirm_interview_slot(interview_id: str, slot_id: Optional[str] = None, confirmed_slot: Optional[Dict[str, Any]] = None, vendor_notes: str = "") -> Optional[Dict[str, Any]]:
    """Vendor confirms a proposed slot for the interview."""
    with get_session() as session:
        interview = session.query(InterviewSchedule).filter(InterviewSchedule.id == interview_id).first()
        if not interview:
            return None
            
        if confirmed_slot:
            interview.confirmed_slot = confirmed_slot
        elif slot_id and interview.proposed_slots:
            matched = next((s for s in interview.proposed_slots if s.get("slot_id") == slot_id), None)
            if matched:
                interview.confirmed_slot = matched
            else:
                interview.confirmed_slot = interview.proposed_slots[0]
        elif interview.proposed_slots:
            interview.confirmed_slot = interview.proposed_slots[0]
            
        interview.status = InterviewStatus.CONFIRMED_BY_VENDOR.value
        if vendor_notes:
            interview.vendor_notes = vendor_notes
        interview.updated_at = datetime.now(timezone.utc)
        
        session._track(interview)
        session.commit()
        doc = interview.to_doc()
        doc["calendar_links"] = generate_calendar_links(doc)
        return doc


def request_reschedule(interview_id: str, vendor_notes: str, alternative_slots: Optional[List[Dict[str, Any]]] = None) -> Optional[Dict[str, Any]]:
    """Vendor requests reschedule with alternate slots/notes."""
    with get_session() as session:
        interview = session.query(InterviewSchedule).filter(InterviewSchedule.id == interview_id).first()
        if not interview:
            return None
            
        interview.status = InterviewStatus.RESCHEDULE_REQUESTED.value
        interview.vendor_notes = vendor_notes
        if alternative_slots:
            interview.proposed_slots = alternative_slots
        interview.updated_at = datetime.now(timezone.utc)
        
        session._track(interview)
        session.commit()
        doc = interview.to_doc()
        doc["calendar_links"] = generate_calendar_links(doc)
        return doc


def complete_interview(interview_id: str, final_remark: str, decision: str) -> Optional[Dict[str, Any]]:
    """Mark a meeting as over and record the Hiring Manager's final remark + decision.

    When the candidate is Accepted, the linked candidate submission is also
    promoted to ``Accepted`` so it surfaces in the dashboard's accepted section.
    """
    from modules.candidate.domain.models import CandidateSubmission
    import logging

    logger = logging.getLogger(__name__)

    with get_session() as session:
        interview = session.query(InterviewSchedule).filter(InterviewSchedule.id == interview_id).first()
        if not interview:
            logger.warning("complete_interview: interview %s not found", interview_id)
            return None

        interview.status = InterviewStatus.COMPLETED.value
        interview.final_remark = final_remark
        interview.decision = decision
        interview.completed_at = datetime.now(timezone.utc)
        interview.updated_at = datetime.now(timezone.utc)

        session._track(interview)

        if interview.candidate_submission_id:
            sub = session.get(CandidateSubmission, interview.candidate_submission_id)
            if sub is not None:
                new_status = "Accepted" if decision == "Accepted" else "Rejected"
                sub.status = new_status
                sub.updated_at = datetime.now(timezone.utc)
                session._track(sub)
                logger.info(
                    "complete_interview: updated candidate submission %s status to %s",
                    interview.candidate_submission_id,
                    new_status,
                )
                if decision == "Accepted":
                    try:
                        from modules.notifications.services.notification_service import notify_candidate_selected_by_hm
                        notify_candidate_selected_by_hm(
                            requisition_id=sub.requisition_id or interview.requisition_id,
                            candidate_name=sub.candidate_name or interview.candidate_name,
                            hiring_manager_name=interview.interviewer_name or "Hiring Manager",
                            candidate_email=sub.candidate_email or interview.candidate_email,
                            candidate_id=getattr(sub, "candidate_id", None) or sub.id,
                            submission_id=sub.id,
                            match_score=sub.match_score,
                            notes=final_remark,
                        )
                    except Exception as notify_err:
                        logger.warning("complete_interview: failed to notify Super Admin: %s", notify_err)

            # Trigger complete formal onboarding, candidate ID assignment & admin notification
            try:
                cand_id_to_process = (sub.id if sub else None) or interview.candidate_submission_id
                if cand_id_to_process:
                    process_candidate_hiring_decision(
                        candidate_id=cand_id_to_process,
                        decision=decision,
                        notes=final_remark,
                        requisition_id=interview.requisition_id,
                    )
            except Exception as proc_err:
                logger.warning("complete_interview: process_candidate_hiring_decision error: %s", proc_err)
            else:
                logger.warning(
                    "complete_interview: candidate submission %s not found for interview %s",
                    interview.candidate_submission_id,
                    interview_id,
                )

        session.commit()
        doc = interview.to_doc()
        doc["calendar_links"] = generate_calendar_links(doc)
        return doc


# =====================================================================
# MULTI-ROUND INTERVIEW WORKFLOW & LIVEKIT INTEGRATION
# =====================================================================


def create_interview_round(data: dict, tenant_id: str, created_by: str, origin: Optional[str] = None) -> dict:
    """
    Create a new interview round for a candidate under a requisition.
    Prevents duplicate rounds and duplicate assignments, generates hosted links and dispatches candidate invites.
    """
    raw_origin = (origin or data.get("origin") or os.getenv("FRONTEND_BASE_URL") or os.getenv("API_PUBLIC_BASE_URL") or "https://termjobs.in").strip().rstrip("/")
    base_url = raw_origin

    with get_session() as session:
        cand_sub_id = data.get("candidate_submission_id", "")
        round_name = (data.get("round_name") or "Technical Round 1").strip()
        
        # Check for existing rounds for this candidate to prevent duplicates
        existing_rounds = session.query(InterviewRound).filter(
            InterviewRound.candidate_submission_id == cand_sub_id,
            InterviewRound.status != "Cancelled"
        ).all()
        
        for r in existing_rounds:
            if r.round_name.lower().strip() == round_name.lower().strip():
                raise ValueError(f"Round '{round_name}' already exists for this candidate.")
                
        round_number = data.get("round_number")
        if not round_number:
            round_number = len(existing_rounds) + 1
            
        passcode = _generate_candidate_passcode()
        cand_token = str(uuid.uuid4())
        interviewer_token = str(uuid.uuid4())
        room_id = f"room_round_{uuid.uuid4().hex[:10]}"
        
        now_utc = datetime.now(timezone.utc)
        expires_at_val = now_utc + timedelta(hours=LINK_EXPIRATION_HOURS)
        
        round_obj = InterviewRound(
            tenant_id=tenant_id,
            requisition_id=data.get("requisition_id", ""),
            requisition_title=data.get("requisition_title", ""),
            candidate_submission_id=cand_sub_id,
            candidate_name=data.get("candidate_name", ""),
            candidate_email=data.get("candidate_email", ""),
            round_number=int(round_number),
            round_name=round_name,
            round_type=data.get("round_type", "Technical"),
            scheduled_date=data.get("scheduled_date", ""),
            scheduled_time=data.get("scheduled_time", ""),
            duration_minutes=int(data.get("duration_minutes", 45)),
            interviewer_name=data.get("interviewer_name", ""),
            interviewer_email=data.get("interviewer_email", ""),
            interviewer_role=data.get("interviewer_role", "Interviewer"),
            instructions=data.get("instructions", ""),
            internal_notes=data.get("internal_notes", ""),
            candidate_passcode=passcode,
            candidate_token=cand_token,
            interviewer_token=interviewer_token,
            room_id=room_id,
            status="Scheduled",
            evaluation={},
            expires_at=expires_at_val,
            created_by=created_by,
            created_at=now_utc,
            updated_at=now_utc,
        )
        
        session.add(round_obj)
        session.commit()
        doc = round_obj.to_doc()

    hosted_meeting_link = f"{base_url}/interview/room/{doc['id']}"
    cand_portal_link = f"{base_url}/interview/candidate/login?token={doc['candidate_token']}&email={urllib.parse.quote(doc.get('candidate_email') or '')}&passcode={doc['candidate_passcode']}"
    interviewer_link = f"{base_url}/interview/staff?token={doc['interviewer_token']}"

    doc["meeting_link"] = hosted_meeting_link
    doc["hosted_meeting_link"] = hosted_meeting_link
    doc["candidate_portal_link"] = cand_portal_link
    doc["interviewer_link"] = interviewer_link
    doc["calendar_links"] = generate_calendar_links(doc, base_url=base_url)

    # Automatically dispatch notification to candidate
    cand_email = (doc.get("candidate_email") or "").strip()
    cand_name = doc.get("candidate_name") or "Candidate"
    if cand_email:
        try:
            send_interview_invitation_email(
                candidate_name=cand_name,
                candidate_email=cand_email,
                requisition_title=doc.get("requisition_title", "Position"),
                company_name=created_by or "Hiring Team",
                round_name=round_name,
                scheduled_date=doc.get("scheduled_date", ""),
                scheduled_time=doc.get("scheduled_time", ""),
                duration_minutes=int(doc.get("duration_minutes", 45)),
                meeting_link=hosted_meeting_link,
                candidate_portal_link=cand_portal_link,
                passcode=str(doc.get("candidate_passcode") or ""),
                instructions=doc.get("instructions", ""),
            )
        except Exception as em_err:
            print(f"[ROUND EMAIL DISPATCH ERROR] {em_err}")

    # Automatically notify Telegram if connected
    try:
        cand_doc = db["candidates"].find_one({"$or": [{"candidate_email": cand_email.lower()}, {"id": cand_sub_id}]}) if cand_email else None
        tg_chat = cand_doc.get("telegram_chat_id") if cand_doc else None
        if not tg_chat and cand_email:
            tlink = db["telegram_links"].find_one({"candidate_email": cand_email.lower()})
            if tlink:
                tg_chat = tlink.get("chat_id")
        if tg_chat:
            import asyncio
            from modules.candidate.telegram_service import send_candidate_interview_scheduled_alert
            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                loop = None
            if loop and loop.is_running():
                asyncio.create_task(send_candidate_interview_scheduled_alert(
                    chat_id=tg_chat,
                    candidate_name=cand_name,
                    requisition_title=doc.get("requisition_title", "Position"),
                    company_name=created_by or "Hiring Team",
                    round_name=round_name,
                    scheduled_date=doc.get("scheduled_date", ""),
                    scheduled_time=doc.get("scheduled_time", ""),
                    duration_minutes=int(doc.get("duration_minutes", 45)),
                    meeting_link=hosted_meeting_link,
                    passcode=str(doc.get("candidate_passcode") or ""),
                ))
            else:
                asyncio.run(send_candidate_interview_scheduled_alert(
                    chat_id=tg_chat,
                    candidate_name=cand_name,
                    requisition_title=doc.get("requisition_title", "Position"),
                    company_name=created_by or "Hiring Team",
                    round_name=round_name,
                    scheduled_date=doc.get("scheduled_date", ""),
                    scheduled_time=doc.get("scheduled_time", ""),
                    duration_minutes=int(doc.get("duration_minutes", 45)),
                    meeting_link=hosted_meeting_link,
                    passcode=str(doc.get("candidate_passcode") or ""),
                ))
    except Exception as tg_err:
        print(f"[ROUND TELEGRAM NOTIFY ERROR] {tg_err}")

    return doc


def get_hiring_manager_rounds(
    tenant_id: Optional[str] = None,
    requisition_id: Optional[str] = None,
    candidate_id: Optional[str] = None,
) -> List[dict]:
    """Retrieve all interview rounds belonging to the Hiring Manager tenant, or all rounds for Super Admin."""
    with get_session() as session:
        q = session.query(InterviewRound)
        if tenant_id:
            q = q.filter((InterviewRound.tenant_id == tenant_id) | (InterviewRound.tenant_id == None))
        if requisition_id:
            q = q.filter(InterviewRound.requisition_id == requisition_id)
        if candidate_id:
            q = q.filter(InterviewRound.candidate_submission_id == candidate_id)
            
        rounds = q.all()
        # Sort by candidate and round_number
        rounds_list = [r.to_doc() for r in rounds]
        rounds_list.sort(key=lambda x: (x.get("candidate_name", ""), x.get("round_number", 1)))
        return rounds_list


def get_candidate_rounds_by_token(token_or_email: str) -> List[dict]:
    """Strict permissions: Candidate sees ONLY their own interview rounds."""
    with get_session() as session:
        token_or_email_clean = token_or_email.strip().lower()
        all_rounds = session.query(InterviewRound).all()
        matched = []
        for r in all_rounds:
            c_token = (r.candidate_token or "").strip().lower()
            c_email = (r.candidate_email or "").strip().lower()
            if c_token == token_or_email_clean or c_email == token_or_email_clean:
                rdoc = r.to_doc()
                exp_info = get_round_expiration_info(r)
                rdoc["is_expired"] = exp_info["is_expired"]
                rdoc["expires_at"] = exp_info["expires_at"]
                rdoc["remaining_seconds"] = exp_info["remaining_seconds"]
                matched.append(rdoc)
        matched.sort(key=lambda x: x.get("round_number", 1))
        return matched


def get_interviewer_rounds_by_token(token_or_email: str) -> List[dict]:
    """Strict permissions: Interviewer sees ONLY candidates and rounds assigned to them."""
    with get_session() as session:
        val = token_or_email.strip().lower()
        all_rounds = session.query(InterviewRound).all()
        matched = []
        for r in all_rounds:
            i_token = (r.interviewer_token or "").strip().lower()
            i_email = (r.interviewer_email or "").strip().lower()
            if i_token == val or (i_email and i_email == val):
                matched.append(r.to_doc())
        matched.sort(key=lambda x: (x.get("scheduled_date", ""), x.get("scheduled_time", "")))
        return matched


def authenticate_candidate_login(
    email: str,
    passcode: Optional[str] = None,
    token: Optional[str] = None,
) -> dict:
    """Validate candidate login via email + passcode or direct invite token with 10hr expiration check."""
    email_clean = email.strip().lower()
    with get_session() as session:
        rounds = session.query(InterviewRound).filter(
            InterviewRound.status != "Cancelled"
        ).all()
        
        user_rounds = [r for r in rounds if (r.candidate_email or "").strip().lower() == email_clean]
        if not user_rounds:
            # Check if token matches directly
            if token:
                token_rounds = [r for r in rounds if (r.candidate_token or "").strip() == token.strip()]
                if token_rounds:
                    user_rounds = token_rounds
                    
        if not user_rounds:
            raise ValueError("No interview schedule found for this candidate email.")
            
        if token:
            valid_token = any((r.candidate_token or "").strip() == token.strip() for r in user_rounds)
            if not valid_token and passcode:
                # check passcode fallback
                passcode_clean = passcode.strip().upper()
                valid_pass = any((r.candidate_passcode or "").strip().upper() == passcode_clean for r in user_rounds)
                if not valid_pass:
                    raise ValueError("Invalid candidate invite token or passcode.")
            elif not valid_token:
                raise ValueError("Invalid candidate invite link.")
        elif passcode:
            passcode_clean = passcode.strip().upper()
            valid_pass = any((r.candidate_passcode or "").strip().upper() == passcode_clean for r in user_rounds)
            if not valid_pass:
                raise ValueError("Invalid interview passcode. Please check your invitation email.")
        else:
            raise ValueError("Passcode or invitation token is required to log in.")

        # Check link expiration: if all candidate rounds are expired (and not Completed), block with informative error
        unexpired_or_completed = [r for r in user_rounds if not is_round_link_expired(r) or r.status == "Completed"]
        if not unexpired_or_completed:
            raise ValueError(
                "This AI interview link has expired. Interview access links and passcodes are valid for 10 hours from creation. Please contact your recruiter or hiring coordinator for a new link."
            )

        first_round = unexpired_or_completed[0]
        exp_info = get_round_expiration_info(first_round)
        return {
            "authenticated": True,
            "candidate_name": first_round.candidate_name,
            "candidate_email": first_round.candidate_email,
            "candidate_token": first_round.candidate_token,
            "candidate_submission_id": first_round.candidate_submission_id,
            "requisition_id": first_round.requisition_id,
            "requisition_title": first_round.requisition_title,
            "rounds_count": len(user_rounds),
            "is_expired": exp_info["is_expired"],
            "expires_at": exp_info["expires_at"],
            "remaining_seconds": exp_info["remaining_seconds"],
        }


def get_round_by_id(round_id: str) -> Optional[dict]:
    """Retrieve single round by ID with expiration metadata."""
    with get_session() as session:
        r = session.query(InterviewRound).filter(InterviewRound.id == round_id).first()
        if not r:
            return None
        rdoc = r.to_doc()
        exp_info = get_round_expiration_info(r)
        rdoc["is_expired"] = exp_info["is_expired"]
        rdoc["expires_at"] = exp_info["expires_at"]
        rdoc["remaining_seconds"] = exp_info["remaining_seconds"]

        # Ensure role title and company name are always resolved accurately
        req_id = r.requisition_id
        if req_id and (not rdoc.get("requisition_title") or rdoc.get("requisition_title") in ("Position", "Candidate Role")):
            from modules.requisition.domain.models import Requisition
            req_model = session.get(Requisition, req_id)
            if req_model and req_model.title:
                rdoc["requisition_title"] = req_model.title
            if req_model and (not rdoc.get("company_name") or rdoc.get("company_name") in ("Hiring Partner", "Enterprise Partner")):
                rdoc["company_name"] = req_model.company_name or "Bearitt"

        if not rdoc.get("company_name"):
            rdoc["company_name"] = "Bearitt"
        return rdoc


def update_round_status(round_id: str, new_status: str) -> Optional[dict]:
    """Update status of an interview round (e.g. In Progress, Completed, Cancelled)."""
    with get_session() as session:
        r = session.query(InterviewRound).filter(InterviewRound.id == round_id).first()
        if not r:
            return None
        # Enforce single-attempt policy: once a round is Completed, do not allow changing back to In Progress or Scheduled
        if r.status == "Completed" and new_status in ("In Progress", "Scheduled"):
            return r.to_doc()
        r.status = new_status
        r.updated_at = datetime.now(timezone.utc)
        session._track(r)
        session.commit()
        return r.to_doc()


def submit_round_evaluation(round_id: str, eval_data: dict, evaluator_identity: str) -> Optional[dict]:
    """
    Record evaluation feedback and mark round completed.
    Example statuses: Completed, Strong Yes, Yes, Maybe, No, No Show.
    """
    with get_session() as session:
        r = session.query(InterviewRound).filter(InterviewRound.id == round_id).first()
        if not r:
            return None
            
        result_verdict = eval_data.get("result", "Completed")
        status = "No Show" if result_verdict == "No Show" else "Completed"
        
        evaluation_record = {
            "result": result_verdict,
            "scores": eval_data.get("scores") or {},
            "strengths": eval_data.get("strengths", ""),
            "weaknesses": eval_data.get("weaknesses", ""),
            "notes": eval_data.get("notes", ""),
            "evaluated_at": datetime.now(timezone.utc).isoformat(),
            "evaluated_by": eval_data.get("evaluator_name") or evaluator_identity or r.interviewer_name,
            "evaluator_email": eval_data.get("evaluator_email") or r.interviewer_email,
        }
        
        r.evaluation = evaluation_record
        r.status = status
        r.updated_at = datetime.now(timezone.utc)
        session._track(r)
        
        # Also update candidate submission status in pipeline if applicable
        cand_sub_id = r.candidate_submission_id
        cand_email = (r.candidate_email or "").strip().lower()
        if cand_sub_id or cand_email:
            sub = session.get(CandidateSubmission, cand_sub_id) if cand_sub_id else None
            if not sub and cand_email and r.requisition_id:
                sub = session.query(CandidateSubmission).filter(
                    CandidateSubmission.requisition_id == r.requisition_id,
                    CandidateSubmission.candidate_email == cand_email
                ).first()

            now_iso = datetime.now(timezone.utc).isoformat()
            if result_verdict in ("Strong Yes", "Yes", "Hold"):
                target_status = "Shortlisted"
            elif result_verdict == "No":
                target_status = f"Rejected at {r.round_name}"
            else:
                target_status = "Under Review"

            if sub is not None:
                sub.status = target_status
                sub.updated_at = datetime.now(timezone.utc)
                session._track(sub)

            try:
                sub_query = {"requisition_id": r.requisition_id}
                if cand_sub_id:
                    sub_query["$or"] = [{"id": cand_sub_id}, {"candidate_email": cand_email}]
                else:
                    sub_query["candidate_email"] = cand_email

                update_fields = {
                    "status": target_status,
                    "interview_result": result_verdict,
                    "updated_at": now_iso,
                }
                if target_status == "Shortlisted":
                    update_fields["shortlisted_at"] = now_iso
                db["candidate_submissions"].update_many(sub_query, {"$set": update_fields})
            except Exception as mongo_err:
                logger.warning(f"Failed to update candidate_submission in Mongo: {mongo_err}")
                
        session.commit()

        # Trigger Shortlist Algorithm for the Requisition
        req_id = r.requisition_id
        if req_id:
            try:
                from modules.candidate.shortlist_service import generate_and_rank_requisition_shortlist
                generate_and_rank_requisition_shortlist(req_id)
            except Exception as auto_sl_err:
                logger.warning("Auto shortlist generation failed for %s: %s", req_id, auto_sl_err)

        return r.to_doc()


def record_round_transcript(round_id: str, transcript_turns
: list) -> Optional[dict]:
    """Append or save speech transcript turns to the interview round."""
    with get_session() as session:
        r = session.query(InterviewRound).filter(InterviewRound.id == round_id).first()
        if not r:
            return None
        existing_transcript = list(r.transcript or [])
        # Merge or append new turns
        existing_transcript.extend(transcript_turns)
        r.transcript = existing_transcript
        r.updated_at = datetime.now(timezone.utc)
        session._track(r)
        session.commit()
        return r.to_doc()


async def analyze_round_communication(
    round_id: str,
    transcript_turns: Optional[list] = None,
    duration_seconds: int = 0,
    candidate_name: Optional[str] = None,
    role_title: Optional[str] = None,
) -> Optional[dict]:
    """
    Executes spoken communication skills analysis (deterministic heuristics + single-pass Groq LLM).
    Persists metrics, analysis results, and transcript to the round.
    """
    from modules.interview.services.communication_analyzer import CommunicationAnalyzer

    with get_session() as session:
        r = session.query(InterviewRound).filter(InterviewRound.id == round_id).first()
        if not r:
            return None

        # Determine transcript turns to analyze
        turns = transcript_turns if transcript_turns is not None else (r.transcript or [])
        cand_name = candidate_name or r.candidate_name or "Candidate"
        role = role_title or r.requisition_title or r.round_name or "Candidate Role"

        # Execute communication evaluation
        result = await CommunicationAnalyzer.evaluate_communication(
            transcript_turns=turns,
            call_duration_seconds=duration_seconds or (r.duration_minutes * 60 if r.duration_minutes else 0),
            candidate_name=cand_name,
            role_title=role,
        )

        r.transcript = turns
        r.communication_metrics = result.get("metrics") or {}
        r.communication_analysis = result.get("analysis") or {}

        # If round already has evaluation or needs auto-evaluation from AI analysis
        eval_dict = dict(r.evaluation or {})
        scores = dict(eval_dict.get("scores") or {})
        analysis_data = result.get("analysis") or {}
        overall = int(analysis_data.get("overall_score", 0))

        if "communication" not in scores and analysis_data:
            # Map 0-100 overall score to 1-5 scale
            scores["communication"] = min(5, max(1, round(overall / 20.0)))
            eval_dict["scores"] = scores

        if not eval_dict.get("result") and overall > 0:
            if overall >= 80:
                eval_dict["result"] = "Strong Yes"
            elif overall >= 65:
                eval_dict["result"] = "Yes"
            elif overall >= 45:
                eval_dict["result"] = "Hold"
            else:
                eval_dict["result"] = "No"
            eval_dict["evaluator"] = "AI Assessment Engine"
            eval_dict["notes"] = analysis_data.get("summary", "")

        r.evaluation = eval_dict

        # Mark round completed upon successful analysis
        if r.status in ("Scheduled", "In Progress", None):
            r.status = "Completed"

        r.updated_at = datetime.now(timezone.utc)
        session._track(r)

        # Update candidate submission status in SQLite and Mongo upon interview completion
        cand_sub_id = r.candidate_submission_id
        cand_email = (r.candidate_email or "").strip().lower()
        cand_name = (r.candidate_name or "").strip()
        now_iso = datetime.now(timezone.utc).isoformat()

        # Find all associated submission IDs and emails (direct + fast-track outreach linked records)
        linked_sub_ids = set()
        linked_emails = set()
        if cand_sub_id:
            linked_sub_ids.add(cand_sub_id)
        if cand_email:
            linked_emails.add(cand_email)

        # Inspect Mongo for linked candidate_id or outreach entries
        try:
            for ms in db["candidate_submissions"].find({
                "$or": [
                    {"id": cand_sub_id} if cand_sub_id else {"_id": None},
                    {"candidate_id": cand_sub_id} if cand_sub_id else {"_id": None},
                    {"round_id": r.id},
                    {"candidate_email": cand_email} if cand_email else {"_id": None},
                ]
            }):
                if ms.get("id"):
                    linked_sub_ids.add(ms["id"])
                if ms.get("candidate_id"):
                    linked_sub_ids.add(ms["candidate_id"])
                if ms.get("candidate_email"):
                    linked_emails.add(ms["candidate_email"].strip().lower())
        except Exception:
            pass

        # Also inspect by candidate name + requisition
        if cand_name and r.requisition_id:
            try:
                import re
                for ms in db["candidate_submissions"].find({
                    "requisition_id": r.requisition_id,
                    "candidate_name": {"$regex": f"^{re.escape(cand_name)}$", "$options": "i"}
                }):
                    if ms.get("id"):
                        linked_sub_ids.add(ms["id"])
                    if ms.get("candidate_id"):
                        linked_sub_ids.add(ms["candidate_id"])
                    if ms.get("candidate_email"):
                        linked_emails.add(ms["candidate_email"].strip().lower())
            except Exception:
                pass

        # 1. Update SQLite candidate submissions
        sqlite_subs = []
        if linked_sub_ids:
            sqlite_subs.extend(
                session.query(CandidateSubmission).filter(CandidateSubmission.id.in_(list(linked_sub_ids))).all()
            )
        if linked_emails and r.requisition_id:
            for em in linked_emails:
                matched = session.query(CandidateSubmission).filter(
                    CandidateSubmission.requisition_id == r.requisition_id,
                    CandidateSubmission.candidate_email == em
                ).all()
                for m in matched:
                    if m not in sqlite_subs:
                        sqlite_subs.append(m)

        for sub in sqlite_subs:
            if sub.status not in ("Hired", "Accepted"):
                sub.status = "Shortlisted"
            sub.match_score = max(float(sub.match_score or 0), float(overall or 0)) if overall > 0 else (sub.match_score or 55.0)
            sub.updated_at = datetime.now(timezone.utc)
            session._track(sub)

        # 2. Update MongoDB candidate submissions
        try:
            mongo_or = []
            for sid in linked_sub_ids:
                mongo_or.append({"id": sid})
                mongo_or.append({"submission_id": sid})
            for em in linked_emails:
                if r.requisition_id:
                    mongo_or.append({"candidate_email": em, "requisition_id": r.requisition_id})
                else:
                    mongo_or.append({"candidate_email": em})
            mongo_or.append({"round_id": r.id})

            if mongo_or:
                db["candidate_submissions"].update_many(
                    {"$or": mongo_or},
                    {"$set": {
                        "status": "Shortlisted",
                        "interview_score": overall,
                        "interview_result": eval_dict.get("result") or "Completed",
                        "interview_summary": analysis_data.get("summary", "") or eval_dict.get("notes", ""),
                        "interview_status": "Completed",
                        "round_id": r.id,
                        "recording_url": r.recording_url or f"/api/interviews/rounds/{r.id}/recording",
                        "shortlisted_at": now_iso,
                        "updated_at": now_iso,
                    }}
                )
        except Exception as mongo_sub_err:
            logger.warning(f"Failed to update candidate_submission in Mongo: {mongo_sub_err}")

        session.commit()

        # Trigger Shortlist Algorithm for the Requisition
        req_id = r.requisition_id
        if req_id:
            try:
                from modules.candidate.shortlist_service import generate_and_rank_requisition_shortlist
                generate_and_rank_requisition_shortlist(req_id)
            except Exception as auto_sl_err:
                logger.warning("Auto shortlist generation failed for %s: %s", req_id, auto_sl_err)

        return {
            "round_id": r.id,
            "metrics": r.communication_metrics,
            "analysis": r.communication_analysis,
            "token_usage": result.get("token_usage", {}),
            "transcript_turn_count": len(turns),
        }


def get_round_communication_analysis(round_id: str) -> Optional[dict]:
    """Retrieve communication metrics, analysis, and transcript for an interview round."""
    with get_session() as session:
        r = session.query(InterviewRound).filter(InterviewRound.id == round_id).first()
        if not r:
            return None
        return {
            "round_id": r.id,
            "candidate_name": r.candidate_name,
            "requisition_title": r.requisition_title,
            "round_name": r.round_name,
            "metrics": r.communication_metrics or {},
            "analysis": r.communication_analysis or {},
            "transcript": r.transcript or [],
            "status": r.status,
        }


def generate_livekit_token(
    room_name: str,
    identity: str,
    name: str,
    role: str = "candidate",
) -> dict:
    """
    Generate official LiveKit JWT access token for video and chat.
    Uses LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET from environment.
    """
    livekit_url = os.getenv("LIVEKIT_URL", "wss://termjobs-livekit.livekit.cloud")
    api_key = os.getenv("LIVEKIT_API_KEY", "devkey")
    api_secret = os.getenv("LIVEKIT_API_SECRET", "termjobs_livekit_super_secret_key_32_chars_long")
    
    now = int(time.time())
    exp = now + (6 * 3600)  # 6 hours valid
    
    payload = {
        "exp": exp,
        "iss": api_key,
        "nbf": now,
        "sub": identity,
        "name": name,
        "video": {
            "room": room_name,
            "roomJoin": True,
            "canPublish": True,
            "canSubscribe": True,
            "canPublishData": True,
            "roomAdmin": True if role == "interviewer" else False,
        },
        "metadata": f'{{"role": "{role}", "name": "{name}"}}'
    }
    
    token = jwt.encode(payload, api_secret, algorithm="HS256")
    
    return {
        "token": token,
        "url": livekit_url,
        "room": room_name,
        "identity": identity,
        "role": role,
    }


def save_chat_message(
    round_id: str,
    room_id: str,
    sender_name: str,
    sender_role: str,
    message: str,
    sender_identity: str = "",
    message_id: str = "",
) -> dict:
    """Save an in-meeting chat message to database with deduplication."""
    with get_session() as session:
        if message_id:
            existing = session.query(InterviewChatMessage).filter(
                InterviewChatMessage.id == message_id
            ).first()
            if existing:
                doc = existing.to_doc()
                if hasattr(doc.get("created_at"), "isoformat"):
                    doc["created_at"] = doc["created_at"].isoformat()
                return doc

        msg = InterviewChatMessage(
            id=message_id or str(uuid.uuid4()),
            round_id=round_id,
            room_id=room_id,
            sender_name=sender_name,
            sender_role=sender_role,
            sender_identity=sender_identity,
            message=message,
        )
        session.add(msg)
        session.commit()
        doc = msg.to_doc()
        if hasattr(doc.get("created_at"), "isoformat"):
            doc["created_at"] = doc["created_at"].isoformat()
        return doc


def get_chat_history(round_id: str) -> List[dict]:
    """Retrieve chat message history for an interview room."""
    with get_session() as session:
        msgs = session.query(InterviewChatMessage).filter(
            InterviewChatMessage.round_id == round_id
        ).all()
        docs = []
        for m in msgs:
            d = m.to_doc()
            if hasattr(d.get("created_at"), "isoformat"):
                d["created_at"] = d["created_at"].isoformat()
            docs.append(d)
        docs.sort(key=lambda x: str(x.get("created_at", "")))

        # Deduplicate historical duplicates (same sender, role, text within 5s)
        deduped: List[dict] = []
        for doc in docs:
            if deduped:
                last = deduped[-1]
                if (
                    last.get("sender_role") == doc.get("sender_role")
                    and last.get("message") == doc.get("message")
                ):
                    try:
                        t1 = datetime.fromisoformat(str(last.get("created_at", "")).replace("Z", "+00:00"))
                        t2 = datetime.fromisoformat(str(doc.get("created_at", "")).replace("Z", "+00:00"))
                        if abs((t2 - t1).total_seconds()) < 5.0:
                            continue
                    except Exception:
                        pass
            deduped.append(doc)
        return deduped


def get_hiring_manager_summary(tenant_id: str) -> List[dict]:
    """
    Get aggregated candidate interview progression summary for Hiring Manager.
    Groups rounds per candidate and computes pipeline readiness.
    Automatically includes shortlisted candidates ready for Round 1 scheduling.
    """
    with get_session() as session:
        from modules.candidate.domain.models import CandidateSubmission
        from modules.requisition.domain.models import Requisition

        # Lookup tenant requisitions for title mapping and filtering
        req_filters = [Requisition.tenant_id == tenant_id] if tenant_id else []
        req_rows = session.query(Requisition).filter(*req_filters).all()
        if not req_rows:
            # Fallback to all requisitions for local / multi-tenant demo
            req_rows = session.query(Requisition).all()
        req_title_map = {r.id: (r.title or "Position") for r in req_rows}
        tenant_req_ids = set(req_title_map.keys())

        # Query scheduled interview rounds from SQLite
        round_filters = [InterviewRound.tenant_id == tenant_id] if tenant_id else []
        rounds = session.query(InterviewRound).filter(*round_filters).all()
        by_candidate = {}
        seen_round_ids = set()
        for r in rounds:
            cid = r.candidate_submission_id or r.candidate_email or r.id
            if cid not in by_candidate:
                by_candidate[cid] = {
                    "candidate_submission_id": r.candidate_submission_id,
                    "candidate_id": r.candidate_submission_id,
                    "candidate_name": r.candidate_name,
                    "candidate_email": r.candidate_email,
                    "requisition_id": r.requisition_id,
                    "requisition_title": r.requisition_title or req_title_map.get(r.requisition_id, "Position"),
                    "match_score": None,
                    "vendor_name": None,
                    "submission_status": "Interviewing",
                    "rounds": [],
                }
            by_candidate[cid]["rounds"].append(r.to_doc())
            seen_round_ids.add(r.id)

        # Also query MongoDB interview_rounds
        try:
            m_round_filters = {"tenant_id": tenant_id} if tenant_id else {}
            mongo_rounds = list(db["interview_rounds"].find(m_round_filters))
            for mr in mongo_rounds:
                mr_id = mr.get("id") or str(mr.get("_id"))
                if mr_id not in seen_round_ids:
                    cid = mr.get("candidate_submission_id") or mr.get("candidate_email") or mr_id
                    if cid not in by_candidate:
                        by_candidate[cid] = {
                            "candidate_submission_id": mr.get("candidate_submission_id"),
                            "candidate_id": mr.get("candidate_submission_id"),
                            "candidate_name": mr.get("candidate_name"),
                            "candidate_email": mr.get("candidate_email"),
                            "requisition_id": mr.get("requisition_id"),
                            "requisition_title": mr.get("requisition_title") or req_title_map.get(mr.get("requisition_id"), "Position"),
                            "match_score": None,
                            "vendor_name": None,
                            "submission_status": "Interviewing",
                            "rounds": [],
                        }
                    m_clean = dict(mr)
                    m_clean["id"] = mr_id
                    m_clean.pop("_id", None)
                    by_candidate[cid]["rounds"].append(m_clean)
                    seen_round_ids.add(mr_id)
        except Exception as m_err:
            logger.warning(f"Error querying mongo interview_rounds in summary: {m_err}")

        # Match candidate submission info from SQLite
        submissions = session.query(CandidateSubmission).all()
        for sub in submissions:
            sub_email_norm = (sub.candidate_email or "").strip().lower()
            sub_name_norm = (sub.candidate_name or "").strip().lower()
            for k, v in by_candidate.items():
                v_email_norm = (v.get("candidate_email") or "").strip().lower()
                v_name_norm = (v.get("candidate_name") or "").strip().lower()
                same_req = str(v.get("requisition_id") or "") == str(sub.requisition_id or "")

                if (sub.id and v.get("candidate_submission_id") == sub.id) or \
                   (sub_email_norm and v_email_norm == sub_email_norm and same_req) or \
                   (sub_name_norm and v_name_norm == sub_name_norm and same_req):
                    by_candidate[k]["match_score"] = sub.match_score
                    by_candidate[k]["vendor_name"] = sub.vendor_name
                    by_candidate[k]["submission_status"] = sub.status
                    if not by_candidate[k].get("candidate_submission_id"):
                        by_candidate[k]["candidate_submission_id"] = sub.id
                    break

        # Also enrich candidate submission info from MongoDB candidate_submissions
        try:
            mongo_subs = list(db["candidate_submissions"].find({}))
            for ms in mongo_subs:
                ms_email = (ms.get("candidate_email") or "").strip().lower()
                ms_id = ms.get("id") or str(ms.get("_id"))
                ms_req = str(ms.get("requisition_id") or "")
                for k, v in by_candidate.items():
                    v_email = (v.get("candidate_email") or "").strip().lower()
                    same_req = str(v.get("requisition_id") or "") == ms_req
                    if (v.get("candidate_submission_id") == ms_id) or (ms_email and v_email == ms_email and same_req):
                        if ms.get("status"):
                            by_candidate[k]["submission_status"] = ms["status"]
                        if ms.get("match_score") is not None:
                            by_candidate[k]["match_score"] = ms["match_score"]
                        if ms.get("vendor_name"):
                            by_candidate[k]["vendor_name"] = ms["vendor_name"]
                        cand_assigned_id = ms.get("candidate_id") or ms_id
                        by_candidate[k]["candidate_id"] = cand_assigned_id
                        if not by_candidate[k].get("candidate_submission_id"):
                            by_candidate[k]["candidate_submission_id"] = ms_id
        except Exception:
            pass
            
        summary = []
        for cid, item in by_candidate.items():
            r_list = item["rounds"]
            r_list.sort(key=lambda x: x.get("round_number", 1))
            
            total_rounds = len(r_list)
            completed_rounds = sum(1 for x in r_list if x.get("status") == "Completed")
            in_progress_rounds = sum(1 for x in r_list if x.get("status") == "In Progress")

            # Hiring Manager sees candidates whose AI interview has completed, or who have active status
            if completed_rounds == 0 and item.get("submission_status") not in ("Accepted", "Hired"):
                continue

            # Determine readiness for next round
            last_round = r_list[-1] if r_list else None
            last_eval = (last_round.get("evaluation") or {}) if last_round else {}
            last_verdict = (last_eval.get("result") or "").strip()

            # Check if company rounds exist (rounds other than AI Fast-Track)
            company_rounds = [r for r in r_list if not (r.get("round_name") or "").startswith("AI")]
            ready_for_company_round_1 = len(company_rounds) == 0

            ready_for_next = False
            if last_round and last_round.get("status") == "Completed" and last_verdict in ("Strong Yes", "Yes", "Maybe"):
                ready_for_next = True
                
            summary.append({
                "candidate_submission_id": item["candidate_submission_id"],
                "candidate_id": item.get("candidate_id") or item["candidate_submission_id"],
                "candidate_name": item["candidate_name"],
                "candidate_email": item["candidate_email"],
                "requisition_id": item["requisition_id"],
                "requisition_title": item["requisition_title"],
                "match_score": item.get("match_score"),
                "vendor_name": item.get("vendor_name"),
                "submission_status": item.get("submission_status", "Shortlisted"),
                "total_rounds": total_rounds,
                "completed_rounds": completed_rounds,
                "in_progress_rounds": in_progress_rounds,
                "ready_for_next_round": ready_for_next,
                "ready_for_round_1": ready_for_company_round_1,
                "latest_round": last_round,
                "rounds": r_list,
            })

        # Sort summary: candidates with completed or active interview rounds first, then ready for round 1
        summary.sort(key=lambda x: (-(x.get("completed_rounds", 0) * 10 + x.get("in_progress_rounds", 0)), not x.get("ready_for_round_1"), x.get("candidate_name", "")))
        return summary


def save_round_recording(
    round_id: str,
    file_bytes: bytes,
    filename: str = "",
    content_type: str = "video/webm",
    duration_seconds: int = 0,
) -> Optional[dict]:
    """
    Saves candidate interview video recording:
    1. Persists locally in uploads/interview_videos/{round_id}.webm
    2. Stores in MongoDB GridFS for persistent multi-machine/cloud access
    3. Updates InterviewRound.recording_url and InterviewRound.recording_metadata
    """
    with get_session() as session:
        r = session.query(InterviewRound).filter(InterviewRound.id == round_id).first()
        if not r:
            return None

        # 1. Local filesystem persistence
        backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
        local_dir = os.path.join(backend_dir, "uploads", "interview_videos")
        os.makedirs(local_dir, exist_ok=True)
        local_path = os.path.join(local_dir, f"{round_id}.webm")
        try:
            with open(local_path, "wb") as f:
                f.write(file_bytes)
        except Exception as e:
            print(f"[RECORDING] Local file write warning: {e}")

        # 2. MongoDB GridFS persistence
        grid_id = None
        try:
            import gridfs
            from modules.shared.db import _get_client, settings
            real_db = _get_client()[settings.mongo_db_name]
            fs = gridfs.GridFS(real_db)
            # Remove any previous recording for this round to prevent orphaned data
            for existing in fs.find({"round_id": round_id}):
                fs.delete(existing._id)
            grid_id = fs.put(
                file_bytes,
                filename=filename or f"recording_{round_id}.webm",
                content_type=content_type or "video/webm",
                round_id=round_id,
                duration_seconds=duration_seconds,
                uploaded_at=datetime.now(timezone.utc),
            )
        except Exception as e:
            print(f"[RECORDING] GridFS storage warning: {e}")

        # 3. Update InterviewRound
        clean_filename = filename or f"interview_{round_id}.webm"
        r.recording_url = f"/api/interviews/rounds/{round_id}/recording"
        r.recording_metadata = {
            "filename": clean_filename,
            "content_type": content_type or "video/webm",
            "size_bytes": len(file_bytes),
            "duration_seconds": duration_seconds,
            "gridfs_id": str(grid_id) if grid_id else None,
            "local_path": local_path if os.path.exists(local_path) else None,
            "uploaded_at": datetime.now(timezone.utc).isoformat(),
        }
        r.updated_at = datetime.now(timezone.utc)
        session._track(r)
        session.commit()
        return r.to_doc()


def get_round_recording(round_id: str) -> Optional[dict]:
    """
    Retrieves video recording bytes and metadata for an interview round.
    Checks local filesystem first, then falls back to MongoDB GridFS.
    """
    # 1. Check local filesystem
    backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
    local_dir = os.path.join(backend_dir, "uploads", "interview_videos")
    local_path = os.path.join(local_dir, f"{round_id}.webm")
    if os.path.exists(local_path) and os.path.getsize(local_path) > 0:
        try:
            with open(local_path, "rb") as f:
                data = f.read()
            return {
                "bytes": data,
                "size": len(data),
                "content_type": "video/webm",
                "filename": f"interview_{round_id}.webm",
            }
        except Exception as e:
            print(f"[RECORDING] Local read warning: {e}")

    # 2. Check MongoDB GridFS
    try:
        import gridfs
        from modules.shared.db import _get_client, settings
        real_db = _get_client()[settings.mongo_db_name]
        fs = gridfs.GridFS(real_db)
        grid_file = fs.find_one({"round_id": round_id})
        if grid_file:
            data = grid_file.read()
            return {
                "bytes": data,
                "size": len(data),
                "content_type": getattr(grid_file, "content_type", "video/webm") or "video/webm",
                "filename": getattr(grid_file, "filename", f"interview_{round_id}.webm") or f"interview_{round_id}.webm",
            }
    except Exception as e:
        print(f"[RECORDING] GridFS read warning: {e}")

    return None


def process_candidate_hiring_decision(
    candidate_id: str,
    decision: str,  # "Accepted" or "Rejected"
    notes: str = "",
    actor_user: Any = None,
    requisition_id: Optional[str] = None,
) -> dict:
    """
    Formal Hiring Decision Workflow:
    - If Accepted:
      1. Formal Candidate ID is confirmed/assigned (e.g. CND-XXXX)
      2. Candidate is onboarded to the company (onboarding_checklists checklist initialized with activation gates)
      3. Draft work order initialized in work_orders
      4. Candidate status updated to 'Accepted' across MongoDB and SQLite
      5. High-priority notification dispatched to Super Admin
      6. Candidate surfaces under Accepted Candidates view & Onboarding tab
    - If Rejected:
      1. Candidate status updated to 'Rejected' across MongoDB and SQLite
      2. Super Admin notified
    """
    import uuid
    from datetime import datetime, timezone
    from modules.shared.db import get_session, db
    from modules.candidate.domain.models import CandidateSubmission
    from modules.requisition.domain.models import Requisition

    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    cid_clean = (candidate_id or "").strip()
    actor_name = getattr(actor_user, "name", None) or getattr(actor_user, "email", None) or "Hiring Manager"
    actor_email = getattr(actor_user, "email", "")
    company_name = getattr(actor_user, "tenant_name", None) or "Enterprise Partner"

    # 1. Lookup candidate in MongoDB candidate_submissions
    sub_doc = db["candidate_submissions"].find_one({
        "$or": [
            {"id": cid_clean},
            {"submission_id": cid_clean},
            {"candidate_id": cid_clean},
            {"candidate_email": cid_clean.lower()},
        ]
    })
    if not sub_doc and requisition_id:
        sub_doc = db["candidate_submissions"].find_one({"requisition_id": requisition_id})

    # 2. Lookup in SQLite
    with get_session() as session:
        sql_sub = session.get(CandidateSubmission, cid_clean)
        if not sql_sub and sub_doc:
            sql_sub = session.get(CandidateSubmission, sub_doc.get("id"))
        if not sql_sub and sub_doc and sub_doc.get("candidate_email"):
            sql_sub = session.query(CandidateSubmission).filter(
                CandidateSubmission.candidate_email == sub_doc["candidate_email"].lower()
            ).first()

        candidate_name = (
            (sub_doc or {}).get("candidate_name")
            or (sql_sub.candidate_name if sql_sub else None)
            or "Candidate"
        )
        candidate_email = (
            (sub_doc or {}).get("candidate_email")
            or (sql_sub.candidate_email if sql_sub else None)
            or ""
        )
        req_id = (
            requisition_id
            or (sub_doc or {}).get("requisition_id")
            or (sql_sub.requisition_id if sql_sub else "")
        )

        req_title = "Position"
        if req_id:
            req_obj = session.get(Requisition, req_id)
            if req_obj:
                req_title = req_obj.title or "Position"
                if not getattr(actor_user, "tenant_name", None) and req_obj.company_name:
                    company_name = req_obj.company_name

        if not sub_doc and not sql_sub:
            raise ValueError(f"Candidate submission '{candidate_id}' not found.")

        # Determine formal Candidate ID
        existing_cid = (sub_doc or {}).get("candidate_id") or (sub_doc or {}).get("id") or cid_clean
        if existing_cid and str(existing_cid).startswith("CND-"):
            final_cand_id = existing_cid
        else:
            final_cand_id = f"CND-{uuid.uuid4().hex[:8].upper()}"

        if decision == "Accepted":
            # 1. Update SQLite submission
            if sql_sub:
                sql_sub.status = "Accepted"
                sql_sub.updated_at = now
                session.add(sql_sub)
                session.commit()

            # 2. Update MongoDB candidate_submissions
            sub_id_to_match = (sql_sub.id if sql_sub else None) or (sub_doc.get("id") if sub_doc else cid_clean)
            update_fields = {
                "status": "Accepted",
                "candidate_id": final_cand_id,
                "accepted_at": now_iso,
                "accepted_by": actor_name,
                "hiring_manager_notes": notes or f"Accepted by {actor_name} on {now_iso[:10]}",
                "onboarding_status": "Pending Setup",
                "updated_at": now_iso,
            }
            db["candidate_submissions"].update_many(
                {"$or": [
                    {"id": sub_id_to_match},
                    {"id": final_cand_id},
                    {"id": cid_clean},
                    {"candidate_email": candidate_email.lower(), "requisition_id": req_id} if candidate_email and req_id else {"candidate_email": candidate_email.lower()}
                ]},
                {"$set": update_fields}
            )

            # 3. Update or Insert in candidates collection
            db["candidates"].update_one(
                {"$or": [{"id": final_cand_id}, {"candidate_email": candidate_email.lower()}]},
                {"$set": {
                    "id": final_cand_id,
                    "candidate_id": final_cand_id,
                    "candidate_name": candidate_name,
                    "candidate_email": candidate_email,
                    "status": "Accepted",
                    "company_name": company_name,
                    "updated_at": now_iso,
                }},
                upsert=True
            )

            # 3b. Automatically create and dispatch formal Employment Offer Letter & Agreement to candidate agreements
            try:
                from datetime import timedelta
                existing_offer = db["offer_letters"].find_one({
                    "$or": [
                        {"candidate_id": final_cand_id},
                        {"candidate_id": cid_clean},
                        {"candidate_email": candidate_email.lower()}
                    ]
                })
                annual_ctc = 1800000
                monthly_ctc = annual_ctc // 12
                basic_annual = int(annual_ctc * 0.50)
                hra_annual = int(annual_ctc * 0.25)
                other_annual = int(annual_ctc * 0.15)
                pf_annual = int(annual_ctc * 0.10)
                joining_str = (now + timedelta(days=14)).strftime("%d %B %Y")
                today_str = now.strftime("%d %B %Y")

                if not existing_offer:
                    new_offer = {
                        "candidate_id": final_cand_id,
                        "submission_id": final_cand_id,
                        "company_name": company_name or "TCS",
                        "company_address": "Corporate Technology Park, Outer Ring Road, Bengaluru, Karnataka 560103",
                        "candidate_name": candidate_name,
                        "candidate_email": candidate_email,
                        "job_title": req_title,
                        "offer_date": today_str,
                        "joining_date": joining_str,
                        "contract_period": "Full Time / Unlimited",
                        "mobility_clause": "You should be aware that you might be subject to transfer to another city or location where the Company operates a business or will operate a business in the future, to carry on similar responsibilities whenever the requirement arises.",
                        "leave_policy": {
                            "earned_leave": 18,
                            "casual_leave": 12,
                            "sick_leave": 12,
                            "restricted_holidays": 3,
                        },
                        "termination_company_notice_days": 30,
                        "termination_employee_notice_days": 30,
                        "probation_period_months": 3,
                        "non_compete_period": "12 months",
                        "annexure": {
                            "grade": "Band L4 / Senior Specialist",
                            "department": "Platform & Software Engineering",
                            "reporting_to": "Engineering Director / Hiring Lead",
                            "work_location": "Bengaluru / Hybrid",
                            "contract_type": "Full Time",
                            "currency": "INR (₹)",
                            "basic_salary_annual": basic_annual,
                            "basic_salary_monthly": basic_annual // 12,
                            "hra_annual": hra_annual,
                            "hra_monthly": hra_annual // 12,
                            "other_allowance_annual": other_annual,
                            "other_allowance_monthly": other_annual // 12,
                            "pf_annual": pf_annual,
                            "pf_monthly": pf_annual // 12,
                            "total_fixed_annual": annual_ctc,
                            "total_fixed_monthly": monthly_ctc,
                            "meal_voucher_monthly": 3000,
                            "annual_bonus_percentage": 10,
                            "medical_insurance_coverage": "₹5,00,000 for employee, spouse, children & parents",
                            "life_insurance_coverage": "Group Life Insurance policy up to 3x Annual CTC",
                            "gratuity_terms": "As per Payment of Gratuity Act, 1972",
                        },
                        "hr_signatory_name": actor_name or "Rakesh Sharma",
                        "hr_signatory_title": "VP – Human Resources",
                        "status": "Offer Extended",
                        "agreement_status": "Pending Signature",
                        "sent_at": now_iso,
                        "sent_by": actor_name,
                        "created_at": now_iso,
                        "updated_at": now_iso,
                    }
                    db["offer_letters"].insert_one(new_offer)
                else:
                    db["offer_letters"].update_one(
                        {"_id": existing_offer["_id"]},
                        {"$set": {
                            "status": "Offer Extended",
                            "agreement_status": "Pending Signature",
                            "sent_at": now_iso,
                            "sent_by": actor_name,
                            "candidate_name": candidate_name or existing_offer.get("candidate_name"),
                            "candidate_email": candidate_email or existing_offer.get("candidate_email"),
                            "updated_at": now_iso,
                        }}
                    )
            except Exception as offer_err:
                logger.warning(f"Error auto-dispatching offer letter on acceptance: {offer_err}")

            # 4. Onboard candidate: Initialize Checklist in onboarding_checklists
            try:
                from modules.onboarding.router import _get_or_create_onboarding_doc
                _get_or_create_onboarding_doc(final_cand_id)
            except Exception as onb_err:
                logger.warning(f"Error creating onboarding doc via helper: {onb_err}")
                default_gates = [
                    {"id": "pan_aadhaar_bank", "label": "PAN, Aadhaar, bank details", "responsible": "Worker", "type": "blocking", "status": "pending"},
                    {"id": "nda_ip", "label": "NDA and IP assignment", "responsible": "Worker", "type": "blocking", "status": "pending"},
                    {"id": "pf_esic", "label": "PF and ESIC declaration", "responsible": "TalentBridge", "type": "blocking", "status": "pending"},
                    {"id": "bgv", "label": "Background verification pack", "responsible": "TalentBridge", "type": "blocking", "status": "pending"},
                    {"id": "ad_vpn_badge", "label": "Access provisioning — AD, VPN, badge", "responsible": "Buyer IT", "type": "blocking", "status": "pending"},
                    {"id": "site_safety", "label": "Site safety induction", "responsible": "Buyer EHS", "type": "blocking", "status": "pending"},
                    {"id": "laptop", "label": "Laptop issuance", "responsible": "Buyer IT", "type": "warn_only", "status": "pending"},
                    {"id": "manager_orientation", "label": "Manager orientation", "responsible": "Manager", "type": "warn_only", "status": "pending"},
                ]
                db["onboarding_checklists"].update_one(
                    {"$or": [{"candidate_id": final_cand_id}, {"workorder_id": final_cand_id}, {"candidate_email": candidate_email.lower()}]},
                    {"$set": {
                        "candidate_id": final_cand_id,
                        "workorder_id": final_cand_id,
                        "candidate_name": candidate_name,
                        "candidate_email": candidate_email,
                        "company_name": company_name,
                        "requisition_id": req_id,
                        "requisition_title": req_title,
                        "status": "in_progress",
                        "activation_status": "pending",
                        "activation_gates": default_gates,
                        "updated_at": now_iso,
                    }},
                    upsert=True
                )

            # 5. Initialize Work Order in work_orders
            db["work_orders"].update_one(
                {"$or": [{"candidate_id": final_cand_id}, {"workorder_id": final_cand_id}]},
                {"$set": {
                    "candidate_id": final_cand_id,
                    "workorder_id": final_cand_id,
                    "candidate_name": candidate_name,
                    "candidate_email": candidate_email,
                    "requisition_id": req_id,
                    "requisition_title": req_title,
                    "company_name": company_name,
                    "status": "Draft",
                    "agreement_status": "Draft",
                    "created_at": now_iso,
                    "updated_at": now_iso,
                }},
                upsert=True
            )

            # 6. Send high-priority notification to Super Admin
            notif_msg = f"{candidate_name} (Candidate ID: {final_cand_id}) has been formally accepted by {company_name} for '{req_title}' and onboarded to company."
            db["notifications"].insert_one({
                "id": f"notif-{uuid.uuid4().hex[:12]}",
                "title": f"Candidate Accepted & Onboarded: {candidate_name}",
                "body": notif_msg,
                "type": "candidate_accepted",
                "recipient_role": "Super Admin",
                "candidate_id": final_cand_id,
                "candidate_name": candidate_name,
                "candidate_email": candidate_email,
                "requisition_id": req_id,
                "company_name": company_name,
                "hiring_manager_name": actor_name,
                "status": "unread",
                "created_at": now_iso,
            })

            # Also dispatch audit & email notification to super admins
            try:
                from modules.notifications.services.notification_service import notify_candidate_selected_by_hm
                notify_candidate_selected_by_hm(
                    requisition_id=req_id,
                    candidate_name=candidate_name,
                    company_name=company_name,
                    hiring_manager_name=actor_name,
                    hiring_manager_email=actor_email,
                    candidate_email=candidate_email,
                    candidate_id=final_cand_id,
                    submission_id=sub_id_to_match,
                    match_score=(sub_doc or {}).get("match_score"),
                    notes=notes,
                )
            except Exception as notif_err:
                logger.warning(f"Error calling notify_candidate_selected_by_hm: {notif_err}")

            return {
                "status": "success",
                "decision": "Accepted",
                "candidate_id": final_cand_id,
                "candidate_name": candidate_name,
                "submission_status": "Accepted",
                "message": f"Candidate {candidate_name} has been accepted and onboarded with Candidate ID {final_cand_id}. Admin notified.",
            }

        else:
            # Rejection workflow
            if sql_sub:
                sql_sub.status = "Rejected"
                sql_sub.updated_at = now
                session.add(sql_sub)
                session.commit()

            sub_id_to_match = (sql_sub.id if sql_sub else None) or (sub_doc.get("id") if sub_doc else cid_clean)
            db["candidate_submissions"].update_many(
                {"$or": [
                    {"id": sub_id_to_match},
                    {"id": cid_clean},
                    {"candidate_email": candidate_email.lower(), "requisition_id": req_id} if candidate_email and req_id else {"candidate_email": candidate_email.lower()}
                ]},
                {"$set": {
                    "status": "Rejected",
                    "rejected_at": now_iso,
                    "rejected_by": actor_name,
                    "rejection_notes": notes,
                    "updated_at": now_iso,
                }}
            )

            # Notify Admin
            db["notifications"].insert_one({
                "id": f"notif-{uuid.uuid4().hex[:12]}",
                "title": f"Candidate Rejected: {candidate_name}",
                "body": f"{candidate_name} was marked as Rejected by {company_name} for '{req_title}'.",
                "type": "candidate_rejected",
                "recipient_role": "Super Admin",
                "candidate_id": cid_clean,
                "candidate_name": candidate_name,
                "requisition_id": req_id,
                "company_name": company_name,
                "status": "unread",
                "created_at": now_iso,
            })

            return {
                "status": "success",
                "decision": "Rejected",
                "candidate_id": cid_clean,
                "candidate_name": candidate_name,
                "submission_status": "Rejected",
                "message": f"Candidate {candidate_name} has been marked as Rejected. Admin notified.",
            }


