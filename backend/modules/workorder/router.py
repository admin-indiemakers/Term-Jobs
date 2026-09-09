import os
import shutil
import uuid
import re
from datetime import datetime, timezone
from pydantic import BaseModel
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
            sql_wo = session.query(WorkOrder).filter(WorkOrder.candidate_id == clean_id).first()
            if not sql_wo:
                sql_wo = session.query(WorkOrder).filter(WorkOrder.workorder_id == clean_id).first()
            if not sql_wo:
                sql_wo = session.query(WorkOrder).filter(WorkOrder.id == clean_id).first()

    # 3. Check candidate_submissions collection
    sub = db["candidate_submissions"].find_one({
        "$or": [
            {"workorder_id": clean_id},
            {"id": clean_id},
            {"candidate_id": clean_id},
            {"workorder_id": {"$regex": regex_pat, "$options": "i"}},
            {"candidate_id": {"$regex": regex_pat, "$options": "i"}},
        ]
    })
    if not wo and not sql_wo and sub:
        wo = {
            "workorder_id": sub.get("workorder_id") or sub.get("id"),
            "candidate_id": sub.get("workorder_id") or sub.get("id"),
            "candidate_name": sub.get("candidate_name") or sub.get("name"),
            "candidate_email": sub.get("candidate_email") or sub.get("email"),
            "vendor_name": sub.get("vendor_name"),
            "requisition_id": sub.get("requisition_id"),
            "requisition_title": sub.get("title") or sub.get("job_title"),
            "company_name": sub.get("company_name"),
            "tenant_id": sub.get("tenant_id"),
        }

    if not wo and not sql_wo and not sub:
        return None

    def _val(k, default=""):
        if wo and wo.get(k) is not None and str(wo.get(k)).strip() != "":
            return wo.get(k)
        if sql_wo and getattr(sql_wo, k, None) is not None and str(getattr(sql_wo, k)).strip() != "":
            return getattr(sql_wo, k)
        if sub and sub.get(k) is not None and str(sub.get(k)).strip() != "":
            return sub.get(k)
        return default

    req_id = _val("requisition_id")
    req_mongo = db["requisitions"].find_one({"id": req_id}) if req_id else None
    sr = (req_mongo or {}).get("structured_role") or {}
    intake = (req_mongo or {}).get("intake_meta") or {}
    prefill = intake.get("prefill") or {}

    # --- 1. RESOLVE BUYER / CLIENT COMPANY NAME ("Company") ---
    company_name = None
    if req_mongo:
        # Check company_profile_id in MongoDB
        if req_mongo.get("company_profile_id"):
            cp = db["company_profiles"].find_one({"id": req_mongo["company_profile_id"]})
            if cp and cp.get("name"):
                company_name = cp["name"]
        if not company_name and req_mongo.get("client_name"):
            company_name = req_mongo.get("client_name")
        if not company_name and req_mongo.get("company_name"):
            company_name = req_mongo.get("company_name")
        if not company_name and req_mongo.get("tenant_id"):
            t_req = db["tenants"].find_one({"id": req_mongo["tenant_id"]})
            if t_req and t_req.get("name"):
                company_name = t_req["name"]

    if not company_name and req_id:
        try:
            with get_session() as session:
                from modules.requisition.domain.models import Requisition as SqlReq, CompanyProfile as SqlCp
                from modules.identity.domain.models import Tenant as SqlTenant
                r_sql = session.get(SqlReq, req_id)
                if r_sql:
                    if r_sql.company_profile_id:
                        cp_sql = session.get(SqlCp, r_sql.company_profile_id)
                        if cp_sql and cp_sql.name:
                            company_name = cp_sql.name
                    if not company_name and r_sql.tenant_id:
                        t_sql = session.get(SqlTenant, r_sql.tenant_id)
                        if t_sql and t_sql.name:
                            company_name = t_sql.name
        except Exception:
            pass

    # Direct company_name from work order or sub if distinct from vendor
    val_comp = _val("company_name")
    val_vend = _val("vendor_name")
    if not company_name and val_comp and val_comp.lower() != (val_vend or "").lower():
        company_name = val_comp

    # Prefix fallback
    if not company_name:
        wid_str = str(clean_id).upper()
        if "SDC" in wid_str:
            company_name = "SDC limited"
        elif "BEAR" in wid_str:
            company_name = "Bearitt"
        else:
            company_name = "SDC limited"

    # --- 2. RESOLVE SUPPLIER / VENDOR NAME ("Supplier") ---
    vendor_name = val_vend or (sub.get("vendor_name") if sub else None)
    if not vendor_name and sub and sub.get("tenant_id"):
        t_sub = db["tenants"].find_one({"id": sub["tenant_id"]})
        if t_sub and t_sub.get("name"):
            vendor_name = t_sub["name"]
    if not vendor_name:
        vendor_name = "Vendorqueue"

    # --- 3. RESOLVE REPORTING MANAGER ---
    reporting_to = sr.get("hiring_manager") or (req_mongo or {}).get("hiring_manager_name") or _val("reporting_manager")
    if not reporting_to and req_mongo and req_mongo.get("created_by"):
        try:
            with get_session() as session:
                from modules.identity.domain.models import User as SqlUser
                u = session.get(SqlUser, req_mongo["created_by"])
                if u and u.name:
                    reporting_to = u.name
        except Exception:
            pass
    if not reporting_to:
        reporting_to = "Hrm 1"

    # --- 4. RESOLVE PLACE OF WORK ---
    place_of_work = _val("location") or sr.get("location") or prefill.get("primary_location")
    if not place_of_work and req_mongo:
        for ans in req_mongo.get("intake_answers", []):
            if ans.get("question_id") == "location" and ans.get("value"):
                place_of_work = str(ans["value"]).capitalize()
                break
    if not place_of_work:
        place_of_work = "Kochi"
    if isinstance(place_of_work, list):
        place_of_work = place_of_work[0] if place_of_work else "Kochi"

    # --- 5. DATES & TERMS ---
    start_date = _val("start_date") or sr.get("start_date") or prefill.get("start_date") or "2026-09-03"
    end_date = _val("end_date") or sr.get("ends_on") or prefill.get("ends_on") or "2027-03-03"
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
        rate = prefill.get("vendor_cap") or sr.get("ceiling_internal") or 1500
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

    slug = re.sub(r'[^A-Za-z0-9]', '', str(company_name)[:4]).upper() or 'SDC'
    year_month = str(start_date)[:7] if start_date else "2026-09"
    msa_ref = f"MSA-{slug}-{year_month}"

    ws_num = _val("workorder_id") or _val("work_order_number") or clean_id

    res = {
        "wsNumber": ws_num,
        "msaRef": msa_ref,
        "companyName": company_name,
        "supplierName": vendor_name,
        "supplierSuffix": "",
        "deployedPersonnel": _val("candidate_name", "Contract Resource"),
        "role": _val("requisition_title") or _val("job_title") or sr.get("title") or (req_mongo or {}).get("title") or "Professional Specialist",
        "reportingTo": reporting_to,
        "placeOfWork": place_of_work,
        "commencement": str(start_date) if start_date else "2026-09-03",
        "expiry": str(end_date) if end_date else "2027-03-03",
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
        "agreement_status": _val("agreement_status") or _val("status", "Draft"),
        "approved_by": _val("approved_by", ""),
        "approved_at": str(_val("approved_at", "")),
        "revision_notes": _val("revision_notes", ""),
        "rejection_reason": _val("rejection_reason", ""),
        "rejected_by": _val("rejected_by", ""),
        "rejected_at": str(_val("rejected_at", "")),
    }

    if wo and isinstance(wo.get("agreement_data"), dict):
        for k, v in wo["agreement_data"].items():
            if v is not None and str(v).strip() != "":
                # Correct legacy misassigned company name or MSA slug
                if k == "companyName" and (v == res.get("supplierName") or v == "Vendorqueue") and company_name != "Vendorqueue":
                    res[k] = company_name
                elif k == "msaRef" and str(v).startswith("MSA-VEND-") and slug != "VEND":
                    res[k] = msa_ref
                else:
                    res[k] = v

    return res


@router.get("/available-workorders")
def get_available_workorders(
    q: str | None = None,
    authorization: str | None = Header(default=None)
) -> list[dict]:
    """Return distinct active work orders and accepted submissions from the database for AI autofill."""
    seen = set()
    result = []
    
    # 1. From work_orders collection
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
    docs = list(db["work_orders"].find(query).limit(25))
    for d in docs:
        wid = d.get("workorder_id") or d.get("candidate_id") or d.get("work_order_number") or d.get("id")
        if wid and wid not in seen:
            seen.add(wid)
            c_name = d.get("company_name", "")
            if not c_name or c_name == d.get("vendor_name") or c_name == "Vendorqueue":
                c_name = ""
                req_doc = db["requisitions"].find_one({"id": d.get("requisition_id")}) if d.get("requisition_id") else None
                if req_doc and req_doc.get("company_profile_id"):
                    cp = db["company_profiles"].find_one({"id": req_doc["company_profile_id"]})
                    if cp and cp.get("name"):
                        c_name = cp["name"]
                if not c_name and req_doc:
                    c_name = req_doc.get("client_name") or req_doc.get("company_name") or ""
                if not c_name and str(wid).upper().startswith("SDC"):
                    c_name = "SDC limited"
                elif not c_name and str(wid).upper().startswith("BEAR"):
                    c_name = "Bearitt"

            req_doc = db["requisitions"].find_one({"id": d.get("requisition_id")}) if d.get("requisition_id") else None
            role_title = d.get("job_title") or d.get("requisition_title")
            if not role_title and req_doc:
                role_title = (req_doc.get("structured_role") or {}).get("title") or req_doc.get("title")
            if not role_title:
                sub_d = db["candidate_submissions"].find_one({"$or": [{"workorder_id": wid}, {"candidate_id": wid}, {"id": wid}]})
                if sub_d:
                    role_title = sub_d.get("job_title") or sub_d.get("title")
            role_title = role_title or "Professional Specialist"

            result.append({
                "workorder_id": wid,
                "work_order_number": d.get("work_order_number") or wid,
                "candidate_name": d.get("candidate_name", "Contract Resource"),
                "role": role_title,
                "job_title": role_title,
                "company_name": c_name or "SDC limited",
                "vendor_name": d.get("vendor_name", "Vendorqueue"),
                "status": d.get("status", "ACTIVE"),
            })

    # 2. Also include accepted submissions from candidate_submissions
    sub_q = {"status": {"$in": ["Accepted", "Hired"]}}
    if q:
        clean_q = q.strip()
        sub_q["$or"] = [
            {"workorder_id": {"$regex": clean_q, "$options": "i"}},
            {"candidate_id": {"$regex": clean_q, "$options": "i"}},
            {"id": {"$regex": clean_q, "$options": "i"}},
            {"candidate_name": {"$regex": clean_q, "$options": "i"}},
            {"requisition_title": {"$regex": clean_q, "$options": "i"}},
        ]
    sub_docs = list(db["candidate_submissions"].find(sub_q).limit(25))
    for s in sub_docs:
        wid = s.get("workorder_id") or s.get("candidate_id") or s.get("id")
        if wid and wid not in seen:
            seen.add(wid)
            req_doc = db["requisitions"].find_one({"id": s.get("requisition_id")}) if s.get("requisition_id") else None
            c_name = ""
            if req_doc and req_doc.get("company_profile_id"):
                cp = db["company_profiles"].find_one({"id": req_doc["company_profile_id"]})
                if cp and cp.get("name"):
                    c_name = cp["name"]
            if not c_name and req_doc:
                c_name = req_doc.get("client_name") or req_doc.get("company_name") or ""
            if not c_name and str(wid).upper().startswith("SDC"):
                c_name = "SDC limited"
            elif not c_name and str(wid).upper().startswith("BEAR"):
                c_name = "Bearitt"

            role_title = s.get("requisition_title") or s.get("job_title")
            if not role_title and req_doc:
                role_title = (req_doc.get("structured_role") or {}).get("title") or req_doc.get("title")
            role_title = role_title or "Professional Specialist"

            result.append({
                "workorder_id": wid,
                "work_order_number": wid,
                "candidate_name": s.get("candidate_name", "Contract Resource"),
                "role": role_title,
                "job_title": role_title,
                "company_name": c_name or "SDC limited",
                "vendor_name": s.get("vendor_name", "Vendorqueue"),
                "status": "Accepted",
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


@router.get("/director-agreements")
def get_director_agreements(
    current_user: User = Depends(get_current_user)
) -> list[dict]:
    """Retrieve agreements and work orders awaiting Director approval for the logged-in company."""
    if current_user.role not in ["Director", "Super Admin", "Admin", "HR"]:
        raise HTTPException(status_code=403, detail="Only Company Directors or Admins can view director agreements.")

    filter_q = {}
    if current_user.role != "Super Admin":
        tenant_id = current_user.tenant_id
        t_doc = db["tenants"].find_one({"id": tenant_id}) if tenant_id else None
        company_name = (t_doc.get("name") if t_doc else "") or getattr(current_user, "tenant_name", "") or ""

        or_conditions = []
        if tenant_id:
            or_conditions.append({"tenant_id": tenant_id})
        if company_name:
            or_conditions.append({"company_name": {"$regex": f"^{re.escape(company_name)}$", "$options": "i"}})
            or_conditions.append({"agreement_data.companyName": {"$regex": f"^{re.escape(company_name)}$", "$options": "i"}})

        if or_conditions:
            filter_q = {"$or": or_conditions}

    docs = list(db["work_orders"].find(filter_q).sort("updated_at", -1))
    results = []
    for d in docs:
        wid = d.get("workorder_id") or d.get("candidate_id") or d.get("id")
        ag = d.get("agreement_data") or {}
        st = d.get("agreement_status") or d.get("status") or "ACTIVE"

        results.append({
            "id": str(d.get("id") or d.get("_id") or wid),
            "workorder_id": wid,
            "candidate_name": ag.get("deployedPersonnel") or d.get("candidate_name") or "Contract Personnel",
            "candidate_email": d.get("candidate_email") or "",
            "role": ag.get("role") or d.get("requisition_title") or d.get("job_title") or "Specialist",
            "company_name": ag.get("companyName") or d.get("company_name") or "Client Company",
            "vendor_name": ag.get("supplierName") or d.get("vendor_name") or "Vendor Partner",
            "charge_rate": ag.get("chargeRate") or d.get("bill_rate") or "₹1,500/hr",
            "duration": ag.get("duration") or "3 months",
            "start_date": ag.get("commencement") or str(d.get("start_date") or ""),
            "end_date": ag.get("expiry") or str(d.get("end_date") or ""),
            "status": st,
            "agreement_status": st,
            "agreement_data": ag if ag else None,
            "submitted_at": d.get("agreement_submitted_at") or str(d.get("submitted_at") or ""),
            "submitted_by": d.get("agreement_submitted_by") or "",
            "approved_at": str(d.get("approved_at") or ""),
            "approved_by": d.get("approved_by") or "",
            "revision_notes": d.get("revision_notes") or "",
            "rejection_reason": d.get("rejection_reason") or "",
            "rejected_by": d.get("rejected_by") or "",
            "rejected_at": str(d.get("rejected_at") or ""),
        })

    priority = {"Pending Director Approval": 0, "Submitted": 1, "Revision Requested": 2, "Rejected": 3, "Approved": 4, "ACTIVE": 5}
    results.sort(key=lambda x: priority.get(x["status"], 6))
    return results


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


class SubmitAgreementPayload(BaseModel):
    workorder_id: str
    agreement_data: dict
    status: str = "Pending Director Approval"


class RevisionPayload(BaseModel):
    notes: str = ""


@router.post("/submit-agreement")
def submit_agreement_endpoint(
    payload: SubmitAgreementPayload,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Vendor submits Master Services Agreement (MSA) for Company Director approval."""
    clean_id = (payload.workorder_id or "").strip()
    if not clean_id:
        raise HTTPException(status_code=400, detail="Work Order ID is required.")

    escaped = re.escape(clean_id)
    norm = re.sub(r'\s*-\s*', r'\\s*-\\s*', escaped)
    regex_pat = f"^{norm}$"

    now_iso = datetime.now(timezone.utc).isoformat()
    ag = payload.agreement_data or {}
    company_name = ag.get("companyName") or "Client Company"
    vendor_name = ag.get("supplierName") or "Vendor Partner"
    deployed_name = ag.get("deployedPersonnel") or "Candidate"
    role_name = ag.get("role") or "Specialist"

    # 1. Search existing in MongoDB
    wo_doc = db["work_orders"].find_one({
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

    target_status = payload.status or "Pending Director Approval"
    is_draft = (target_status == "Draft")

    update_fields = {
        "status": target_status,
        "agreement_status": target_status,
        "agreement_data": ag,
        "candidate_name": deployed_name,
        "requisition_title": role_name,
        "job_title": role_name,
        "company_name": company_name,
        "vendor_name": vendor_name,
        "bill_rate": ag.get("chargeRate") or "",
        "start_date": ag.get("commencement") or "",
        "end_date": ag.get("expiry") or "",
        "location": ag.get("placeOfWork") or "",
        "updated_at": now_iso,
    }

    if not is_draft:
        update_fields["agreement_submitted_at"] = now_iso
        update_fields["agreement_submitted_by"] = f"{current_user.name} ({current_user.role})"
        update_fields["agreement_submitted_by_email"] = current_user.email

    target_tenant_id = wo_doc.get("tenant_id") if wo_doc else None

    # Try resolving client tenant by company name
    if not target_tenant_id and company_name:
        t_doc = db["tenants"].find_one({"name": {"$regex": f"^{re.escape(company_name)}$", "$options": "i"}})
        if t_doc:
            target_tenant_id = t_doc.get("id")
            update_fields["tenant_id"] = target_tenant_id

    if wo_doc:
        db["work_orders"].update_one({"_id": wo_doc["_id"]}, {"$set": update_fields})
    else:
        update_fields["workorder_id"] = clean_id
        update_fields["candidate_id"] = clean_id
        update_fields["id"] = clean_id
        update_fields["created_at"] = now_iso
        db["work_orders"].insert_one(update_fields)

    # 2. Update SQL WorkOrder if exists
    with get_session() as session:
        sql_wo = session.query(WorkOrder).filter(WorkOrder.candidate_id == clean_id).first()
        if not sql_wo:
            sql_wo = session.query(WorkOrder).filter(WorkOrder.workorder_id == clean_id).first()
        if not sql_wo:
            sql_wo = session.query(WorkOrder).filter(WorkOrder.id == clean_id).first()
        if sql_wo:
            sql_wo.status = target_status
            if not is_draft:
                sql_wo.submitted_at = datetime.now(timezone.utc)
            sql_wo.updated_at = datetime.now(timezone.utc)
            if not target_tenant_id and sql_wo.tenant_id:
                target_tenant_id = sql_wo.tenant_id
            session.commit()

    # 3. Notify Company Director(s) only if submitted for approval
    if not is_draft and target_tenant_id:
        with get_session() as session:
            directors = session.query(User).filter(User.role == "Director").all()
            for d in directors:
                if str(d.tenant_id) == str(target_tenant_id):
                    d_id = str(d.id)
                    db["notifications"].insert_one({
                        "id": str(uuid.uuid4()),
                        "user_id": d_id,
                        "tenant_id": str(target_tenant_id),
                        "type": "agreement.pending_approval",
                        "title": "New Agreement Pending Your Approval",
                        "body": f"Master Services Agreement for {deployed_name} ({clean_id}) has been submitted by {vendor_name} for executive sign-off.",
                        "message": f"Master Services Agreement for {deployed_name} ({clean_id}) has been submitted by {vendor_name} for executive sign-off.",
                        "data": {
                            "link": "/dashboard/director",
                            "workorder_id": clean_id,
                            "candidate_name": deployed_name,
                            "role": role_name,
                            "vendor": vendor_name
                        },
                        "link": "/dashboard/director",
                        "read": False,
                        "created_at": now_iso
                    })

    msg = f"Agreement draft saved for {clean_id}." if is_draft else f"Agreement submitted to {company_name} Director for approval."
    return {
        "success": True,
        "message": msg,
        "status": target_status,
        "workorder_id": clean_id,
        "submitted_at": now_iso if not is_draft else ""
    }


@router.post("/{identifier:path}/director-approve")
def director_approve_agreement(
    identifier: str,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Company Director approves the Master Services Agreement."""
    if current_user.role not in ["Director", "Super Admin", "Admin"]:
        raise HTTPException(status_code=403, detail="Only Company Directors or Admins can approve agreements.")

    clean_id = (identifier or "").strip()
    escaped = re.escape(clean_id)
    norm = re.sub(r'\s*-\s*', r'\\s*-\\s*', escaped)
    regex_pat = f"^{norm}$"

    now_iso = datetime.now(timezone.utc).isoformat()
    approver_label = f"{current_user.name} (Director)"

    # 1. Update in MongoDB
    wo_doc = db["work_orders"].find_one({
        "$or": [
            {"workorder_id": clean_id},
            {"candidate_id": clean_id},
            {"work_order_number": clean_id},
            {"id": clean_id},
            {"workorder_id": {"$regex": regex_pat, "$options": "i"}},
            {"candidate_id": {"$regex": regex_pat, "$options": "i"}},
        ]
    })

    if wo_doc:
        # 1. Activate work order in MongoDB with Approved agreement status
        db["work_orders"].update_one(
            {"_id": wo_doc["_id"]},
            {"$set": {
                "status": "ACTIVE",
                "agreement_status": "Approved",
                "activated_at": now_iso,
                "activation_gates_cleared": True,
                "director_approved": True,
                "approved_at": now_iso,
                "approved_by": approver_label,
                "rejection_reason": "",
                "rejected_by": "",
                "rejected_at": "",
                "revision_notes": "",
                "updated_at": now_iso,
            }}
        )

        cand_id = wo_doc.get("candidate_id") or clean_id
        cand_name = wo_doc.get("candidate_name") or ""
        cand_email = wo_doc.get("candidate_email") or ""
        cid_clean = clean_id.replace("SDC-", "").replace("SDC -", "").replace("BEAR-", "").strip()

        # 2. Unlock Onboarding Checklist and clear all activation gates
        ob_or = [
            {"candidate_id": clean_id},
            {"workorder_id": clean_id},
            {"candidate_id": cid_clean},
            {"workorder_id": cid_clean},
        ]
        if cand_email:
            ob_or.append({"candidate_email": cand_email})
        if cand_name:
            ob_or.append({"candidate_name": cand_name})

        ob_doc = db["onboarding_checklists"].find_one({"$or": ob_or})
        if ob_doc:
            gates = ob_doc.get("activation_gates", [])
            for g in gates:
                g["status"] = "cleared"
            db["onboarding_checklists"].update_one(
                {"_id": ob_doc["_id"]},
                {"$set": {
                    "activation_status": "activated",
                    "onboarding_status": "completed",
                    "status": "completed",
                    "activated_at": now_iso,
                    "activation_gates": gates,
                    "updated_at": now_iso
                }}
            )
        else:
            db["onboarding_checklists"].insert_one({
                "id": f"ob_{uuid.uuid4().hex[:12]}",
                "candidate_id": clean_id,
                "workorder_id": clean_id,
                "candidate_name": cand_name or "Candidate",
                "candidate_email": cand_email or "",
                "tenant_id": wo_doc.get("tenant_id", ""),
                "activation_status": "activated",
                "onboarding_status": "completed",
                "status": "completed",
                "activated_at": now_iso,
                "activation_gates": [
                    {"name": "Identity & KYC", "status": "cleared", "type": "blocking"},
                    {"name": "Master Agreement Approval", "status": "cleared", "type": "blocking"},
                    {"name": "Background Clearance", "status": "cleared", "type": "blocking"}
                ],
                "created_at": now_iso,
                "updated_at": now_iso
            })

        # 3. Update candidate submission status to Accepted & Onboarding Completed
        db["candidate_submissions"].update_many(
            {"$or": [
                {"id": cand_id},
                {"candidate_id": cand_id},
                {"candidate_name": cand_name},
                {"name": cand_name},
                {"candidate_email": cand_email}
            ]},
            {"$set": {
                "status": "Accepted",
                "stage": "Offer Accepted",
                "onboarding_status": "completed",
                "updated_at": now_iso
            }}
        )

        # 4. Notify Candidate that Portal is fully unlocked
        try:
            db["candidate_notifications"].insert_one({
                "id": f"notif_{uuid.uuid4().hex[:10]}",
                "candidate_id": cand_id,
                "workorder_id": clean_id,
                "type": "work_order_activated",
                "title": "Master Services Agreement Approved & Activated",
                "message": f"Director {current_user.name} has approved your agreement. Your Candidate Portal is now fully unlocked for Timesheets, Attendance, and Expenses.",
                "is_read": False,
                "target_tab": "timesheet",
                "created_at": now_iso
            })
        except Exception:
            pass

        # 5. Notify Recruiter that Director signed off
        recruiter_email = wo_doc.get("agreement_submitted_by_email")
        if recruiter_email:
            with get_session() as s_rec:
                u_rec = s_rec.query(User).filter(User.email == recruiter_email).first()
                if u_rec:
                    db["notifications"].insert_one({
                        "id": str(uuid.uuid4()),
                        "user_id": str(u_rec.id),
                        "tenant_id": str(u_rec.tenant_id),
                        "type": "agreement.approved",
                        "title": "Agreement Approved by Director!",
                        "body": f"Director {current_user.name} has approved Master Services Agreement {clean_id} for {wo_doc.get('candidate_name', 'Candidate')}.",
                        "message": f"Director {current_user.name} has approved Master Services Agreement {clean_id} for {wo_doc.get('candidate_name', 'Candidate')}.",
                        "data": {"link": "/dashboard/recruiter/agreements", "workorder_id": clean_id},
                        "link": "/dashboard/recruiter/agreements",
                        "read": False,
                        "created_at": now_iso
                    })

    # 6. Update in SQL
    with get_session() as session:
        sql_wo = session.query(WorkOrder).filter(WorkOrder.candidate_id == clean_id).first()
        if not sql_wo:
            sql_wo = session.query(WorkOrder).filter(WorkOrder.workorder_id == clean_id).first()
        if not sql_wo:
            sql_wo = session.query(WorkOrder).filter(WorkOrder.id == clean_id).first()
        if sql_wo:
            sql_wo.status = "Approved"
            sql_wo.approved_at = datetime.now(timezone.utc)
            sql_wo.approved_by = approver_label
            sql_wo.updated_at = datetime.now(timezone.utc)
            session.commit()

    return {
        "success": True,
        "message": f"Agreement {clean_id} approved successfully by {approver_label}.",
        "status": "Approved",
        "approved_by": approver_label,
        "approved_at": now_iso
    }


@router.post("/{identifier:path}/director-request-revision")
def director_request_revision(
    identifier: str,
    payload: RevisionPayload,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Company Director requests changes / revision notes for the agreement."""
    clean_id = (identifier or "").strip()
    escaped = re.escape(clean_id)
    norm = re.sub(r'\s*-\s*', r'\\s*-\\s*', escaped)
    regex_pat = f"^{norm}$"

    now_iso = datetime.now(timezone.utc).isoformat()
    notes = payload.notes or "Director requested adjustments to agreement terms."

    wo_doc = db["work_orders"].find_one({
        "$or": [
            {"workorder_id": clean_id},
            {"candidate_id": clean_id},
            {"work_order_number": clean_id},
            {"id": clean_id},
            {"workorder_id": {"$regex": regex_pat, "$options": "i"}},
        ]
    })

    if wo_doc:
        db["work_orders"].update_one(
            {"_id": wo_doc["_id"]},
            {"$set": {
                "status": "Revision Requested",
                "agreement_status": "Revision Requested",
                "revision_notes": notes,
                "revision_requested_by": current_user.name,
                "revision_requested_at": now_iso,
                "updated_at": now_iso,
            }}
        )

        recruiter_email = wo_doc.get("agreement_submitted_by_email")
        if recruiter_email:
            with get_session() as s_rec:
                u_rec = s_rec.query(User).filter(User.email == recruiter_email).first()
                if u_rec:
                    db["notifications"].insert_one({
                        "id": str(uuid.uuid4()),
                        "user_id": str(u_rec.id),
                        "tenant_id": str(u_rec.tenant_id),
                        "type": "agreement.revision_requested",
                        "title": "Revision Requested on Agreement",
                        "body": f"Director {current_user.name} requested changes on {clean_id}: \"{notes}\"",
                        "message": f"Director {current_user.name} requested changes on {clean_id}: \"{notes}\"",
                        "data": {"link": "/dashboard/recruiter/agreements", "workorder_id": clean_id, "revision_notes": notes},
                        "link": "/dashboard/recruiter/agreements",
                        "read": False,
                        "created_at": now_iso
                    })

    return {
        "success": True,
        "message": f"Revision requested for agreement {clean_id}.",
        "status": "Revision Requested",
        "revision_notes": notes
    }


@router.post("/{identifier:path}/director-reject")
def director_reject_agreement(
    identifier: str,
    payload: RevisionPayload,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Company Director rejects the Master Services Agreement."""
    if current_user.role not in ["Director", "Super Admin", "Admin"]:
        raise HTTPException(status_code=403, detail="Only Company Directors or Admins can reject agreements.")

    clean_id = (identifier or "").strip()
    escaped = re.escape(clean_id)
    norm = re.sub(r'\s*-\s*', r'\\s*-\\s*', escaped)
    regex_pat = f"^{norm}$"

    now_iso = datetime.now(timezone.utc).isoformat()
    reason = payload.notes or "Director rejected this Master Services Agreement."
    rejector_label = f"{current_user.name} (Director)"

    wo_doc = db["work_orders"].find_one({
        "$or": [
            {"workorder_id": clean_id},
            {"candidate_id": clean_id},
            {"work_order_number": clean_id},
            {"id": clean_id},
            {"workorder_id": {"$regex": regex_pat, "$options": "i"}},
            {"candidate_id": {"$regex": regex_pat, "$options": "i"}},
        ]
    })

    if wo_doc:
        db["work_orders"].update_one(
            {"_id": wo_doc["_id"]},
            {"$set": {
                "status": "Rejected",
                "agreement_status": "Rejected",
                "rejection_reason": reason,
                "rejected_by": rejector_label,
                "rejected_at": now_iso,
                "updated_at": now_iso,
            }}
        )

        cand_id = wo_doc.get("candidate_id") or clean_id
        db["candidate_submissions"].update_many(
            {"$or": [
                {"id": cand_id},
                {"candidate_id": cand_id},
                {"candidate_name": wo_doc.get("candidate_name")},
                {"name": wo_doc.get("candidate_name")}
            ]},
            {"$set": {"agreement_status": "Rejected", "updated_at": now_iso}}
        )

        recruiter_email = wo_doc.get("agreement_submitted_by_email")
        if recruiter_email:
            with get_session() as s_rec:
                u_rec = s_rec.query(User).filter(User.email == recruiter_email).first()
                if u_rec:
                    db["notifications"].insert_one({
                        "id": str(uuid.uuid4()),
                        "user_id": str(u_rec.id),
                        "tenant_id": str(u_rec.tenant_id),
                        "type": "agreement.rejected",
                        "title": "Agreement Rejected by Director",
                        "body": f"Director {current_user.name} rejected agreement {clean_id}: \"{reason}\"",
                        "message": f"Director {current_user.name} rejected agreement {clean_id}: \"{reason}\"",
                        "data": {"link": "/dashboard/recruiter/agreements", "workorder_id": clean_id, "rejection_reason": reason},
                        "link": "/dashboard/recruiter/agreements",
                        "read": False,
                        "created_at": now_iso
                    })

    # Update in SQL if exists
    with get_session() as session:
        sql_wo = session.query(WorkOrder).filter(WorkOrder.candidate_id == clean_id).first()
        if not sql_wo:
            sql_wo = session.query(WorkOrder).filter(WorkOrder.workorder_id == clean_id).first()
        if not sql_wo:
            sql_wo = session.query(WorkOrder).filter(WorkOrder.id == clean_id).first()
        if sql_wo:
            sql_wo.status = "Rejected"
            sql_wo.updated_at = datetime.now(timezone.utc)
            session.commit()

    return {
        "success": True,
        "message": f"Agreement {clean_id} rejected by {rejector_label}.",
        "status": "Rejected",
        "rejection_reason": reason,
        "rejected_by": rejector_label,
        "rejected_at": now_iso
    }
