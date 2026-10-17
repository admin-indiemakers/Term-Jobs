"""
Interviewer availability and schedule conflict detection across all candidates, requisitions, and rounds.
"""
import re
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict, Any, Tuple
from zoneinfo import ZoneInfo

from modules.shared.db import get_session, db
from modules.interview.domain.models import InterviewRound
from modules.identity.domain.models import User


ACTIVE_STATUSES = ("Scheduled", "Confirmed", "In Progress", "Live")


def parse_round_time_window(
    scheduled_date: Optional[str],
    scheduled_time: Optional[str],
    scheduled_timezone: Optional[str] = "Asia/Kolkata",
    duration_minutes: Optional[int] = 45,
) -> Tuple[Optional[datetime], Optional[datetime]]:
    """
    Safely parses date and time strings into UTC timezone-aware (start_utc, end_utc) datetimes.
    Supports both 24-hour ('14:30', '09:00') and 12-hour ('02:30 PM', '9:00 AM') formats.
    Returns (None, None) if missing, invalid, or non-timed (e.g. 'Immediate / On-Demand').
    """
    if not scheduled_date or not scheduled_time:
        return None, None

    date_str = str(scheduled_date).strip()
    time_str = str(scheduled_time).strip()

    if not date_str or not time_str:
        return None, None

    lower_time = time_str.lower()
    if any(keyword in lower_time for keyword in ("immediate", "on-demand", "tbd", "none", "not scheduled")):
        return None, None

    try:
        tz = ZoneInfo(scheduled_timezone or "Asia/Kolkata")
    except Exception:
        tz = ZoneInfo("Asia/Kolkata")

    normalized_time = None

    # Check 12-hour format e.g. "09:30 AM", "9:30 AM", "12:00 PM"
    m12 = re.match(r"^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$", time_str, re.IGNORECASE)
    if m12:
        hours = int(m12.group(1)) % 12
        if m12.group(3).upper() == "PM":
            hours += 12
        minutes = int(m12.group(2))
        normalized_time = f"{hours:02d}:{minutes:02d}"
    else:
        # Check 24-hour format e.g. "09:30", "14:00"
        m24 = re.match(r"^(\d{1,2}):(\d{2})(?::\d{2})?$", time_str)
        if m24:
            hours = int(m24.group(1))
            minutes = int(m24.group(2))
            normalized_time = f"{hours:02d}:{minutes:02d}"

    if not normalized_time:
        return None, None

    try:
        start_local = datetime.strptime(f"{date_str} {normalized_time}", "%Y-%m-%d %H:%M").replace(tzinfo=tz)
        start_utc = start_local.astimezone(timezone.utc)
        duration = int(duration_minutes) if duration_minutes and int(duration_minutes) > 0 else 45
        end_utc = start_utc + timedelta(minutes=duration)
        return start_utc, end_utc
    except Exception:
        return None, None


def check_intervals_overlap(
    start1_utc: datetime,
    end1_utc: datetime,
    start2_utc: datetime,
    end2_utc: datetime,
) -> bool:
    """Returns True if interval 1 and interval 2 overlap."""
    return start1_utc < end2_utc and end1_utc > start2_utc


def find_interviewer_conflicts(
    interviewer_email: Optional[str],
    scheduled_date: Optional[str],
    scheduled_time: Optional[str],
    scheduled_timezone: Optional[str] = "Asia/Kolkata",
    duration_minutes: Optional[int] = 45,
    exclude_round_id: Optional[str] = None,
    interviewer_name: Optional[str] = None,
    session=None,
) -> List[Dict[str, Any]]:
    """
    Find all overlapping interview rounds for a specific interviewer across all
    candidates, interview rounds, and requisitions.
    """
    if not scheduled_date or not scheduled_time:
        return []

    target_email = (interviewer_email or "").strip().lower()
    target_name = (interviewer_name or "").strip().lower()

    if not target_email and not target_name:
        return []

    target_start_utc, target_end_utc = parse_round_time_window(
        scheduled_date,
        scheduled_time,
        scheduled_timezone,
        duration_minutes,
    )

    if not target_start_utc or not target_end_utc:
        return []

    def _inspect_rounds(s):
        # Query active rounds across all candidates and requisitions
        # We check both email match and name match if email is missing or provided
        query = s.query(InterviewRound).filter(
            InterviewRound.status.in_(ACTIVE_STATUSES)
        )
        all_active = query.all()

        conflicts = []
        for r in all_active:
            if getattr(r, "status", None) not in ACTIVE_STATUSES:
                continue
            if exclude_round_id and str(r.id) == str(exclude_round_id):
                continue

            r_email = (r.interviewer_email or "").strip().lower()
            r_name = (r.interviewer_name or "").strip().lower()

            matches_interviewer = False
            if target_email and r_email:
                matches_interviewer = (target_email == r_email)
            elif target_email and not r_email and target_name and r_name:
                matches_interviewer = (target_name == r_name)
            elif not target_email and target_name and r_name:
                matches_interviewer = (target_name == r_name)

            if not matches_interviewer:
                continue

            r_start_utc, r_end_utc = parse_round_time_window(
                r.scheduled_date,
                r.scheduled_time,
                r.scheduled_timezone,
                r.duration_minutes,
            )

            if not r_start_utc or not r_end_utc:
                continue

            if check_intervals_overlap(target_start_utc, target_end_utc, r_start_utc, r_end_utc):
                conflicts.append({
                    "round_id": r.id,
                    "round_name": r.round_name or "Interview Round",
                    "candidate_name": r.candidate_name or "Candidate",
                    "candidate_email": r.candidate_email or "",
                    "requisition_id": r.requisition_id or "",
                    "requisition_title": r.requisition_title or "Requisition",
                    "scheduled_date": r.scheduled_date,
                    "scheduled_time": r.scheduled_time,
                    "duration_minutes": r.duration_minutes or 45,
                    "scheduled_timezone": r.scheduled_timezone or "Asia/Kolkata",
                    "interviewer_name": r.interviewer_name,
                    "interviewer_email": r.interviewer_email,
                    "status": r.status,
                })

        return conflicts

    if session:
        return _inspect_rounds(session)
    else:
        with get_session() as session:
            return _inspect_rounds(session)


def validate_interviewer_availability(
    interviewer_email: Optional[str],
    scheduled_date: Optional[str],
    scheduled_time: Optional[str],
    scheduled_timezone: Optional[str] = "Asia/Kolkata",
    duration_minutes: Optional[int] = 45,
    exclude_round_id: Optional[str] = None,
    interviewer_name: Optional[str] = None,
    session=None,
) -> None:
    """
    Validates that the interviewer does not have an overlapping interview.
    Raises ValueError if a conflict exists.
    """
    conflicts = find_interviewer_conflicts(
        interviewer_email=interviewer_email,
        scheduled_date=scheduled_date,
        scheduled_time=scheduled_time,
        scheduled_timezone=scheduled_timezone,
        duration_minutes=duration_minutes,
        exclude_round_id=exclude_round_id,
        interviewer_name=interviewer_name,
        session=session,
    )

    if conflicts:
        c = conflicts[0]
        cand = f" with {c['candidate_name']}" if c.get("candidate_name") else ""
        req = f" for '{c['requisition_title']}'" if c.get("requisition_title") else ""
        round_info = f" ({c['round_name']})" if c.get("round_name") else ""
        interviewer_display = interviewer_name or interviewer_email or "Selected interviewer"
        
        raise ValueError(
            f"Interviewer '{interviewer_display}' is already booked for another interview{round_info}{cand}{req} "
            f"on {c['scheduled_date']} at {c['scheduled_time']} ({c['duration_minutes']} mins). "
            f"Please choose another time slot or select a different interviewer."
        )


def get_all_interviewers_with_availability(
    current_user: User,
    scheduled_date: Optional[str] = None,
    scheduled_time: Optional[str] = None,
    scheduled_timezone: Optional[str] = "Asia/Kolkata",
    duration_minutes: Optional[int] = 45,
    exclude_round_id: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Returns all interviewers for the user's tenant with their booked slots and
    computed availability status for the given date/time slot.
    """
    tenant_id = getattr(current_user, "tenant_id", None) or getattr(current_user, "id", "")
    custom_interviewers = list(db["hiring_manager_interviewers"].find(
        {"tenant_id": tenant_id},
        {"_id": 0}
    ).sort("created_at", -1))

    seen_emails = {i["email"].lower() for i in custom_interviewers if i.get("email")}
    combined = list(custom_interviewers)

    with get_session() as session:
        staff = session.query(User).filter(User.tenant_id == tenant_id).all()
        for actor in staff:
            if actor.is_active and actor.role in ('Hiring Manager', 'HR', 'Admin', 'Director') and actor.email.lower() not in seen_emails:
                combined.append({
                    'id': str(actor.id),
                    'name': actor.name,
                    'role': actor.role,
                    'email': actor.email,
                    'avatar': getattr(actor, 'avatar', None) or f"https://api.dicebear.com/7.x/avataaars/svg?seed={actor.name.replace(' ', '')}"
                })

        # Fetch all active rounds across all candidates and requisitions
        active_rounds = session.query(InterviewRound).filter(
            InterviewRound.status.in_(ACTIVE_STATUSES)
        ).all()

        # Build map of booked slots per interviewer email/name
        # email -> list of booked slots
        booked_by_email: Dict[str, List[Dict[str, Any]]] = {}
        booked_by_name: Dict[str, List[Dict[str, Any]]] = {}

        for r in active_rounds:
            if getattr(r, "status", None) not in ACTIVE_STATUSES:
                continue
            if exclude_round_id and str(r.id) == str(exclude_round_id):
                continue

            r_start_utc, r_end_utc = parse_round_time_window(
                r.scheduled_date,
                r.scheduled_time,
                r.scheduled_timezone,
                r.duration_minutes,
            )
            if not r_start_utc or not r_end_utc:
                continue

            slot_info = {
                "round_id": r.id,
                "round_name": r.round_name or "Interview Round",
                "candidate_name": r.candidate_name or "Candidate",
                "requisition_id": r.requisition_id or "",
                "requisition_title": r.requisition_title or "",
                "scheduled_date": r.scheduled_date,
                "scheduled_time": r.scheduled_time,
                "duration_minutes": r.duration_minutes or 45,
                "scheduled_timezone": r.scheduled_timezone or "Asia/Kolkata",
                "start_utc": r_start_utc.isoformat(),
                "end_utc": r_end_utc.isoformat(),
            }

            if r.interviewer_email:
                e_key = r.interviewer_email.strip().lower()
                booked_by_email.setdefault(e_key, []).append(slot_info)

            if r.interviewer_name:
                n_key = r.interviewer_name.strip().lower()
                booked_by_name.setdefault(n_key, []).append(slot_info)

        # Target slot for availability calculation if provided
        target_start_utc, target_end_utc = None, None
        if scheduled_date and scheduled_time:
            target_start_utc, target_end_utc = parse_round_time_window(
                scheduled_date,
                scheduled_time,
                scheduled_timezone,
                duration_minutes,
            )

        result = []
        for person in combined:
            p_email = (person.get("email") or "").strip().lower()
            p_name = (person.get("name") or "").strip().lower()

            person_slots = []
            if p_email and p_email in booked_by_email:
                person_slots.extend(booked_by_email[p_email])
            elif p_name and p_name in booked_by_name:
                person_slots.extend(booked_by_name[p_name])

            # Deduplicate slots by round_id
            seen_rids = set()
            unique_slots = []
            for s in person_slots:
                if s["round_id"] not in seen_rids:
                    seen_rids.add(s["round_id"])
                    unique_slots.append(s)

            # Compute availability if target time window is provided
            is_available = True
            conflict_info = None

            if target_start_utc and target_end_utc:
                for s in unique_slots:
                    s_start = datetime.fromisoformat(s["start_utc"])
                    s_end = datetime.fromisoformat(s["end_utc"])
                    if check_intervals_overlap(target_start_utc, target_end_utc, s_start, s_end):
                        is_available = False
                        conflict_info = {
                            "round_name": s["round_name"],
                            "candidate_name": s["candidate_name"],
                            "requisition_title": s["requisition_title"],
                            "scheduled_date": s["scheduled_date"],
                            "scheduled_time": s["scheduled_time"],
                            "duration_minutes": s["duration_minutes"],
                        }
                        break

            person_copy = dict(person)
            if not person_copy.get("avatar"):
                person_copy["avatar"] = f"https://api.dicebear.com/7.x/avataaars/svg?seed={(person_copy.get('name') or 'User').replace(' ', '')}"
            person_copy["booked_slots"] = unique_slots
            person_copy["is_available"] = is_available
            person_copy["conflict"] = conflict_info
            result.append(person_copy)

        return result


def find_candidate_conflicts(
    candidate_submission_id: Optional[str] = None,
    candidate_email: Optional[str] = None,
    scheduled_date: Optional[str] = None,
    scheduled_time: Optional[str] = None,
    scheduled_timezone: Optional[str] = "Asia/Kolkata",
    duration_minutes: Optional[int] = 45,
    exclude_round_id: Optional[str] = None,
    candidate_name: Optional[str] = None,
    session=None,
) -> List[Dict[str, Any]]:
    """
    Find all overlapping interview rounds for a specific candidate across all
    interview rounds, interviewers, and requisitions.
    """
    if not scheduled_date or not scheduled_time:
        return []

    sub_id = str(candidate_submission_id or "").strip()
    c_email = str(candidate_email or "").strip().lower()
    c_name = str(candidate_name or "").strip().lower()

    if not sub_id and not c_email and not c_name:
        return []

    target_start_utc, target_end_utc = parse_round_time_window(
        scheduled_date,
        scheduled_time,
        scheduled_timezone,
        duration_minutes,
    )

    if not target_start_utc or not target_end_utc:
        return []

    resolved_emails = {c_email} if c_email else set()
    resolved_sub_ids = {sub_id} if sub_id else set()

    try:
        from modules.shared.db import db as mongo_db
        or_clauses = []
        if sub_id:
            or_clauses.extend([{"id": sub_id}, {"submission_id": sub_id}, {"candidate_id": sub_id}])
        if c_email:
            or_clauses.append({"candidate_email": c_email})
        if c_name:
            or_clauses.append({"candidate_name": {"$regex": f"^{re.escape(c_name)}$", "$options": "i"}})
        if or_clauses:
            for c_doc in mongo_db["candidate_submissions"].find(
                {"$or": or_clauses},
                {"_id": 0, "id": 1, "submission_id": 1, "candidate_email": 1, "candidate_name": 1}
            ).limit(10):
                sid = c_doc.get("id") or c_doc.get("submission_id")
                em = (c_doc.get("candidate_email") or "").strip().lower()
                nm = (c_doc.get("candidate_name") or "").strip().lower()
                if sid:
                    resolved_sub_ids.add(str(sid))
                if em:
                    resolved_emails.add(em)
                if not c_name and nm:
                    c_name = nm
    except Exception:
        pass

    def _inspect_candidate_rounds(s):
        query = s.query(InterviewRound).filter(
            InterviewRound.status.in_(ACTIVE_STATUSES)
        )
        all_active = query.all()

        conflicts = []
        for r in all_active:
            if getattr(r, "status", None) not in ACTIVE_STATUSES:
                continue
            if exclude_round_id and str(r.id) == str(exclude_round_id):
                continue

            r_sub_id = str(r.candidate_submission_id or "").strip()
            r_email = str(r.candidate_email or "").strip().lower()
            r_name = str(r.candidate_name or "").strip().lower()

            matches_candidate = False
            if r_sub_id and r_sub_id in resolved_sub_ids:
                matches_candidate = True
            elif r_email and r_email in resolved_emails:
                matches_candidate = True
            elif c_name and r_name and c_name == r_name:
                matches_candidate = True

            if not matches_candidate:
                continue

            r_start_utc, r_end_utc = parse_round_time_window(
                r.scheduled_date,
                r.scheduled_time,
                r.scheduled_timezone,
                r.duration_minutes,
            )

            if not r_start_utc or not r_end_utc:
                continue

            if check_intervals_overlap(target_start_utc, target_end_utc, r_start_utc, r_end_utc):
                conflicts.append({
                    "round_id": r.id,
                    "round_name": r.round_name or "Interview Round",
                    "candidate_name": r.candidate_name or candidate_name or "Candidate",
                    "candidate_email": r.candidate_email or candidate_email or "",
                    "requisition_id": r.requisition_id or "",
                    "requisition_title": r.requisition_title or "Requisition",
                    "scheduled_date": r.scheduled_date,
                    "scheduled_time": r.scheduled_time,
                    "duration_minutes": r.duration_minutes or 45,
                    "scheduled_timezone": r.scheduled_timezone or "Asia/Kolkata",
                    "interviewer_name": r.interviewer_name,
                    "interviewer_email": r.interviewer_email,
                    "status": r.status,
                })

        return conflicts

    if session:
        return _inspect_candidate_rounds(session)
    else:
        with get_session() as session:
            return _inspect_candidate_rounds(session)


def validate_candidate_availability(
    candidate_submission_id: Optional[str] = None,
    candidate_email: Optional[str] = None,
    scheduled_date: Optional[str] = None,
    scheduled_time: Optional[str] = None,
    scheduled_timezone: Optional[str] = "Asia/Kolkata",
    duration_minutes: Optional[int] = 45,
    exclude_round_id: Optional[str] = None,
    candidate_name: Optional[str] = None,
    session=None,
) -> None:
    """
    Validates that the candidate does not have another interview round scheduled
    at an overlapping date and time.
    Raises ValueError if a conflict exists.
    """
    conflicts = find_candidate_conflicts(
        candidate_submission_id=candidate_submission_id,
        candidate_email=candidate_email,
        scheduled_date=scheduled_date,
        scheduled_time=scheduled_time,
        scheduled_timezone=scheduled_timezone,
        duration_minutes=duration_minutes,
        exclude_round_id=exclude_round_id,
        candidate_name=candidate_name,
        session=session,
    )

    if conflicts:
        c = conflicts[0]
        round_info = f" ({c['round_name']})" if c.get("round_name") else ""
        req_info = f" for '{c['requisition_title']}'" if c.get("requisition_title") else ""
        c_display = candidate_name or c.get("candidate_name") or candidate_email or "Candidate"
        
        raise ValueError(
            f"Candidate '{c_display}' already has an interview round{round_info}{req_info} "
            f"scheduled on {c['scheduled_date']} at {c['scheduled_time']} ({c['duration_minutes']} mins). "
            f"Each round must have a separate, non-conflicting time slot to prevent overlapping interviews."
        )


def get_candidate_booked_slots(
    candidate_submission_id: Optional[str] = None,
    candidate_email: Optional[str] = None,
    candidate_name: Optional[str] = None,
    exclude_round_id: Optional[str] = None,
    session=None,
) -> List[Dict[str, Any]]:
    """
    Returns all active booked slots for a candidate across all requisitions and rounds.
    """
    sub_id = str(candidate_submission_id or "").strip()
    c_email = str(candidate_email or "").strip().lower()
    c_name = str(candidate_name or "").strip().lower()

    if not sub_id and not c_email and not c_name:
        return []

    resolved_emails = {c_email} if c_email else set()
    resolved_sub_ids = {sub_id} if sub_id else set()

    try:
        from modules.shared.db import db as mongo_db
        or_clauses = []
        if sub_id:
            or_clauses.extend([{"id": sub_id}, {"submission_id": sub_id}, {"candidate_id": sub_id}])
        if c_email:
            or_clauses.append({"candidate_email": c_email})
        if c_name:
            or_clauses.append({"candidate_name": {"$regex": f"^{re.escape(c_name)}$", "$options": "i"}})
        if or_clauses:
            for c_doc in mongo_db["candidate_submissions"].find(
                {"$or": or_clauses},
                {"_id": 0, "id": 1, "submission_id": 1, "candidate_email": 1, "candidate_name": 1}
            ).limit(10):
                sid = c_doc.get("id") or c_doc.get("submission_id")
                em = (c_doc.get("candidate_email") or "").strip().lower()
                nm = (c_doc.get("candidate_name") or "").strip().lower()
                if sid:
                    resolved_sub_ids.add(str(sid))
                if em:
                    resolved_emails.add(em)
                if not c_name and nm:
                    c_name = nm
    except Exception:
        pass

    def _fetch_slots(s):
        rounds = s.query(InterviewRound).filter(
            InterviewRound.status.in_(ACTIVE_STATUSES)
        ).all()
        slots = []
        for r in rounds:
            if getattr(r, "status", None) not in ACTIVE_STATUSES:
                continue
            if exclude_round_id and str(r.id) == str(exclude_round_id):
                continue
            r_sub_id = str(r.candidate_submission_id or "").strip()
            r_email = str(r.candidate_email or "").strip().lower()
            r_name = str(r.candidate_name or "").strip().lower()

            matches = False
            if r_sub_id and r_sub_id in resolved_sub_ids:
                matches = True
            elif r_email and r_email in resolved_emails:
                matches = True
            elif c_name and r_name and c_name == r_name:
                matches = True

            if not matches:
                continue

            r_start_utc, r_end_utc = parse_round_time_window(
                r.scheduled_date,
                r.scheduled_time,
                r.scheduled_timezone,
                r.duration_minutes,
            )
            if not r_start_utc or not r_end_utc:
                continue

            slots.append({
                "round_id": r.id,
                "round_name": r.round_name or "Interview Round",
                "candidate_name": r.candidate_name,
                "candidate_email": r.candidate_email,
                "requisition_id": r.requisition_id,
                "requisition_title": r.requisition_title,
                "scheduled_date": r.scheduled_date,
                "scheduled_time": r.scheduled_time,
                "duration_minutes": r.duration_minutes or 45,
                "scheduled_timezone": r.scheduled_timezone or "Asia/Kolkata",
                "start_utc": r_start_utc.isoformat(),
                "end_utc": r_end_utc.isoformat(),
            })
        return slots

    if session:
        return _fetch_slots(session)
    else:
        with get_session() as session:
            return _fetch_slots(session)

