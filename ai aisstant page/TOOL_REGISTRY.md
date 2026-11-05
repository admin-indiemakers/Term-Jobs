# TermJobs AI Hiring Manager Assistant — Master Tool Registry

## 1. Registry Architecture & Security Specification

Every tool executed by the TermJobs AI Hiring Manager Assistant is registered using the Python `@hiring_tool` decorator. The execution engine enforces:
1. **Context Hydration**: Automatic injection of `ToolExecutionContext` containing `tenant_id`, `user_id`, `user_email`, `department`, and scoped `db_session`.
2. **Pydantic v2 Schema Validation**: Runtime validation of all arguments before handler execution.
3. **Tenant & HM Scoping**: Queries strictly filter by `tenant_id`. Modification operations verify that the authenticated HM owns or is assigned to the resource.
4. **Human-in-the-Loop Confirmation Gate**: Any tool with `requires_confirmation=True` automatically halts execution, generates a pending proposal record in MongoDB `agent_proposals`, and emits a confirmation card to the frontend.
5. **Immutable Audit Trail**: All operations are logged to the `ai_actions` collection.

---

## 2. Complete Tool Catalog by Domain (14 Domains / 35 Tools)

### Domain 1: Requisition Management

#### 1. `list_requisitions`
- **Purpose**: Retrieve requisitions owned by or accessible to the Hiring Manager.
- **Confirmation Required**: No (Read-Only)
- **Input Schema**:
  ```python
  class ListRequisitionsInput(BaseModel):
      status: Optional[str] = Field(None, description="Filter by status: DRAFT, PENDING_APPROVAL, OPEN, FILLED, CLOSED")
      department: Optional[str] = Field(None, description="Filter by department")
      search_term: Optional[str] = Field(None, description="Keyword search across title or skills")
      limit: int = Field(20, ge=1, le=50)
  ```
- **Backend Mapping**: `db["requisitions"].find({"tenant_id": ctx.tenant_id, "created_by": ctx.user_id, ...})`
- **UI Card**: `requisition_list_card`

#### 2. `get_requisition_details`
- **Purpose**: Fetch full details of a specific requisition including budget, required skills, and interview rounds.
- **Confirmation Required**: No (Read-Only)
- **Input Schema**:
  ```python
  class GetRequisitionDetailsInput(BaseModel):
      requisition_id: str = Field(..., description="Unique requisition ID")
  ```
- **Backend Mapping**: `db["requisitions"].find_one({"_id": ObjectId(requisition_id), "tenant_id": ctx.tenant_id})`
- **UI Card**: `requisition_detail_card`

#### 3. `create_requisition_draft`
- **Purpose**: Create a new draft job requisition.
- **Confirmation Required**: No (Non-destructive draft creation)
- **Input Schema**:
  ```python
  class CreateRequisitionDraftInput(BaseModel):
      title: str = Field(..., description="Job title")
      department: str = Field(..., description="Department")
      headcount: int = Field(1, ge=1)
      primary_skills: List[str] = Field(..., min_length=1)
      secondary_skills: Optional[List[str]] = Field(default_factory=list)
      min_experience_years: int = Field(0, ge=0)
      budget_max: float = Field(..., gt=0)
      work_mode: str = Field(..., description="Remote | Hybrid | Onsite")
      location: str = Field(..., description="City or region")
      description: Optional[str] = Field(None, description="Job description text")
  ```
- **Backend Mapping**: `db["requisitions"].insert_one(...)` with `status="DRAFT"`
- **UI Card**: `requisition_draft_card`

#### 4. `update_requisition_draft`
- **Purpose**: Modify fields of an existing draft requisition.
- **Confirmation Required**: No (Updating draft)
- **Input Schema**:
  ```python
  class UpdateRequisitionDraftInput(BaseModel):
      requisition_id: str
      updates: dict = Field(..., description="Fields to update (title, skills, budget, etc.)")
  ```
- **Backend Mapping**: `db["requisitions"].update_one({"_id": ObjectId(id), "status": "DRAFT", ...}, {"$set": updates})`
- **UI Card**: `requisition_draft_card`

#### 5. `submit_requisition_for_approval`
- **Purpose**: Submit a finalized draft to the Director for approval.
- **Confirmation Required**: **YES** (Submits formal corporate request)
- **Input Schema**:
  ```python
  class SubmitRequisitionInput(BaseModel):
      requisition_id: str
      justification_note: Optional[str] = Field(None, description="Business justification for Director")
  ```
- **Backend Mapping**: Transitions `status="DRAFT"` to `status="PENDING_APPROVAL"`. Creates approval notification for Director.
- **UI Card**: `proposal_confirmation_card` -> `requisition_status_badge`

#### 6. `close_requisition`
- **Purpose**: Close an open requisition (filled or cancelled).
- **Confirmation Required**: **YES** (Irreversible state change)
- **Input Schema**:
  ```python
  class CloseRequisitionInput(BaseModel):
      requisition_id: str
      closure_reason: str = Field(..., description="Reason for closure: FILLED, CANCELLED, RESTRUCTURED")
  ```
- **Backend Mapping**: `db["requisitions"].update_one(...)` with `status="CLOSED"`
- **UI Card**: `proposal_confirmation_card`

---

### Domain 2: Job Description & Skills AI

#### 7. `generate_enterprise_jd`
- **Purpose**: AI-powered generation of enterprise-standard job description markdown with responsibilities and qualifications.
- **Confirmation Required**: No (Content Generation)
- **Input Schema**:
  ```python
  class GenerateJDInput(BaseModel):
      title: str
      skills: List[str]
      experience_years: int
      work_mode: str
      role_context: Optional[str] = None
  ```
- **Backend Mapping**: Invokes configured LLM with enterprise JD prompt template.
- **UI Card**: `markdown_preview_card`

#### 8. `refine_skill_requirements`
- **Purpose**: Suggests categorized primary and secondary skills, seniority level, and adjacent skills for a given job title.
- **Confirmation Required**: No
- **Input Schema**:
  ```python
  class RefineSkillsInput(BaseModel):
      role_title: str
      raw_skills: List[str]
  ```
- **UI Card**: `skill_taxonomy_chip_group`

---

### Domain 3: Candidate Search & Screening

#### 9. `search_candidates`
- **Purpose**: Search and filter candidate submissions for a specific requisition or across the HM's pool.
- **Confirmation Required**: No (Read-Only)
- **Input Schema**:
  ```python
  class SearchCandidatesInput(BaseModel):
      requisition_id: Optional[str] = None
      min_match_score: Optional[int] = Field(None, ge=0, le=100)
      skills: Optional[List[str]] = None
      status: Optional[str] = None
      vendor_id: Optional[str] = None
      limit: int = Field(10, ge=1, le=30)
  ```
- **Backend Mapping**: `db["candidates"].find({"tenant_id": ctx.tenant_id, ...})`
- **UI Card**: `candidate_search_results_card`

#### 10. `get_candidate_profile`
- **Purpose**: Retrieve full candidate profile, parsed resume text, work history, and contact info.
- **Confirmation Required**: No (Read-Only)
- **Input Schema**:
  ```python
  class GetCandidateProfileInput(BaseModel):
      candidate_id: str
  ```
- **Backend Mapping**: `db["candidates"].find_one({"_id": ObjectId(candidate_id), "tenant_id": ctx.tenant_id})`
- **UI Card**: `candidate_dossier_card`

#### 11. `compare_candidates`
- **Purpose**: Generate a side-by-side comparison of 2 to 4 candidates against the requisition requirements.
- **Confirmation Required**: No (Read-Only Analytical)
- **Input Schema**:
  ```python
  class CompareCandidatesInput(BaseModel):
      candidate_ids: List[str] = Field(..., min_length=2, max_length=4)
      requisition_id: str
  ```
- **UI Card**: `candidate_comparison_table`

#### 12. `explain_ai_match_score`
- **Purpose**: Retrieve granular explanation of a candidate's AI match score (matched skills, missing skills, experience overlap).
- **Confirmation Required**: No (Read-Only Analytical)
- **Input Schema**:
  ```python
  class ExplainMatchScoreInput(BaseModel):
      candidate_id: str
      requisition_id: str
  ```
- **UI Card**: `match_score_breakdown_card`

---

### Domain 4: Candidate Shortlisting & Actions

#### 13. `shortlist_candidate`
- **Purpose**: Shortlist a candidate for interview rounds.
- **Confirmation Required**: **YES** (Advances candidate pipeline stage)
- **Input Schema**:
  ```python
  class ShortlistCandidateInput(BaseModel):
      candidate_id: str
      requisition_id: str
      shortlist_notes: Optional[str] = None
  ```
- **Backend Mapping**: `db["candidates"].update_one({"_id": ObjectId(id)}, {"$set": {"status": "SHORTLISTED"}})`
- **UI Card**: `proposal_confirmation_card`

#### 14. `reject_candidate`
- **Purpose**: Formally reject a candidate with mandatory structured feedback.
- **Confirmation Required**: **YES** (Consequential; triggers vendor notification)
- **Input Schema**:
  ```python
  class RejectCandidateInput(BaseModel):
      candidate_id: str
      requisition_id: str
      rejection_reason: str = Field(..., min_length=10, description="Mandatory detailed reason for rejection")
  ```
- **Backend Mapping**: `db["candidates"].update_one(..., {"$set": {"status": "REJECTED", "rejection_reason": ...}})`
- **UI Card**: `proposal_confirmation_card`

#### 15. `check_candidate_sla_status`
- **Purpose**: Check the 48-hour shortlist SLA status across all submitted candidates to flag impending breaches.
- **Confirmation Required**: No (Read-Only)
- **Input Schema**:
  ```python
  class CheckSLAStatusInput(BaseModel):
      requisition_id: Optional[str] = None
  ```
- **UI Card**: `sla_countdown_card`

---

### Domain 5: Interview Scheduling & Calendar

#### 16. `get_interviewer_availability`
- **Purpose**: Query available time slots for interviewers on a given date range.
- **Confirmation Required**: No (Read-Only)
- **Input Schema**:
  ```python
  class GetAvailabilityInput(BaseModel):
      interviewer_emails: List[str]
      start_date: str = Field(..., description="YYYY-MM-DD")
      end_date: str = Field(..., description="YYYY-MM-DD")
      duration_minutes: int = Field(45, ge=15, le=120)
  ```
- **Backend Mapping**: Integrates with Google Calendar service / FreeBusy API.
- **UI Card**: `calendar_slots_picker_card`

#### 17. `schedule_interview`
- **Purpose**: Schedule an interview round, reserve calendar slot, provision LiveKit room, and send invitations.
- **Confirmation Required**: **YES** (Sends external calendar invites)
- **Input Schema**:
  ```python
  class ScheduleInterviewInput(BaseModel):
      candidate_id: str
      requisition_id: str
      round_name: str = Field(..., description="e.g. 'Round 1 - Technical Screen'")
      interviewer_email: str
      scheduled_time: str = Field(..., description="ISO 8601 UTC timestamp")
      duration_minutes: int = Field(45, ge=15, le=120)
      notes: Optional[str] = None
  ```
- **Backend Mapping**: `db["interviews"].insert_one(...)`, LiveKit token generation, Google Calendar event creation.
- **UI Card**: `proposal_confirmation_card` -> `interview_scheduled_card`

#### 18. `reschedule_interview`
- **Purpose**: Reschedule an existing interview to a new slot.
- **Confirmation Required**: **YES** (Modifies calendar invites)
- **Input Schema**:
  ```python
  class RescheduleInterviewInput(BaseModel):
      interview_id: str
      new_scheduled_time: str = Field(..., description="ISO 8601 timestamp")
      reschedule_reason: str = Field(..., min_length=5)
  ```
- **UI Card**: `proposal_confirmation_card`

#### 19. `cancel_interview`
- **Purpose**: Cancel a scheduled interview with notification to participants.
- **Confirmation Required**: **YES** (Cancels external meeting)
- **Input Schema**:
  ```python
  class CancelInterviewInput(BaseModel):
      interview_id: str
      cancellation_reason: str = Field(..., min_length=5)
  ```
- **UI Card**: `proposal_confirmation_card`

#### 20. `list_upcoming_interviews`
- **Purpose**: Retrieve upcoming interviews scheduled for the Hiring Manager.
- **Confirmation Required**: No (Read-Only)
- **Input Schema**:
  ```python
  class ListInterviewsInput(BaseModel):
      limit: int = Field(10, ge=1, le=50)
  ```
- **UI Card**: `interview_agenda_card`

---

### Domain 6: Interview Evaluation & Scorecards

#### 21. `get_interview_feedback`
- **Purpose**: Retrieve interviewer scorecards, competency ratings, and notes for a candidate.
- **Confirmation Required**: No (Read-Only)
- **Input Schema**:
  ```python
  class GetFeedbackInput(BaseModel):
      candidate_id: str
      interview_id: Optional[str] = None
  ```
- **UI Card**: `evaluation_scorecard_card`

#### 22. `get_speech_analytics_summary`
- **Purpose**: Retrieve AI-transcribed interview highlights, sentiment, and competency question analytics if recorded.
- **Confirmation Required**: No (Read-Only)
- **Input Schema**:
  ```python
  class GetSpeechAnalyticsInput(BaseModel):
      interview_id: str
  ```
- **UI Card**: `speech_analytics_card`

---

### Domain 7: Final Hiring Decisions

#### 23. `recommend_hiring_decision`
- **Purpose**: Synthesizes all candidate screening scores, interview evaluations, and feedback into a data-driven recommendation.
- **Confirmation Required**: No (Analytical Advice)
- **Input Schema**:
  ```python
  class RecommendHiringInput(BaseModel):
      candidate_id: str
      requisition_id: str
  ```
- **UI Card**: `hiring_recommendation_card`

#### 24. `accept_candidate_offer`
- **Purpose**: Formally accept a candidate for hire, advancing them to ACCEPTED status and queuing the Work Order.
- **Confirmation Required**: **YES** (Crucial business milestone)
- **Input Schema**:
  ```python
  class AcceptCandidateInput(BaseModel):
      candidate_id: str
      requisition_id: str
      target_start_date: str = Field(..., description="YYYY-MM-DD")
      approved_rate: float = Field(..., gt=0)
  ```
- **Backend Mapping**: `db["candidates"].update_one(..., {"$set": {"status": "ACCEPTED"}})`
- **UI Card**: `proposal_confirmation_card`

---

### Domain 8: Candidate Portal & Access

#### 25. `check_candidate_portal_status`
- **Purpose**: Check if a candidate has activated their portal account and completed initial onboarding steps.
- **Confirmation Required**: No (Read-Only)
- **Input Schema**:
  ```python
  class CheckPortalStatusInput(BaseModel):
      candidate_id: str
  ```
- **UI Card**: `candidate_portal_badge`

#### 26. `resend_portal_invitation`
- **Purpose**: Resend candidate portal activation email.
- **Confirmation Required**: **YES** (Triggers email dispatch)
- **Input Schema**:
  ```python
  class ResendPortalInviteInput(BaseModel):
      candidate_id: str
  ```
- **UI Card**: `proposal_confirmation_card`

---

### Domain 9: Pre-Onboarding Tracking

#### 27. `get_onboarding_pipeline`
- **Purpose**: Retrieve list of accepted candidates progressing through pre-onboarding.
- **Confirmation Required**: No (Read-Only)
- **Input Schema**:
  ```python
  class GetOnboardingPipelineInput(BaseModel):
      requisition_id: Optional[str] = None
  ```
- **UI Card**: `onboarding_pipeline_card`

#### 28. `get_onboarding_blockers`
- **Purpose**: Identify bottlenecks in BGV, equipment provisioning, or SOW signing for accepted candidates.
- **Confirmation Required**: No (Read-Only)
- **Input Schema**:
  ```python
  class GetOnboardingBlockersInput(BaseModel):
      candidate_id: Optional[str] = None
  ```
- **UI Card**: `blockers_alert_card`

---

### Domain 10: Contingent Workforce Management

#### 29. `list_active_contractors`
- **Purpose**: List active contingent workers assigned to the Hiring Manager's team.
- **Confirmation Required**: No (Read-Only)
- **Input Schema**:
  ```python
  class ListContractorsInput(BaseModel):
      project: Optional[str] = None
      expiring_within_days: Optional[int] = Field(None, ge=1, le=90)
  ```
- **UI Card**: `contractor_roster_card`

---

### Domain 11: Timesheet Approvals

#### 30. `list_pending_timesheets`
- **Purpose**: Retrieve all submitted timesheets awaiting the Hiring Manager's signoff.
- **Confirmation Required**: No (Read-Only)
- **Input Schema**:
  ```python
  class ListTimesheetsInput(BaseModel):
      limit: int = Field(20, ge=1, le=50)
  ```
- **UI Card**: `timesheet_review_list_card`

#### 31. `approve_timesheet`
- **Purpose**: Approve a contractor's weekly logged hours.
- **Confirmation Required**: **YES** (Authorizes financial liability)
- **Input Schema**:
  ```python
  class ApproveTimesheetInput(BaseModel):
      timesheet_id: str
      approval_note: Optional[str] = None
  ```
- **UI Card**: `proposal_confirmation_card`

#### 32. `reject_timesheet`
- **Purpose**: Reject a submitted timesheet with mandatory reason so the contractor can correct hours.
- **Confirmation Required**: **YES** (Halts payroll processing)
- **Input Schema**:
  ```python
  class RejectTimesheetInput(BaseModel):
      timesheet_id: str
      rejection_reason: str = Field(..., min_length=10, description="Mandatory detailed reason for rejection")
  ```
- **UI Card**: `proposal_confirmation_card`

---

### Domain 12: Expense Claims

#### 33. `list_pending_expenses`
- **Purpose**: List expense claims submitted by contractors awaiting review.
- **Confirmation Required**: No (Read-Only)
- **Input Schema**:
  ```python
  class ListExpensesInput(BaseModel):
      limit: int = Field(20, ge=1, le=50)
  ```
- **UI Card**: `expense_review_list_card`

#### 34. `approve_expense`
- **Purpose**: Approve an expense claim after verifying receipt validity.
- **Confirmation Required**: **YES** (Authorizes reimbursement payout)
- **Input Schema**:
  ```python
  class ApproveExpenseInput(BaseModel):
      expense_id: str
  ```
- **UI Card**: `proposal_confirmation_card`

#### 35. `reject_expense`
- **Purpose**: Reject an expense claim with a mandatory reason (e.g. missing receipt, out-of-policy).
- **Confirmation Required**: **YES** (Denies reimbursement)
- **Input Schema**:
  ```python
  class RejectExpenseInput(BaseModel):
      expense_id: str
      rejection_reason: str = Field(..., min_length=10, description="Mandatory reason for rejection")
  ```
- **UI Card**: `proposal_confirmation_card`

---

### Domain 13: Workplace Issues Desk

#### 36. `list_contractor_issues`
- **Purpose**: Retrieve workplace issues or tickets logged regarding contractors.
- **Confirmation Required**: No (Read-Only)
- **Input Schema**:
  ```python
  class ListIssuesInput(BaseModel):
      severity: Optional[str] = Field(None, description="HIGH, MEDIUM, LOW")
      status: Optional[str] = Field(None, description="OPEN, RESOLVED")
  ```
- **UI Card**: `issues_desk_card`

#### 37. `resolve_contractor_issue`
- **Purpose**: Formally resolve an issue ticket with mandatory resolution documentation.
- **Confirmation Required**: **YES** (Closes formal issue ticket)
- **Input Schema**:
  ```python
  class ResolveIssueInput(BaseModel):
      issue_id: str
      resolution_notes: str = Field(..., min_length=15, description="Mandatory documentation of how issue was resolved")
  ```
- **UI Card**: `proposal_confirmation_card`

---

### Domain 14: Hiring Analytics & KPIs

#### 38. `get_hiring_manager_kpis`
- **Purpose**: Retrieve aggregate executive stats for the HM (Open Reqs, Pending Candidates, SLA at risk, Timesheets pending).
- **Confirmation Required**: No (Read-Only)
- **Input Schema**:
  ```python
  class GetKPIsInput(BaseModel):
      pass
  ```
- **UI Card**: `hm_kpi_overview_card`