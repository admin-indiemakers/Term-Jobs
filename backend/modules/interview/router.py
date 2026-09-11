"""
Interview Scheduling REST router for Company Admins, Hiring Managers, and Vendors.
"""
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Response, WebSocket, WebSocketDisconnect
from fastapi.encoders import jsonable_encoder
import uuid

from modules.identity.domain.models import User, Tenant
from modules.identity.router import get_current_user
from modules.shared.db import get_session
from modules.interview.domain.models import (
    InterviewSchedule,
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
)

router = APIRouter(prefix="/interviews", tags=["Interviews"])


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
    body: ScheduleInterviewRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Hiring Manager / Company proposes an interview schedule for a shortlisted candidate.
    Dispatches the proposed slots to the Vendor.
    """
    company_name = _get_tenant_name(current_user.tenant_id)
    if not company_name or company_name == "Company":
        company_name = getattr(current_user, "name", "Company")
    data = body.model_dump()
    result = create_interview_proposal(data, current_user.tenant_id, company_name)
    return result


@router.get("/company")
def get_company_interviews(
    requisition_id: Optional[str] = Query(default=None),
    candidate_submission_id: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_user),
):
    """
    Fetch all interview schedules created by the company tenant.
    """
    with get_session() as session:
        query = session.query(InterviewSchedule).filter(
            InterviewSchedule.tenant_id == current_user.tenant_id
        )
        if requisition_id:
            query = query.filter(InterviewSchedule.requisition_id == requisition_id)
        if candidate_submission_id:
            query = query.filter(InterviewSchedule.candidate_submission_id == candidate_submission_id)
            
        interviews = query.all()
        results = []
        for inv in interviews:
            doc = inv.to_doc()
            doc["calendar_links"] = generate_calendar_links(doc)
            results.append(doc)
        return results


@router.get("/vendor")
def get_vendor_interviews(
    current_user: User = Depends(get_current_user),
):
    """
    Fetch all interview requests transmitted to the current vendor agency.
    Matches either by vendor_id or vendor_name.
    """
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
            if (v_id and v_id == user_tenant_id) or (user_tenant_name and (user_tenant_name in v_name or v_name in user_tenant_name)) or (user_name and (user_name in v_name or v_name in user_name)) or not v_name or v_name == "vendor":
                doc = inv.to_doc()
                doc["calendar_links"] = generate_calendar_links(doc)
                results.append(doc)
                
        return results


# -------------------------------------------------------------
# MULTI-ROUND INTERVIEW WORKFLOW ENDPOINTS
# -------------------------------------------------------------

@router.post("/rounds")
def create_round_endpoint(
    body: CreateInterviewRoundRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Hiring Manager / HR creates an interview round for a candidate.
    Enforces duplicate prevention and generates candidate/staff access credentials.
    """
    try:
        data = body.model_dump()
        result = create_interview_round(
            data=data,
            tenant_id=current_user.tenant_id,
            created_by=str(current_user.id),
        )
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
    """List interview rounds for the authenticated Hiring Manager / HR tenant."""
    return get_hiring_manager_rounds(
        tenant_id=current_user.tenant_id,
        requisition_id=requisition_id,
        candidate_id=candidate_id,
    )


@router.get("/summary")
def get_interview_summary_endpoint(
    current_user: User = Depends(get_current_user),
):
    """Get aggregated interview progression per candidate for Hiring Manager."""
    return get_hiring_manager_summary(tenant_id=current_user.tenant_id)


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


@router.get("/candidate/portal")
def candidate_portal_endpoint(
    token: Optional[str] = Query(default=None),
    email: Optional[str] = Query(default=None),
):
    """Candidate portal data: lists only the candidate's own interview rounds."""
    ident = token or email
    if not ident:
        raise HTTPException(status_code=400, detail="Candidate token or email is required")
    rounds = get_candidate_rounds_by_token(ident)
    return {"rounds": rounds}


@router.get("/staff/portal")
def staff_portal_endpoint(
    token: Optional[str] = Query(default=None),
    email: Optional[str] = Query(default=None),
):
    """Staff portal data: lists only candidates & rounds assigned to this interviewer."""
    ident = token or email
    if not ident:
        raise HTTPException(status_code=400, detail="Interviewer token or email is required")
    rounds = get_interviewer_rounds_by_token(ident)
    return {"rounds": rounds}


@router.get("/rounds/{round_id}")
def get_round_detail_endpoint(round_id: str):
    """Get specific interview round details."""
    round_doc = get_round_by_id(round_id)
    if not round_doc:
        raise HTTPException(status_code=404, detail="Interview round not found")
    return round_doc


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


@router.post("/livekit/token")
def livekit_token_endpoint(body: LiveKitTokenRequest):
    """Generate LiveKit video/audio access token for in-house meeting room."""
    round_doc = get_round_by_id(body.round_id)
    room_name = round_doc.get("room_id") if round_doc else f"room_{body.round_id}"
    ident = body.participant_identity or f"{body.role}_{uuid.uuid4().hex[:6]}"
    
    token_payload = generate_livekit_token(
        room_name=room_name,
        identity=ident,
        name=body.participant_name,
        role=body.role,
    )
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
