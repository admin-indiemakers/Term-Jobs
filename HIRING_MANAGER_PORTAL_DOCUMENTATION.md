# HIRING MANAGER PORTAL — COMPLETE SYSTEM AUDIT & ARCHITECTURE SPECIFICATION
**Repository:** Term-Jobs  
**System Role:** Hiring Manager  
**Audit Status:** Complete Source-Code Level Audit  
**Document Classification:** Single Source of Truth (SSOT) for Redesign & Re-engineering  

---

## CONVENTIONS USED IN THIS DOCUMENT
- `[IMPLEMENTED]`: Confirmed directly from active repository code (frontend components, backend routers, services, models).
- `[INFERRED]`: Highly probable architectural intent derived from correlated code patterns and standard workflows.
- `[NEEDS CLARIFICATION]`: Ambiguous or incomplete code path that requires architectural/product confirmation before modifying.

---

# 1. ENTIRE PROJECT ARCHITECTURE

### 1.1 Technical Stack & Frameworks
- **Frontend Framework `[IMPLEMENTED]`:** React 19 (`react: ^19.0.0`, `react-dom: ^19.0.0`) bootstrapped with **Vite 6** (`@vitejs/plugin-react: ^4.3.4`).
- **Routing `[IMPLEMENTED]`:** `react-router-dom` v7 (`^7.2.0`) utilizing client-side SPA routing (`BrowserRouter`, `Routes`, `Route`, `Navigate`).
- **UI & Styling `[IMPLEMENTED]`:** Vanilla CSS / Modern CSS Modules augmented with Tailwind CSS (`tailwindcss: ^3.4.17`, `autoprefixer: ^10.4.20`, `postcss: ^8.4.49`), with Lucide React icons (`lucide-react: ^0.475.0`).
- **Real-Time WebRTC Media `[IMPLEMENTED]`:** `livekit-client` (`^2.9.1`) for live interview video and audio channels.
- **Backend Framework `[IMPLEMENTED]`:** **FastAPI** (`fastapi>=0.115.0`) on Python 3.11+, managed via `uv` package manager (`pyproject.toml`).
- **HTTP Server `[IMPLEMENTED]`:** `uvicorn[standard]>=0.32.0` with asynchronous event loop (`asyncio`).
- **Database Layer `[IMPLEMENTED]`:** **MongoDB Atlas** (and local MongoDB) queried via `pymongo` (`motor>=3.6.0`, `pymongo>=4.9.0`), wrapped by a custom SQLAlchemy-compatible session abstraction layer located in `backend/modules/shared/db.py` (`Session`, `query()`, `filter()`).
- **LLM / AI Orchestration `[IMPLEMENTED]`:** **Groq Cloud API** (`groq>=0.11.0` and raw `httpx>=0.27.0` clients) powering the Hiring Manager Agent, Resume Screener, Requisition AI Structurer, and Candidate Scoring.
- **Background Tasks & Bots `[IMPLEMENTED]`:** Native `asyncio` background workers, Telegram Bot long-polling daemon (`python-telegram-bot>=21.6` via `backend/modules/hm_telegram_bot/`), and FastAPI `BackgroundTasks`.

### 1.2 End-to-End Architectural Layering
```
┌─────────────────────────────────────────────────────────────────────────┐
│                     FRONTEND SPA (React 19 + Vite)                      │
│   Pages: Dashboard, Chat, Requisitions, Candidates, Interviews, Workforce│
│   Contexts: AuthContext, ThemeContext                                    │
│   HTTP Client: frontend/src/api/client.js (JWT injection, error mapping)│
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ HTTP / REST & WebSockets
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       FASTAPI APPLICATION (main.py)                     │
│   Middleware: CORSMiddleware, GZipMiddleware, Custom Exception Handlers │
│   Auth Dependency: get_current_user (Bearer JWT, Role & Tenant checks)  │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
           ┌─────────────────────────┼─────────────────────────┐
           ▼                         ▼                         ▼
┌─────────────────────┐   ┌─────────────────────┐   ┌─────────────────────┐
│  REQUISITIONS &     │   │ INTERVIEWS & AI     │   │ WORKFORCE & EXPENSES│
│  CANDIDATE POOL     │   │ SPEECH ANALYTICS    │   │ (Timesheets, Team,  │
│  (modules/candidate,│   │ (modules/interview, │   │  Work Orders)       │
│   modules/requisition)   modules/resume_screener)  (modules/workforce) │
└──────────┬──────────┘   └──────────┬──────────┘   └──────────┬──────────┘
           │                         │                         │
           ▼                         ▼                         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    PERSISTENCE & INTEGRATIONS LAYER                     │
│  • MongoDB Collections: candidate_submissions, requisitions, work_orders│
│  • SQLAlchemy-like Session: modules/shared/db.py (Tenants, Users)      │
│  • Groq Cloud API: LLaMA 3.3 70B Versatile (Agent Tools & Analytics)    │
│  • LiveKit Cloud: WebRTC Video / Audio Token Issuer                     │
│  • Telegram Bot Daemon: modules/hm_telegram_bot/bot.py                  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

# 2. COMPLETE HIRING MANAGER SCOPE

The Hiring Manager (HM) is an internal hiring authority responsible for departmental staffing, requisition creation, candidate evaluation, interview orchestration, and contractor oversight.

### 2.1 Complete Route & Page Registry
| Route | Frontend Component File | Navigation Group | Required Role | Backend APIs Interfaced |
|---|---|---|---|---|
| `/dashboard/hiring-manager` | `frontend/src/pages/HiringManagerDashboard.jsx` | WORKSPACE | `Hiring Manager` | `GET /api/workforce/stats`, `GET /api/candidates`, `GET /api/requisitions`, `GET /api/interviews/summary`, `GET /api/onboarding/issues` |
| `/dashboard/hiring-manager/chat` | `frontend/src/pages/HiringManagerChat.jsx` | WORKSPACE | `Hiring Manager` | `POST /api/hiring-manager/agent/chat` |
| `/dashboard/requisitions` | `frontend/src/pages/requisitions/RequisitionOverview.jsx` | HIRING | `Hiring Manager` | `GET /api/requisitions` |
| `/dashboard/requisitions/new` | `frontend/src/pages/requisitions/NewRequisition.jsx` | HIRING | `Hiring Manager` | `POST /api/requisitions`, `POST /api/requisitions/ai-structure` |
| `/dashboard/requisitions/:id` | `frontend/src/pages/requisitions/RequisitionDetail.jsx` | HIRING | `Hiring Manager` | `GET /api/requisitions/{id}`, `POST /api/requisitions/{id}/approve`, `POST /api/requisitions/{id}/publish` |
| `/dashboard/candidates` | `frontend/src/pages/candidates/RequisitionCandidates.jsx` | CANDIDATES | `Hiring Manager` | `GET /api/candidates`, `POST /api/candidates/shortlist`, `POST /api/interviews/candidates/{id}/decision` |
| `/dashboard/interviews` | `frontend/src/interview/pages/HiringManagerInterviews.jsx` | CANDIDATES | `Hiring Manager` | `GET /api/interviews/rounds`, `GET /api/interviews/summary`, `POST /api/interviews/rounds`, `POST /api/interviews/candidates/{id}/decision`, `GET /api/interviews/rounds/{id}/recording` |
| `/dashboard/candidates/issues` | `frontend/src/pages/candidates/ReportedIssues.jsx` | CANDIDATES | `Hiring Manager` | `GET /api/onboarding/issues`, `PATCH /api/onboarding/issues/{id}` |
| `/dashboard/candidates/portal-access` | `frontend/src/pages/candidates/CandidatePortalAccess.jsx` | CANDIDATES | `Hiring Manager` | `GET /api/auth/portal-users`, `POST /api/auth/portal-users/{id}/resend-invite` |
| `/dashboard/workforce/team` | `frontend/src/pages/workforce/TeamOverview.jsx` | WORKFORCE | `Hiring Manager` | `GET /api/workforce/team`, `GET /api/workforce/team/{id}` |
| `/dashboard/workforce/timesheets` | `frontend/src/pages/workforce/TimesheetApprovals.jsx` | WORKFORCE | `Hiring Manager` | `GET /api/workforce/timesheets`, `POST /api/workforce/timesheets/{id}/approve`, `POST /api/workforce/timesheets/{id}/reject` |
| `/dashboard/workforce/expenses` | `frontend/src/pages/workforce/ExpenseApprovals.jsx` | WORKFORCE | `Hiring Manager` | `GET /api/workforce/expenses`, `POST /api/workforce/expenses/{id}/approve`, `POST /api/workforce/expenses/{id}/reject` |

---

# 3. HIRING MANAGER ROUTE MAP

```
Hiring Manager Portal (/dashboard)
│
├── [WORKSPACE]
│   ├── Dashboard (/dashboard/hiring-manager)
│   └── Hiring AI Chat (/dashboard/hiring-manager/chat)
│
├── [HIRING]
│   ├── Requisition Overview (/dashboard/requisitions)
│   │   ├── Published Tab (/dashboard/requisitions/published)
│   │   ├── Pending Approval Tab (/dashboard/requisitions/pending-approval)
│   │   ├── Drafted Tab (/dashboard/requisitions/drafted)
│   │   ├── Completed Tab (/dashboard/requisitions/completed)
│   │   └── History Tab (/dashboard/requisitions/history)
│   ├── Create Requisition (/dashboard/requisitions/new)
│   └── Requisition Detail & Edit (/dashboard/requisitions/:id)
│
├── [CANDIDATES]
│   ├── Candidate Pool (/dashboard/candidates)
│   ├── Interviews & AI Scores (/dashboard/interviews)
│   ├── Reported Issues (/dashboard/candidates/issues)
│   └── Portal Access (/dashboard/candidates/portal-access)
│
└── [WORKFORCE]
    ├── Team Overview (/dashboard/workforce/team)
    ├── Timesheets (/dashboard/workforce/timesheets)
    └── Expenses (/dashboard/workforce/expenses)
```

---

# 4. TRACE OF ACTUAL DATA FLOWS

### 4.1 Flow: Loading Hiring Manager Dashboard
1. **User Action `[IMPLEMENTED]`:** HM navigates to `/dashboard/hiring-manager`.
2. **Component Init `[IMPLEMENTED]`:** `HiringManagerDashboard.jsx` mounts; checks `user.role === 'Hiring Manager'` via `AuthContext`.
3. **Parallel API Dispatch `[IMPLEMENTED]`:**
   - `GET /api/workforce/stats`
   - `GET /api/requisitions`
   - `GET /api/candidates?status=Shortlisted`
   - `GET /api/interviews/summary`
   - `GET /api/onboarding/issues`
4. **Backend Processing `[IMPLEMENTED]`:**
   - `get_current_user` validates Bearer JWT and extracts `user.id`, `user.role`, and `user.tenant_id`.
   - In `backend/main.py`, requisitions are filtered: `models.Requisition.created_by == current_user.id` and `models.Requisition.tenant_id == current_user.tenant_id`.
   - In `backend/modules/workforce/router.py`, stats aggregation combines counts across `candidate_submissions` (statuses `Accepted`, `Hired`, `Shortlisted`) and `work_orders`.
5. **Frontend State Hydration `[IMPLEMENTED]`:** Sets `stats`, `urgentApprovals`, `activePipelines`, and `recentCandidates`.
6. **UI Rendering `[IMPLEMENTED]`:** Displays KPI metrics, Action Attention queue, Active Pipeline breakdown, and Recent Candidate profiles.

### 4.2 Flow: Candidate Decision (Accept & Onboard / Reject)
1. **User Action `[IMPLEMENTED]`:** On `/dashboard/interviews` or `/dashboard/candidates`, HM clicks **Accept & Onboard** or **Reject**.
2. **API Dispatch `[IMPLEMENTED]`:** `POST /api/interviews/candidates/{candidate_id}/decision` with body:
   ```json
   {
     "decision": "Accepted",
     "notes": "Strong system design capabilities and communicative skills",
     "requisition_id": "req-123"
   }
   ```
3. **Backend Service Execution `[IMPLEMENTED]` (`modules/interview/router.py` lines 880-970):**
   - Resolves submission in `db["candidate_submissions"]`.
   - Updates status: `"Accepted"` (or `"Rejected"`).
   - Generates work order shell in `db["work_orders"]` with status `"Draft"`.
   - Initializes onboarding checklist records in `db["onboarding_checklists"]`.
   - Automatically provisions portal credentials in `db["candidate_portal_users"]`.
4. **Response `[IMPLEMENTED]`:** `{ "status": "success", "candidate_id": "...", "onboarding_status": "Initialized" }`.
5. **Frontend State Update `[IMPLEMENTED]`:** Re-fetches interview rounds and candidate pool; shows success toast: `"Candidate accepted and moved to Onboarding."`

---

# 5. DATABASE / DATA MODEL

The system utilizes MongoDB Atlas through both native PyMongo collection drivers and a custom SQLAlchemy-compatible Session wrapper located in `backend/modules/shared/db.py`.

```
┌──────────────────┐           1:N           ┌──────────────────┐
│   Tenant / Org   ├─────────────────────────►   User (HM/Dir)  │
└────────┬─────────┘                         └────────┬─────────┘
         │                                            │
         │ 1:N                                        │ 1:N (created_by)
         ▼                                            ▼
┌──────────────────┐           1:N           ┌──────────────────┐
│   Requisition    ├─────────────────────────►CandidateSubmission
└────────┬─────────┘                         └────────┬─────────┘
         │                                            │
         │ 1:N                                        │ 1:N
         ▼                                            ▼
┌──────────────────┐           1:1           ┌──────────────────┐
│  InterviewRound  ├─────────────────────────► WorkOrder/Worker │
└────────┬─────────┘                         └────────┬─────────┘
         │                                            │
         ▼                                            ▼
┌──────────────────┐                         ┌──────────────────┐
│Speech Analytics  │                         │Timesheet / Expense
└──────────────────┘                         └──────────────────┘
```

### 5.1 Primary Entities & Attributes
1. **`User` (Entity: `modules.identity.domain.models.User`) `[IMPLEMENTED]`:**
   - Fields: `id`, `email`, `hashed_password`, `name`, `role` (`"Hiring Manager"`), `tenant_id`, `is_active`, `telegram_chat_id`, `created_at`.
2. **`Requisition` (Entity: `modules.requisition.domain.models.Requisition`) `[IMPLEMENTED]`:**
   - Fields: `id`, `tenant_id`, `created_by`, `role_title`, `department`, `status` (`Draft`, `Pending Approval`, `Published`, `Completed`), `skills`, `target_rate`, `min_experience`, `openings_count`, `budget`, `work_mode`.
3. **`CandidateSubmission` (Collection: `candidate_submissions`) `[IMPLEMENTED]`:**
   - Fields: `_id`, `requisition_id`, `tenant_id`, `candidate_name`, `email`, `phone`, `vendor_id`, `resume_url`, `status` (`Submitted`, `Screened`, `Shortlisted`, `Interviewing`, `Accepted`, `Rejected`), `ai_match_score`, `ai_evaluation_notes`.
4. **`InterviewRound` (Collection: `interview_rounds`) `[IMPLEMENTED]`:**
   - Fields: `_id`, `candidate_id`, `requisition_id`, `round_number`, `round_type`, `scheduled_at`, `status` (`Scheduled`, `In-Progress`, `Completed`, `Cancelled`), `interviewer_name`, `evaluation_verdict`, `communication_score`, `recording_url`.
5. **`WorkOrder` (Collection: `work_orders`) `[IMPLEMENTED]`:**
   - Fields: `_id`, `candidate_id`, `requisition_id`, `tenant_id`, `status` (`Draft`, `Procurement_Review`, `Active`), `hourly_rate`, `start_date`, `end_date`.
6. **`Timesheet` (Collection: `timesheets`) `[IMPLEMENTED]`:**
   - Fields: `_id`, `candidate_id`, `tenant_id`, `week_start`, `week_end`, `total_hours`, `status` (`Draft`, `Submitted`, `Approved`, `Rejected`), `daily_breakdown`, `rejection_reason`.
7. **`Expense` (Collection: `expenses`) `[IMPLEMENTED]`:**
   - Fields: `_id`, `candidate_id`, `tenant_id`, `amount`, `currency`, `category`, `status` (`Submitted`, `Approved`, `Rejected`), `receipt_url`, `description`.

---

# 6. BUSINESS WORKFLOWS & LOGIC

### 6.1 Requisition Creation & Director Approval Gate
- **Drafting `[IMPLEMENTED]`:** HM fills 6 tabs in `NewRequisition.jsx`.
- **Approval Evaluation `[IMPLEMENTED]`:** In `backend/main.py`, if the requisition requires senior signoff or exceeds budget limits, it moves to `Pending Approval`.
- **Director Review `[IMPLEMENTED]`:** The Director approves via `/api/requisitions/{id}/approve`, transitioning the requisition status to `Published`.
- **Publishing & Distribution `[IMPLEMENTED]`:** Once published, automated notifications alert registered staffing vendors to submit candidate resumes.

### 6.2 48-Hour Shortlisting SLA
- **Countdown Timer `[IMPLEMENTED]`:** Displayed on candidate lists (`formatCountdown`).
- **Vendor Submission SLA `[IMPLEMENTED]`:** Vendors must submit candidate profiles within 48 hours of requisition publication.
- **Shortlist Lock & Release `[IMPLEMENTED]`:** HM can trigger `POST /api/requisitions/{id}/shortlist/send-now` to lock submissions and advance screened candidates into technical interview rounds immediately.

### 6.3 Timesheet & Expense Approvals
- **HM Oversight `[IMPLEMENTED]`:** Contractors submit weekly timesheets via the Candidate Portal.
- **Approval Actions `[IMPLEMENTED]`:** In `TimesheetApprovals.jsx`, HM clicks **Approve** (`POST /api/workforce/timesheets/{id}/approve`) or **Reject** with a mandatory reason note.
- **Financial Handoff `[IMPLEMENTED]`:** Approved timesheets propagate to Finance / Invoicing (`db["finance_work_orders"]`).

---

# 7. HIRING MANAGER USER JOURNEY

```
1. Authenticate (Email & Password / Role: Hiring Manager)
   ↓
2. Landing on HM Dashboard (/dashboard/hiring-manager)
   • Reviews Active Hiring Requisitions & Urgent Action Queue
   ↓
3. Requisition Management
   • Creates Requisition via 6-tab wizard or AI Structurer
   • Monitors Director Approval state
   ↓
4. Candidate Screening & Shortlisting
   • Reviews AI-ranked candidate pool
   • Evaluates match breakdown (Skills, Experience, Rates)
   ↓
5. Interview Management & AI Speech Analytics
   • Schedules technical/managerial rounds
   • Listens to WebM recording playback
   • Reviews AI WPM cadence, filler word percentage, and confidence metrics
   ↓
6. Final Decision & Handoff
   • Clicks "Accept & Onboard"
   • System creates Work Order shell and notifies Candidate
   ↓
7. Workforce Supervision
   • Approves weekly contractor Timesheets
   • Approves contractor Expense claims
   • Tracks reported onboarding blockers
```

---

# 8. PAGE-BY-PAGE DEEP AUDIT

## 8.1 PAGE: Hiring Manager Dashboard
- **Route `[IMPLEMENTED]`:** `/dashboard/hiring-manager`
- **Frontend File `[IMPLEMENTED]`:** `frontend/src/pages/HiringManagerDashboard.jsx`
- **Purpose `[IMPLEMENTED]`:** Mission-control cockpit for tracking open requisitions, interview pipeline, urgent approvals, and workforce health.
- **Main APIs `[IMPLEMENTED]`:**
  - `GET /api/workforce/stats`
  - `GET /api/candidates?status=Shortlisted`
  - `GET /api/requisitions`
  - `GET /api/interviews/summary`
  - `GET /api/onboarding/issues`
- **Data Displayed `[IMPLEMENTED]`:** Total Requisitions, Published Count, Shortlisted Candidates, Accepted Candidates, Active Contractors, Urgent Approvals Queue, Active Requisition Progress Cards.
- **Information Priority:**
  - **CRITICAL:** Urgent Approvals (Pending Timesheets, Issues), Active Requisitions count.
  - **IMPORTANT:** Candidate pipeline stats, upcoming interviews.
  - **SECONDARY:** Historical completed requisitions, generic onboarding stats.
  - **OPTIONAL:** Decorative charts with static summary data.
- **UX Observations `[IMPLEMENTED]`:** Highly informative but visually dense; cards on small laptops require vertical scrolling to access pipeline status.

## 8.2 PAGE: Hiring AI Chat
- **Route `[IMPLEMENTED]`:** `/dashboard/hiring-manager/chat`
- **Frontend File `[IMPLEMENTED]`:** `frontend/src/pages/HiringManagerChat.jsx`
- **Purpose `[IMPLEMENTED]`:** Conversational AI copilot enabling voice and text interaction to draft requisitions, query candidates, schedule interviews, and audit timesheets.
- **Main APIs `[IMPLEMENTED]`:** `POST /api/hiring-manager/agent/chat`
- **Features `[IMPLEMENTED]`:**
  - Two-way Web Speech Synthesis & Recognition (STT/TTS) with VAD (Voice Activity Detection).
  - 7 Interactive UI Widgets dynamically mounted on the right panel based on tool outputs.
- **Information Priority:**
  - **CRITICAL:** Active Widget display (draft form, candidate profile, timesheet table).
  - **IMPORTANT:** Chat message history, input prompt bar.
  - **SECONDARY:** Voice customization controls (pitch, speed, Priya/David voice picker).
  - **OPTIONAL:** Suggested quick prompt pill chips.

## 8.3 PAGE: Requisition Overview
- **Route `[IMPLEMENTED]`:** `/dashboard/requisitions` (and subtabs: `/published`, `/pending-approval`, `/drafted`, `/completed`, `/history`)
- **Frontend File `[IMPLEMENTED]`:** `frontend/src/pages/requisitions/RequisitionOverview.jsx`
- **Purpose `[IMPLEMENTED]`:** Central directory for searching, filtering, and tracking requisitions by status lifecycle.
- **Main APIs `[IMPLEMENTED]`:** `GET /api/requisitions`
- **Data Displayed `[IMPLEMENTED]`:** Requisition title, department, engagement type, openings count, applicants count, creation date, status pill badge.
- **Actions `[IMPLEMENTED]`:** Create Requisition, View Details, Delete Draft, Filter by department/status.
- **Information Priority:**
  - **CRITICAL:** Requisition Title, Status pill, Openings/Applicant counter, Action button.
  - **IMPORTANT:** Department, Target rate, Experience level.
  - **SECONDARY:** Creation date, location type.
  - **OPTIONAL:** Detailed engagement metadata.

## 8.4 PAGE: Create Requisition
- **Route `[IMPLEMENTED]`:** `/dashboard/requisitions/new`
- **Frontend File `[IMPLEMENTED]`:** `frontend/src/pages/requisitions/NewRequisition.jsx`
- **Purpose `[IMPLEMENTED]`:** Comprehensive 6-tab form for defining new job parameters and initiating hiring.
- **Main APIs `[IMPLEMENTED]`:**
  - `POST /api/requisitions`
  - `POST /api/requisitions/ai-structure`
- **Form Structure (6 Tabs) `[IMPLEMENTED]`:**
  1. `role`: Title, Seniority, Department, Primary Skills, Secondary Skills, Min/Max Experience, Description.
  2. `engagement`: Engagement Type (Contract/C2H/Full-time), Duration, Start Date, End Date, Headcount.
  3. `commercials`: Currency, Bill Rate, Min/Max Rate, Unit (hourly/monthly), Overtime allowed.
  4. `work_setup`: Work Mode (Remote/Hybrid/Onsite), City, Country, Equipment (BYOD/Company).
  5. `compliance`: Background Check, Drug Test, NDA required, Contract Template.
  6. `process`: Submission Deadline, Max Submissions per Vendor, Interview Rounds configuration.
- **Information Priority:**
  - **CRITICAL:** Role title, Skills, Department, Budget/Rate, Openings count.
  - **IMPORTANT:** Engagement type, Duration, Work mode.
  - **SECONDARY:** Equipment provision, compliance checkboxes.
  - **OPTIONAL:** Detailed interview round descriptions.

## 8.5 PAGE: Requisition Detail & Edit
- **Route `[IMPLEMENTED]`:** `/dashboard/requisitions/:id`
- **Frontend File `[IMPLEMENTED]`:** `frontend/src/pages/requisitions/RequisitionDetail.jsx`
- **Purpose `[IMPLEMENTED]`:** In-depth specification view, allowing modification, status transition, and vendor submission monitoring.
- **Main APIs `[IMPLEMENTED]`:**
  - `GET /api/requisitions/{id}`
  - `POST /api/requisitions/{id}/approve`
  - `POST /api/requisitions/{id}/publish`
  - `PATCH /api/requisitions/{id}`
- **Information Priority:**
  - **CRITICAL:** Current Status banner, Primary specifications, Candidate submission shortcut.
  - **IMPORTANT:** Budget details, Compliance terms.
  - **SECONDARY:** Audit logs and timeline.

## 8.6 PAGE: Candidate Pool & Review
- **Route `[IMPLEMENTED]`:** `/dashboard/candidates`
- **Frontend File `[IMPLEMENTED]`:** `frontend/src/pages/candidates/RequisitionCandidates.jsx`
- **Purpose `[IMPLEMENTED]`:** Candidate evaluation matrix featuring AI resume match scoring, skills gap analysis, and 48-hour shortlist lock.
- **Main APIs `[IMPLEMENTED]`:**
  - `GET /api/candidates`
  - `POST /api/candidates/shortlist`
  - `POST /api/requisitions/{id}/shortlist/send-now`
  - `POST /api/interviews/candidates/{id}/decision`
- **Information Priority:**
  - **CRITICAL:** Candidate Name, AI Match Score (0-100%), Skills match badges, Current Status, Action buttons (Shortlist, Schedule, Accept, Reject).
  - **IMPORTANT:** Vendor name, Hourly rate, Experience years.
  - **SECONDARY:** Resume download link, 48-hour SLA countdown timer.
  - **OPTIONAL:** Internal vendor submission ID.

## 8.7 PAGE: Interviews & AI Scores
- **Route `[IMPLEMENTED]`:** `/dashboard/interviews`
- **Frontend File `[IMPLEMENTED]`:** `frontend/src/interview/pages/HiringManagerInterviews.jsx`
- **Purpose `[IMPLEMENTED]`:** Multi-round interview orchestration hub with integrated audio playback and AI speech evaluation metrics.
- **Main APIs `[IMPLEMENTED]`:**
  - `GET /api/interviews/rounds`
  - `GET /api/interviews/summary`
  - `POST /api/interviews/rounds`
  - `GET /api/interviews/rounds/{id}/recording`
  - `POST /api/interviews/candidates/{id}/decision`
- **Speech Analytics Displayed `[IMPLEMENTED]`:** Spoken WPM, filler word count, confidence index, AI generated interview summary transcript.
- **Information Priority:**
  - **CRITICAL:** Candidate Name, Round Type, Interview Date/Time, Final Decision buttons (Accept & Onboard / Reject).
  - **IMPORTANT:** AI Speech Score, Recording player, Evaluation notes.
  - **SECONDARY:** Meeting link, Passcode.
  - **OPTIONAL:** Candidate round logs.

## 8.8 PAGE: Reported Issues
- **Route `[IMPLEMENTED]`:** `/dashboard/candidates/issues`
- **Frontend File `[IMPLEMENTED]`:** `frontend/src/pages/candidates/ReportedIssues.jsx`
- **Purpose `[IMPLEMENTED]`:** Triage dashboard for candidate onboarding blockers (hardware delays, credential failures, doc rejections).
- **Main APIs `[IMPLEMENTED]`:**
  - `GET /api/onboarding/issues`
  - `PATCH /api/onboarding/issues/{id}`
- **Information Priority:**
  - **CRITICAL:** Candidate Name, Issue Title, Severity level, Resolution status.
  - **IMPORTANT:** Reported date, Description notes.
  - **SECONDARY:** Update status button (Resolved / Dismissed).

## 8.9 PAGE: Candidate Portal Access
- **Route `[IMPLEMENTED]`:** `/dashboard/candidates/portal-access`
- **Frontend File `[IMPLEMENTED]`:** `frontend/src/pages/candidates/CandidatePortalAccess.jsx`
- **Purpose `[IMPLEMENTED]`:** Manage self-service candidate portal user accounts, invitation emails, and access revocation.
- **Main APIs `[IMPLEMENTED]`:**
  - `GET /api/auth/portal-users`
  - `POST /api/auth/portal-users/{id}/resend-invite`
  - `POST /api/auth/portal-users/{id}/toggle-status`
- **Information Priority:**
  - **CRITICAL:** Candidate Name, Email, Account Status (Active/Disabled), Resend Invite button.
  - **IMPORTANT:** Last login timestamp, Role assignment.
  - **SECONDARY:** Account creation timestamp.

## 8.10 PAGE: Team Overview
- **Route `[IMPLEMENTED]`:** `/dashboard/workforce/team`
- **Frontend File `[IMPLEMENTED]`:** `frontend/src/pages/workforce/TeamOverview.jsx`
- **Purpose `[IMPLEMENTED]`:** Workforce roster showing active contractors, assigned requisitions, vendors, and contract end dates.
- **Main APIs `[IMPLEMENTED]`:**
  - `GET /api/workforce/team`
  - `GET /api/workforce/team/{candidate_id}`
- **Information Priority:**
  - **CRITICAL:** Contractor Name, Role title, Vendor, Work status (Active/Ending Soon).
  - **IMPORTANT:** Hourly billing rate, Contract end date.
  - **SECONDARY:** Candidate detail drawer trigger.

## 8.11 PAGE: Timesheet Approvals
- **Route `[IMPLEMENTED]`:** `/dashboard/workforce/timesheets`
- **Frontend File `[IMPLEMENTED]`:** `frontend/src/pages/workforce/TimesheetApprovals.jsx`
- **Purpose `[IMPLEMENTED]`:** Review and approval queue for contractor weekly hour submissions.
- **Main APIs `[IMPLEMENTED]`:**
  - `GET /api/workforce/timesheets`
  - `POST /api/workforce/timesheets/{id}/approve`
  - `POST /api/workforce/timesheets/{id}/reject`
- **Information Priority:**
  - **CRITICAL:** Contractor Name, Week range, Total Hours, Approve/Reject buttons.
  - **IMPORTANT:** Daily hours breakdown (Mon-Sun).
  - **SECONDARY:** Submission timestamp.

## 8.12 PAGE: Expense Approvals
- **Route `[IMPLEMENTED]`:** `/dashboard/workforce/expenses`
- **Frontend File `[IMPLEMENTED]`:** `frontend/src/pages/workforce/ExpenseApprovals.jsx`
- **Purpose `[IMPLEMENTED]`:** Audit and reimbursement queue for contractor project expenses.
- **Main APIs `[IMPLEMENTED]`:**
  - `GET /api/workforce/expenses`
  - `POST /api/workforce/expenses/{id}/approve`
  - `POST /api/workforce/expenses/{id}/reject`
- **Information Priority:**
  - **CRITICAL:** Contractor Name, Amount, Currency, Category, Receipt download link, Approve/Reject buttons.
  - **IMPORTANT:** Description/Justification.
  - **SECONDARY:** Submission date.

---

# 9. DASHBOARD DEEP ANALYSIS

### 9.1 Elements & Decision Value
| Dashboard Component | Data Source | Decision Value | Priority | Redesign Recommendation |
|---|---|---|---|---|
| **KPI Metrics Strip** | `/api/workforce/stats` | High: Instant glance at headcount and open reqs | CRITICAL | Retain above fold as primary status banner. |
| **Urgent Attention Queue** | `/api/workforce/timesheets`, `/api/onboarding/issues` | Critical: Direct operational blockers needing approval | CRITICAL | Move to top-right prominent action drawer or card. |
| **Active Pipeline Progress** | `/api/requisitions` | High: Status of live hiring campaigns | IMPORTANT | Keep compact with progress bars. |
| **Candidate Shortlist Strip** | `/api/candidates?status=Shortlisted` | Medium: Recently screened profiles | SECONDARY | Consolidate with a quick shortcut to Candidate Pool. |
| **AI Assistant Shortcut** | Client-side routing | Medium: Quick jump to chat copilot | OPTIONAL | Embed as floating action button or sidebar item. |

---

# 10. REQUISITION MANAGEMENT DEEP ANALYSIS

### 10.1 Creation Fields & Validation Matrix
| Field Name | Tab | Type | Mandatory? | Backend Model Target | Stored In |
|---|---|---|---|---|---|
| `role_title` | Role | String | Yes | `Requisition.role_title` | `db["requisitions"]` |
| `department` | Role | String | Yes | `Requisition.department` | `db["requisitions"]` |
| `seniority_level` | Role | Select | Yes | `Requisition.seniority_level` | `db["requisitions"]` |
| `primary_skills` | Role | Array[String] | Yes | `Requisition.skills` | `db["requisitions"]` |
| `min_experience` | Role | Number | Yes | `Requisition.min_experience` | `db["requisitions"]` |
| `engagement_type` | Engagement | Select | Yes | `Requisition.engagement_type` | `db["requisitions"]` |
| `duration_months` | Engagement | Number | No | `Requisition.duration_months` | `db["requisitions"]` |
| `headcount` | Engagement | Number | Yes | `Requisition.openings_count` | `db["requisitions"]` |
| `target_rate` | Commercials | Number | Yes | `Requisition.target_rate` | `db["requisitions"]` |
| `rate_unit` | Commercials | Select | Yes | `Requisition.rate_unit` | `db["requisitions"]` |
| `work_mode` | Work Setup | Select | Yes | `Requisition.work_mode` | `db["requisitions"]` |
| `location_city` | Work Setup | String | No | `Requisition.location` | `db["requisitions"]` |
| `interview_rounds` | Process | Array[Object] | No | `Requisition.interview_rounds` | `db["requisitions"]` |

---

# 11. CANDIDATE MANAGEMENT DEEP ANALYSIS

### 11.1 Candidate State Machine
```
[Submitted by Vendor]
       │
       ▼
 [AI Screened & Ranked]
       │
       ├─────────────────────────────────┐
       ▼                                 ▼
 [Shortlisted by HM]                [Rejected]
       │
       ▼
 [Interview Scheduled (Rounds 1-N)]
       │
       ├─────────────────────────────────┐
       ▼                                 ▼
 [Accepted & Moved to Onboarding]   [Rejected]
       │
       ▼
 [Work Order Drafted & Issued]
       │
       ▼
 [Active Team Contractor]
```

### 11.2 State Transition Table
| Starting State | Trigger / User Action | API Endpoint | Resulting State |
|---|---|---|---|
| `Submitted` | AI Resume Screener worker parses PDF | Internal worker | `Screened` |
| `Screened` | HM clicks "Shortlist" | `POST /api/candidates/shortlist` | `Shortlisted` |
| `Screened` / `Shortlisted` | HM clicks "Reject" | `POST /api/interviews/candidates/{id}/decision` | `Rejected` |
| `Shortlisted` | HM creates round in Interview page | `POST /api/interviews/rounds` | `Interviewing` |
| `Interviewing` | HM clicks "Accept & Onboard" | `POST /api/interviews/candidates/{id}/decision` | `Accepted` |
| `Accepted` | Work order issued & signed | `POST /api/workforce/work-orders` | `Active` (Contractor) |

---

# 12. AI SCREENING & SPEECH ANALYTICS

### 12.1 Spoken Communication & Speech Evaluation
- **Implementation `[IMPLEMENTED]`:** Located in `backend/modules/interview/router.py` lines 112-140 (`analyze_spoken_communication`).
- **Input Parameters `[IMPLEMENTED]`:** Audio/video turn transcriptions, timestamped audio chunks.
- **Metrics Evaluated `[IMPLEMENTED]`:**
  - Words Per Minute (WPM Cadence, target: 120-160 WPM).
  - Filler Word Density (`"um"`, `"ah"`, `"like"`, `"you know"` count).
  - Sentiment & Emotional Tone (Positive, Neutral, Hesitant).
  - Synthesized Overall Communication Score (0-100).
- **Separation of Concerns `[IMPLEMENTED]`:** The AI produces analytical indicators; **the Hiring Manager retains 100% human authority** to click Accept or Reject. The AI cannot unilaterally reject or hire candidates.

---

# 13. AI HIRING ASSISTANT

### 13.1 Agent Architecture & Capabilities
- **Backend Service `[IMPLEMENTED]`:** `backend/modules/hiring_manager_agent/agent.py` running on Groq LLaMA 3.3 70B Versatile.
- **Frontend Interface `[IMPLEMENTED]`:** Split-screen UI in `HiringManagerChat.jsx` (left: conversation transcript, right: interactive dynamic widgets).

### 13.2 Tool Registry & Execution Matrix
| Agent Tool Name | User Trigger / Intent | Backend Function | Can Modify Data? | Result / UI Widget Rendered |
|---|---|---|---|---|
| `get_hiring_manager_stats` | "Show my hiring overview" | `get_hiring_manager_stats()` | No | `hiring_metrics` KPI Widget |
| `list_hiring_requisitions` | "List my open requisitions" | `list_hiring_requisitions()` | No | `requisition_list` Interactive Table |
| `draft_hiring_requisition` | "Draft a React dev position" | `draft_requisition_preview()` | No | `draft_requisition` Form Preview |
| `create_hiring_requisition` | "Confirm and publish requisition"| `create_hiring_requisition()` | **Yes** | Inserts into `db["requisitions"]` |
| `submit_for_director_approval`| "Send req to Director" | `submit_requisition_for_director_approval()` | **Yes** | Updates status to `Pending Approval` |
| `list_shortlisted_candidates`| "Show shortlisted candidates" | `list_shortlisted_candidates()` | No | `shortlisted_candidates` Profile Cards |
| `schedule_candidate_interview`| "Schedule interview for Alex" | `schedule_candidate_interview()` | **Yes** | `interview_proposal` Card & Calendar slot |
| `reject_shortlisted_candidate`| "Reject candidate John" | `reject_shortlisted_candidate()` | **Yes** | Updates status to `Rejected` |
| `list_onboarding_issues` | "Any onboarding blockers?" | `list_onboarding_issues()` | No | `onboarding_issues` Triage Table |
| `list_pending_timesheets` | "Show pending timesheets" | `list_pending_timesheets()` | No | `timesheets` Approval Table |
| `list_pending_expenses` | "Check pending expenses" | `list_pending_expenses()` | No | `expenses` Audit Table |
| `get_candidate_profile_details`| "Get details for Suraj" | `get_candidate_profile_details()` | No | `candidate_profile` Deep Inspection Widget |

### 13.3 Telegram Bot Integration
- **Implementation `[IMPLEMENTED]`:** `backend/modules/hm_telegram_bot/bot.py`.
- **Bot Handle `[IMPLEMENTED]`:** `@Termjobs_hm_bot`.
- **Functionality `[IMPLEMENTED]`:** Sends immediate push notifications to the HM's personal Telegram account when a timesheet is submitted, an onboarding issue is raised, or an interview round is completed.

---

# 14. INTERVIEWS & MULTI-ROUND HUB

### 14.1 Technical Architecture
- **Room Media `[IMPLEMENTED]`:** LiveKit WebRTC (`backend/modules/interview/router.py` line 90 generates LiveKit JWT tokens).
- **Candidate Recordings `[IMPLEMENTED]`:** Uploaded as WebM blobs to `/api/interviews/rounds/{id}/recording`, stored in local filesystem or S3-compatible object storage, and streamed via HTML5 video player in `CandidateRecordingPlayer.jsx`.
- **Evaluation Form `[IMPLEMENTED]`:** Allows scoring candidate across Technical Competency, Cultural Fit, Communication, and Problem Solving.

---

# 15. WORKFORCE / POST-HIRING

### 15.1 Separation of Hiring vs Post-Hiring Scope
- **Hiring Scope:** Requisitions, Candidate Pool, AI Screening, Interviews, Decision (Accept/Reject).
- **Post-Hiring Scope:** Team Overview, Work Orders, Timesheet Approvals, Expense Approvals, Onboarding Issues.
- **Linkage `[IMPLEMENTED]`:** When an HM clicks "Accept & Onboard" in the hiring workflow, the system triggers the automatic generation of a Work Order shell and moves the candidate into the Workforce module.

---

# 16. NAVIGATION ANALYSIS

### 16.1 Navigation Structure (`DashboardLayout.jsx`)
```
WORKSPACE
  ├── Dashboard          -> /dashboard/hiring-manager
  └── Hiring AI Chat     -> /dashboard/hiring-manager/chat

HIRING
  ├── Requisitions       -> /dashboard/requisitions
  └── New Requisition    -> /dashboard/requisitions/new

CANDIDATES
  ├── Candidate Pool     -> /dashboard/candidates
  ├── Interviews         -> /dashboard/interviews
  ├── Reported Issues    -> /dashboard/candidates/issues
  └── Portal Access      -> /dashboard/candidates/portal-access

WORKFORCE
  ├── Team Overview      -> /dashboard/workforce/team
  ├── Timesheets         -> /dashboard/workforce/timesheets
  └── Expenses           -> /dashboard/workforce/expenses
```

---

# 17. INFORMATION ARCHITECTURE MATRIX

| Page | CRITICAL (Above Fold) | IMPORTANT (First Scroll) | SECONDARY (In Tabs/Drawers) | OPTIONAL (Low Traffic) |
|---|---|---|---|---|
| **Dashboard** | KPI Counts, Urgent Approvals Queue | Pipeline Progress Bars | Recent Candidate Cards | Static Metrics Charts |
| **Chat** | Output Display Widget, Chat Input | Conversation History | Voice Pitch/Speed Controls | Suggested Question Chips |
| **Requisitions**| Requisition Title, Status, Openings | Department, Bill Rate | Creation Date, Location | Submissions Count Details |
| **New Requisition**| Role Title, Skills, Budget, Openings| Engagement Type, Dates | Compliance Checkboxes | Round descriptions |
| **Candidates** | Candidate Name, AI Score, Actions | Skills match chips, Vendor | Resume viewer | Submission timestamps |
| **Interviews** | Candidate, Round, Decision Buttons | AI Speech Metrics, Recording | Meeting Passcode | Room logs |
| **Team Overview**| Contractor Name, Role, Status | Vendor, Hourly Rate | Contract End Date | Profile drawer |
| **Timesheets** | Contractor, Week, Hours, Approve/Reject| Daily Breakdown (Mon-Sun) | Rejection modal | Submission ID |
| **Expenses** | Contractor, Amount, Receipt link | Category, Description | Rejection modal | Submission ID |

---

# 18. REDUNDANCY & DUPLICATION AUDIT

1. **Candidate Shortlist Display `[IMPLEMENTED]`:** Appears simultaneously on Dashboard, Candidate Pool, and Interview Hub. *Recommendation: Dashboard should display only actionable counts, delegating evaluation to Candidate Pool.*
2. **Requisition Status Information `[IMPLEMENTED]`:** Requisition metrics exist in Dashboard cards, Requisition Overview tabs, and within the AI Chat widget. *Recommendation: Unify status badge representations.*
3. **Timesheet / Expense Action Queue `[IMPLEMENTED]`:** Displayed in Dashboard "Urgent Approvals" and inside Workforce tabs. *Recommendation: Maintain summary link on Dashboard that deep-links directly to pre-filtered approval queues.*

---

# 19. SCROLLING & DENSITY AUDIT

| Page | Density Rating | Scrolling Characteristic | Structural Cause |
|---|---|---|---|
| **HiringManagerDashboard** | Too Dense | Excessive vertical scrolling on 13" laptops | High number of stacked card components and tables |
| **NewRequisition** | Balanced | Tabbed navigation prevents excessive vertical length | Form divided cleanly into 6 distinct tabs |
| **RequisitionCandidates** | Too Dense | Long scrolling list of candidate cards | Each card displays full skill sets and resume snippets |
| **HiringManagerInterviews** | Balanced | Split panel (list on left, detail on right) | Minimizes vertical scroll by anchoring detail pane |
| **TimesheetApprovals** | Balanced | Clean table format with action buttons | Paginated or scrollable table container |

---

# 20. RESPONSIVE BEHAVIOR

- **Desktop (>= 1280px) `[IMPLEMENTED]`:** Two-column split screens on Chat, full wide tables on Workforce, sidebar permanently expanded.
- **Tablet (768px - 1024px) `[IMPLEMENTED]`:** Sidebar collapses into mobile hamburger menu; two-column layouts stack vertically.
- **Mobile (< 768px) `[IMPLEMENTED]`:** Tables require horizontal touch scrolling (`overflow-x: auto`); AI Chat collapses into a single column switching between conversation and widget view.

---

# 21. AUTHENTICATION & AUTHORIZATION

### 21.1 Security Implementation
- **Authentication `[IMPLEMENTED]`:** Bearer JWT tokens issued by `/api/auth/login`, stored in `localStorage` (`access_token`).
- **Tenant Isolation `[IMPLEMENTED]`:** All queries in `backend/main.py` and `modules/workforce/router.py` enforce `tenant_id == current_user.tenant_id`.
- **Role Enforcement `[IMPLEMENTED]`:** Requisitions are scoped: `models.Requisition.created_by == current_user.id` when `current_user.role == "Hiring Manager"`.

---

# 22. STATUS & STATE MACHINE CATALOG

### 22.1 Requisition Lifecycle
- `Draft` → `Pending Approval` → `Published` → `Completed` / `Closed`

### 22.2 Candidate Lifecycle
- `Submitted` → `Screened` → `Shortlisted` → `Interviewing` → `Accepted` / `Rejected`

### 22.3 Interview Round Lifecycle
- `Scheduled` → `In-Progress` → `Completed` → `Cancelled`

### 22.4 Timesheet & Expense Lifecycle
- `Draft` → `Submitted` → `Approved` / `Rejected`

---

# 23. CRITICAL FUNCTIONALITY THAT MUST NOT BE LOST

A future UI redesign MUST preserve the following active capabilities:
1. **6-Tab Requisition Wizard & AI Structurer:** Must retain all technical, commercial, compliance, and process fields.
2. **48-Hour Shortlist SLA:** Real-time countdown timer and instant shortlisting release mechanism.
3. **AI Speech Analytics:** Playback of candidate recordings and display of WPM, filler word count, and sentiment scores.
4. **Human Decision Control:** Final "Accept & Onboard" or "Reject" buttons triggering automated Work Order and Onboarding record generation.
5. **Interactive AI Assistant Widgets:** Dynamic mounting of the 7 interactive cards inside the chat copilot.
6. **One-Click Timesheet & Expense Approvals:** Streamlined weekly hours review with rejection justification modals.
7. **Strict Tenant & Creator Scoping:** Ensuring HMs only manage requisitions and candidates within their authorized organization.

---

# 24. CURRENT UX PROBLEM AUDIT

| ID | Location | Problem Description | Severity | Impact on Hiring Manager |
|---|---|---|---|---|
| UX-01 | Dashboard | Urgent approvals buried beneath pipeline cards | **High** | Delays contractor payment and onboarding issue resolution |
| UX-02 | Candidates Pool | 48-Hour SLA countdown timer not prominent | **Medium** | HM risks missing vendor shortlisting cutoffs |
| UX-03 | AI Chat | Widget pane and chat transcript compete for horizontal width on laptops | **High** | Causes cramped forms and clipped table text |
| UX-04 | New Requisition | Tab navigation requires sequential clicking without progress indicator | **Medium** | High cognitive load during long job specification creation |
| UX-05 | Workforce | Timesheet rejection modal requires text justification but has no canned presets | **Low** | Adds manual typing friction for repeated rejection causes |

---

# 25. HIRING MANAGER PERSONA

- **Title:** Engineering Hiring Manager / Department Lead
- **Primary Goals:** Close open requisitions quickly with vetted talent, conduct efficient interviews, and maintain compliance on contractor hours.
- **Pain Points:** Information overload across disparate tabs, delayed feedback on vendor submissions, and manual back-and-forth on timesheets.

---

# 26. FINAL SYSTEM MAP & COMPREHENSIVE ARCHITECTURE

### A. Portal Page Hierarchy
```
/dashboard/hiring-manager
/dashboard/hiring-manager/chat
/dashboard/requisitions
/dashboard/requisitions/new
/dashboard/requisitions/:id
/dashboard/candidates
/dashboard/interviews
/dashboard/candidates/issues
/dashboard/candidates/portal-access
/dashboard/workforce/team
/dashboard/workforce/timesheets
/dashboard/workforce/expenses
```

### B. End-to-End Workflow Map
```
Create Requisition (HM) 
   → Director Approval (Director) 
   → Published to Vendors 
   → Vendor Resume Ingestion 
   → AI Resume Screening 
   → Shortlist Release (HM) 
   → Technical Interview & Speech Analytics (HM) 
   → Accept & Onboard (HM) 
   → Work Order & Checklist Initialization 
   → Weekly Timesheet & Expense Oversight (HM)
```

### C. API Endpoint Summary Map
| Frontend Page | HTTP Method | Endpoint | Data Sent / Received |
|---|---|---|---|
| Dashboard | GET | `/api/workforce/stats` | KPI aggregate counts |
| AI Chat | POST | `/api/hiring-manager/agent/chat` | Message prompt & Tool output |
| Requisitions | GET | `/api/requisitions` | Requisition array filtered by tenant |
| New Requisition | POST | `/api/requisitions` | Full 6-tab requisition payload |
| Candidate Pool | GET | `/api/candidates` | Candidate profiles with AI scores |
| Interviews | GET | `/api/interviews/rounds` | Scheduled rounds & analytics |
| Interviews | POST | `/api/interviews/candidates/{id}/decision` | Decision (`Accepted`/`Rejected`) |
| Timesheets | POST | `/api/workforce/timesheets/{id}/approve` | Timesheet approval confirmation |

---

# 27. SOURCE REFERENCES (EXACT REPOSITORY PATHS)

### Frontend Components
- `frontend/src/pages/HiringManagerDashboard.jsx`
- `frontend/src/pages/HiringManagerChat.jsx`
- `frontend/src/pages/requisitions/RequisitionOverview.jsx`
- `frontend/src/pages/requisitions/NewRequisition.jsx`
- `frontend/src/pages/requisitions/RequisitionDetail.jsx`
- `frontend/src/pages/candidates/RequisitionCandidates.jsx`
- `frontend/src/interview/pages/HiringManagerInterviews.jsx`
- `frontend/src/pages/candidates/ReportedIssues.jsx`
- `frontend/src/pages/candidates/CandidatePortalAccess.jsx`
- `frontend/src/pages/workforce/TeamOverview.jsx`
- `frontend/src/pages/workforce/TimesheetApprovals.jsx`
- `frontend/src/pages/workforce/ExpenseApprovals.jsx`
- `frontend/src/interview/services/interviewApi.js`

### Backend Modules & Services
- `backend/main.py`
- `backend/modules/workforce/router.py`
- `backend/modules/interview/router.py`
- `backend/modules/hiring_manager_agent/agent.py`
- `backend/modules/hiring_manager_agent/router.py`
- `backend/modules/candidate/router.py`
- `backend/modules/requisition/domain/models.py`
- `backend/modules/identity/domain/models.py`
- `backend/modules/shared/db.py`
- `backend/modules/hm_telegram_bot/bot.py`

---

# 28. IMPLEMENTATION STATUS VERIFICATION
- [x] All Hiring Manager routes verified against `frontend/src/App.jsx`.
- [x] All database models verified against `backend/modules/`.
- [x] All AI agent tools verified against `backend/modules/hiring_manager_agent/agent.py`.
- [x] All workforce endpoints verified against `backend/modules/workforce/router.py`.
- [x] All interview and speech analytics verified against `backend/modules/interview/router.py`.
- [x] Strict adherence to zero-modification principle maintained throughout the audit.
