"""
Vendor Billing & Invoicing Router.
Provides endpoints for recruiters/vendors to inspect accepted candidate hours,
timesheet pricing breakdowns, expenses, and generate monthly invoices.
"""

from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from datetime import datetime, timezone
from modules.identity.domain.models import User
from modules.identity.router import get_current_user
from modules.shared.db import db
from modules.billing.services.billing_service import (
    get_accepted_contractors_for_vendor,
    get_candidate_billing_breakdown,
    generate_vendor_invoice,
)

router = APIRouter(prefix="/api/vendor-billing", tags=["Vendor Billing"])


class GenerateInvoiceRequest(BaseModel):
    workorder_id: str
    period: Optional[str] = None


class UpdateInvoiceStatusRequest(BaseModel):
    status: str


@router.get("/overview")
def get_vendor_billing_overview(
    month: Optional[str] = Query(None, description="Month in YYYY-MM format"),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Return overview of all billable accepted candidates, KPI stats, and billing statuses."""
    if current_user.role not in ["Recruiter", "Admin", "Super Admin", "Director", "HR"]:
        raise HTTPException(status_code=403, detail="Vendor / Recruiter role required.")

    candidates = get_accepted_contractors_for_vendor(current_user, month_filter=month)

    total_contractors = len(candidates)
    total_hours = sum(c["total_hours"] for c in candidates)
    total_expenses = sum(c["total_expenses"] for c in candidates)
    total_value = sum(c["gross_amount"] for c in candidates)

    return {
        "status": "success",
        "month": month or "",
        "kpi_stats": {
            "active_contractors": total_contractors,
            "total_billable_hours": round(total_hours, 1),
            "total_approved_expenses": round(total_expenses, 2),
            "total_invoice_value": round(total_value, 2),
        },
        "candidates": candidates
    }


@router.get("/candidate/{workorder_id:path}")
def get_candidate_billing_details(
    workorder_id: str,
    month: Optional[str] = Query(None, description="Month in YYYY-MM format"),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Return detailed week-by-week timesheet breakdown, overtime multiplier,
    rate breakdown, approved expenses, and invoice info for a specific contractor.
    """
    if current_user.role not in ["Recruiter", "Admin", "Super Admin", "Director", "HR"]:
        raise HTTPException(status_code=403, detail="Vendor / Recruiter role required.")

    try:
        breakdown = get_candidate_billing_breakdown(workorder_id, month)
        return {
            "status": "success",
            "data": breakdown
        }
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/invoices/generate")
def create_invoice_endpoint(
    payload: GenerateInvoiceRequest,
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Generate and persist a monthly vendor invoice for candidate billing."""
    if current_user.role not in ["Recruiter", "Admin", "Super Admin"]:
        raise HTTPException(status_code=403, detail="Vendor role required to generate invoice.")

    period = payload.period or datetime.now().strftime("%Y-%m")
    try:
        inv = generate_vendor_invoice(payload.workorder_id, period, current_user)
        return {
            "status": "success",
            "message": f"Invoice {inv.get('invoice_number')} generated successfully.",
            "invoice": inv
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/invoices/{invoice_id}/status")
def update_invoice_status_endpoint(
    invoice_id: str,
    payload: UpdateInvoiceStatusRequest,
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Update invoice payment/billing status."""
    inv_coll = db["vendor_invoices"]
    inv = inv_coll.find_one({"$or": [{"id": invoice_id}, {"invoice_number": invoice_id}]})
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found.")

    inv_coll.update_one(
        {"_id": inv["_id"]},
        {"$set": {
            "status": payload.status,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "status_updated_by": current_user.name
        }}
    )

    inv["status"] = payload.status
    inv.pop("_id", None)
    return {
        "status": "success",
        "message": f"Invoice status updated to {payload.status}.",
        "invoice": inv
    }


class DispatchSowRequest(BaseModel):
    period: Optional[str] = None


@router.post("/candidate/{workorder_id:path}/dispatch-sow")
def dispatch_sow_endpoint(
    workorder_id: str,
    payload: Optional[DispatchSowRequest] = None,
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Recruiter dispatches the contractor billing package directly to the client's Procurement team."""
    if current_user.role not in ["Recruiter", "Admin", "Super Admin"]:
        raise HTTPException(status_code=403, detail="Vendor / Recruiter role required to dispatch SOW.")

    from modules.billing.services.billing_service import dispatch_vendor_sow
    period = payload.period if payload else None
    try:
        res = dispatch_vendor_sow(workorder_id, current_user, period=period)
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

