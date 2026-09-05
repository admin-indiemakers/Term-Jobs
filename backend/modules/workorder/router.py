import os
import shutil
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from modules.identity.domain.models import User
from modules.identity.router import get_current_user
from modules.requisition.domain.models import Requisition
from modules.candidate.domain.models import CandidateSubmission
from modules.shared.db import get_session
from modules.workorder.domain.models import (
    WorkOrder, WorkOrderCreate, WorkOrderUpdate, WorkOrderApproveIn, WorkOrderRevisionIn
)
from modules.workorder.agent.workorder_agent import generate_autofill_workorder

router = APIRouter(prefix="/api/work-orders", tags=["WorkOrders"])

if os.getenv("VERCEL") or os.getenv("AWS_LAMBDA_FUNCTION_NAME"):
    ESIGN_UPLOAD_DIR = "/tmp/uploads/work_orders"
else:
    ESIGN_UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "uploads", "work_orders")

try:
    os.makedirs(ESIGN_UPLOAD_DIR, exist_ok=True)
except Exception as _mkdir_err:
    ESIGN_UPLOAD_DIR = "/tmp/uploads/work_orders"
    os.makedirs(ESIGN_UPLOAD_DIR, exist_ok=True)



def _work_order_dict(wo: WorkOrder) -> dict:
    return {
        "id": wo.id,
        "tenant_id": wo.tenant_id,
        "requisition_id": wo.requisition_id,
        "requisition_ref": wo.requisition_ref,
        "candidate_id": wo.candidate_id,
        "candidate_name": wo.candidate_name,
        "candidate_email": wo.candidate_email,
        "candidate_phone": wo.candidate_phone,
        "vendor_id": wo.vendor_id,
        "vendor_name": wo.vendor_name,
        "company_name": wo.company_name,
        "hiring_manager_name": wo.hiring_manager_name,
        "job_title": wo.job_title,
        "work_location": wo.work_location,
        "start_date": wo.start_date,
        "end_date": wo.end_date,
        "contract_duration_months": wo.contract_duration_months,
        "billing_rate": wo.billing_rate,
        "rate_type": wo.rate_type,
        "currency": wo.currency,
        "vendor_visible_floor": wo.vendor_visible_floor,
        "vendor_visible_cap": wo.vendor_visible_cap,
        "billing_cycle": wo.billing_cycle,
        "payment_terms": wo.payment_terms,
        "scope_of_work": wo.scope_of_work,
        "special_terms": wo.special_terms,
        "esign_document_url": wo.esign_document_url,
        "esign_filename": wo.esign_filename,
        "approval_type": wo.approval_type,
        "status": wo.status,
        "revision_notes": wo.revision_notes,
        "ai_generated": wo.ai_generated,
        "ai_reasoning": wo.ai_reasoning,
        "created_at": wo.created_at.isoformat() if wo.created_at else None,
        "updated_at": wo.updated_at.isoformat() if wo.updated_at else None,
        "submitted_at": wo.submitted_at.isoformat() if wo.submitted_at else None,
        "approved_at": wo.approved_at.isoformat() if wo.approved_at else None,
        "approved_by": wo.approved_by,
    }


@router.post("/autofill-generate")
def autofill_workorder(
    payload: dict,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Run AI Work Order Agent to auto-generate prefilled Work Order using Candidate & Requisition details."""
    candidate_id = payload.get("candidate_id")
    requisition_id = payload.get("requisition_id")
    
    if not candidate_id or not requisition_id:
        raise HTTPException(status_code=400, detail="Both candidate_id and requisition_id are required.")

    with get_session() as session:
        # Load requisition
        req = session.get(Requisition, requisition_id)
        req_dict = {}
        if req:
            req_dict = {
                "id": req.id,
                "title": req.title,
                "generated_jd_markdown": req.generated_jd_markdown,
                "location": getattr(req, "location", "Remote"),
                "company_name": getattr(req, "company_name", None),
                "duration_months": getattr(req, "duration_months", 6),
                "intake_meta": req.intake_meta or {},
            }
            # Extract vendor visible floor & cap
            prefill = (req.intake_meta or {}).get("prefill", {})
            req_dict["vendor_visible_floor"] = prefill.get("vendor_visible_floor") or prefill.get("budget_min")
            req_dict["vendor_visible_cap"] = prefill.get("vendor_visible_cap") or prefill.get("budget_max")

        # Load candidate
        cand_sub = session.get(CandidateSubmission, candidate_id)
        cand_dict = {}
        if cand_sub:
            cand_dict = {
                "id": cand_sub.id,
                "candidate_id": cand_sub.id,
                "candidate_name": cand_sub.candidate_name,
                "candidate_email": cand_sub.candidate_email,
                "candidate_phone": (cand_sub.details or {}).get("candidate_phone") or getattr(cand_sub, "candidate_phone", ""),
                "vendor_name": cand_sub.vendor_name,
                "match_score": cand_sub.match_score,
                "requisition_id": cand_sub.requisition_id,
                "requisition_ref": f"REQ-{str(cand_sub.requisition_id)[:6].upper()}" if cand_sub.requisition_id else None,
            }
        else:
            cand_dict = {
                "id": candidate_id,
                "candidate_name": payload.get("candidate_name") or "Candidate",
                "vendor_name": current_user.tenant_name or "Vendor",
            }

        autofilled = generate_autofill_workorder(cand_dict, req_dict)
        return autofilled


@router.post("")
def create_work_order(
    body: WorkOrderCreate,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Create a new Work Order (Draft or Submitted)."""
    with get_session() as session:
        # Check existing
        existing = session.query(WorkOrder).filter(
            WorkOrder.candidate_id == body.candidate_id,
            WorkOrder.requisition_id == body.requisition_id,
            WorkOrder.status != "Cancelled"
        ).first()

        if existing:
            # Update existing
            for k, v in body.model_dump().items():
                if hasattr(existing, k) and v is not None:
                    setattr(existing, k, v)
            existing.updated_at = datetime.now(timezone.utc)
            session.commit()
            session.refresh(existing)
            return _work_order_dict(existing)

        wo = WorkOrder(
            tenant_id=current_user.tenant_id,
            requisition_id=body.requisition_id,
            candidate_id=body.candidate_id,
            candidate_name=body.candidate_name,
            candidate_email=body.candidate_email,
            candidate_phone=body.candidate_phone,
            vendor_name=body.vendor_name,
            job_title=body.job_title,
            work_location=body.work_location,
            start_date=body.start_date,
            end_date=body.end_date,
            contract_duration_months=body.contract_duration_months,
            billing_rate=body.billing_rate,
            rate_type=body.rate_type,
            currency=body.currency,
            vendor_visible_floor=body.vendor_visible_floor,
            vendor_visible_cap=body.vendor_visible_cap,
            billing_cycle=body.billing_cycle,
            payment_terms=body.payment_terms,
            scope_of_work=body.scope_of_work,
            special_terms=body.special_terms,
            ai_generated=body.ai_generated,
            ai_reasoning=body.ai_reasoning,
            status="Draft",
        )
        session.add(wo)
        session.commit()
        session.refresh(wo)
        return _work_order_dict(wo)


@router.get("")
def list_work_orders(
    candidate_id: str | None = None,
    requisition_id: str | None = None,
    vendor_name: str | None = None,
    status: str | None = None,
    current_user: User = Depends(get_current_user)
) -> list[dict]:
    """Fetch Work Orders based on search filters."""
    with get_session() as session:
        query = session.query(WorkOrder)
        if candidate_id:
            query = query.filter(WorkOrder.candidate_id == candidate_id)
        if requisition_id:
            query = query.filter(WorkOrder.requisition_id == requisition_id)
        if vendor_name:
            query = query.filter(WorkOrder.vendor_name.ilike(f"%{vendor_name}%"))
        if status:
            query = query.filter(WorkOrder.status == status)

        # Tenant filtering for non-superadmin
        if current_user.role != "Super Admin" and current_user.tenant_id:
            query = query.filter(
                (WorkOrder.tenant_id == current_user.tenant_id) | 
                (WorkOrder.tenant_id == None) |
                (WorkOrder.vendor_name.ilike(f"%{current_user.tenant_name or ''}%"))
            )

        rows = query.order_by(WorkOrder.updated_at.desc()).all()
        return [_work_order_dict(r) for r in rows]


@router.get("/{work_order_id}")
def get_work_order(
    work_order_id: str,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Fetch single Work Order detail."""
    with get_session() as session:
        wo = session.get(WorkOrder, work_order_id)
        if not wo:
            raise HTTPException(status_code=404, detail="Work Order not found.")
        return _work_order_dict(wo)


@router.put("/{work_order_id}")
def update_work_order(
    work_order_id: str,
    body: WorkOrderUpdate,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Update a Work Order draft or revision."""
    with get_session() as session:
        wo = session.get(WorkOrder, work_order_id)
        if not wo:
            raise HTTPException(status_code=404, detail="Work Order not found.")
        
        for k, v in body.model_dump(exclude_unset=True).items():
            if hasattr(wo, k) and v is not None:
                setattr(wo, k, v)

        wo.updated_at = datetime.now(timezone.utc)
        session.commit()
        session.refresh(wo)
        return _work_order_dict(wo)


@router.post("/{work_order_id}/submit")
def submit_work_order(
    work_order_id: str,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Vendor submits or resubmits Master Services Agreement (MSA) for Company Director approval."""
    with get_session() as session:
        wo = session.get(WorkOrder, work_order_id)
        if not wo:
            raise HTTPException(status_code=404, detail="Master Services Agreement (MSA) not found.")

        wo.status = "Submitted"
        wo.submitted_at = datetime.now(timezone.utc)
        wo.updated_at = datetime.now(timezone.utc)
        session.commit()
        session.refresh(wo)
        return _work_order_dict(wo)


@router.post("/{work_order_id}/approve")
def approve_work_order(
    work_order_id: str,
    body: WorkOrderApproveIn,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Company Director approves Master Services Agreement (MSA)."""
    with get_session() as session:
        wo = session.get(WorkOrder, work_order_id)
        if not wo:
            raise HTTPException(status_code=404, detail="Master Services Agreement (MSA) not found.")

        wo.status = "Approved"
        wo.approved_by = body.approved_by or f"{current_user.name} ({current_user.role})"
        wo.approved_at = datetime.now(timezone.utc)
        wo.approval_type = body.approval_type or "click_to_approve"
        wo.updated_at = datetime.now(timezone.utc)

        # Update candidate submission status if candidate exists
        if wo.candidate_id:
            cand = session.get(CandidateSubmission, wo.candidate_id)
            if cand:
                cand.status = "Accepted"

        session.commit()
        session.refresh(wo)
        return _work_order_dict(wo)


@router.post("/{work_order_id}/request-revision")
def request_revision(
    work_order_id: str,
    body: WorkOrderRevisionIn,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Company Director requests changes / rejects MSA with mandatory revision feedback notes."""
    with get_session() as session:
        wo = session.get(WorkOrder, work_order_id)
        if not wo:
            raise HTTPException(status_code=404, detail="Master Services Agreement (MSA) not found.")

        wo.status = "Revision Requested"
        wo.revision_notes = body.revision_notes or "Director requested commercial rate or scope revision."
        wo.updated_at = datetime.now(timezone.utc)
        session.commit()
        session.refresh(wo)
        return _work_order_dict(wo)


@router.post("/{work_order_id}/upload-esign")
def upload_esign_document(
    work_order_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
) -> dict:
    """Upload signed E-signature PDF agreement for the Work Order."""
    with get_session() as session:
        wo = session.get(WorkOrder, work_order_id)
        if not wo:
            raise HTTPException(status_code=404, detail="Work Order not found.")

        ext = os.path.splitext(file.filename)[1] or ".pdf"
        saved_filename = f"WO_ESIGN_{work_order_id}_{uuid.uuid4().hex[:6]}{ext}"
        saved_path = os.path.join(ESIGN_UPLOAD_DIR, saved_filename)

        with open(saved_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        wo.esign_document_url = f"/uploads/work_orders/{saved_filename}"
        wo.esign_filename = file.filename
        wo.approval_type = "esign_upload"
        wo.updated_at = datetime.now(timezone.utc)

        session.commit()
        session.refresh(wo)
        return _work_order_dict(wo)
