# TermJobs Hiring Manager Architecture & Capability Analysis

## 1. Executive Summary

TermJobs (`D:\projects\Term-Jobs`) is an enterprise-grade contingent workforce and contract talent acquisition platform. The platform supports multiple personas, including Super Admins, Directors, Staffing Vendors, Candidates, and **Hiring Managers**.

The Hiring Manager is the primary operational user responsible for initiating demand (requisitions), evaluating and shortlisting vendor-submitted candidates, conducting structured interviews, approving or rejecting timesheets and expense claims, tracking contractor performance, and monitoring active contingent workers.

This audit details the complete frontend routes, backend domain services, data models, tenant isolation mechanisms, role boundaries, and existing assistant limitations, establishing the exact operational boundary for the new independent AI Hiring Operations Assistant.

---

## 2. Frontend Hiring Manager Routes Audit

All 15 authenticated Hiring Manager routes verified from `frontend/src/App.jsx`:

| Route Path | Primary Purpose & Features | Key User Actions & Controls | Backend API Dependencies |
| :--- | :--- | :--- | :--- |
| `/dashboard/hiring-manager` | **HM Command Center & KPI Overview**: Snapshot of active requisitions, pending timesheets, upcoming interviews, contractor issues, and 48-hour SLA candidate alerts. | Metric cards, quick links to requisition creator, timesheet review drawer, recent candidate submissions. | `GET /api/workforce/stats`, `GET /api/requisitions`, `GET /api/timesheets?status=SUBMITTED` |
| `/dashboard/hiring-manager/chat` | **Existing AI Assistant Workspace**: Chat interface intended to assist HMs. | Conversation window, prompt chips. *(Inspected for limitations; will not be modified)* | `POST /api/hiring-manager-agent/chat` |
| `/dashboard/requisitions` | **Requisitions Roster**: Tabbed table displaying all requisitions created by or assigned to the HM (Draft, Pending Approval, Open, Closed). | Search by role title/skills, filter by department/status, click into detail or candidate pool, duplicate requisition. | `GET /api/requisitions`, `GET /api/requisitions?status=...` |
| `/dashboard/requisitions/new` | **Requisition Creation Wizard**: Multi-step form to define contract role specifications, skills, budget, headcount, and interview stages. | Input title, department, work mode (Remote/Hybrid/Onsite), rates, dates; auto-generate enterprise JD; configure interview stages; Save Draft; Submit for Director Approval. | `POST /api/requisitions`, `POST /api/requisitions/draft`, `POST /api/ai/generate-jd` |
| `/dashboard/requisitions/:id` | **Requisition Details & Configuration**: In-depth view of role description, budget envelope, compliance rules, and configured interview rounds. | Edit draft fields, submit pending draft, close requisition, view audit logs of approvals. | `GET /api/requisitions/{id}`, `PUT /api/requisitions/{id}`, `POST /api/requisitions/{id}/submit` |
| `/dashboard/requisitions/:id/candidates` | **Candidate Pipeline & Screening Pool**: Kanban/Table of vendor-submitted candidates for a specific requisition. Displays AI match scores, matched/missing skills, 48-hour SLA badge. | Filter candidates by match score (>80%), compare top candidates side-by-side, shortlist candidate, reject candidate with feedback. | `GET /api/candidates?requisition_id={id}`, `POST /api/candidates/{id}/shortlist`, `POST /api/candidates/{id}/reject` |
| `/dashboard/requisitions/:reqId/candidates/:candidateId` | **Candidate Dossier & Resume Viewer**: Detailed candidate profile, extracted resume text, work history, skill taxonomy, and vendor submission details. | View embedded resume PDF, inspect AI screening breakdown, trigger interview scheduling modal, download dossier. | `GET /api/candidates/{id}`, `GET /api/candidates/{id}/resume` |
| `/interview-panel/:candidateId` | **Live Interview Room & Scorecard**: Synchronous interview workstation powered by LiveKit video, structured rating rubric (1-5 score, technical skills, communication, problem solving), and real-time notes. | Join LiveKit room, toggle video/audio, fill competency scorecards, submit round evaluation. | `GET /api/interviews/{id}`, `POST /api/interviews/{id}/scorecard`, `GET /api/livekit/token` |
| `/dashboard/interviews` | **Interview Master Schedule**: Agenda and calendar view of all upcoming and past candidate interviews across the HM's requisitions. | Sync with Google Calendar, reschedule interview slot, cancel interview with notification, view completed scorecards. | `GET /api/interviews`, `POST /api/interviews/schedule`, `PUT /api/interviews/{id}/reschedule`, `DELETE /api/interviews/{id}` |
| `/dashboard/candidates/accepted` | **Accepted & Pre-Onboarding Roster**: Pipeline of candidates who accepted offers, tracking background check, contract/SOW execution, and work order creation. | View onboarding checklist status, monitor blocker flags, initiate onboarding kickoff, view linked Work Order. | `GET /api/candidates?status=ACCEPTED`, `GET /api/workorders?requisition_id=...` |
| `/dashboard/candidates/portal-access` | **Candidate Portal Provisioning**: Management of candidate portal user credentials, login status, and credential provisioning. | Check portal activation status, resend invitation link, temporarily lock or unlock candidate portal access. | `GET /api/candidate-portal/users`, `POST /api/candidate-portal/resend-invite`, `PUT /api/candidate-portal/status` |
| `/dashboard/candidates/issues` | **Contractor Issues Desk**: Escalations, attendance anomalies, equipment delays, or behavioral issues logged by or against contractors. | Filter by severity (High/Med/Low), review issue timeline, assign corrective actions, resolve issue with mandatory resolution notes. | `GET /api/workforce/issues`, `PUT /api/workforce/issues/{id}/resolve` |
| `/dashboard/workforce/team` | **Active Contingent Workforce**: Roster of all deployed contractors currently reporting to the Hiring Manager's team. | View contractor profile, billing rate, project, vendor source, tenure, upcoming contract end dates (< 30 days alert). | `GET /api/workforce/contractors`, `GET /api/workforce/contractors/{id}` |
| `/dashboard/workforce/timesheets` | **Timesheet Approvals Hub**: Weekly timesheets submitted by contractors detailing daily logged hours, overtime, and task descriptions. | View daily hours grid, review contractor notes, bulk or single Approve, Reject with mandatory explanation. | `GET /api/timesheets?status=SUBMITTED`, `POST /api/timesheets/{id}/approve`, `POST /api/timesheets/{id}/reject` |
| `/dashboard/workforce/expenses` | **Expense Claims Hub**: Out-of-pocket project expense claims submitted by contractors with receipt attachments. | Inspect receipt image/PDF, check category limits, Approve claim, Reject claim with mandatory reason. | `GET /api/expenses?status=SUBMITTED`, `POST /api/expenses/{id}/approve`, `POST /api/expenses/{id}/reject` |

---

## 3. Backend Architecture & Domain Module Audit

TermJobs backend is built with **FastAPI** (`backend/main.py`), utilizing a clean modular architecture under `backend/modules/`:

### 3.1 Database Access (`backend/modules/shared/db.py`)
- Employs **PyMongo** connecting to MongoDB Atlas (`MONGODB_URI`).
- Implements a scoped session pattern (`get_session()`) wrapping PyMongo database instances.
- Core collections:
  - `requisitions`: Job specifications, status (`DRAFT`, `PENDING_APPROVAL`, `OPEN`, `FILLED`, `CANCELLED`), budget, headcount, interview stages.
  - `candidates`: Candidate profiles, parsed resume data, AI match scores, status (`SUBMITTED`, `SHORTLISTED`, `INTERVIEW_SCHEDULED`, `EVALUATED`, `ACCEPTED`, `REJECTED`).
  - `interviews`: Scheduled rounds, stage names, dates, times, interviewer IDs, LiveKit room names, evaluation scorecards.
  - `timesheets`: Weekly records, line-item hours per day, total hours, status (`SUBMITTED`, `APPROVED`, `REJECTED`), rejection reason.
  - `expenses`: Category, amount, currency, receipt URLs, status (`SUBMITTED`, `APPROVED`, `REJECTED`), rejection reason.
  - `workforce`: Active contractor engagements, assignment dates, rates, project tags.
  - `workorders`: Legal/billing work orders tied to accepted candidates.
  - `issues`: Contractor workplace tickets, priority, status (`OPEN`, `INVESTIGATING`, `RESOLVED`), resolution notes.
  - `ai_actions`: Audit trail for all autonomous or tool-executed operations.

### 3.2 Authentication & Context (`backend/modules/identity/router.py`)
- Standard OAuth2 Bearer token with JWT payload.
- Dependency `get_current_user` decodes token and yields:
  ```python
  CurrentUser(
      id="user_hm_123",
      email="hiring.manager@enterprise.com",
      role="HIRING_MANAGER",
      tenant_id="tenant_corp_01",
      department="Engineering"
  )
  ```

---

## 4. Role Boundaries & Security Model

The Hiring Manager Assistant operates strictly within the authorized envelope of the `HIRING_MANAGER` role. The table below delineates the hard operational boundaries:

| Domain | Authorized Hiring Manager Operations | PROHIBITED / Out-of-Scope Operations (Hard Blocked) |
| :--- | :--- | :--- |
| **Requisitions** | Create drafts, edit draft fields, submit for Director approval, close filled roles. | Direct publishing bypassing Director approval when tenant policy requires Director signoff. |
| **Candidates** | Screen, view resumes, compare match scores, shortlist, reject, accept for hire. | Changing vendor submission pricing, modifying candidate source vendor tags. |
| **Interviews** | Schedule, reschedule, cancel, conduct live panel, submit scorecards. | Deleting interview transcripts, overriding other interviewers' scorecards. |
| **Vendors** | Review submitted vendor candidates, rate vendor quality score. | **Onboarding new vendors, countersigning MSAs, modifying vendor commission tiers.** (Super Admin / Director only) |
| **Financials** | Approve/reject timesheets, approve/reject project expenses. | **Executing bank payouts, generating UTR references, modifying SOW billing rates.** (Finance / Procurement only) |
| **Tenancy** | Access only data tagged with `current_user.tenant_id`. | **Cross-tenant querying or cross-tenant candidate discovery.** |

---

## 5. Audit of Current Hiring Manager Assistant

An existing assistant router exists at `backend/modules/hiring_manager_agent/router.py`. Inspection reveals critical shortcomings that explain why it is not production-grade:

1. **Rigid Keyword Heuristics**: Relies on basic regex/keyword routing rather than an LLM agentic tool-calling loop. Complex queries fail silently.
2. **No Multi-Step Reasoning**: Unable to decompose compound instructions (e.g., "Find the top 2 Python candidates and schedule interviews for tomorrow").
3. **Absence of Human-in-the-Loop Confirmation**: Consequential actions (rejecting candidates, approving timesheets) are either not supported or execute without safety confirmation cards.
4. **No Audit Trail**: Does not persist operations to `ai_actions`.
5. **No Structured Card Streaming**: Yields plain string responses; does not emit interactive widgets (comparison tables, approval cards, requisition previews).

**Conclusion**: The existing implementation cannot serve as the foundation. The new assistant must be an independent Python implementation modeled after NEXUS's proven architecture, residing in `D:\projects\Term-Jobs\ai aisstant page`.