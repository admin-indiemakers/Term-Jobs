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
