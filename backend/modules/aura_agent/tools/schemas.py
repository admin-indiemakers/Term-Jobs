"""Pydantic v2 schemas for all 38 tools across 14 Hiring Manager domains."""
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# -----------------------------------------------------------------------------
# Domain 1: Requisition Management
# -----------------------------------------------------------------------------
class ListRequisitionsInput(BaseModel):
    status: Optional[str] = Field(None, description="Filter by status: DRAFT, PENDING_APPROVAL, OPEN, FILLED, CLOSED")
    department: Optional[str] = Field(None, description="Filter by department, e.g. Engineering")
    search_term: Optional[str] = Field(None, description="Keyword search across title or skills")
    has_shortlisted_candidates: Optional[bool] = Field(None, description="Filter only requisitions that currently have shortlisted candidates count > 0")
    has_candidates: Optional[bool] = Field(None, description="Filter requisitions that contain any candidates or applicants")
    limit: int = Field(20, ge=1, le=50, description="Maximum items to return")


class GetRequisitionDetailsInput(BaseModel):
    requisition_id: str = Field(..., description="Unique requisition ID")


class CreateRequisitionDraftInput(BaseModel):
    title: str = Field(..., description="Role title, e.g. 'Senior Python Backend Engineer'")
    department: str = Field(..., description="Department, e.g. 'Engineering'")
    headcount: int = Field(1, ge=1, description="Number of openings")
    primary_skills: List[str] = Field(..., min_length=1, description="Mandatory required skills")
    secondary_skills: Optional[List[str]] = Field(default_factory=list, description="Optional skills")
    min_experience_years: int = Field(0, ge=0, description="Minimum years of experience")
    budget_max: float = Field(..., gt=0, description="Maximum budget / rate")
    work_mode: str = Field("Remote", description="Work mode: Remote | Hybrid | Onsite")
    location: str = Field(..., description="City or timezone")
    description: Optional[str] = Field(None, description="Job description text")


class UpdateRequisitionDraftInput(BaseModel):
    requisition_id: str = Field(..., description="ID of draft requisition to update")
    updates: Dict[str, Any] = Field(..., description="Key-value fields to update")


class SubmitRequisitionForApprovalInput(BaseModel):
    requisition_id: str = Field(..., description="Requisition ID to submit for Director approval")
    justification_note: Optional[str] = Field(None, description="Business justification for Director")


class CloseRequisitionInput(BaseModel):
    requisition_id: str = Field(..., description="Requisition ID to close")
    closure_reason: str = Field(..., description="Reason: FILLED, CANCELLED, RESTRUCTURED")


# -----------------------------------------------------------------------------
# Domain 2: Job Description & Skills AI
# -----------------------------------------------------------------------------
class GenerateEnterpriseJDInput(BaseModel):
    title: str = Field(..., description="Role title")
    skills: List[str] = Field(..., description="Key required technical skills")
    experience_years: int = Field(..., ge=0, description="Years of experience required")
    work_mode: str = Field("Remote", description="Remote | Hybrid | Onsite")
    role_context: Optional[str] = Field(None, description="Company context or team mission")


class RefineSkillRequirementsInput(BaseModel):
    role_title: str = Field(..., description="Job role title")
    raw_skills: List[str] = Field(..., description="List of unrefined or raw skills")


# -----------------------------------------------------------------------------
# Domain 3: Candidate Search & Screening
# -----------------------------------------------------------------------------
class SearchCandidatesInput(BaseModel):
    requisition_id: Optional[str] = Field(None, description="Filter by requisition ID")
    min_match_score: Optional[int] = Field(None, ge=0, le=100, description="Minimum AI match percentage")
    skills: Optional[List[str]] = Field(None, description="List of required skills")
    status: Optional[str] = Field(None, description="Status: SUBMITTED, SHORTLISTED, etc.")
    vendor_id: Optional[str] = Field(None, description="Filter by vendor source")
    limit: int = Field(10, ge=1, le=50)


class GetCandidateProfileInput(BaseModel):
    candidate_id: str = Field(..., description="Candidate ID")


class CompareCandidatesInput(BaseModel):
    candidate_ids: List[str] = Field(..., min_length=2, max_length=4, description="2 to 4 candidate IDs")
    requisition_id: str = Field(..., description="Target requisition ID for comparison")


class ExplainAIMatchScoreInput(BaseModel):
    candidate_id: str = Field(..., description="Candidate ID")
    requisition_id: str = Field(..., description="Requisition ID")


# -----------------------------------------------------------------------------
# Domain 4: Candidate Pipeline Actions
# -----------------------------------------------------------------------------
class ShortlistCandidateInput(BaseModel):
    candidate_id: str = Field(..., description="Candidate ID to shortlist")
    requisition_id: str = Field(..., description="Requisition ID")
    shortlist_notes: Optional[str] = Field(None, description="Notes on why candidate was shortlisted")


class RejectCandidateInput(BaseModel):
    candidate_id: str = Field(..., description="Candidate ID to reject")
    requisition_id: str = Field(..., description="Requisition ID")
    rejection_reason: str = Field(..., min_length=10, description="Mandatory detailed reason for rejection")


class CheckCandidateSLAStatusInput(BaseModel):
    requisition_id: Optional[str] = Field(None, description="Requisition ID to check SLA countdowns for")


# -----------------------------------------------------------------------------
# Domain 5: Interview Scheduling & Calendar
# -----------------------------------------------------------------------------
class GetInterviewerAvailabilityInput(BaseModel):
    interviewer_emails: List[str] = Field(..., min_length=1, description="Emails of interviewers")
    start_date: str = Field(..., description="Start date YYYY-MM-DD")
    end_date: str = Field(..., description="End date YYYY-MM-DD")
    duration_minutes: int = Field(45, ge=15, le=120)


class ScheduleInterviewInput(BaseModel):
    candidate_id: str = Field(..., description="Candidate ID")
    requisition_id: str = Field(..., description="Requisition ID")
    round_name: str = Field(..., description="Interview stage name, e.g. Technical Round 1")
    interviewer_email: str = Field(..., description="Email of primary interviewer")
    scheduled_time: str = Field(..., description="ISO 8601 UTC timestamp")
    duration_minutes: int = Field(45, ge=15, le=120)
    notes: Optional[str] = Field(None, description="Interview focus areas or instructions")


class RescheduleInterviewInput(BaseModel):
    interview_id: str = Field(..., description="Interview ID to reschedule")
    new_scheduled_time: str = Field(..., description="New ISO 8601 UTC timestamp")
    reschedule_reason: str = Field(..., min_length=5, description="Mandatory reason for rescheduling")


class CancelInterviewInput(BaseModel):
    interview_id: str = Field(..., description="Interview ID to cancel")
    cancellation_reason: str = Field(..., min_length=5, description="Mandatory cancellation reason")


class ListUpcomingInterviewsInput(BaseModel):
    limit: int = Field(10, ge=1, le=50)


# -----------------------------------------------------------------------------
# Domain 6: Interview Evaluation & Scorecards
# -----------------------------------------------------------------------------
class GetInterviewFeedbackInput(BaseModel):
    candidate_id: str = Field(..., description="Candidate ID")
    interview_id: Optional[str] = Field(None, description="Optional specific interview ID")


class GetSpeechAnalyticsSummaryInput(BaseModel):
    interview_id: str = Field(..., description="Interview ID with recorded transcript")


# -----------------------------------------------------------------------------
# Domain 7: Final Hiring Decisions
# -----------------------------------------------------------------------------
class RecommendHiringDecisionInput(BaseModel):
    candidate_id: str = Field(..., description="Candidate ID")
    requisition_id: str = Field(..., description="Requisition ID")


class AcceptCandidateOfferInput(BaseModel):
    candidate_id: str = Field(..., description="Candidate ID to accept")
    requisition_id: str = Field(..., description="Requisition ID")
    target_start_date: str = Field(..., description="Target start date YYYY-MM-DD")
    approved_rate: float = Field(..., gt=0, description="Agreed hourly or monthly billing rate")


# -----------------------------------------------------------------------------
# Domain 8: Candidate Portal & Access
# -----------------------------------------------------------------------------
class CheckCandidatePortalStatusInput(BaseModel):
    candidate_id: str = Field(..., description="Candidate ID")


class ResendPortalInvitationInput(BaseModel):
    candidate_id: str = Field(..., description="Candidate ID")


# -----------------------------------------------------------------------------
# Domain 9: Pre-Onboarding Tracking
# -----------------------------------------------------------------------------
class GetOnboardingPipelineInput(BaseModel):
    requisition_id: Optional[str] = Field(None, description="Optional requisition filter")


class GetOnboardingBlockersInput(BaseModel):
    candidate_id: Optional[str] = Field(None, description="Optional candidate filter")


# -----------------------------------------------------------------------------
# Domain 10: Contingent Workforce Roster
# -----------------------------------------------------------------------------
class ListActiveContractorsInput(BaseModel):
    project: Optional[str] = Field(None, description="Filter by project code")
    expiring_within_days: Optional[int] = Field(None, ge=1, le=90, description="Flag contracts ending soon")


# -----------------------------------------------------------------------------
# Domain 11: Timesheet Approvals
# -----------------------------------------------------------------------------
class ListPendingTimesheetsInput(BaseModel):
    limit: int = Field(20, ge=1, le=50)


class ApproveTimesheetInput(BaseModel):
    timesheet_id: str = Field(..., description="Timesheet ID to approve")
    approval_note: Optional[str] = Field(None, description="Optional approval comments")


class RejectTimesheetInput(BaseModel):
    timesheet_id: str = Field(..., description="Timesheet ID to reject")
    rejection_reason: str = Field(..., min_length=10, description="Mandatory detailed reason for rejection")


# -----------------------------------------------------------------------------
# Domain 12: Expense Claims
# -----------------------------------------------------------------------------
class ListPendingExpensesInput(BaseModel):
    limit: int = Field(20, ge=1, le=50)


class ApproveExpenseInput(BaseModel):
    expense_id: str = Field(..., description="Expense ID to approve")


class RejectExpenseInput(BaseModel):
    expense_id: str = Field(..., description="Expense ID to reject")
    rejection_reason: str = Field(..., min_length=10, description="Mandatory reason for rejection")


# -----------------------------------------------------------------------------
# Domain 13: Workplace Issues Desk
# -----------------------------------------------------------------------------
class ListContractorIssuesInput(BaseModel):
    severity: Optional[str] = Field(None, description="Severity: HIGH, MEDIUM, LOW")
    status: Optional[str] = Field(None, description="Status: OPEN, RESOLVED")


class ResolveContractorIssueInput(BaseModel):
    issue_id: str = Field(..., description="Issue ticket ID")
    resolution_notes: str = Field(..., min_length=15, description="Mandatory explanation of resolution")


# -----------------------------------------------------------------------------
# Domain 14: Hiring Analytics & KPIs
# -----------------------------------------------------------------------------
class GetHiringManagerKPIsInput(BaseModel):
    pass
