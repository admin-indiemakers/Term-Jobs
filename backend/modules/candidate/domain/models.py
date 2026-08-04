from enum import Enum
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field

class SubmissionStatus(str, Enum):
    SUBMITTED = "Submitted"
    SCREENED = "Screened"
    SHORTLISTED = "Shortlisted"
    INTERVIEW_SCHEDULED = "InterviewScheduled"
    INTERVIEW_COMPLETED = "InterviewCompleted"
    REJECTED = "Rejected"
    SELECTED = "Selected"

class Recommendation(str, Enum):
    SHORTLIST = "SHORTLIST"
    REVIEW = "REVIEW"
    REJECT = "REJECT"

class Candidate(BaseModel):
    id: str = Field(..., description="Unique Candidate ID")
    tenant_id: str = Field(..., description="Tenant ID (Client / Consultancy)")
    name: str = Field(..., description="Full Name of candidate")
    email: str = Field(..., description="Candidate email address")
    phone: str = Field(..., description="Candidate phone number")
    resume_text: str = Field(..., description="Raw parsed text from PDF resume")
    skills: List[str] = Field(default_factory=list, description="Extracted skills")

class Submission(BaseModel):
    id: str = Field(..., description="Unique Submission ID")
    candidate_id: str = Field(..., description="Linked Candidate ID")
    requisition_id: str = Field(..., description="Linked Requisition ID")
    status: SubmissionStatus = Field(default=SubmissionStatus.SUBMITTED, description="Current submission state")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
