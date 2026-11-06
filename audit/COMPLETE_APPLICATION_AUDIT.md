# Complete Application Audit & Inventory

**Project**: TermJobs Platform  
**Target Environment**: Production Readiness  
**Date**: November 2026  

---

## 1. Application Inventory & Route Topology

The TermJobs platform comprises **160 frontend routes** and **127 backend API endpoints**.

### 1.1 Frontend Route Categorization (160 Total Routes)

| Category | Route Count | Primary Path Examples | Description |
| :--- | :--- | :--- | :--- |
| **Public & Informational** | 24 | `/`, `/why-termjobs`, `/how-it-works`, `/for-talent`, `/for-teams` | Public landing, value proposition, feature overviews |
| **Job Search & Discovery** | 12 | `/jobs`, `/find-jobs`, `/jobs/open-roles`, `/jobs/contract`, `/jobs/remote` | Search, keyword filtering, work mode, department & location drawers |
| **Job Details & Application** | 8 | `/jobs/:id`, `/apply/:id`, `/apply/confirm` | Public requisition detail, application form, document upload |
| **Candidate Auth & Onboarding**| 14 | `/candidate/login`, `/candidate/signup`, `/candidate/onboarding`, `/onboarding/verify` | Auth forms, profile wizard, resume parsing preview |
| **Candidate Portal & Dashboard**| 22 | `/candidate/dashboard`, `/candidate/timesheets`, `/candidate/attendance`, `/candidate/expenses` | Candidate post-placement portal, weekly smart draft entries, timesheet submissions |
| **AI Interview & Rooms** | 18 | `/interview/ai/:roundId`, `/interview/room/:roundId`, `/candidate/interview-login` | WebRTC audio/video stage, AI speech synthesis, real-time transcription |
| **Hiring Manager Portal** | 20 | `/manager/dashboard`, `/manager/requisitions`, `/manager/approvals`, `/manager/interviews` | Requisition intake, candidate review, director sign-off |
| **Recruiter & Agency Portal** | 16 | `/recruiter/dashboard`, `/recruiter/bank`, `/recruiter/screening`, `/recruiter/submissions` | Candidate bank, AI bulk screening, resume parser |
| **Super Admin & Platform** | 18 | `/admin/requisitions`, `/admin/users`, `/admin/billing`, `/admin/contracts` | Platform-wide management, requisition publishing, contract issuance |
| **Resources, Legal & Trust** | 8 | `/resources`, `/privacy-policy`, `/terms`, `/platform-rules` | Documentation, compliance, white theme policy pages |

### 1.2 Backend API Modules (127 Total Endpoints)

| Module | Route Prefix | Endpoint Count | Key Responsibilities |
| :--- | :--- | :--- | :--- |
| **Identity & Authentication** | `/api/auth`, `/api/users` | 24 | JWT authentication, role resolution, tenant switching, password hashing |
| **Requisition Lifecycle** | `/api/requisitions`, `/requisitions` | 28 | AI intake, Director approval state machine, publishing, deadline policy |
| **Candidate Bank & Screening** | `/api/candidates` | 22 | Resume parsing, skill extraction, bulk AI matching, PDF preview generation |
| **Interviews & LiveKit** | `/api/interviews` | 16 | Round scheduling, token generation, AI evaluation, transcript recording |
| **Candidate Portal & Workforce** | `/api/candidate-portal`, `/api/workforce` | 19 | Work order binding, weekly timesheet smart drafts, expenses, attendance |
| **Onboarding & Offboarding** | `/api/onboarding`, `/api/offboarding` | 10 | Equipment checklists, access revocation, 48-hour expiration locking |
| **Billing & Work Orders** | `/api/billing`, `/api/workorders` | 8 | Rate calculation, invoice generation, contractor ledger |

---

## 2. Dependency & Code Hygiene Audit

### 2.1 Frontend Dependencies (`frontend/package.json`)
- **Core Framework**: React 18.3, React DOM 18.3, React Router DOM 6.22.
- **Styling & UI**: TailwindCSS 3.4, Lucide React (feather icon set), Framer Motion (page animations).
- **Audio / Video / RTC**: `livekit-client` 2.0 (lazy-loaded exclusively in interview rooms).
- **Bundle Split Boundaries**:
  - `AiInterviewRoom.jsx` and `InterviewRoom.jsx` are dynamically imported (`React.lazy()`).
  - No WebRTC or LiveKit packages are bundled into the public landing page or job search pages.

### 2.2 Backend Dependencies (`backend/pyproject.toml`)
- **Web & Asynchronous**: FastAPI 0.115, Uvicorn 0.32, AnyIO 4.15.
- **Database**: PyMongo 4.9 (MongoDB Atlas), SQLAlchemy 2.0 (Identity/Tenants SQLite/Postgres).
- **AI & Processing**: PyMuPDF (PDF resume parsing & generation), Groq SDK (LLM structured extraction).
- **Security**: Passlib / bcrypt (password hashing), Python-Jose / PyJWT (cryptographic JWT verification).

### 2.3 Obsolete Files & Refactoring Verification
During the inventory inspection, 4 legacy candidate test files (`test_agent_graph.py`, `test_duplicate_detector.py`, `test_pdf_parser.py`, `test_state_machine.py`) were identified in `backend/tests/candidate/`. These files tested an earlier monolithic candidate agent structure that was refactored into the active `modules/resume_screener/` pipeline. The active candidate suite (`test_candidate_payment_notifications.py`, `test_candidate_portal.py`, `test_offboarding_workflow.py`, `test_timesheet_draft_persistence.py`) fully covers current candidate workflows.

---

## 3. Structural Health Verification

1. **Circular Import Check**: Clean; Python module imports follow layered domain-service-router hierarchy.
2. **Dead Code Elimination**: All 160 frontend routes map to active components in `frontend/src/`.
3. **Environment Isolation**: Production secrets (JWT secrets, MongoDB URIs, Groq API keys) are strictly loaded via `.env` and `get_settings()`, never hardcoded.

