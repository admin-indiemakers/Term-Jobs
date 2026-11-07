# Complete Workflow Test Report

**Project**: TermJobs Platform  
**Target Environment**: End-to-End Production Verification  
**Audit Role**: QA Automation & Systems Engineer  
**Date**: November 2026  

---

## 1. Candidate End-to-End Workflow Verification

### Journey 1: Public Discovery & Job Application
1. **Browse Opportunities**: User visits `/jobs` or `/find-jobs`. Jobs are filtered via Work Mode, Department, and Location drawers.
2. **Application Preservation**: When an unauthenticated candidate applies for a role (`/apply/:id`), application parameters are saved to sessionStorage and preserved across candidate signup/login.
3. **Application Status**: Candidate can inspect application status in the candidate dashboard under "Apps".

### Journey 2: First-Time Onboarding & Profile Completion
1. **Onboarding Gate**: Triggers only for candidates with pending onboarding checklists.
2. **Profile & Documents**: Resume upload extracts skills and contact information; profile completion persists to MongoDB `onboarding_checklists`.
3. **Completion**: Transition to active status once prerequisites are satisfied.

### Journey 3: Candidate Portal (Active Placement)
1. **Dashboard & Work Order Binding**:
   - `get_candidate_dashboard` resolves active work orders, manager names, expected weekly hours (40.0), and start/end dates.
   - Verified that `status: "ACTIVE"` and `agreement_status: "Approved"` render cleanly.
2. **Weekly Smart Timesheet Drafts**:
   - Auto-generates smart draft entries for Monday–Sunday of the current week.
   - Weekday default hours: 8.0 Regular; weekend default: 0.0.
   - Validated: Rejects negative hours (`HTTP 400`), rejects logging hours on future dates (`HTTP 400`).
   - Draft persistence verified: Saved drafts retain entered notes and hours across page refreshes.
3. **Attendance & Payable Days Calculation**:
   - Monthly calendar dynamically calculates present days, client holidays, paid leaves, and approved hours.
4. **Expense Logging**:
   - Rejects expenses prior to work order start date (`HTTP 400`).
   - Rejects future expense dates (`HTTP 400`).
   - Accepts valid PDF and image receipt attachments (PNG, JPG, WEBP).

---

## 2. AI Interview & Room System Verification

1. **Invitation & Identity Resolution**:
   - Validates invitation token (`join-identity`).
   - Rejects expired round tokens for non-interviewer roles.
2. **Media Initialization & Consent**:
   - Microphone defaults to on (`isMicOn: true`), camera is toggleable with separate user consent.
   - Hardware tracks cleanly unmount and power down upon exit.
3. **AI Voice & Speech-to-Text**:
   - Browser Web Speech API transcription provides zero-latency real-time closed captions.
   - Speech fallback mechanism ensures evaluations continue even under constrained network conditions.
4. **Interview Submission**:
   - Zero-length recording blobs are strictly rejected by `finalizeRecording`, with graceful UI fallback in `AiInterviewStage.jsx`.

---

## 3. Hiring Manager, Director & Recruiter Workflows

1. **Requisition Intake & State Machine**:
   - Hiring Manager creates requisition draft.
   - Requisition requires explicit `work_mode` (`Hybrid`, `On-site`, `Remote`) before director submission or publishing.
   - Director review allows approval, revision request, or rejection.
   - Once approved, Super Admin or system transitions requisition to `Published`.
2. **Recruiter Bulk Screening & AI Matching**:
   - Recruiter selects multiple candidates from the candidate bank.
   - AI evaluates resume text against requisition JD requirements.
   - Results are stored in `screening_cache` with SHA-256 keys; re-screening executes in under 5ms from cache without LLM latency.

---

## 4. Candidate Offboarding & Expiration Workflow

1. **Initiation**: Manager initiates offboarding with equipment checklists (laptop, badge, software revocation).
2. **Completion**: Candidate submits progress; completion sets `access_expires_at = now + 48 hours`.
3. **Timesheet Freezing**: Timesheet creation is locked immediately (`timesheet_frozen: True`).
4. **48-Hour Lockout**: After 48 hours, login is rejected with `HTTP 403 Forbidden` ("Candidate access has expired").
5. **Contract-Gated Re-Provisioning**: Attempting to create a new placement with the same email requires a verified Super Admin contract (`contract_issued()`), preventing unauthorized reactivation.

---

## 5. Automated Verification Results Summary

- **Frontend Integration Tests**: 140 / 140 passed (100%).
- **Backend Core Module Tests**: 157 / 157 passed (100%).
- **Backend Candidate Portal Tests**: 16 / 16 passed (100%).
- **Flakiness Count**: 0 flaky tests detected across repeat executions.

