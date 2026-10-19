"""
Interview Scheduling REST router for Company Admins, Hiring Managers, and Vendors.
"""
import os
import re
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Response, WebSocket, WebSocketDisconnect, Request, UploadFile, File, Form
from sqlalchemy import func
from starlette.requests import HTTPConnection
from fastapi.encoders import jsonable_encoder
from .access import authorize_round

from modules.identity.domain.models import User, Tenant
from modules.interview.domain.models import CompanyInterviewRequest
from modules.identity.router import get_current_user
from modules.shared.db import get_session, db
from modules.interview.domain.models import (
    InterviewSchedule,
    InterviewRound,
    InterviewStatus,
    ScheduleInterviewRequest,
    VendorConfirmRequest,
    CompleteInterviewRequest,
    CreateInterviewRoundRequest,
    CandidateLoginRequest,
    SubmitEvaluationRequest,
    UpdateRoundStatusRequest,
    LiveKitTokenRequest,
    SendChatMessageRequest,
    AnalyzeCommunicationRequest,
    SaveTranscriptRequest,
)
from modules.interview.services.interview_service import (
    create_interview_proposal,
    confirm_interview_slot,
    request_reschedule,
    complete_interview,
    generate_calendar_links,
    generate_ics_content,
    create_interview_round,
    get_hiring_manager_rounds,
    get_candidate_rounds_by_token,
    get_interviewer_rounds_by_token,
    authenticate_candidate_login,
    get_round_by_id,
    update_round_status,
    submit_round_evaluation,
    generate_livekit_token,
    save_chat_message,
    get_chat_history,
    get_hiring_manager_summary,
    record_round_transcript,
    analyze_round_communication,
    get_round_communication_analysis,
    save_round_recording,
    get_round_recording,
    process_candidate_hiring_decision,
)

async def authorize_interview_request(connection: HTTPConnection):
    round_id = connection.path_params.get('round_id')
    schedule_id = connection.path_params.get('interview_id')
    if not round_id and isinstance(connection, Request) and connection.url.path.endswith('/livekit/token'):
        round_id = (await connection.json()).get('round_id')
        if not round_id:
            raise HTTPException(status_code=400, detail='Interview round required')
    if not round_id and not schedule_id:
        return
    if isinstance(connection, Request) and (connection.url.path.endswith('/send-invitation') or (connection.method == 'GET' and connection.url.path.endswith('/recording'))):
        return
    authorization = connection.headers.get('authorization')
    # Media elements and WebSockets cannot attach an Authorization header.
    if not isinstance(connection, Request) and not authorization and connection.query_params.get('access_token'):
        authorization = 'Bearer ' + connection.query_params['access_token']
    actor = None
    if authorization:
        try:
            with get_session() as session:
                actor = get_current_user(authorization, session)
        except Exception:
            actor = None
    invitation = connection.query_params.get('token', '') or connection.query_params.get('candidate_token', '') or connection.query_params.get('interviewer_token', '')
    if round_id:
        doc = db['interview_rounds'].find_one({'id': round_id})
        role = authorize_round(db, doc, actor, invitation)
        connection.state.interview_role = role
        if isinstance(connection, Request) and connection.url.path.endswith('/livekit/token'):
            try:
                body = await connection.json()
                if body.get('role', 'candidate') != role and actor is None and invitation:
                    raise HTTPException(status_code=403, detail='Participant role does not match invitation')
            except HTTPException:
                raise
            except Exception:
                pass
    else:
        doc = db['interview_schedules'].find_one({'id': schedule_id})
        if not doc:
            raise HTTPException(status_code=404, detail='Interview not found')
        if not actor:
            raise HTTPException(status_code=401, detail='Authentication required')
        if actor.role == 'Super Admin':
            return
        if actor.role in ('Recruiter', 'Vendor') and actor.tenant_id and doc.get('vendor_id') == actor.tenant_id:
            return
        authorize_round(db, doc, actor)


router = APIRouter(prefix="/interviews", tags=["Interviews"], dependencies=[Depends(authorize_interview_request)])


def _extract_origin(request: Request, body_origin: Optional[str] = None) -> str:
    default_domain = (os.getenv("INTERVIEW_PUBLIC_DOMAIN") or "https://termjobs.in").strip().rstrip("/")
    if body_origin and body_origin.strip() and "localhost" not in body_origin and "127.0.0.1" not in body_origin:
        return body_origin.strip().rstrip("/")
    header_origin = request.headers.get("origin") or request.headers.get("referer")
    if header_origin:
        parts = header_origin.split("://")
        if len(parts) == 2:
            domain_part = parts[1].split("/")[0]
            if "localhost" not in domain_part and "127.0.0.1" not in domain_part:
                return f"{parts[0]}://{domain_part}"
    return default_domain


def _get_tenant_name(tenant_id: str) -> str:
    if not tenant_id:
        return "Company"
    try:
        with get_session() as session:
            t = session.query(Tenant).filter(Tenant.id == tenant_id).first()
            if t and t.name:
                return t.name
    except Exception:
        pass
    return "Company"


@router.post("/schedule")
def schedule_interview(
    body: Dict[str, Any],
    request: Request,
    current_user: User = Depends(get_current_user),
):
    """
    Hiring Manager / Company proposes an interview schedule for a shortlisted candidate.
    Supports both multi-round scheduling and legacy single proposal format.
    """
    company_name = _get_tenant_name(current_user.tenant_id)
    if not company_name or company_name == "Company":
        company_name = getattr(current_user, "name", "Company")
    data = dict(body)
    origin = _extract_origin(request, data.get("origin"))
    data["origin"] = origin

    # If modern multi-round format
    if "rounds" in data:
        candidate_id = data.get("candidate_id") or data.get("candidate_submission_id") or "cand"
        candidate_email = data.get("candidate_email") or ""
        candidate_name = data.get("candidate_name") or "Candidate"
        rounds = data.get("rounds", [])

        # Validate candidate and interviewer availability across all rounds
        from .services.interviewer_availability import (
            validate_interviewer_availability,
            validate_candidate_availability,
            parse_round_time_window,
            check_intervals_overlap,
        )
        seen_batch_slots = []
        seen_cand_batch_slots = []
        for idx, r in enumerate(rounds):
            r_date = r.get("scheduledDate") or r.get("scheduled_date") or "2026-10-06"
            r_time = r.get("scheduledTime") or r.get("scheduled_time") or "10:30 AM"
            r_dur = int(r.get("duration") or r.get("duration_minutes") or 45)
            r_title = r.get("title") or r.get("round_name") or f"Round {idx+1}"

            # 1. Candidate DB conflict validation
            try:
                validate_candidate_availability(
                    candidate_submission_id=str(candidate_id),
                    candidate_email=candidate_email,
                    scheduled_date=r_date,
                    scheduled_time=r_time,
                    scheduled_timezone="Asia/Kolkata",
                    duration_minutes=r_dur,
                    candidate_name=candidate_name,
                )
            except ValueError as val_err:
                raise HTTPException(status_code=400, detail=str(val_err))

            # 2. Candidate intra-batch overlap validation
            c_start_utc, c_end_utc = parse_round_time_window(r_date, r_time, "Asia/Kolkata", r_dur)
            if c_start_utc and c_end_utc:
                for prev_start, prev_end, prev_title, prev_date in seen_cand_batch_slots:
                    if prev_date == r_date and check_intervals_overlap(c_start_utc, c_end_utc, prev_start, prev_end):
                        raise HTTPException(
                            status_code=400,
                            detail=f"Candidate scheduling conflict: Multiple rounds ('{prev_title}' and '{r_title}') are scheduled at overlapping times on {r_date}. Each round must have a separate, non-conflicting time slot."
                        )
                seen_cand_batch_slots.append((c_start_utc, c_end_utc, r_title, r_date))

            # 3. Interviewer availability validation
            interviewer = r.get("interviewer") or {}
            int_email = interviewer.get("email") if isinstance(interviewer, dict) else ""
            int_name = interviewer.get("name") if isinstance(interviewer, dict) else str(interviewer or "")
            if int_email or int_name:
                try:
                    validate_interviewer_availability(
                        interviewer_email=int_email,
                        scheduled_date=r_date,
                        scheduled_time=r_time,
                        scheduled_timezone="Asia/Kolkata",
                        duration_minutes=r_dur,
                        interviewer_name=int_name,
                    )
                except ValueError as val_err:
                    raise HTTPException(status_code=400, detail=str(val_err))
                if c_start_utc and c_end_utc:
                    for prev_email, prev_name, prev_start, prev_end, prev_title in seen_batch_slots:
                        if (int_email and prev_email and int_email.lower() == prev_email.lower()) or (int_name and prev_name and int_name.lower() == prev_name.lower()):
                            if check_intervals_overlap(c_start_utc, c_end_utc, prev_start, prev_end):
                                raise HTTPException(
                                    status_code=400,
                                    detail=f"Conflicting assignments: Interviewer '{int_name or int_email}' is assigned to both '{prev_title}' and '{r_title}' at overlapping times."
                                )
                    seen_batch_slots.append((int_email, int_name, c_start_utc, c_end_utc, r_title))

        # Persist to relational DB
        try:
            with get_session() as session:
                for idx, r in enumerate(rounds):
                    r_id = f"rnd_{uuid.uuid4().hex[:10]}"
                    interviewer = r.get("interviewer") or {}
                    round_obj = InterviewRound(
                        id=r_id,
                        tenant_id=current_user.tenant_id,
                        candidate_submission_id=str(candidate_id),
                        candidate_name=candidate_name,
                        requisition_id=data.get("requisition_code") or data.get("requisition_id") or "",
                        round_name=r.get("title") or f"Round {idx + 1}",
                        round_order=idx + 1,
                        status="Scheduled",
                        scheduled_date=r.get("scheduledDate") or "2026-10-06",
                        scheduled_time=r.get("scheduledTime") or "10:30 AM",
                        interviewer_name=interviewer.get("name") if isinstance(interviewer, dict) else str(interviewer or ""),
                        interviewer_email=interviewer.get("email") if isinstance(interviewer, dict) else "",
                        created_at=datetime.now(timezone.utc),
                        updated_at=datetime.now(timezone.utc),
                    )
                    session.add(round_obj)
                session.commit()
        except Exception:
            pass

        # Also persist to mongodb if available
        try:
            db.interviews.insert_one({
                "tenant_id": current_user.tenant_id,
                "candidate_id": candidate_id,
                "candidate_name": candidate_name,
                "candidate_email": data.get("candidate_email"),
                "requisition_title": data.get("requisition_title"),
                "requisition_code": data.get("requisition_code"),
                "rounds": rounds,
                "status": "In Interview",
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
        except Exception:
            pass

        return {
            "status": "success",
            "message": "Interview scheduled successfully",
            "candidate_id": candidate_id,
            "rounds_scheduled": len(rounds),
        }

    # Otherwise legacy create_interview_proposal
    result = create_interview_proposal(data, current_user.tenant_id, company_name, origin=origin)
    return result


@router.get("/company")
def get_company_interviews(
    request: Request,
    requisition_id: Optional[str] = Query(default=None),
    candidate_submission_id: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_user),
):
    """
    Fetch all interview schedules created by the company tenant.
    """
    origin = _extract_origin(request)
    req_id_val = str(requisition_id).strip() if (requisition_id and isinstance(requisition_id, str)) else None
    cand_sub_id_val = str(candidate_submission_id).strip() if (candidate_submission_id and isinstance(candidate_submission_id, str)) else None

    with get_session() as session:
        query = session.query(InterviewSchedule).filter(
            InterviewSchedule.tenant_id == current_user.tenant_id
        )
        if req_id_val:
            query = query.filter(InterviewSchedule.requisition_id == req_id_val)
        if cand_sub_id_val:
            query = query.filter(InterviewSchedule.candidate_submission_id == cand_sub_id_val)
            
        interviews = query.all()
        results = []
        for inv in interviews:
            doc = inv.to_doc()
            # If meeting_link is legacy cal.com or empty, resolve to hosted domain room if round_id is present
            if doc.get("round_id") and (not doc.get("meeting_link") or "cal.com" in doc.get("meeting_link", "").lower()):
                doc["meeting_link"] = f"{origin}/interview/room/{doc['round_id']}"
            doc["calendar_links"] = generate_calendar_links(doc, base_url=origin)
            results.append(doc)

        # Also inspect modern InterviewRound records
        from modules.candidate.domain.models import CandidateSubmission
        from sqlalchemy import or_

        round_query = session.query(InterviewRound)
        if current_user.tenant_id and current_user.role != "Super Admin":
            round_query = round_query.filter(InterviewRound.tenant_id == current_user.tenant_id)
        if req_id_val:
            round_query = round_query.filter(InterviewRound.requisition_id == req_id_val)

        if cand_sub_id_val:
            cand_sub = session.get(CandidateSubmission, cand_sub_id_val)
            c_email = (cand_sub.candidate_email or "").strip().lower() if cand_sub else ""
            c_name = (cand_sub.candidate_name or "").strip().lower() if cand_sub else ""

            # Check for linked fast-track submissions in mongo
            linked_ids = {cand_sub_id_val}
            try:
                from modules.shared.db import db
                for ms in db["candidate_submissions"].find({
                    "$or": [
                        {"id": cand_sub_id_val},
                        {"candidate_id": cand_sub_id_val},
                        {"submission_id": cand_sub_id_val},
                    ]
                }):
                    if ms.get("id"):
                        linked_ids.add(ms["id"])
                    if ms.get("candidate_id"):
                        linked_ids.add(ms["candidate_id"])
                    if ms.get("round_id"):
                        linked_ids.add(ms["round_id"])
                    if ms.get("candidate_email"):
                        c_email = ms["candidate_email"].strip().lower()
            except Exception:
                pass

            combined_filter = InterviewRound.candidate_submission_id.in_(list(linked_ids))
            if c_email:
                combined_filter = combined_filter | (InterviewRound.candidate_email.ilike(c_email))
            if c_name:
                combined_filter = combined_filter | (InterviewRound.candidate_name.ilike(c_name))

            round_matches = round_query.filter(combined_filter).all()
        else:
            round_matches = round_query.all() if req_id_val else []

        for r in round_matches:
            if any(doc.get("round_id") == r.id or doc.get("id") == r.id for doc in results):
                continue
            ev = r.evaluation or {}
            decision_val = ev.get("decision") or ev.get("final_decision") or None
            status_val = "COMPLETED" if r.status == "Completed" else "CONFIRMED_BY_VENDOR"
            results.append({
                "id": r.id,
                "round_id": r.id,
                "interview_round": r.round_name or "AI Technical Interview",
                "candidate_submission_id": candidate_submission_id or r.candidate_submission_id,
                "requisition_id": r.requisition_id,
                "status": status_val,
                "decision": decision_val,
                "final_remark": ev.get("notes") or "",
                "meeting_link": f"{origin}/interview/room/{r.id}",
                "candidate_passcode": r.candidate_passcode,
                "candidate_token": r.candidate_token,
                "interviewer_name": r.interviewer_name or "AI Assessment Engine",
                "evaluation": r.evaluation,
                "communication_metrics": r.communication_metrics,
                "communication_analysis": r.communication_analysis,
                "transcript": r.transcript,
                "recording_url": r.recording_url or f"/api/interviews/rounds/{r.id}/recording",
                "scheduled_date": r.scheduled_date or "",
                "scheduled_time": r.scheduled_time or "",
                "created_at": r.created_at.isoformat() if hasattr(r.created_at, "isoformat") else str(r.created_at or ""),
                "updated_at": r.updated_at.isoformat() if hasattr(r.updated_at, "isoformat") else str(r.updated_at or ""),
            })

        return results


@router.get("/vendor")
def get_vendor_interviews(
    request: Request,
    current_user: User = Depends(get_current_user),
):
    """
    Fetch all interview requests transmitted to the current vendor agency.
    Matches either by vendor_id or vendor_name.
    """
    origin = _extract_origin(request)
    with get_session() as session:
        all_invs = session.query(InterviewSchedule).all()
        results = []
        user_name = (getattr(current_user, "name", "") or "").lower().strip()
        user_tenant_name = _get_tenant_name(current_user.tenant_id).lower().strip()
        user_tenant_id = current_user.tenant_id
        
        for inv in all_invs:
            v_name = (inv.vendor_name or "").lower().strip()
            v_id = inv.vendor_id
            
            # Match vendor tenant
            if user_tenant_id and v_id == user_tenant_id:
                doc = inv.to_doc()
                if doc.get("round_id") and (not doc.get("meeting_link") or "cal.com" in doc.get("meeting_link", "").lower()):
                    doc["meeting_link"] = f"{origin}/interview/room/{doc['round_id']}"
                doc["calendar_links"] = generate_calendar_links(doc, base_url=origin)
                results.append(doc)
                
        return results


# -------------------------------------------------------------
# MULTI-ROUND INTERVIEW WORKFLOW ENDPOINTS
# -------------------------------------------------------------

@router.post("/company-round")
def save_company_round(body: CompanyInterviewRequest, current_user: User = Depends(get_current_user)):
    from .services.company_schedule import save_company_interview
    if current_user.role not in ("Hiring Manager", "Admin", "HR", "Director"):
        raise HTTPException(status_code=403, detail="Only company hiring staff may schedule interviews.")
    try:
        return save_company_interview(current_user, body.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/rounds")
def create_round_endpoint(
    body: CreateInterviewRoundRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
):
    """
    Hiring Manager / HR creates an interview round for a candidate.
    Enforces duplicate prevention and generates candidate/staff access credentials.
    """
    try:
        data = body.model_dump()
        from .services.company_schedule import validate_company_requisition
        from modules.calendar.services.google_calendar import schedule_window, sync_interview_event
        validate_company_requisition(current_user, data['requisition_id'])
        schedule_window(data['scheduled_date'], data['scheduled_time'], data['scheduled_timezone'], data['duration_minutes'])
        # Company scheduling must use the same availability checks as chat booking.
        if not data.get('round_name', '').startswith('AI'):
            from .services.company_schedule import save_company_interview
            return save_company_interview(current_user, {**data, 'candidate_identifier': data['candidate_submission_id']})
        origin = _extract_origin(request, data.get("origin"))
        data["origin"] = origin
        result = create_interview_round(
            data=data,
            tenant_id=current_user.tenant_id,
            created_by=str(current_user.id),
            origin=origin,
        )
        calendar = sync_interview_event(current_user, result)
        result['calendar_sync'] = calendar
        with get_session() as session:
            stored = session.get(InterviewRound, result['id'])
            stored.calendar_sync = calendar
            stored.email_delivery = result.get('email_delivery') or {'status': 'not_confirmed'}
            if calendar.get('event_id'): stored.google_event_id = calendar['event_id']
            session._track(stored); session.commit()
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create interview round: {str(e)}")


@router.get("/rounds")
def list_rounds_endpoint(
    requisition_id: Optional[str] = Query(default=None),
    candidate_id: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_user),
):
    """List interview rounds for the authenticated Hiring Manager / HR tenant, or all for Super Admin."""
    effective_tenant = None if current_user.role == "Super Admin" else current_user.tenant_id
    return get_hiring_manager_rounds(
        tenant_id=effective_tenant,
        requisition_id=requisition_id,
        candidate_id=candidate_id,
        user_id=current_user.id,
        user_role=current_user.role,
    )


@router.get("/summary")
def get_interview_summary_endpoint(
    current_user: User = Depends(get_current_user),
):
    """Get aggregated interview progression per candidate for Hiring Manager, or all for Super Admin."""
    effective_tenant = None if current_user.role == "Super Admin" else current_user.tenant_id
    from modules.shared.cache import cache as _cache
    cache_key = f"interview_summary:{current_user.id}:{current_user.role}:{effective_tenant or 'all'}"
    cached_val = _cache.get(cache_key)
    if cached_val is not None:
        return cached_val
    res = get_hiring_manager_summary(
        tenant_id=effective_tenant,
        user_id=current_user.id,
        user_role=current_user.role,
    )
    _cache.set(cache_key, res, ttl=30)
    return res


@router.post("/candidates/{candidate_id}/decision")
def candidate_decision_endpoint(
    candidate_id: str,
    body: Dict[str, Any],
    current_user: User = Depends(get_current_user),
):
    """
    Formal hiring decision by Hiring Manager / Company Admin (Accepted / Rejected).
    When Accepted:
      - Assigns/confirms formal Candidate ID (CND-XXXX)
      - Onboards candidate to company (onboarding checklist with 8 activation gates + draft work order)
      - Updates status to 'Accepted' in SQLite & MongoDB
      - Notifies Super Admin (both in-app notification & candidate_selections record)
      - Immediately surfaces candidate under Accepted Candidates and Onboarding views
    """
    decision = body.get("decision", "Accepted")
    notes = body.get("notes", "")
    requisition_id = body.get("requisition_id")
    try:
        return process_candidate_hiring_decision(
            candidate_id=candidate_id,
            decision=decision,
            notes=notes,
            actor_user=current_user,
            requisition_id=requisition_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to record candidate decision: {str(e)}")




@router.post("/candidate/login")
def candidate_login_endpoint(body: CandidateLoginRequest):
    """Candidate login via email + passcode or token."""
    try:
        session_info = authenticate_candidate_login(
            email=body.email,
            passcode=body.passcode,
            token=body.token,
        )
        return session_info
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))


@router.get("/candidate/booked-slots")
def get_candidate_booked_slots_endpoint(
    candidate_submission_id: Optional[str] = Query(default=None),
    candidate_email: Optional[str] = Query(default=None),
    candidate_name: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_user),
):
    """
    Returns all active booked slots for a candidate across all requisitions.
    Used by the interview scheduling modal to disable already-booked candidate time slots.
    """
    from .services.interviewer_availability import get_candidate_booked_slots
    slots = get_candidate_booked_slots(
        candidate_submission_id=candidate_submission_id,
        candidate_email=candidate_email,
        candidate_name=candidate_name,
    )
    return {"booked_slots": slots}


@router.get("/candidate/portal")
def candidate_portal_endpoint(
    token: Optional[str] = Query(default=None),
    email: Optional[str] = Query(default=None),
):
    """Candidate portal data: lists only the candidate's own interview rounds."""
    ident = token or email
    if not ident:
        raise HTTPException(status_code=400, detail="Candidate invitation token or email is required")
    rounds = get_candidate_rounds_by_token(ident)
    return {"rounds": rounds}


@router.post("/rounds/{round_id}/send-invitation")
def send_round_invitation_endpoint(round_id: str, body: Optional[Dict[str, Any]] = None):
    """Dispatch or re-send official interview invitation email to candidate and interviewer with date, time, and room link."""
    from modules.interview.services.interview_service import send_interview_invitation_email, send_interviewer_invitation_email, _resolve_interview_domain
    import urllib.parse
    with get_session() as session:
        r = session.query(InterviewRound).filter(InterviewRound.id == round_id).first()
        if not r:
            raise HTTPException(status_code=404, detail="Interview round not found")
        cand_email = (body and body.get("email")) or r.candidate_email
        if not cand_email:
            raise HTTPException(status_code=400, detail="Candidate email is required")
        
        base_url = _resolve_interview_domain()
        hosted_meeting_link = f"{base_url}/interview/room/{r.id}"
        cand_portal_link = f"{base_url}/interview/candidate/login?token={r.candidate_token}&email={urllib.parse.quote(cand_email)}&passcode={r.candidate_passcode}"
        
        delivery = send_interview_invitation_email(
            candidate_name=r.candidate_name or "Candidate",
            candidate_email=cand_email,
            requisition_title=r.requisition_title or "Position",
            company_name=getattr(r, "company_name", None) or "Hiring Team",
            round_name=r.round_name or "Interview Round",
            scheduled_date=r.scheduled_date or "To Be Decided",
            scheduled_time=f"{r.scheduled_time or 'TBD'} ({r.scheduled_timezone or 'Asia/Kolkata'})",
            duration_minutes=int(r.duration_minutes or 45),
            meeting_link=hosted_meeting_link,
            candidate_portal_link=cand_portal_link,
            passcode=str(r.candidate_passcode or ""),
            instructions=r.instructions or "",
        )
        r.email_delivery = delivery

        int_email = (body and body.get("interviewer_email")) or r.interviewer_email
        interviewer_delivery = None
        if int_email:
            int_name = r.interviewer_name or "Interviewer"
            int_room_link = f"{base_url}/interview/room/{r.id}?role=interviewer&token={r.interviewer_token}&name={urllib.parse.quote(int_name)}"
            int_portal_link = f"{base_url}/interview/staff?token={r.interviewer_token}&email={urllib.parse.quote(int_email)}"
            try:
                interviewer_delivery = send_interviewer_invitation_email(
                    interviewer_name=int_name,
                    interviewer_email=int_email,
                    candidate_name=r.candidate_name or "Candidate",
                    candidate_email=cand_email,
                    requisition_title=r.requisition_title or "Position",
                    company_name=getattr(r, "company_name", None) or "Hiring Team",
                    round_name=r.round_name or "Interview Round",
                    round_type=r.round_type or "Technical",
                    scheduled_date=r.scheduled_date or "To Be Decided",
                    scheduled_time=f"{r.scheduled_time or 'TBD'} ({r.scheduled_timezone or 'Asia/Kolkata'})",
                    duration_minutes=int(r.duration_minutes or 45),
                    meeting_link=int_room_link,
                    staff_portal_link=int_portal_link,
                    instructions=r.instructions or "",
                )
                r.interviewer_email_delivery = interviewer_delivery
            except Exception as e:
                interviewer_delivery = {"status": "failed", "reason": str(e)}

        session._track(r)
        session.commit()
        return {
            "status": "success",
            "message": f"Interview invitation email sent to {cand_email}" + (f" and interviewer {int_email}" if int_email else ""),
            "delivery": delivery,
            "interviewer_delivery": interviewer_delivery,
        }


@router.get("/staff/portal")
def staff_portal_endpoint(
    token: Optional[str] = Query(default=None),
    email: Optional[str] = Query(default=None),
):
    """Staff portal data: lists only candidates & rounds assigned to this interviewer."""
    ident = token
    if not ident:
        raise HTTPException(status_code=400, detail="Interviewer invitation token is required")
    rounds = get_interviewer_rounds_by_token(ident)
    return {"rounds": rounds}


@router.get("/rounds/{round_id}")
def get_round_detail_endpoint(round_id: str, token: Optional[str] = Query(None)):
    """Get specific interview round details with expiration check."""
    round_doc = get_round_by_id(round_id)
    if not round_doc:
        raise HTTPException(status_code=404, detail="Interview round not found")

    status = round_doc.get("status")
    is_active = status in ("In Progress", "Live", "Scheduled", "Upcoming")
    is_valid_token = bool(token and (token == round_doc.get("candidate_token") or token == round_doc.get("interviewer_token")))

    if status != "Completed" and round_doc.get("is_expired") and not (is_active or is_valid_token):
        raise HTTPException(
            status_code=410,
            detail="This AI interview link has expired. Please request a new interview link from the hiring team."
        )
    for secret in ('candidate_token', 'interviewer_token', 'candidate_passcode'):
        round_doc.pop(secret, None)
    return round_doc


@router.get('/rounds/{round_id}/join-identity')
async def resolve_interview_join_identity(round_id: str, request: Request, token: str = Query('')):
    from inspect import isawaitable
    with get_session() as session:
        interview = session.query(InterviewRound).filter(InterviewRound.id == round_id).first()
        if not interview: raise HTTPException(status_code=404, detail='Interview not found')
        authorization = request.headers.get('authorization')
        if authorization:
            actor = get_current_user(authorization, session)
            if isawaitable(actor): actor = await actor
            if actor.role in ('Hiring Manager', 'Admin', 'HR', 'Director') and actor.tenant_id == interview.tenant_id and (str(interview.created_by) == str(actor.id) or str(interview.interviewer_email or '').lower() == str(actor.email or '').lower()):
                return {'role': 'interviewer', 'name': actor.name}
        if token and token == interview.interviewer_token:
            return {'role': 'interviewer', 'name': interview.interviewer_name or 'Interviewer'}
        if token and token == interview.candidate_token:
            return {'role': 'candidate', 'name': interview.candidate_name or 'Candidate'}
        raise HTTPException(status_code=403, detail='Sign in with the assigned hiring-manager account or use your personal interview invitation.')


@router.post("/rounds/{round_id}/status")
def update_round_status_endpoint(
    round_id: str,
    body: UpdateRoundStatusRequest,
):
    """Update round status (e.g. In Progress, Completed, Cancelled)."""
    updated = update_round_status(round_id, body.status)
    if not updated:
        raise HTTPException(status_code=404, detail="Interview round not found")
    return updated


@router.post("/rounds/{round_id}/evaluation")
def submit_evaluation_endpoint(
    round_id: str,
    body: SubmitEvaluationRequest,
):
    """Interviewer submits evaluation feedback and status for the completed interview round."""
    updated = submit_round_evaluation(
        round_id=round_id,
        eval_data=body.model_dump(),
        evaluator_identity=body.evaluator_name or body.evaluator_email or "Interviewer",
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Interview round not found")
    return updated


@router.post("/rounds/{round_id}/transcript")
def save_transcript_endpoint(
    round_id: str,
    body: SaveTranscriptRequest,
):
    """Appends or stores speech-to-text transcript turns for an interview round."""
    updated = record_round_transcript(
        round_id=round_id,
        transcript_turns=body.transcript_turns,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Interview round not found")
    return {"status": "success", "round_id": round_id, "turn_count": len(updated.get("transcript", []))}


@router.post("/rounds/{round_id}/analyze-communication")
async def analyze_communication_endpoint(
    round_id: str,
    body: AnalyzeCommunicationRequest,
):
    """
    Evaluates candidate spoken communication skills using zero-token linguistic heuristics
    and single-pass token-minimized LLM analysis on the recorded speech transcript.
    """
    # The router dependency already verifies company ownership or the invitation.
    # Round details intentionally omit credentials, so the body need not repeat one.
    try:
        analysis_result = await analyze_round_communication(
            round_id=round_id,
            transcript_turns=body.transcript_turns,
            duration_seconds=body.call_duration_seconds or 0,
            candidate_name=body.candidate_name,
            role_title=body.role_title,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if not analysis_result:
        raise HTTPException(status_code=404, detail="Interview round not found")
    return analysis_result


@router.get("/rounds/{round_id}/questions")
def get_assessment_questions(round_id: str):
    from modules.interview.services.assessment import load_questions, RUBRIC_VERSION
    with get_session() as session:
        interview = session.query(InterviewRound).filter(InterviewRound.id == round_id).first()
        if not interview:
            raise HTTPException(status_code=404, detail="Interview not found")
        try:
            return {"questions": load_questions(session, interview), "rubric_version": RUBRIC_VERSION}
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/rounds/{round_id}/communication-analysis")
def get_communication_analysis_endpoint(round_id: str):
    """Retrieve communication metrics, analysis results, and transcript for an interview round."""
    report = get_round_communication_analysis(round_id)
    if not report:
        raise HTTPException(status_code=404, detail="Interview round not found")
    return report


@router.post('/rounds/{round_id}/recording/chunks/{upload_id}/parts/{chunk_index}')
def upload_recording_chunk(round_id: str, upload_id: str, chunk_index: int, token: str = Query(...), file: UploadFile = File(...)):
    from datetime import datetime, timedelta, timezone
    from modules.shared.db import db
    with get_session() as session:
        interview = session.query(InterviewRound).filter(InterviewRound.id == round_id).first()
        if not interview or not token or token not in (interview.candidate_token, interview.interviewer_token):
            raise HTTPException(status_code=404, detail='Interview not found')
    try: uuid.UUID(upload_id)
    except ValueError: raise HTTPException(status_code=400, detail='Invalid recording upload ID')
    if not 0 <= chunk_index < 256:
        raise HTTPException(status_code=400, detail='Recording exceeds the supported upload size')
    contents = file.file.read(1024 * 1024 + 1)
    if not contents or len(contents) > 1024 * 1024:
        raise HTTPException(status_code=413, detail='Recording chunks must be at most 1 MB')
    chunks = db['interview_recording_chunks']
    if chunk_index == 0:
        chunks.create_index('expires_at', expireAfterSeconds=0)
    chunks.replace_one({'_id': f'{round_id}:{upload_id}:{chunk_index}'}, {'_id': f'{round_id}:{upload_id}:{chunk_index}',
        'round_id': round_id, 'upload_id': upload_id, 'index': chunk_index, 'data': contents,
        'expires_at': datetime.now(timezone.utc) + timedelta(days=1)}, upsert=True)
    return {'status': 'uploaded', 'index': chunk_index}


@router.post('/rounds/{round_id}/recording/chunks/{upload_id}/complete')
def complete_recording_upload(round_id: str, upload_id: str, token: str = Query(...), chunk_count: int = Form(...), duration_seconds: int = Form(0), content_type: str = Form('video/webm')):
    from modules.shared.db import db
    with get_session() as session:
        interview = session.query(InterviewRound).filter(InterviewRound.id == round_id).first()
        if not interview or not token or token not in (interview.candidate_token, interview.interviewer_token):
            raise HTTPException(status_code=404, detail='Interview not found')
    if not 1 <= chunk_count <= 256 or content_type.split(';')[0] not in ('video/webm', 'video/mp4'):
        raise HTTPException(status_code=400, detail='Invalid recording upload metadata')
    chunks = db['interview_recording_chunks']
    rows = list(chunks.find({'round_id': round_id, 'upload_id': upload_id}).sort('index', 1))
    if [row['index'] for row in rows] != list(range(chunk_count)):
        raise HTTPException(status_code=409, detail='Recording chunks are missing. Retry submission.')
    contents = b''.join(row['data'] for row in rows)
    extension = 'mp4' if content_type.startswith('video/mp4') else 'webm'
    updated = save_round_recording(round_id, contents, f'recording.{extension}', content_type, duration_seconds)
    if not updated: raise HTTPException(status_code=404, detail='Interview not found')
    chunks.delete_many({'round_id': round_id, 'upload_id': upload_id})
    return {'status': 'success', 'recording_url': updated['recording_url'], 'recording_metadata': updated['recording_metadata']}


@router.post("/rounds/{round_id}/recording")
async def upload_round_recording_endpoint(
    round_id: str,
    file: UploadFile = File(...),
    duration_seconds: int = Form(0),
):
    """
    Upload candidate video & audio recording for an interview round.
    Stores reliably to MongoDB GridFS and local storage, updating InterviewRound metadata.
    """
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Empty video recording file provided")
    if not str(file.content_type or "").startswith("video/"):
        raise HTTPException(status_code=415, detail="A camera video recording is required; audio-only uploads are not accepted.")

    updated = save_round_recording(
        round_id=round_id,
        file_bytes=contents,
        filename=file.filename or f"interview_{round_id}.webm",
        content_type=file.content_type or "video/webm",
        duration_seconds=duration_seconds,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Interview round not found")

    return {
        "status": "success",
        "round_id": round_id,
        "recording_url": updated.get("recording_url"),
        "recording_metadata": updated.get("recording_metadata"),
    }


@router.get('/rounds/{round_id}/recording-access')
def recording_access_endpoint(round_id: str):
    from datetime import timedelta
    from modules.identity.services.auth_service import create_access_token
    credential = create_access_token({'purpose': 'interview_recording', 'round_id': round_id}, expires_delta=timedelta(minutes=10))
    return {'media_token': credential}


@router.get("/rounds/{round_id}/recording")
async def get_round_recording_endpoint(
    round_id: str,
    request: Request,
    download: bool = Query(False),
):
    """
    Streams or downloads candidate video recording with HTTP 206 Partial Content (Range requests)
    for seamless, instant video scrubbing and playback in modern web browsers.
    """
    rec = get_round_recording(round_id)
    if not rec or not rec.get("bytes"):
        raise HTTPException(status_code=404, detail="Recording not found for this interview round")

    data_bytes = rec["bytes"]
    total_size = len(data_bytes)
    content_type = rec.get("content_type", "video/webm") or "video/webm"
    filename = rec.get("filename", f"interview_{round_id}.webm")
    disposition = f'attachment; filename="{filename}"' if download else f'inline; filename="{filename}"'

    range_header = request.headers.get("range")
    if not range_header or download:
        return Response(
            content=data_bytes,
            status_code=200,
            media_type=content_type,
            headers={
                "Content-Length": str(total_size),
                "Accept-Ranges": "bytes",
                "Content-Disposition": disposition,
            },
        )

    # Handle HTTP 206 Byte-Range for fluid video scrubbing
    try:
        range_str = range_header.replace("bytes=", "").strip()
        parts = range_str.split("-")
        start = int(parts[0]) if parts[0] else 0
        end = int(parts[1]) if len(parts) > 1 and parts[1] else total_size - 1
        end = min(end, total_size - 1)
        if start > end or start >= total_size:
            return Response(
                status_code=416,
                headers={"Content-Range": f"bytes */{total_size}"}
            )
        chunk_length = end - start + 1
        chunk = data_bytes[start : end + 1]
        return Response(
            content=chunk,
            status_code=206,
            media_type=content_type,
            headers={
                "Content-Range": f"bytes {start}-{end}/{total_size}",
                "Accept-Ranges": "bytes",
                "Content-Length": str(chunk_length),
                "Content-Disposition": disposition,
            },
        )
    except Exception:
        return Response(
            content=data_bytes,
            status_code=200,
            media_type=content_type,
            headers={
                "Content-Length": str(total_size),
                "Accept-Ranges": "bytes",
                "Content-Disposition": disposition,
            },
        )


@router.post("/livekit/token")
def livekit_token_endpoint(body: LiveKitTokenRequest):
    """Generate LiveKit video/audio access token for in-house meeting room."""
    round_doc = get_round_by_id(body.round_id)
    if not round_doc:
        raise HTTPException(status_code=404, detail="Interview room not found. Create a scheduled interview first.")
    status = round_doc.get("status")
    is_active = status in ("In Progress", "Live", "Scheduled", "Upcoming")
    if status != "Completed" and round_doc.get("is_expired") and not is_active:
        raise HTTPException(
            status_code=410,
            detail="Cannot enter interview room: This AI interview link expired."
        )
    room_name = round_doc.get("room_id")
    ident = body.participant_identity or f"{body.role}_{uuid.uuid4().hex[:6]}"
    
    try:
        token_payload = generate_livekit_token(
            room_name=room_name, identity=ident, name=body.participant_name, role=body.role,
        )
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return token_payload


# In-memory WebSocket manager for real-time signaling & chat
_room_websockets: Dict[str, set] = {}


@router.get("/rounds/{round_id}/chat")
def get_chat_history_endpoint(round_id: str):
    """Retrieve chat history for this interview round."""
    return {"messages": get_chat_history(round_id)}


@router.post("/rounds/{round_id}/chat")
async def send_chat_message_endpoint(round_id: str, body: SendChatMessageRequest):
    """Post chat message to meeting room."""
    round_doc = get_round_by_id(round_id)
    room_id = round_doc.get("room_id") if round_doc else f"room_{round_id}"
    msg = save_chat_message(
        round_id=round_id,
        room_id=room_id,
        sender_name=body.sender_name,
        sender_role=body.sender_role,
        message=body.message,
        sender_identity=body.sender_identity or "",
        message_id=body.message_id or "",
    )
    # Broadcast to all connected WebSockets in this room using jsonable_encoder
    payload = jsonable_encoder({"type": "chat", "message": msg})
    disconnected = []
    for ws in list(_room_websockets.get(round_id, set())):
        try:
            await ws.send_json(payload)
        except Exception as e:
            print(f"Error sending chat ws broadcast: {e}")
            disconnected.append(ws)
    for ws in disconnected:
        _room_websockets.get(round_id, set()).discard(ws)
    return msg


@router.websocket("/rounds/{round_id}/ws")
async def room_websocket_endpoint(websocket: WebSocket, round_id: str):
    """WebSocket connection for real-time in-room messaging and signaling."""
    await websocket.accept()
    if round_id not in _room_websockets:
        _room_websockets[round_id] = set()
    _room_websockets[round_id].add(websocket)
    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type", "chat")
            if msg_type == "chat":
                round_doc = get_round_by_id(round_id)
                room_id = round_doc.get("room_id") if round_doc else f"room_{round_id}"
                saved = save_chat_message(
                    round_id=round_id,
                    room_id=room_id,
                    sender_name=data.get("sender_name", "Participant"),
                    sender_role=data.get("sender_role", "candidate"),
                    message=data.get("message", ""),
                    sender_identity=data.get("sender_identity", ""),
                    message_id=data.get("id") or data.get("message_id") or "",
                )
                payload = jsonable_encoder({"type": "chat", "message": saved})
            else:
                payload = jsonable_encoder(data)

            # Broadcast to all participants in this room
            disconnected = []
            for ws in list(_room_websockets.get(round_id, set())):
                try:
                    await ws.send_json(payload)
                except Exception as e:
                    print(f"Error broadcasting ws message: {e}")
                    disconnected.append(ws)
            for ws in disconnected:
                _room_websockets[round_id].discard(ws)
    except WebSocketDisconnect:
        _room_websockets.get(round_id, set()).discard(websocket)
    except Exception:
        _room_websockets.get(round_id, set()).discard(websocket)


@router.post("/{interview_id}/vendor-confirm")
def vendor_confirm_interview(
    interview_id: str,
    body: VendorConfirmRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Vendor confirms candidate availability for a proposed slot or requests reschedule.
    """
    if body.action == "reschedule":
        alt_slots = [s.model_dump() for s in (body.alternative_slots or [])]
        updated = request_reschedule(interview_id, body.vendor_notes or "", alt_slots)
    else:
        conf_slot = body.confirmed_slot.model_dump() if body.confirmed_slot else None
        updated = confirm_interview_slot(interview_id, body.slot_id, conf_slot, body.vendor_notes or "")
        
    if not updated:
        raise HTTPException(status_code=404, detail="Interview schedule not found")
    return updated


@router.post("/{interview_id}/complete")
def complete_interview_endpoint(
    interview_id: str,
    body: CompleteInterviewRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Hiring Manager marks the meeting as over and records the final remark
    plus accept/reject decision for the candidate.
    """
    updated = complete_interview(interview_id, body.final_remark or "", body.decision or "Accepted")
    if not updated:
        raise HTTPException(status_code=404, detail="Interview schedule not found")
    return updated


@router.get("/{interview_id}/invite.ics")
def download_ics_invitation(
    interview_id: str,
):
    """
    Streams universal standard RFC 5545 iCalendar (.ics) file with alarms and meeting details.
    100% Free & compatible with Apple, Google, Outlook, and mobile calendar apps.
    """
    with get_session() as session:
        interview = session.query(InterviewSchedule).filter(InterviewSchedule.id == interview_id).first()
        if not interview:
            raise HTTPException(status_code=404, detail="Interview schedule not found")
            
        doc = interview.to_doc()
        ics_text = generate_ics_content(doc)
        cand_name = (doc.get("candidate_name") or "candidate").replace(" ", "_")
        
        return Response(
            content=ics_text,
            media_type="text/calendar; charset=utf-8",
            headers={
                "Content-Disposition": f'attachment; filename="interview_{cand_name}.ics"'
            }
        )


@router.get("/{interview_id}/links")
def get_calendar_direct_links(
    interview_id: str,
    current_user: User = Depends(get_current_user),
):
    """
    Returns 1-click web intent calendar links (Google, Outlook, Zoho, and .ics).
    """
    with get_session() as session:
        interview = session.query(InterviewSchedule).filter(InterviewSchedule.id == interview_id).first()
        if not interview:
            raise HTTPException(status_code=404, detail="Interview schedule not found")
        doc = interview.to_doc()
        return generate_calendar_links(doc)


@router.get("/process/template")
def get_interview_process_template(
    requisition_id: str | None = None,
    current_user: User = Depends(get_current_user),
):
    """
    Get the default or configured interview process for the hiring manager / company.
    Effects all requisitions for this hiring manager.
    """
    tenant_id = getattr(current_user, "tenant_id", None) or getattr(current_user, "id", "")
    if requisition_id:
        from .services.company_schedule import validate_company_requisition
        try:
            validate_company_requisition(current_user, requisition_id)
        except ValueError as exc:
            raise HTTPException(status_code=403, detail=str(exc)) from exc
    doc = db["hiring_manager_interview_processes"].find_one(
        {"tenant_id": tenant_id, "requisition_id": requisition_id},
        sort=[("updated_at", -1)],
    )
    if not doc:
        return {"is_saved": False, "template": "custom", "rounds": None}

    return {
        "is_saved": True,
        "template": doc.get("template", "custom"),
        "rounds": doc.get("rounds", []),
        "updated_at": str(doc.get("updated_at", "")),
    }


@router.post("/process/template")
def save_interview_process_template(
    body: Dict[str, Any],
    current_user: User = Depends(get_current_user),
):
    """
    Save or update interview process for this hiring manager / tenant.
    This applies across all requisitions for this hiring manager.
    """
    tenant_id = getattr(current_user, "tenant_id", None) or getattr(current_user, "id", "")
    requisition_id = body.get('requisition_id')
    if requisition_id:
        from .services.company_schedule import validate_company_requisition
        try:
            validate_company_requisition(current_user, requisition_id)
        except ValueError as exc:
            raise HTTPException(status_code=403, detail=str(exc)) from exc
    template = body.get("template", "custom")
    rounds = body.get("rounds", [])

    now = datetime.now(timezone.utc)
    db["hiring_manager_interview_processes"].update_one(
        {"tenant_id": tenant_id, "requisition_id": requisition_id},
        {
            "$set": {
                "tenant_id": tenant_id,
                "requisition_id": requisition_id,
                "user_id": current_user.id,
                "template": template,
                "rounds": rounds,
                "updated_at": now.isoformat(),
            }
        },
        upsert=True,
    )

    return {
        "success": True,
        "is_saved": True,
        "message": "Interview process saved successfully across all requisitions",
        "template": template,
        "rounds": rounds,
    }


@router.get("/interviewers")
def get_interviewers_list(
    date: Optional[str] = Query(default=None),
    time: Optional[str] = Query(default=None),
    timezone: Optional[str] = Query(default="Asia/Kolkata"),
    duration_minutes: Optional[int] = Query(default=45),
    exclude_round_id: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_user),
):
    """
    Get all available interviewers for this hiring manager / tenant,
    with their booked slots and computed availability status for the chosen time slot.
    """
    from .services.interviewer_availability import get_all_interviewers_with_availability
    interviewers = get_all_interviewers_with_availability(
        current_user=current_user,
        scheduled_date=date,
        scheduled_time=time,
        scheduled_timezone=timezone,
        duration_minutes=duration_minutes,
        exclude_round_id=exclude_round_id,
    )
    return {"interviewers": interviewers}


@router.get("/interviewers/availability")
def check_interviewers_availability_endpoint(
    email: Optional[str] = Query(default=None),
    name: Optional[str] = Query(default=None),
    date: str = Query(...),
    time: str = Query(...),
    timezone: Optional[str] = Query(default="Asia/Kolkata"),
    duration_minutes: Optional[int] = Query(default=45),
    exclude_round_id: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_user),
):
    """
    Explicit endpoint to check availability and conflicts for interviewers.
    """
    from .services.interviewer_availability import find_interviewer_conflicts, get_all_interviewers_with_availability
    if email or name:
        conflicts = find_interviewer_conflicts(
            interviewer_email=email,
            interviewer_name=name,
            scheduled_date=date,
            scheduled_time=time,
            scheduled_timezone=timezone,
            duration_minutes=duration_minutes,
            exclude_round_id=exclude_round_id,
        )
        return {
            "available": len(conflicts) == 0,
            "conflicts": conflicts,
            "conflict": conflicts[0] if conflicts else None,
        }
    else:
        interviewers = get_all_interviewers_with_availability(
            current_user=current_user,
            scheduled_date=date,
            scheduled_time=time,
            scheduled_timezone=timezone,
            duration_minutes=duration_minutes,
            exclude_round_id=exclude_round_id,
        )
        return {
            "available": any(i.get("is_available") for i in interviewers),
            "interviewers": interviewers,
        }


@router.get("/candidate/booked-slots")
def get_candidate_booked_slots_endpoint(
    candidate_submission_id: Optional[str] = Query(default=None),
    candidate_email: Optional[str] = Query(default=None),
    candidate_name: Optional[str] = Query(default=None),
    exclude_round_id: Optional[str] = Query(default=None),
):
    """
    Get active scheduled interview slots for a candidate across all requisitions.
    Used by the scheduling modal to disable conflicting time slots.
    """
    from .services.interviewer_availability import get_candidate_booked_slots
    slots = get_candidate_booked_slots(
        candidate_submission_id=candidate_submission_id,
        candidate_email=candidate_email,
        candidate_name=candidate_name,
        exclude_round_id=exclude_round_id,
    )
    return {"booked_slots": slots}


@router.post("/interviewers")
def add_new_interviewer(
    body: Dict[str, Any],
    current_user: User = Depends(get_current_user),
):
    """
    Add a new interviewer to the database with validation and duplicate prevention.
    """
    name = (body.get("name") or "").strip()
    role = (body.get("role") or "").strip()
    email = (body.get("email") or "").strip()

    # 1. Full name validation
    if not name or len(name) < 2:
        raise HTTPException(status_code=400, detail="Please enter a valid full name (minimum 2 characters).")
    if len(name) > 80:
        raise HTTPException(status_code=400, detail="Full name must be 80 characters or less.")
    if not re.search(r"[a-zA-Z]", name):
        raise HTTPException(status_code=400, detail="Full name must contain alphabetical characters.")
    if not re.match(r"^[a-zA-Z\s.'-]+$", name):
        raise HTTPException(status_code=400, detail="Full name contains invalid characters.")
    
    dummy_words = {
        "test", "testing", "fake", "dummy", "asdf", "admin", "user",
        "interviewer", "none", "null", "na", "qwerty", "abc", "xyz", "xxx"
    }
    name_lower = name.lower()
    if name_lower in dummy_words or all(w in dummy_words for w in name_lower.split()):
        raise HTTPException(status_code=400, detail="Please enter a valid real name instead of a placeholder.")

    # 2. Role / designation validation
    if not role or len(role) < 2:
        raise HTTPException(status_code=400, detail="Please enter a valid role or designation (minimum 2 characters).")
    if len(role) > 80:
        raise HTTPException(status_code=400, detail="Role / designation must be 80 characters or less.")
    if not re.search(r"[a-zA-Z]", role):
        raise HTTPException(status_code=400, detail="Role / designation must contain letters.")
    if role.lower() in dummy_words:
        raise HTTPException(status_code=400, detail="Please enter a valid role or designation instead of a placeholder.")

    # 3. Email validation
    if not email:
        raise HTTPException(status_code=400, detail="Email is required.")

    try:
        from modules.identity.domain.schemas import _validate_real_email
        email_clean = _validate_real_email(email)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))

    parts = email_clean.split("@", 1)
    if len(parts) != 2:
        raise HTTPException(status_code=400, detail="Invalid email address format.")
    local_part, domain_part = parts[0], parts[1]

    blocked_domains = {
        "test.com", "testing.com", "fake.com", "example.com", "example.org", "example.net",
        "sample.com", "invalid.com", "nowhere.com", "dummy.com", "noemail.com", "temp.com",
        "asdf.com", "abc.com", "xyz.com", "fakeemail.com", "nomail.com", "null.com",
    }
    # In test environments, allow example.com if needed for mock runs
    is_test_env = bool(os.environ.get("PYTEST_CURRENT_TEST"))
    if not is_test_env and (domain_part in blocked_domains or any(domain_part.endswith(f".{bd}") for bd in blocked_domains)):
        raise HTTPException(status_code=400, detail=f"Email addresses from '{domain_part}' are not allowed. Please use a valid business or personal email.")
    elif is_test_env and (domain_part in (blocked_domains - {"example.com", "example.org", "example.net"})):
        raise HTTPException(status_code=400, detail=f"Email addresses from '{domain_part}' are not allowed. Please use a valid business or personal email.")

    if local_part in dummy_words or len(local_part) < 2:
        raise HTTPException(status_code=400, detail="Please enter a valid, non-placeholder email address.")

    email = email_clean
    tenant_id = getattr(current_user, "tenant_id", None) or getattr(current_user, "id", "")

    # 4. Duplicate check against existing custom interviewers and company staff
    existing_custom = db["hiring_manager_interviewers"].find_one({
        "tenant_id": tenant_id,
        "email": {"$regex": f"^{re.escape(email)}$", "$options": "i"},
    })
    if existing_custom:
        raise HTTPException(
            status_code=400,
            detail="An interviewer with this email address is already registered.",
        )

    with get_session() as session:
        staff_members = session.query(User).filter(User.tenant_id == tenant_id).all()
        for member in staff_members:
            if member.email and member.email.strip().lower() == email.lower():
                raise HTTPException(
                    status_code=400,
                    detail="An interviewer with this email address is already registered.",
                )

    interviewer_id = f"int-{uuid.uuid4().hex[:8]}"
    avatar = body.get("avatar") or f"https://api.dicebear.com/7.x/avataaars/svg?seed={name.replace(' ', '')}"
    now = datetime.now(timezone.utc)
    new_doc = {
        "id": interviewer_id,
        "name": name,
        "role": role,
        "email": email,
        "avatar": avatar,
        "tenant_id": tenant_id,
        "user_id": current_user.id,
        "created_at": now.isoformat(),
    }

    # Insert new record - never overwrite existing
    insert_data = dict(new_doc)
    db["hiring_manager_interviewers"].insert_one(insert_data)

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
                combined.append({'id': str(actor.id), 'name': actor.name, 'role': actor.role, 'email': actor.email})

    return {
        "success": True,
        "interviewer": new_doc,
        "interviewers": combined,
    }


# Static interview endpoints must precede this generic ID lookup.
@router.get("/{interview_id}")
def get_interview_detail(
    interview_id: str,
    current_user: User = Depends(get_current_user),
):
    """
    Fetch single interview schedule details along with 1-click calendar links.
    """
    with get_session() as session:
        interview = session.query(InterviewSchedule).filter(InterviewSchedule.id == interview_id).first()
        if not interview:
            raise HTTPException(status_code=404, detail="Interview schedule not found")
        doc = interview.to_doc()
        doc["calendar_links"] = generate_calendar_links(doc)
        return doc
