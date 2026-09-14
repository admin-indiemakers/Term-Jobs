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
        "final_remark": "",                # Hiring Manager final feedback once the meeting is over
        "decision": "",                    # "Accepted" | "Rejected" once the meeting is over
        "completed_at": None,              # datetime when the meeting was marked over
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
    final_remark = Column("final_remark")
    decision = Column("decision")
    completed_at = Column("completed_at")
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


class CompleteInterviewRequest(BaseModel):
    final_remark: str = ""
    decision: str = "Accepted"  # "Accepted" | "Rejected"


class InterviewRound(Model):
    __tablename__ = "interview_rounds"

    _fields: ClassVar[dict[str, object]] = {
        "id": _uuid,
        "tenant_id": "",
        "requisition_id": "",
        "requisition_title": "",
        "candidate_submission_id": "",
        "candidate_name": "",
        "candidate_email": "",
        "round_number": 1,
        "round_name": "Technical Round 1",
        "round_type": "Technical",
        "scheduled_date": "",
        "scheduled_time": "",
        "duration_minutes": 45,
        "interviewer_name": "",
        "interviewer_email": "",
        "interviewer_role": "Interviewer",
        "instructions": "",
        "internal_notes": "",
        "candidate_passcode": "",
        "candidate_token": _uuid,
        "interviewer_token": _uuid,
        "room_id": "",
        "status": "Scheduled",
        "evaluation": dict,
        "created_by": "",
        "created_at": _utcnow,
        "updated_at": _utcnow,
    }

    id = Column("id")
    tenant_id = Column("tenant_id")
    requisition_id = Column("requisition_id")
    requisition_title = Column("requisition_title")
    candidate_submission_id = Column("candidate_submission_id")
    candidate_name = Column("candidate_name")
    candidate_email = Column("candidate_email")
    round_number = Column("round_number")
    round_name = Column("round_name")
    round_type = Column("round_type")
    scheduled_date = Column("scheduled_date")
    scheduled_time = Column("scheduled_time")
    duration_minutes = Column("duration_minutes")
    interviewer_name = Column("interviewer_name")
    interviewer_email = Column("interviewer_email")
    interviewer_role = Column("interviewer_role")
    instructions = Column("instructions")
    internal_notes = Column("internal_notes")
    candidate_passcode = Column("candidate_passcode")
    candidate_token = Column("candidate_token")
    interviewer_token = Column("interviewer_token")
    room_id = Column("room_id")
    status = Column("status")
    evaluation = Column("evaluation")
    created_by = Column("created_by")
    created_at = Column("created_at")
    updated_at = Column("updated_at")


class InterviewChatMessage(Model):
    __tablename__ = "interview_messages"

    _fields: ClassVar[dict[str, object]] = {
        "id": _uuid,
        "round_id": "",
        "room_id": "",
        "sender_name": "",
        "sender_role": "candidate",
        "sender_identity": "",
        "message": "",
        "created_at": _utcnow,
    }

    id = Column("id")
    round_id = Column("round_id")
    room_id = Column("room_id")
    sender_name = Column("sender_name")
    sender_role = Column("sender_role")
    sender_identity = Column("sender_identity")
    message = Column("message")
    created_at = Column("created_at")


class CreateInterviewRoundRequest(BaseModel):
    requisition_id: str
    requisition_title: Optional[str] = ""
    candidate_submission_id: str
    candidate_name: str
    candidate_email: str
    round_number: Optional[int] = None
    round_name: str = "Technical Round 1"
    round_type: Optional[str] = "Technical"
    scheduled_date: str
    scheduled_time: str
    duration_minutes: Optional[int] = 45
    interviewer_name: str
    interviewer_email: str
    interviewer_role: Optional[str] = "Interviewer"
    instructions: Optional[str] = ""
    internal_notes: Optional[str] = ""


class CandidateLoginRequest(BaseModel):
    email: str
    passcode: Optional[str] = None
    token: Optional[str] = None


class SubmitEvaluationRequest(BaseModel):
    result: str = "Yes"  # "Completed" | "Strong Yes" | "Yes" | "Maybe" | "No" | "No Show"
    scores: Optional[Dict[str, Any]] = None  # { technical: 4, communication: 5, problem_solving: 4, culture: 4 }
    strengths: Optional[str] = ""
    weaknesses: Optional[str] = ""
    notes: Optional[str] = ""
    evaluator_name: Optional[str] = ""
    evaluator_email: Optional[str] = ""


class UpdateRoundStatusRequest(BaseModel):
    status: str  # "Scheduled" | "In Progress" | "Completed" | "Cancelled" | "No Show"


class LiveKitTokenRequest(BaseModel):
    round_id: str
    participant_name: str
    participant_identity: Optional[str] = None
    role: str = "candidate"  # "candidate" | "interviewer"


class SendChatMessageRequest(BaseModel):
    sender_name: str
    sender_role: str = "candidate"
    sender_identity: Optional[str] = None
    message: str
    message_id: Optional[str] = None

