"""
Interview Scheduling business logic and Cal.com / Cal.diy Integration.
"""
import urllib.parse
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
import uuid

from modules.shared.db import get_session, db
from modules.interview.domain.models import InterviewSchedule, InterviewStatus
from modules.calendar.domain.models import CalendarConfig


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


def generate_calendar_links(interview: Dict[str, Any]) -> Dict[str, str]:
    """
    Generates Cal.com dynamic booking URL + 1-click fallback sync links.
    """
    confirmed = interview.get("confirmed_slot") or (interview.get("proposed_slots") and interview["proposed_slots"][0]) or {}
    date = confirmed.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    start_time = confirmed.get("start_time", "10:00")
    end_time = confirmed.get("end_time", "11:00")
    
    cand_name = interview.get("candidate_name", "Candidate")
    cand_email = interview.get("candidate_email", "")
    req_title = interview.get("requisition_title", "Role")
    
    # 1. Cal.com Dynamic Booking URL
    tenant_id = interview.get("tenant_id", "")
    cal_cfg = get_company_cal_config(tenant_id)
    raw_cal = cal_cfg.get("cal_link", "https://cal.com/")
    slug = cal_cfg.get("event_slug", "30min")
    embed_path, cal_path = normalize_cal_url(raw_cal, slug)
        
    cal_params = {
        "name": cand_name,
        "email": cand_email,
        "notes": f"Interview for {req_title}. {interview.get('notes', '')}".strip(),
    }
    cal_booking_url = f"{cal_path}?{urllib.parse.urlencode(cal_params)}"
    
    # Universal fallback web intents
    title = f"{interview.get('interview_round', 'Interview')}: {cand_name} - {req_title}"
    location = interview.get("meeting_link") or interview.get("platform") or "Cal.com Video Room"
    
    desc_lines = [
        f"Role: {req_title}",
        f"Candidate: {cand_name} ({cand_email})",
        f"Interviewer: {interview.get('interviewer_name', '')} ({interview.get('interviewer_email', '')})",
        f"Company: {interview.get('company_name', 'Company')}",
        f"Cal Booking Link: {cal_booking_url}",
    ]
    if interview.get("meeting_link"):
        desc_lines.append(f"Meeting Link: {interview.get('meeting_link')}")
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
        "text": title,
        "details": description,
        "location": location,
        "dates": f"{start_dt_str}/{end_dt_str}",
    }
    google_url = f"https://calendar.google.com/calendar/render?{urllib.parse.urlencode(google_params)}"
    
    outlook_params = {
        "path": "/calendar/action/compose",
        "rru": "addevent",
        "subject": title,
        "body": description,
        "location": location,
        "startdt": f"{date}T{start_time}:00",
        "enddt": f"{date}T{end_time}:00",
    }
    outlook_url = f"https://outlook.live.com/calendar/0/deeplink/compose?{urllib.parse.urlencode(outlook_params)}"
    
    ics_url = f"/api/interviews/{interview.get('id')}/invite.ics"
    
    return {
        "cal_booking_url": cal_booking_url,
        "cal_path": cal_path,
        "google": google_url,
        "outlook": outlook_url,
        "ics": ics_url,
        "provider": "cal",
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
    
    summary = f"{interview.get('interview_round', 'Interview')} - {interview.get('candidate_name', 'Candidate')} ({interview.get('requisition_title', 'Role')})"
    location = interview.get("meeting_link") or interview.get("platform") or "Cal.com Meeting"
    
    description = (
        f"Interview for {interview.get('requisition_title', 'Role')}\\n"
        f"Candidate: {interview.get('candidate_name', '')} ({interview.get('candidate_email', '')})\\n"
        f"Company: {interview.get('company_name', '')}\\n"
        f"Interviewer: {interview.get('interviewer_name', '')} ({interview.get('interviewer_email', '')})\\n"
        f"Meeting Link: {interview.get('meeting_link', '')}\\n"
        f"Notes: {interview.get('notes', '')}"
    )

    ics_payload = f"""BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//TermJobs Workforce Platform//Cal.com Scheduling//EN
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


def create_interview_proposal(data: Dict[str, Any], tenant_id: str, company_name: str = "") -> Dict[str, Any]:
    """Create a new interview proposal from the Hiring Manager."""
    interview = InterviewSchedule(
        tenant_id=tenant_id,
        company_name=company_name or "Company",
        calendar_provider="cal",
        requisition_id=data.get("requisition_id"),
        requisition_title=data.get("requisition_title", "Untitled Role"),
        candidate_submission_id=data.get("candidate_submission_id"),
        candidate_name=data.get("candidate_name", "Candidate"),
        candidate_email=data.get("candidate_email", ""),
        vendor_id=data.get("vendor_id"),
        vendor_name=data.get("vendor_name", "Vendor"),
        interview_round=data.get("interview_round", "Technical Round 1"),
        interviewer_name=data.get("interviewer_name", ""),
        interviewer_email=data.get("interviewer_email", ""),
        meeting_link=data.get("meeting_link", ""),
        platform=data.get("platform", "Cal.com Video"),
        proposed_slots=data.get("proposed_slots", []),
        confirmed_slot=data.get("confirmed_slot", {}),
        status=InterviewStatus.PROPOSED_BY_COMPANY.value,
        notes=data.get("notes", ""),
        vendor_notes="",
    )
    
    with get_session() as session:
        session.add(interview)
        session.flush()
        doc = interview.to_doc()
        session.commit()
        
    doc["calendar_links"] = generate_calendar_links(doc)
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

import os
import random
import string
import time
import jwt
from modules.interview.domain.models import InterviewRound, InterviewChatMessage
from modules.candidate.domain.models import CandidateSubmission


def _generate_candidate_passcode() -> str:
    """Generate a clean, memorable candidate interview passcode like TJ-INT-5829."""
    digits = "".join(random.choices(string.digits, k=4))
    return f"TJ-INT-{digits}"


def create_interview_round(data: dict, tenant_id: str, created_by: str) -> dict:
    """
    Create a new interview round for a candidate under a requisition.
    Prevents duplicate rounds and duplicate assignments.
    """
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
            created_by=created_by,
        )
        
        session.add(round_obj)
        session.commit()
        return round_obj.to_doc()


def get_hiring_manager_rounds(
    tenant_id: str,
    requisition_id: Optional[str] = None,
    candidate_id: Optional[str] = None,
) -> List[dict]:
    """Retrieve all interview rounds belonging to the Hiring Manager tenant."""
    with get_session() as session:
        q = session.query(InterviewRound).filter(InterviewRound.tenant_id == tenant_id)
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
                matched.append(r.to_doc())
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
    """Validate candidate login via email + passcode or direct invite token."""
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
            
        first_round = user_rounds[0]
        return {
            "authenticated": True,
            "candidate_name": first_round.candidate_name,
            "candidate_email": first_round.candidate_email,
            "candidate_token": first_round.candidate_token,
            "candidate_submission_id": first_round.candidate_submission_id,
            "requisition_id": first_round.requisition_id,
            "requisition_title": first_round.requisition_title,
            "rounds_count": len(user_rounds),
        }


def get_round_by_id(round_id: str) -> Optional[dict]:
    """Retrieve single round by ID."""
    with get_session() as session:
        r = session.query(InterviewRound).filter(InterviewRound.id == round_id).first()
        return r.to_doc() if r else None


def update_round_status(round_id: str, new_status: str) -> Optional[dict]:
    """Update status of an interview round (e.g. In Progress, Completed, Cancelled)."""
    with get_session() as session:
        r = session.query(InterviewRound).filter(InterviewRound.id == round_id).first()
        if not r:
            return None
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
        if r.candidate_submission_id:
            sub = session.get(CandidateSubmission, r.candidate_submission_id)
            if sub is not None:
                if result_verdict in ("Strong Yes", "Yes"):
                    sub.status = f"Passed {r.round_name}"
                elif result_verdict == "No":
                    sub.status = f"Rejected at {r.round_name}"
                sub.updated_at = datetime.now(timezone.utc)
                session._track(sub)
                
        session.commit()
        return r.to_doc()


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

        # Query all scheduled interview rounds for this tenant
        round_filters = [InterviewRound.tenant_id == tenant_id] if tenant_id else []
        rounds = session.query(InterviewRound).filter(*round_filters).all()
        by_candidate = {}
        for r in rounds:
            cid = r.candidate_submission_id or r.candidate_email or r.id
            if cid not in by_candidate:
                by_candidate[cid] = {
                    "candidate_submission_id": r.candidate_submission_id,
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

        # Also pull all Shortlisted candidates from candidate_submissions
        submissions = session.query(CandidateSubmission).all()
        for sub in submissions:
            status_clean = (sub.status or "").strip().lower()
            if status_clean in ("shortlisted", "interviewing", "under review", "screened"):
                # If tenant requisitions are known, filter to candidates for those requisitions
                if tenant_req_ids and sub.requisition_id and sub.requisition_id not in tenant_req_ids:
                    continue

                # Check if this candidate is already tracked in by_candidate
                existing_key = None
                sub_email_norm = (sub.candidate_email or "").strip().lower()
                for k, v in by_candidate.items():
                    if (sub.id and v.get("candidate_submission_id") == sub.id) or \
                       (sub_email_norm and (v.get("candidate_email") or "").strip().lower() == sub_email_norm):
                        existing_key = k
                        break

                if existing_key:
                    by_candidate[existing_key]["match_score"] = sub.match_score
                    by_candidate[existing_key]["vendor_name"] = sub.vendor_name
                    by_candidate[existing_key]["submission_status"] = sub.status
                else:
                    cand_key = sub.id or sub.candidate_email or f"sub-{len(by_candidate)}"
                    by_candidate[cand_key] = {
                        "candidate_submission_id": sub.id,
                        "candidate_name": sub.candidate_name or "Candidate",
                        "candidate_email": sub.candidate_email or "",
                        "requisition_id": sub.requisition_id or "",
                        "requisition_title": req_title_map.get(sub.requisition_id, "Position"),
                        "match_score": sub.match_score,
                        "vendor_name": sub.vendor_name,
                        "submission_status": sub.status or "Shortlisted",
                        "rounds": [],
                    }
            
        summary = []
        for cid, item in by_candidate.items():
            r_list = item["rounds"]
            r_list.sort(key=lambda x: x.get("round_number", 1))
            
            total_rounds = len(r_list)
            completed_rounds = sum(1 for x in r_list if x.get("status") == "Completed")
            in_progress_rounds = sum(1 for x in r_list if x.get("status") == "In Progress")
            
            # Determine readiness for next round
            last_round = r_list[-1] if r_list else None
            last_eval = (last_round.get("evaluation") or {}) if last_round else {}
            last_verdict = last_eval.get("result", "")
            
            ready_for_next = False
            if last_round and last_round.get("status") == "Completed" and last_verdict in ("Strong Yes", "Yes"):
                ready_for_next = True
                
            summary.append({
                "candidate_submission_id": item["candidate_submission_id"],
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
                "ready_for_round_1": (total_rounds == 0),
                "latest_round": last_round,
                "rounds": r_list,
            })

        # Sort summary: candidates ready for round 1 or next round first, then by name
        summary.sort(key=lambda x: (not (x.get("ready_for_round_1") or x.get("ready_for_next_round")), x.get("candidate_name", "")))
        return summary

