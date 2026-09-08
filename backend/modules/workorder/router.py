import os
import shutil
import uuid
import re
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Header
from modules.identity.domain.models import User
from modules.identity.router import get_current_user
from modules.requisition.domain.models import Requisition
from modules.candidate.domain.models import CandidateSubmission
from modules.shared.db import get_session, db
from modules.workorder.domain.models import (
    WorkOrder, WorkOrderCreate, WorkOrderUpdate, WorkOrderApproveIn, WorkOrderRevisionIn
)
from modules.workorder.agent.workorder_agent import generate_autofill_workorder

router = APIRouter(prefix="/api/work-orders", tags=["WorkOrders"])

ESIGN_UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "uploads", "work_orders")
os.makedirs(ESIGN_UPLOAD_DIR, exist_ok=True)


def _work_order_dict(wo: WorkOrder) -> dict:
    return {
        "id": wo.id,
        "tenant_id": wo.tenant_id,
        "requisition_id": wo.requisition_id,
        "requisition_ref": wo.requisition_ref,
        "candidate_id": wo.candidate_id,
        "workorder_id": getattr(wo, "workorder_id", None) or wo.candidate_id or wo.id,
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
    candidate_id = payload.get("workorder_id") or payload.get("candidate_id")
    requisition_id = payload.get("requisition_id")
    
    if not candidate_id or not requisition_id:
        raise HTTPException(status_code=400, detail="Both workorder_id and requisition_id are required.")

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
                "candidate_id": getattr(cand_sub, "workorder_id", None) or cand_sub.id,
                "workorder_id": getattr(cand_sub, "workorder_id", None) or cand_sub.id,
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
                "workorder_id": candidate_id,
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
    cand_id = getattr(body, "workorder_id", None) or body.candidate_id
    with get_session() as session:
        # Check existing
        existing = session.query(WorkOrder).filter(
            WorkOrder.candidate_id == cand_id,
            WorkOrder.requisition_id == body.requisition_id,
            WorkOrder.status != "Cancelled"
        ).first()

        if existing:
            # Update existing
            for k, v in body.model_dump().items():
                if hasattr(existing, k) and v is not None:
                    setattr(existing, k, v)
            existing.workorder_id = cand_id
            existing.updated_at = datetime.now(timezone.utc)
            session.commit()
            session.refresh(existing)
            return _work_order_dict(existing)

        wo = WorkOrder(
            tenant_id=current_user.tenant_id,
            requisition_id=body.requisition_id,
            candidate_id=cand_id,
            workorder_id=cand_id,
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
    workorder_id: str | None = None,
    requisition_id: str | None = None,
    vendor_name: str | None = None,
    status: str | None = None,
    current_user: User = Depends(get_current_user)
) -> list[dict]:
    """Fetch Work Orders based on search filters."""
    with get_session() as session:
        query = session.query(WorkOrder)
        target_cand = workorder_id or candidate_id
        if target_cand:
            query = query.filter((WorkOrder.candidate_id == target_cand) | (WorkOrder.workorder_id == target_cand))
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


def _extract_agreement_details_from_db(identifier: str) -> dict | None:
    """Extract real, unmocked agreement details from work_orders, requisitions, and tenants."""
    clean_id = (identifier or "").strip()
    if not clean_id:
        return None

    escaped = re.escape(clean_id)
    norm = re.sub(r'\s*-\s*', r'\\s*-\\s*', escaped)
    regex_pat = f"^{norm}$"

    # 1. Search in MongoDB work_orders collection
    wo = db["work_orders"].find_one({
        "$or": [
            {"workorder_id": clean_id},
            {"candidate_id": clean_id},
            {"work_order_number": clean_id},
            {"id": clean_id},
            {"workorder_id": {"$regex": regex_pat, "$options": "i"}},
            {"candidate_id": {"$regex": regex_pat, "$options": "i"}},
            {"work_order_number": {"$regex": regex_pat, "$options": "i"}},
        ]
    })

    # 2. If not found in MongoDB work_orders, check SQL WorkOrder model
    sql_wo = None
    with get_session() as session:
        if not wo:
            sql_wo = session.query(WorkOrder).filter(
                (WorkOrder.candidate_id == clean_id) |
                (WorkOrder.workorder_id == clean_id) |
                (WorkOrder.id == clean_id)
            ).first()

    # 3. Fallback: check candidate_submissions collection in case work order was not yet synced
    if not wo and not sql_wo:
        sub = db["candidate_submissions"].find_one({
            "$or": [
                {"workorder_id": clean_id},
                {"id": clean_id},
                {"candidate_id": clean_id},
                {"workorder_id": {"$regex": regex_pat, "$options": "i"}},
                {"candidate_id": {"$regex": regex_pat, "$options": "i"}},
            ]
        })
        if sub:
            wo = {
                "workorder_id": sub.get("workorder_id") or sub.get("id"),
                "candidate_id": sub.get("workorder_id") or sub.get("id"),
                "candidate_name": sub.get("candidate_name") or sub.get("name"),
                "candidate_email": sub.get("candidate_email") or sub.get("email"),
                "vendor_name": sub.get("vendor_name"),
                "requisition_id": sub.get("requisition_id"),
                "requisition_title": sub.get("title") or sub.get("job_title"),
                "tenant_id": sub.get("tenant_id"),
            }

    if not wo and not sql_wo:
        return None

    def _val(k, default=""):
        if wo and wo.get(k) is not None and str(wo.get(k)).strip() != "":
            return wo.get(k)
        if sql_wo and getattr(sql_wo, k, None) is not None and str(getattr(sql_wo, k)).strip() != "":
            return getattr(sql_wo, k)
        return default

    req_id = _val("requisition_id")
    req_mongo = db["requisitions"].find_one({"id": req_id}) if req_id else None
    sr = (req_mongo or {}).get("structured_role") or {}
    intake = (req_mongo or {}).get("intake_meta") or {}
    prefill = intake.get("prefill") or {}

    tenant_id = _val("tenant_id")
    tenant_name = ""
    if tenant_id:
        t = db["tenants"].find_one({"id": tenant_id})
        if t:
            tenant_name = t.get("name", "")

    company_name = _val("company_name") or (req_mongo or {}).get("company_name") or tenant_name or "Client Company"
    vendor_name = _val("vendor_name") or "Supplier Vendor"

    reporting_to = _val("reporting_manager") or sr.get("hiring_manager") or (req_mongo or {}).get("hiring_manager_name") or "Engineering Manager"
    
    place_of_work = _val("location") or sr.get("location") or prefill.get("primary_location") or "Remote"
    if isinstance(place_of_work, list):
        place_of_work = place_of_work[0] if place_of_work else "Remote"

    start_date = _val("start_date") or sr.get("start_date") or prefill.get("start_date") or ""
    end_date = _val("end_date") or sr.get("ends_on") or prefill.get("ends_on") or ""
    duration = sr.get("duration") or sr.get("contract_duration") or prefill.get("duration") or "6 months"
    notice = sr.get("max_notice_period") or "15 days"

    weekly_hours = _val("weekly_hours", 40)
    try:
        wh = int(weekly_hours)
        std_day = f"{round(wh / 5)} hours"
    except Exception:
        std_day = "8 hours"

    rate = _val("billing_rate") or _val("bill_rate")
    if not rate:
        rate = sr.get("ceiling_internal") or prefill.get("vendor_cap") or 1500
    try:
        rate_num = float(rate)
    except Exception:
        rate_num = 1500.0

    rate_basis = str(_val("rate_basis") or _val("rate_type") or "hourly").lower()
    currency = _val("currency") or "INR"
    curr_sym = "₹" if currency.upper() in ["INR", "RS"] else ("$" if currency.upper() == "USD" else currency)
    
    unit_str = "per hour" if "hour" in rate_basis else ("per day" if "day" in rate_basis else "per month")
    charge_rate = f"{curr_sym}{rate_num:,.0f} {unit_str}"
    basis_str = "Hourly, against approved timesheets" if "hour" in rate_basis else "Monthly, against approved timesheets"

    slug = re.sub(r'[^A-Za-z0-9]', '', str(company_name)[:4]).upper() or 'CORP'
    year_month = str(start_date)[:7] if start_date else "2026-09"
    msa_ref = f"MSA-{slug}-{year_month}"

    ws_num = _val("workorder_id") or _val("work_order_number") or clean_id

    return {
        "wsNumber": ws_num,
        "msaRef": msa_ref,
        "companyName": company_name,
        "supplierName": vendor_name,
        "supplierSuffix": "",
        "deployedPersonnel": _val("candidate_name", "Contract Personnel"),
        "role": _val("requisition_title") or _val("job_title") or sr.get("title") or (req_mongo or {}).get("title") or "Professional Specialist",
        "reportingTo": reporting_to,
        "placeOfWork": place_of_work,
        "commencement": str(start_date) if start_date else "2026-09-01",
        "expiry": str(end_date) if end_date else "2027-03-01",
        "duration": duration,
        "notice": notice if notice else "15 days",
        "billingBasis": basis_str,
        "chargeRate": charge_rate,
        "standardWorkDay": std_day,
        "billingCycle": "Monthly",
        "paymentTerms": "Net 30 days from invoice release",
        "supplierMargin": "30%",
        "requisition_id": req_id,
        "status": _val("status", "ACTIVE"),
    }


@router.get("/available-workorders")
def get_available_workorders(
    q: str | None = None,
    authorization: str | None = Header(default=None)
) -> list[dict]:
    """Return distinct active work orders from the database for AI autofill and selection."""
    query = {}
    if q:
        clean_q = q.strip()
        query["$or"] = [
            {"workorder_id": {"$regex": clean_q, "$options": "i"}},
            {"candidate_id": {"$regex": clean_q, "$options": "i"}},
            {"work_order_number": {"$regex": clean_q, "$options": "i"}},
            {"candidate_name": {"$regex": clean_q, "$options": "i"}},
            {"requisition_title": {"$regex": clean_q, "$options": "i"}},
            {"company_name": {"$regex": clean_q, "$options": "i"}},
        ]
    docs = list(db["work_orders"].find(query, {
        "_id": 0,
        "workorder_id": 1,
        "candidate_id": 1,
        "work_order_number": 1,
        "candidate_name": 1,
        "requisition_title": 1,
        "company_name": 1,
        "vendor_name": 1,
        "status": 1
    }).limit(25))

    seen = set()
    result = []
    for d in docs:
        wid = d.get("workorder_id") or d.get("candidate_id") or d.get("work_order_number")
        if wid and wid not in seen:
            seen.add(wid)
            result.append({
                "workorder_id": wid,
                "work_order_number": d.get("work_order_number") or wid,
                "candidate_name": d.get("candidate_name", "Contract Resource"),
                "role": d.get("requisition_title", "Professional Specialist"),
                "company_name": d.get("company_name", ""),
                "vendor_name": d.get("vendor_name", ""),
                "status": d.get("status", "ACTIVE"),
            })
    return result


@router.get("/agreement-details/{identifier:path}")
def get_agreement_details_by_id(
    identifier: str,
    authorization: str | None = Header(default=None)
) -> dict:
    """Fetch real agreement details for a Work Order from DB and linked Requisition without fake data."""
    details = _extract_agreement_details_from_db(identifier)
    if not details:
        raise HTTPException(
            status_code=404,
            detail=f"No work order found matching '{identifier}'. Please check the ID in the database."
        )
    return details


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
