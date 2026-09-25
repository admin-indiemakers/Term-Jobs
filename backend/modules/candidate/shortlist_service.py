"""Requisition Shortlist Service (48-Hour Automation & Instant Dispatch).

Handles:
1. 48-Hour Auto-Shortlist: Automatically compiles and delivers screened candidates
   to the Hiring Manager once the 48-hour sourcing window elapses.
2. Instant Send (Before 48h): Allows Recruiters, Hiring Managers, or Admins to bypass
   the 48-hour countdown and dispatch the current candidate shortlist immediately.
3. In-App Notifications and Email alerts to company hiring stakeholders.
"""
import logging
import time
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

from modules.shared.db import get_session, db
from modules.candidate.domain.models import CandidateSubmission
from modules.interview.domain.models import InterviewRound
from modules.requisition.domain.models import Requisition
from modules.identity.domain.models import User
from modules.notifications.services.notification_service import notify_shortlist_dispatched
from modules.candidate_screening_agent.services.email_service import (
    send_shortlist_dispatch_to_hiring_manager,
    send_shortlist_notification,
)

logger = logging.getLogger("shortlist_service")

_auto_shortlist_last_run: float = 0.0


def _parse_datetime(val: Any) -> Optional[datetime]:
    if not val:
        return None
    if isinstance(val, datetime):
        if val.tzinfo is None:
            return val.replace(tzinfo=timezone.utc)
        return val
    try:
        s = str(val).strip()
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None


def get_requisition_shortlist_status(requisition_id: str) -> Dict[str, Any]:
    """Return the 48-hour shortlist status, countdown, and candidates count."""
    now = datetime.now(timezone.utc)
    
    # 1. Fetch Requisition from MongoDB and SQLite
    req_doc = None
    try:
        req_doc = db["requisitions"].find_one({"id": requisition_id})
    except Exception:
        pass

    with get_session() as session:
        req_model = session.get(Requisition, requisition_id)
        if not req_model and not req_doc:
            return {
                "error": "Requisition not found",
                "requisition_id": requisition_id,
                "can_send_instant": False,
            }

        # Determine start time (approved_at, created_at, or updated_at)
        created_val = (
            getattr(req_model, "approved_at", None)
            or getattr(req_model, "created_at", None)
            or (req_doc or {}).get("approved_at")
            or (req_doc or {}).get("created_at")
        )
        created_dt = _parse_datetime(created_val) or now

        # Window & Deadline
        window_hours = (
            getattr(req_model, "shortlist_window_hours", 48)
            or (req_doc or {}).get("shortlist_window_hours")
            or 48
        )
        
        saved_deadline_val = (
            getattr(req_model, "shortlist_deadline", None)
            or (req_doc or {}).get("shortlist_deadline")
        )
        deadline_dt = _parse_datetime(saved_deadline_val)
        if not deadline_dt:
            deadline_dt = created_dt + timedelta(hours=window_hours)

        seconds_remaining = max(0, int((deadline_dt - now).total_seconds()))
        is_expired = seconds_remaining <= 0

        dispatched = bool(
            getattr(req_model, "shortlist_dispatched", False)
            or (req_doc or {}).get("shortlist_dispatched", False)
        )
        dispatched_at = (
            getattr(req_model, "shortlist_dispatched_at", None)
            or (req_doc or {}).get("shortlist_dispatched_at")
        )
        dispatched_by = (
            getattr(req_model, "shortlist_dispatched_by", None)
            or (req_doc or {}).get("shortlist_dispatched_by")
        )
        auto_sent = bool(
            getattr(req_model, "shortlist_auto_sent", False)
            or (req_doc or {}).get("shortlist_auto_sent", False)
        )
        instant_sent = bool(
            getattr(req_model, "shortlist_instant_sent", False)
            or (req_doc or {}).get("shortlist_instant_sent", False)
        )
        cand_count = (
            getattr(req_model, "shortlist_candidate_count", 0)
            or (req_doc or {}).get("shortlist_candidate_count", 0)
            or 0
        )

    # Candidate Submissions breakdown
    total_candidates = 0
    screened_count = 0
    shortlisted_count = 0
    try:
        subs = list(db["candidate_submissions"].find({"requisition_id": requisition_id}))
        total_candidates = len(subs)
        for s in subs:
            st = s.get("status")
            if st == "Screened":
                screened_count += 1
            elif st in ("Shortlisted", "Accepted", "Under Review"):
                shortlisted_count += 1
    except Exception:
        pass

    return {
        "requisition_id": requisition_id,
        "shortlist_window_hours": window_hours,
        "created_at": created_dt.isoformat(),
        "shortlist_deadline": deadline_dt.isoformat(),
        "seconds_remaining": seconds_remaining,
        "hours_remaining": round(seconds_remaining / 3600, 1),
        "is_expired": is_expired,
        "shortlist_dispatched": dispatched,
        "shortlist_dispatched_at": dispatched_at.isoformat() if hasattr(dispatched_at, "isoformat") else (dispatched_at or None),
        "shortlist_dispatched_by": dispatched_by,
        "shortlist_auto_sent": auto_sent,
        "shortlist_instant_sent": instant_sent,
        "shortlist_candidate_count": cand_count or shortlisted_count,
        "total_candidates": total_candidates,
        "screened_count": screened_count,
        "shortlisted_count": shortlisted_count,
        "can_send_instant": not dispatched,
    }


def generate_and_rank_requisition_shortlist(requisition_id: str) -> Dict[str, Any]:
    """Algorithmic Candidate Shortlist Generator.
    Triggered when an AI score is created or updated, or on demand.
    
    1. Collects all candidates under this requisition.
    2. Incorporates AI Spoken Communication Score / Evaluation Verdicts and Resume Match Scores.
       Algorithmic weighted formula:
         Composite Score = (0.6 * AI Interview Score) + (0.4 * Resume Match Score) [if interview exists]
         Composite Score = Resume Match Score [if no interview completed yet]
    3. Ranks candidates descending by Composite Score.
    4. Automatically qualifies & promotes eligible candidates to "Shortlisted" status.
    5. Sets / resets the 48-hour shortlist dispatch deadline (now + 48 hours) so it will automatically
       deliver to the company once 48h has elapsed.
    6. Persists the ranked shortlist and returns full status.
    """
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    logger.info(f"[SHORTLIST ALGORITHM] Generating candidate shortlist for requisition {requisition_id}...")

    with get_session() as session:
        req = session.get(Requisition, requisition_id)
        if not req:
            logger.warning(f"generate_and_rank_requisition_shortlist: req {requisition_id} not found")
            return {"error": "Requisition not found"}

        # Fetch all candidate submissions for this req from SQLite
        sqlite_subs = (
            session.query(CandidateSubmission)
            .filter(CandidateSubmission.requisition_id == requisition_id)
            .all()
        )
        existing_sqlite_emails = {(s.candidate_email or "").strip().lower() for s in sqlite_subs if s.candidate_email}
        existing_sqlite_ids = {s.id for s in sqlite_subs if s.id}

        # Also sync any MongoDB candidate submissions for this req that aren't yet in SQLite
        try:
            mongo_subs = list(db["candidate_submissions"].find({"requisition_id": requisition_id}))
            for ms in mongo_subs:
                m_email = (ms.get("candidate_email") or "").strip().lower()
                m_id = ms.get("id") or str(ms.get("_id"))
                if m_email not in existing_sqlite_emails and m_id not in existing_sqlite_ids:
                    new_sub = CandidateSubmission(
                        id=m_id,
                        requisition_id=requisition_id,
                        candidate_name=ms.get("candidate_name") or "Candidate",
                        candidate_email=m_email,
                        vendor_name=ms.get("vendor_name") or "Direct Applicant",
                        match_score=ms.get("match_score"),
                        status=ms.get("status") or "Screened",
                        created_at=now,
                        updated_at=now,
                    )
                    session.add(new_sub)
                    session.commit()
                    sqlite_subs.append(new_sub)
                    existing_sqlite_emails.add(m_email)
                    existing_sqlite_ids.add(m_id)
        except Exception as sync_err:
            logger.warning(f"Error syncing MongoDB submissions to SQLite for {requisition_id}: {sync_err}")
        
        # Fetch all interview rounds for this requisition to get latest AI scores
        interview_rounds = (
            session.query(InterviewRound)
            .filter(InterviewRound.requisition_id == requisition_id)
            .all()
        )
        
        # Map rounds by candidate email, submission id, or candidate name
        rounds_by_sub = {}
        rounds_by_email = {}
        rounds_by_name = {}
        for ir in interview_rounds:
            if ir.candidate_submission_id:
                rounds_by_sub.setdefault(ir.candidate_submission_id, []).append(ir)
            if ir.candidate_email:
                rounds_by_email.setdefault(ir.candidate_email.strip().lower(), []).append(ir)
            if ir.candidate_name:
                rounds_by_name.setdefault(ir.candidate_name.strip().lower(), []).append(ir)

        ranked_candidates = []
        shortlisted_count = 0

        # Score SQLite candidates
        for sub in sqlite_subs:
            sub_id = sub.id
            email = (sub.candidate_email or "").strip().lower()
            name = (sub.candidate_name or "").strip().lower()
            
            c_rounds = rounds_by_sub.get(sub_id) or rounds_by_email.get(email) or rounds_by_name.get(name) or []
            # Find best completed interview score
            best_interview_score = None
            has_passed_round = False
            has_completed_interview = any(r.status == "Completed" for r in c_rounds)
            for r in c_rounds:
                ca = r.communication_analysis or {}
                sc = ca.get("overall_score")
                if sc is not None and str(sc).isdigit():
                    sc_int = int(sc)
                    if best_interview_score is None or sc_int > best_interview_score:
                        best_interview_score = sc_int
                
                ev = r.evaluation or {}
                if ev.get("result") in ("Strong Yes", "Yes", "Hold"):
                    has_passed_round = True
                    if best_interview_score is None or best_interview_score < 75:
                        best_interview_score = 80

            # Algorithm Weighting:
            # Composite = 60% AI interview score + 40% resume score (only if interview completed)
            # If no completed interview → candidate is NOT eligible for HM shortlist.
            resume_score = float(sub.match_score) if sub.match_score is not None else 0.0
            if best_interview_score is not None:
                composite_score = round(0.6 * best_interview_score + 0.4 * resume_score, 1)
            else:
                # Keep raw resume score for display but do NOT shortlist without interview
                composite_score = round(resume_score, 1)

            # Update candidate match_score to reflect composite algorithmic score
            sub.match_score = composite_score

            # ── STRICT GATE: candidate must have COMPLETED the AI screening interview ──
            # Simply having a good resume is not enough — they must have attended the interview.
            is_qualified = (
                has_completed_interview                                      # round.status == "Completed"
                or (best_interview_score is not None and has_passed_round)   # AI evaluation passed
                or sub.status in ("Shortlisted", "Accepted", "Under Review", "Hired")  # already promoted
            )

            if is_qualified:
                if sub.status not in ("Hired", "Rejected"):
                    sub.status = "Shortlisted"
                shortlisted_count += 1
            else:
                # Reset any stale Shortlisted status if interview has not been completed
                if sub.status == "Shortlisted":
                    sub.status = "Screened"

            sub.updated_at = now
            session.add(sub)

            ranked_candidates.append({
                "submission_id": sub_id,
                "candidate_name": sub.candidate_name,
                "candidate_email": sub.candidate_email,
                "match_score": composite_score,
                "interview_score": best_interview_score,
                "has_completed_interview": has_completed_interview,
                "status": sub.status,
                "is_shortlisted": is_qualified,
            })

            # Update MongoDB submission as well
            try:
                db["candidate_submissions"].update_one(
                    {"$or": [{"id": sub_id}, {"candidate_email": email, "requisition_id": requisition_id}]},
                    {"$set": {
                        "match_score": composite_score,
                        "interview_score": best_interview_score,
                        "status": sub.status,
                        "shortlisted_at": now_iso,
                        "updated_at": now_iso,
                    }}
                )
            except Exception:
                pass

        # Sort descending by composite score
        ranked_candidates.sort(key=lambda x: x["match_score"], reverse=True)
        for idx, item in enumerate(ranked_candidates, 1):
            item["rank"] = idx

        # Set or maintain 48h deadline
        current_deadline = _parse_datetime(getattr(req, "shortlist_deadline", None))
        # If deadline is missing or already expired, set a fresh 48-hour delivery window
        if not current_deadline or current_deadline <= now:
            new_deadline = now + timedelta(hours=48)
            req.shortlist_deadline = new_deadline.isoformat()
            deadline_str = new_deadline.isoformat()
        else:
            deadline_str = current_deadline.isoformat()

        req.shortlist_candidate_count = shortlisted_count
        req.updated_at = now
        session.add(req)
        session.commit()

        # Update MongoDB Requisition
        try:
            db["requisitions"].update_one(
                {"id": requisition_id},
                {"$set": {
                    "shortlist_deadline": deadline_str,
                    "shortlist_candidate_count": shortlisted_count,
                    "shortlist_generated_at": now_iso,
                    "updated_at": now_iso,
                }}
            )
        except Exception:
            pass

        logger.info(
            f"[SHORTLIST ALGORITHM] Successfully generated shortlist for {requisition_id}: "
            f"{shortlisted_count} shortlisted candidates. 48h deadline: {deadline_str}"
        )

        return {
            "requisition_id": requisition_id,
            "shortlisted_count": shortlisted_count,
            "shortlist_deadline": deadline_str,
            "candidates": ranked_candidates,
            "generated_at": now_iso,
        }


def dispatch_requisition_shortlist(
    requisition_id: str,
    dispatched_by: str = "48h Automated Sourcing Window",
    is_auto: bool = False,
    notes: Optional[str] = None,
) -> Dict[str, Any]:
    """Promote screened candidates to Shortlisted and deliver the shortlist to the Hiring Manager.

    Can be triggered automatically when 48 hours pass, or instantly via the recruiter/HM button.
    """
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()

    with get_session() as session:
        req = session.get(Requisition, requisition_id)
        if not req:
            raise ValueError(f"Requisition {requisition_id} not found")

        # 1. Gather only candidates already marked Shortlisted by the scoring algorithm
        #    (i.e. those who completed the AI screening interview).
        #    We do NOT blindly promote un-interviewed candidates here.
        sqlite_subs = (
            session.query(CandidateSubmission)
            .filter(CandidateSubmission.requisition_id == requisition_id)
            .all()
        )

        # Fetch completed interview rounds to determine who actually attended screening
        interview_rounds = (
            session.query(InterviewRound)
            .filter(InterviewRound.requisition_id == requisition_id)
            .all()
        )
        completed_emails = set()
        completed_sub_ids = set()
        for ir in interview_rounds:
            if ir.status == "Completed":
                if ir.candidate_email:
                    completed_emails.add(ir.candidate_email.strip().lower())
                if ir.candidate_submission_id:
                    completed_sub_ids.add(ir.candidate_submission_id)

        # Only promote candidates who attended the AI interview
        for s in sqlite_subs:
            email = (s.candidate_email or "").strip().lower()
            attended = s.id in completed_sub_ids or email in completed_emails
            already_promoted = s.status in ("Shortlisted", "Accepted", "Under Review", "Hired")
            if attended and s.status not in ("Hired", "Rejected"):
                s.status = "Shortlisted"
                s.updated_at = now
                session.add(s)
            elif not attended and not already_promoted:
                # Leave un-interviewed candidates as Screened — do not promote
                pass

        # In MongoDB: only promote candidates who attended the AI screening
        try:
            email_list = list(completed_emails)
            sub_id_list = list(completed_sub_ids)
            if email_list or sub_id_list:
                mongo_filter = {
                    "requisition_id": requisition_id,
                    "status": {"$nin": ["Shortlisted", "Accepted", "Under Review", "Hired", "Rejected"]},
                    "$or": (
                        [{"candidate_email": {"$in": email_list}}] if email_list else []
                    ) + (
                        [{"id": {"$in": sub_id_list}}] if sub_id_list else []
                    )
                }
                if mongo_filter["$or"]:
                    db["candidate_submissions"].update_many(
                        mongo_filter,
                        {"$set": {"status": "Shortlisted", "shortlisted_at": now_iso, "updated_at": now_iso}}
                    )
        except Exception as e:
            logger.warning(f"Error updating MongoDB candidate submissions: {e}")

        # Fetch all currently shortlisted candidates for summary
        candidate_list = []
        try:
            mongo_subs = list(
                db["candidate_submissions"].find({
                    "requisition_id": requisition_id,
                    "status": {"$in": ["Shortlisted", "Accepted", "Under Review"]}
                })
            )
            for m in mongo_subs:
                candidate_list.append({
                    "name": m.get("candidate_name") or "Candidate",
                    "email": m.get("candidate_email") or "",
                    "vendor": m.get("vendor_name") or "Direct",
                    "match_score": m.get("match_score"),
                    "recommendation": m.get("recommendation"),
                    "matched_skills": m.get("matched_skills") or [],
                })
        except Exception:
            for s in sqlite_subs:
                if s.status in ("Shortlisted", "Accepted", "Under Review"):
                    candidate_list.append({
                        "name": s.candidate_name or "Candidate",
                        "email": s.candidate_email or "",
                        "vendor": s.vendor_name or "Direct",
                        "match_score": s.match_score,
                        "recommendation": s.recommendation,
                        "matched_skills": s.matched_skills or [],
                    })

        total_count = len(candidate_list)

        # 2. Update Requisition record
        req.shortlist_dispatched = True
        req.shortlist_dispatched_at = now_iso
        req.shortlist_dispatched_by = dispatched_by
        req.shortlist_auto_sent = is_auto
        req.shortlist_instant_sent = not is_auto
        req.shortlist_candidate_count = total_count
        session.add(req)
        session.commit()

        # Update in MongoDB Requisitions
        try:
            db["requisitions"].update_one(
                {"id": requisition_id},
                {"$set": {
                    "shortlist_dispatched": True,
                    "shortlist_dispatched_at": now_iso,
                    "shortlist_dispatched_by": dispatched_by,
                    "shortlist_auto_sent": is_auto,
                    "shortlist_instant_sent": not is_auto,
                    "shortlist_candidate_count": total_count,
                    "shortlist_notes": notes or "",
                    "updated_at": now_iso,
                }}
            )
        except Exception as e:
            logger.warning(f"Error updating MongoDB requisition shortlist status: {e}")

        # 3. Retrieve Context for Notifications & Emails
        req_title = req.title or "Untitled Requisition"
        req_ref = f"REQ-{requisition_id[:6].upper()}"
        hm_name = (req.structured_role or {}).get("hiring_manager") or "Hiring Manager"

        # Find Hiring Manager or Company Admin users to email
        company_users = (
            session.query(User)
            .filter(User.tenant_id == req.tenant_id)
            .all()
        )
        recipient_emails = [u.email for u in company_users if u.email and u.is_active]

    # 4. Dispatch In-App Notification
    try:
        notify_shortlist_dispatched(
            requisition_id=requisition_id,
            candidate_count=total_count,
            dispatched_by=dispatched_by,
            is_auto=is_auto,
        )
    except Exception as e:
        logger.warning(f"Failed to send in-app shortlist notification: {e}")

    # 5. Send Shortlist Email to Hiring Team
    for email in recipient_emails:
        try:
            send_shortlist_dispatch_to_hiring_manager(
                hm_email=email,
                hm_name=hm_name,
                job_title=req_title,
                req_ref=req_ref,
                candidate_count=total_count,
                candidates=candidate_list,
                dispatched_by=dispatched_by,
                is_auto=is_auto,
                notes=notes,
            )
        except Exception as e:
            logger.warning(f"Failed to email shortlist to {email}: {e}")

    # 6. Notify Candidates (if emails exist)
    for c in candidate_list:
        if c.get("email"):
            try:
                send_shortlist_notification(
                    candidate_name=c["name"],
                    candidate_email=c["email"],
                    job_title=req_title,
                    notes=notes,
                )
            except Exception as e:
                logger.warning(f"Failed to email shortlisted candidate {c['name']}: {e}")

    mode_label = "automatically upon 48h window expiration" if is_auto else f"instantly before 48h by {dispatched_by}"
    logger.info(f"[SHORTLIST DISPATCHED] Requisition {req_ref} ({req_title}): {total_count} candidates sent {mode_label}.")

    return {
        "status": "success",
        "requisition_id": requisition_id,
        "dispatched": True,
        "dispatched_at": now_iso,
        "dispatched_by": dispatched_by,
        "is_auto": is_auto,
        "instant": not is_auto,
        "candidate_count": total_count,
        "shortlisted_candidates": candidate_list,
        "message": f"Shortlist of {total_count} candidate(s) successfully dispatched to Hiring Manager ({mode_label}).",
    }


def auto_check_and_dispatch_48h_shortlists() -> List[Dict[str, Any]]:
    """Scan Published requisitions and auto-dispatch shortlists whose 48h window has passed.

    Debounced to run at most once per 60 seconds to avoid high-frequency overhead.
    """
    global _auto_shortlist_last_run
    now_ts = time.time()
    if now_ts - _auto_shortlist_last_run < 60:
        return []
    _auto_shortlist_last_run = now_ts

    now = datetime.now(timezone.utc)
    dispatches = []

    # Find candidate requisitions from MongoDB
    try:
        query = {
            "status": {"$in": ["Published", "Active"]},
            "shortlist_dispatched": {"$ne": True},
        }
        active_reqs = list(db["requisitions"].find(query, {"id": 1, "created_at": 1, "approved_at": 1, "shortlist_deadline": 1, "shortlist_window_hours": 1}))
        for r in active_reqs:
            req_id = r.get("id")
            if not req_id:
                continue
            
            created_val = r.get("approved_at") or r.get("created_at")
            created_dt = _parse_datetime(created_val) or now
            window_hours = r.get("shortlist_window_hours") or 48
            saved_deadline = _parse_datetime(r.get("shortlist_deadline"))
            deadline_dt = saved_deadline or (created_dt + timedelta(hours=window_hours))

            if now >= deadline_dt:
                logger.info(f"[AUTO-SHORTLIST] 48h deadline reached for Requisition {req_id}. Auto-dispatching shortlist...")
                try:
                    res = dispatch_requisition_shortlist(
                        requisition_id=req_id,
                        dispatched_by="48h Automated Sourcing Window",
                        is_auto=True,
                    )
                    dispatches.append(res)
                except Exception as dispatch_err:
                    logger.warning(f"Error during auto-shortlist dispatch for {req_id}: {dispatch_err}")
    except Exception as e:
        logger.warning(f"auto_check_and_dispatch_48h_shortlists scan failed: {e}")

    return dispatches
