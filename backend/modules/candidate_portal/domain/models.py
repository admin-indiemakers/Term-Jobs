from typing import ClassVar
from ...shared.db import Column, Model, _utcnow, _uuid


class WorkOrder(Model):
    __tablename__ = "work_orders"

    _fields: ClassVar[dict[str, object]] = {
        "id": _uuid,
        "work_order_number": "",
        "tenant_id": "",
        "requisition_id": "",
        "requisition_title": "",
        "offer_id": "",
        "candidate_id": "",
        "candidate_name": "",
        "candidate_email": "",
        "person_id": "",
        "vendor_id": "",
        "vendor_name": "",
        "company_name": "",
        "bill_rate": 1500.0,
        "rate_basis": "hourly",
        "currency": "INR",
        "start_date": "",
        "end_date": "",
        "weekly_hours": 40.0,
        "location": "Mumbai (Hybrid)",
        "work_arrangement": "Hybrid",
        "reporting_manager": "Deepak Sharma (Head of Infrastructure)",
        "overtime_eligible": False,
        "overtime_policy": "Standard 40h/week cap, overtime requires prior manager approval",
        "engagement_type": "Contract Staffing",
        "status": "ACTIVE",  # PENDING, ACTIVE, CLOSED
        "is_conditional_start": False,
        "conditional_expiry_date": "",
        "activated_at": "",
        "created_at": _utcnow,
        "updated_at": _utcnow,
    }

    id = Column("id")
    work_order_number = Column("work_order_number")
    tenant_id = Column("tenant_id")
    requisition_id = Column("requisition_id")
    requisition_title = Column("requisition_title")
    candidate_id = Column("candidate_id")
    candidate_name = Column("candidate_name")
    candidate_email = Column("candidate_email")
    vendor_name = Column("vendor_name")
    company_name = Column("company_name")
    start_date = Column("start_date")
    end_date = Column("end_date")
    weekly_hours = Column("weekly_hours")
    location = Column("location")
    work_arrangement = Column("work_arrangement")
    reporting_manager = Column("reporting_manager")
    overtime_eligible = Column("overtime_eligible")
    overtime_policy = Column("overtime_policy")
    engagement_type = Column("engagement_type")
    status = Column("status")
    created_at = Column("created_at")
    updated_at = Column("updated_at")


class Timesheet(Model):
    __tablename__ = "timesheets"

    _fields: ClassVar[dict[str, object]] = {
        "id": _uuid,
        "timesheet_number": "",
        "type": "HOURLY_TIMESHEET",
        "work_order_id": "",
        "work_order_number": "",
        "tenant_id": "",
        "vendor_id": "",
        "vendor_name": "",
        "candidate_id": "",
        "worker_name": "",
        "week_start_date": "",
        "week_end_date": "",
        "daily_entries": list,
        "total_regular_hours": 40.0,
        "total_overtime_hours": 0.0,
        "total_hours": 40.0,
        "expected_hours": 40.0,
        "bill_rate": 0.0,
        "rate_basis": "hourly",
        "gross_amount": 0.0,
        "status": "DRAFT",  # DRAFT, SUBMITTED, APPROVED, REJECTED, INVOICED
        "has_exceptions": False,
        "exception_flags": list,
        "ai_insights": dict,
        "rejection_reason": "",
        "approved_by": "",
        "approved_at": "",
        "submitted_at": "",
        "created_at": _utcnow,
        "updated_at": _utcnow,
    }

    id = Column("id")
    timesheet_number = Column("timesheet_number")
    work_order_id = Column("work_order_id")
    work_order_number = Column("work_order_number")
    candidate_id = Column("candidate_id")
    worker_name = Column("worker_name")
    week_start_date = Column("week_start_date")
    week_end_date = Column("week_end_date")
    daily_entries = Column("daily_entries")
    total_regular_hours = Column("total_regular_hours")
    total_overtime_hours = Column("total_overtime_hours")
    total_hours = Column("total_hours")
    status = Column("status")
    submitted_at = Column("submitted_at")
    approved_at = Column("approved_at")
    created_at = Column("created_at")
    updated_at = Column("updated_at")


class AttendanceSheet(Model):
    __tablename__ = "attendance_sheets"

    _fields: ClassVar[dict[str, object]] = {
        "id": _uuid,
        "attendance_number": "",
        "type": "MONTHLY_ATTENDANCE",
        "work_order_id": "",
        "work_order_number": "",
        "tenant_id": "",
        "candidate_id": "",
        "worker_name": "",
        "month_year": "",
        "total_calendar_days": 30,
        "present_days": 20,
        "paid_leave_days": 1,
        "client_holidays": 1,
        "absent_days": 0,
        "payable_days": 22.0,
        "status": "ACTIVE",
        "created_at": _utcnow,
        "updated_at": _utcnow,
    }

    id = Column("id")
    work_order_id = Column("work_order_id")
    candidate_id = Column("candidate_id")
    month_year = Column("month_year")
    payable_days = Column("payable_days")
    status = Column("status")
    created_at = Column("created_at")
