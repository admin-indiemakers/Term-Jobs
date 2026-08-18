"""
Interview Scheduling domain models and Pydantic schemas.
"""
from typing import ClassVar, List, Optional, Dict, Any
from enum import Enum
from pydantic import BaseModel, Field
import uuid

from ...shared.db import Column, Model, _utcnow, _uuid


class InterviewStatus(str, Enum):
    PROPOSED_BY_COMPANY = "PROPOSED_BY_COMPANY"
    CONFIRMED_BY_VENDOR = "CONFIRMED_BY_VENDOR"
    RESCHEDULE_REQUESTED = "RESCHEDULE_REQUESTED"
    CANCELLED = "CANCELLED"
    COMPLETED = "COMPLETED"


class InterviewSchedule(Model):
    __tablename__ = "interview_schedules"

    _fields: ClassVar[dict[str, object]] = {
        "id": _uuid,
        "tenant_id": None,                 # Company tenant ID
        "company_name": "",
        "calendar_provider": "google",     # "google" | "microsoft" | "zoho" | "universal"
        
        "requisition_id": None,
        "requisition_title": "",
        "candidate_submission_id": None,
        "candidate_name": "",
        "candidate_email": "",
        
        "vendor_id": None,                 # Vendor tenant ID
        "vendor_name": "",
        
        "interview_round": "Technical Round 1",
        "interviewer_name": "",
        "interviewer_email": "",
        "meeting_link": "",
        "platform": "Google Meet",         # "Google Meet" | "Microsoft Teams" | "Zoom" | "In-Person"
        
        "proposed_slots": list,            # list of {slot_id, date, start_time, end_time, timezone}
        "confirmed_slot": dict,            # {slot_id, date, start_time, end_time, timezone}
        
        "status": "PROPOSED_BY_COMPANY",   # InterviewStatus
        "notes": "",
        "vendor_notes": "",
        "created_at": _utcnow,
        "updated_at": _utcnow,
    }

    id = Column("id")
    tenant_id = Column("tenant_id")
    company_name = Column("company_name")
    calendar_provider = Column("calendar_provider")
    requisition_id = Column("requisition_id")
    requisition_title = Column("requisition_title")
    candidate_submission_id = Column("candidate_submission_id")
    candidate_name = Column("candidate_name")
    candidate_email = Column("candidate_email")
    vendor_id = Column("vendor_id")
    vendor_name = Column("vendor_name")
    interview_round = Column("interview_round")
    interviewer_name = Column("interviewer_name")
    interviewer_email = Column("interviewer_email")
    meeting_link = Column("meeting_link")
    platform = Column("platform")
    proposed_slots = Column("proposed_slots")
    confirmed_slot = Column("confirmed_slot")
    status = Column("status")
    notes = Column("notes")
    vendor_notes = Column("vendor_notes")
    created_at = Column("created_at")
    updated_at = Column("updated_at")


class SlotSchema(BaseModel):
    slot_id: str = Field(default_factory=lambda: f"slot_{uuid.uuid4().hex[:8]}")
    date: str                  # "2026-08-20"
    start_time: str            # "10:00"
    end_time: str              # "11:00"
    timezone: str = "Asia/Kolkata"


class ScheduleInterviewRequest(BaseModel):
    requisition_id: str
    requisition_title: str
    candidate_submission_id: str
    candidate_name: str
    candidate_email: Optional[str] = ""
    vendor_name: Optional[str] = "Vendor"
    vendor_id: Optional[str] = None
    interview_round: str = "Technical Round 1"
    interviewer_name: Optional[str] = ""
    interviewer_email: Optional[str] = ""
    meeting_link: Optional[str] = ""
    platform: Optional[str] = "Google Meet"
    proposed_slots: List[SlotSchema]
    notes: Optional[str] = ""


class VendorConfirmRequest(BaseModel):
    confirmed_slot: Optional[SlotSchema] = None
    slot_id: Optional[str] = None
    action: str = "confirm"    # "confirm" | "reschedule" | "cancel"
    vendor_notes: Optional[str] = ""
    alternative_slots: Optional[List[SlotSchema]] = None
