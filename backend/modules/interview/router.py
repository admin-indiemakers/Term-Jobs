"""
Interview Scheduling REST router for Company Admins, Hiring Managers, and Vendors.
"""
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Response

from modules.identity.domain.models import User, Tenant
from modules.identity.router import get_current_user
from modules.shared.db import get_session
from modules.interview.domain.models import (
    InterviewSchedule,
    InterviewStatus,
    ScheduleInterviewRequest,
    VendorConfirmRequest,
)
from modules.interview.services.interview_service import (
    create_interview_proposal,
    confirm_interview_slot,
    request_reschedule,
    generate_calendar_links,
    generate_ics_content,
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
