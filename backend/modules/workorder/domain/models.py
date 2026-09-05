from datetime import datetime, timezone
from typing import ClassVar
import uuid
from pydantic import BaseModel, Field
from modules.shared.db import Column, Model, _utcnow, _uuid


class WorkOrder(Model):
    """Domain model for Work Orders issued by Vendors for selected candidates."""
    __tablename__ = "work_orders"

    _fields: ClassVar[dict[str, object]] = {
        "id": _uuid,
        "tenant_id": "",
        "requisition_id": "",
        "requisition_ref": "",
        "candidate_id": "",
        "candidate_name": "",
        "candidate_email": "",
        "candidate_phone": "",
        "vendor_id": "",
        "vendor_name": "",
        "company_name": "",
        "hiring_manager_name": "",
        "job_title": "",
        "work_location": "Remote",
        "start_date": "",
        "end_date": "",
        "contract_duration_months": 6,
        "billing_rate": 0.0,
        "rate_type": "monthly",
        "currency": "INR",
        "vendor_visible_floor": 0.0,
        "vendor_visible_cap": 0.0,
        "billing_cycle": "Monthly",
        "payment_terms": "NET 30",
        "scope_of_work": "",
        "special_terms": "",
        "esign_document_url": "",
        "esign_filename": "",
        "approval_type": "click_to_approve",
        "status": "Draft",
        "revision_notes": "",
        "ai_generated": False,
        "ai_reasoning": "",
        "created_at": _utcnow,
        "updated_at": _utcnow,
        "submitted_at": None,
        "approved_at": None,
        "approved_by": "",
    }

    id = Column("id")
    tenant_id = Column("tenant_id")
    requisition_id = Column("requisition_id")
    requisition_ref = Column("requisition_ref")
    candidate_id = Column("candidate_id")
    candidate_name = Column("candidate_name")
    candidate_email = Column("candidate_email")
    candidate_phone = Column("candidate_phone")
    vendor_id = Column("vendor_id")
    vendor_name = Column("vendor_name")
    company_name = Column("company_name")
    hiring_manager_name = Column("hiring_manager_name")
    job_title = Column("job_title")
    work_location = Column("work_location")
    start_date = Column("start_date")
    end_date = Column("end_date")
    contract_duration_months = Column("contract_duration_months")
    billing_rate = Column("billing_rate")
    rate_type = Column("rate_type")
    currency = Column("currency")
    vendor_visible_floor = Column("vendor_visible_floor")
    vendor_visible_cap = Column("vendor_visible_cap")
    billing_cycle = Column("billing_cycle")
    payment_terms = Column("payment_terms")
    scope_of_work = Column("scope_of_work")
    special_terms = Column("special_terms")
    esign_document_url = Column("esign_document_url")
    esign_filename = Column("esign_filename")
    approval_type = Column("approval_type")
    status = Column("status")
    revision_notes = Column("revision_notes")
    ai_generated = Column("ai_generated")
    ai_reasoning = Column("ai_reasoning")
    created_at = Column("created_at")
    updated_at = Column("updated_at")
    submitted_at = Column("submitted_at")
    approved_at = Column("approved_at")
    approved_by = Column("approved_by")


# Pydantic Schemas

class WorkOrderCreate(BaseModel):
    requisition_id: str
    candidate_id: str
    candidate_name: str
    candidate_email: str | None = None
    candidate_phone: str | None = None
    vendor_name: str
    job_title: str
    work_location: str = "Remote"
    start_date: str | None = None
    end_date: str | None = None
    contract_duration_months: int = 6
    billing_rate: float
    rate_type: str = "monthly"
    currency: str = "INR"
    vendor_visible_floor: float | None = None
    vendor_visible_cap: float | None = None
    billing_cycle: str = "Monthly"
    payment_terms: str = "NET 30"
    scope_of_work: str | None = None
    special_terms: str | None = None
    ai_generated: bool = False
    ai_reasoning: str | None = None


class WorkOrderUpdate(BaseModel):
    job_title: str | None = None
    work_location: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    contract_duration_months: int | None = None
    billing_rate: float | None = None
    rate_type: str | None = None
    currency: str | None = None
    billing_cycle: str | None = None
    payment_terms: str | None = None
    scope_of_work: str | None = None
    special_terms: str | None = None


class WorkOrderApproveIn(BaseModel):
    approved_by: str
    approval_type: str = "click_to_approve"
    notes: str | None = None


class WorkOrderRevisionIn(BaseModel):
    reviewer: str
    revision_notes: str
