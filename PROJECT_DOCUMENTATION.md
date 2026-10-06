# TermJobs — Comprehensive System Architecture & Technical Specification

> **Enterprise AI-Powered Contingent Workforce & Contract Hiring Orchestration Platform**  
> *Version 2.0 | Production Architecture | Multi-Tenant Platform*

---

## Table of Contents
1. [Executive Summary & System Vision](#1-executive-summary--system-vision)
2. [High-Level Architecture](#2-high-level-architecture)
3. [AI & Machine Learning Architecture](#3-ai--machine-learning-architecture)
4. [Backend Services & Modular Architecture](#4-backend-services--modular-architecture)
5. [Frontend Application & User Portals](#5-frontend-application--user-portals)
6. [Database Schema & Data Models](#6-database-schema--data-models)
7. [API Endpoints & Integration Contracts](#7-api-endpoints--integration-contracts)
8. [End-to-End Business Workflows](#8-end-to-end-business-workflows)
9. [Third-Party Integrations](#9-third-party-integrations)
10. [Infrastructure, Deployment & Security](#10-infrastructure-deployment--security)

---

## 1. Executive Summary & System Vision

**TermJobs** is an enterprise-grade contingent workforce management and AI-orchestrated hiring platform designed for companies, staffing vendors, hiring managers, and contractors. It bridges the gap between hiring demand, vendor sourcing, candidate vetting, interview logistics, contractual onboarding, and contractor billing.

```
       ┌─────────────────────────────────────────────────────────────┐
       │                      TERMJOBS PLATFORM                      │
       └──────────────────────────────┬──────────────────────────────┘
                                      │
        ┌───────────────────┬─────────┴─────────┬───────────────────┐
        ▼                   ▼                   ▼                   ▼
  [Client Enterprise] [Hiring Managers] [Staffing Vendors] [Contract Workers]
  • Director Approvals • AI Bot / Chat   • Role Pipeline    • Interview Portal
  • Budget Controls   • Sched. Interview • Candidate Sub.   • Timesheets
  • Vendor SOWs       • Timesheet Review • Invoicing        • Expenses
```

### Core Value Propositions
1. **Automated AI Job Requisition Generation**: Hiring managers describe hiring needs in plain natural language (e.g., *"We need a contract DevOps engineer with Kubernetes and Terraform experience for 6 months"*), and the system drafts standardized, structured requisitions with market rate benchmarking.
2. **Deterministic Governance & Approval Chains**: Direct publication to external vendors is governed by policy; requisitions route to Directors and Finance for budget allocation.
3. **AI Candidate Screening & Match Scoring**: Automated resume parsing, candidate profile extraction, GitHub repository tech stack verification, and objective match scoring (0–100%).
4. **Automated Logistics**: Automatic generation of Google Meet and Calendar invites (`.ics`) and delivery via Gmail SMTP.
5. **Contract Lifecycle Management**: Automatic generation of Work Orders, Statement of Work (SOW) documents, onboarding compliance checkpoints, weekly timesheet approvals, and vendor invoices.
6. **Omnichannel Conversational AI**: Full hiring manager capabilities available over the Web Dashboard, **Telegram Bot**, and **Zoho Cliq Enterprise Bot**.

---

## 2. High-Level Architecture

The system uses a modern, decoupled client-server architecture deployed on **Vercel** with **MongoDB Atlas** as the persistence layer and **Groq Cloud** as the accelerated LLM inference engine.

```mermaid
graph TD
    subgraph Clients ["Client Channels"]
        Web["Web Application<br/>(React + Vite)"]
        TG["Telegram Bot<br/>(@hm_term_bot)"]
        Cliq["Zoho Cliq Bot<br/>(Deluge Webhook)"]
        CandidateUI["Candidate Portal<br/>(Interview Room)"]
    end

    subgraph Gateway ["Edge & Gateway (Vercel)"]
        VercelEdge["Vercel Edge Proxy<br/>(vercel.json rewrites)"]
        ASGIMiddleware["ASGI Vercel Path Middleware<br/>(__vercel_path routing)"]
        FastAPIEntry["FastAPI Application<br/>(main.py / api/index.py)"]
    end

    subgraph CoreServices ["Backend Application Services"]
        AuthSvc["Identity & Multi-Tenancy Service"]
        ReqSvc["AI Requisition Service (LangGraph)"]
        ScreenSvc["Candidate Screening & Matching Engine"]
        IntSvc["Interview & Calendar Engine"]
        WorkOrderSvc["Work Order & Onboarding Service"]
        BillingSvc["Billing, SOW & Invoicing Engine"]
        HMAgent["Hiring Manager Conversational Agent"]
    end

    subgraph DataAndAI ["Storage & Inference Layer"]
        MongoDB[("MongoDB Atlas Database<br/>(Multi-Tenant Collections)")]
        GroqLLM["Groq Llama-3 / Mixtral Engine<br/>(Key-Rotation Manager)"]
        SMTPMail["Gmail SMTP Server<br/>(Automated Notifications)"]
    end

    Web --> VercelEdge
    CandidateUI --> VercelEdge
    TG --> FastAPIEntry
    Cliq --> VercelEdge
    VercelEdge --> ASGIMiddleware --> FastAPIEntry

    FastAPIEntry --> AuthSvc
    FastAPIEntry --> ReqSvc
    FastAPIEntry --> ScreenSvc
    FastAPIEntry --> IntSvc
    FastAPIEntry --> WorkOrderSvc
    FastAPIEntry --> BillingSvc
    FastAPIEntry --> HMAgent

    AuthSvc --> MongoDB
    ReqSvc --> MongoDB
    ReqSvc --> GroqLLM
    ScreenSvc --> MongoDB
    ScreenSvc --> GroqLLM
    IntSvc --> MongoDB
    IntSvc --> SMTPMail
    WorkOrderSvc --> MongoDB
    BillingSvc --> MongoDB
    HMAgent --> GroqLLM
```

---

## 3. AI & Machine Learning Architecture

TermJobs embeds specialized AI agents throughout the recruitment and workforce lifecycle.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        AI AGENTS IN TERMJOBS                           │
├───────────────────────────────┬────────────────────────────────────────┤
│ 1. Requisition Agent (LangGraph)│ Drafts structured JDs, enforces limits │
│ 2. Candidate Screener         │ Match score (0-100%), GitHub repo scan │
│ 3. Interview Communication AI │ Assesses candidate tone, vocabulary    │
│ 4. Hiring Manager Agent       │ Conversational assistant across 3 UIs  │
│ 5. SuperAdmin & Voice Pipeline│ Platform metrics, Groq key rotation    │
└───────────────────────────────┴────────────────────────────────────────┘
```

### 3.1 Requisition Agent (LangGraph State Graph)
Located in [`backend/modules/requisition/agent/graph.py`](file:///Users/mac/Desktop/asimovex/TERMJOB/backend/modules/requisition/agent/graph.py), the Requisition Agent handles conversational multi-turn Job Description (JD) drafting.

- **Checkpointer**: Uses `langgraph-checkpoint-mongodb` to persist state across turns, enabling users to refine requisitions iteratively.
- **Workflow Nodes**:
  1. `intake_input`: Ingests free-form user message and conversational context.
  2. `enrich_heuristics`: Uses [`heuristics.py`](file:///Users/mac/Desktop/asimovex/TERMJOB/backend/modules/requisition/enrichment/heuristics.py) to automatically suggest market salary bands, required skills, and compliance criteria.
  3. `evaluate_guardrails`: Runs [`guardrails.py`](file:///Users/mac/Desktop/asimovex/TERMJOB/backend/modules/requisition/agent/guardrails.py) to ensure non-discrimination, budget compliance, and mandatory enterprise fields.
  4. `llm_generate`: Invokes Groq LLM to generate the final structured Job Description.

```mermaid
stateDiagram-v2
    [*] --> IntakeInput
    IntakeInput --> EnrichHeuristics
    EnrichHeuristics --> EvaluateGuardrails
    EvaluateGuardrails --> LLMGenerate
    LLMGenerate --> MongoDBCheckpointer
    MongoDBCheckpointer --> [*]
```

### 3.2 Candidate Screening & Matching Engine
Located in [`backend/modules/resume_screener/`](file:///Users/mac/Desktop/asimovex/TERMJOB/backend/modules/resume_screener/), this module calculates fit between resumes and open requisitions:
- **Document Text Extractor**: Extracts text from PDF (`pypdf`, `pymupdf` fallback) and DOCX (`python-docx`).
- **LLM Extraction**: Normalizes extracted data into a structured schema (candidate name, years of experience, core tech stack, education, past companies).
- **GitHub Intelligence Agent**: Parses public developer GitHub profiles to evaluate commit frequency, public repository stacks, and code authenticity.
- **Match Score Formula**: Generates an overall 0–100% score combining skills overlap, experience suitability, and rate alignment.

### 3.3 Communication & Sentiment Analyzer
Located in [`backend/modules/interview/services/communication_analyzer.py`](file:///Users/mac/Desktop/asimovex/TERMJOB/backend/modules/interview/services/communication_analyzer.py):
- Analyzes candidate text and transcribed audio from interviews.
- Evaluates:
  - Technical vocabulary relevance
  - Answer completeness
  - Confidence and conciseness indicators
  - Sentiment neutrality and communication tone

### 3.4 Hiring Manager Omnichannel Agent
Located in [`backend/modules/hiring_manager_agent/agent.py`](file:///Users/mac/Desktop/asimovex/TERMJOB/backend/modules/hiring_manager_agent/agent.py):
- Powers conversational operations across Web, Telegram, and Zoho Cliq.
- Implements fuzzy string matching with `rapidfuzz` for typo-tolerant candidate and role search.
- Tool-calling system routes commands:
  - *Drafting requisitions*
  - *Checking pending timesheets & expenses*
  - *Retrieving candidate profiles & match scores*
  - *Scheduling interviews & approving time entries*

### 3.5 Groq API Key Rotation Manager
Located in [`backend/modules/superadmin_agent/groq_manager.py`](file:///Users/mac/Desktop/asimovex/TERMJOB/backend/modules/superadmin_agent/groq_manager.py):
- Maintains a pool of Groq API keys.
- Automatically detects HTTP `429 Rate Limit Exceeded` or invalid key states.
- Rotates to the next healthy key in round-robin sequence without dropping in-flight user requests.

---

## 4. Backend Services & Modular Architecture

The backend is built with **FastAPI** running on **Python 3.12**, organized into domain-driven modules inside [`backend/modules/`](file:///Users/mac/Desktop/asimovex/TERMJOB/backend/modules/).

```
backend/
├── main.py                     # Primary FastAPI application and route registry
├── vercel.json                 # Serverless routing and rewrites
├── requirements.txt            # Production dependencies
├── api/
│   └── index.py                # Serverless entrypoint
└── modules/
    ├── identity/               # Users, tenants, authentication, RBAC
    ├── requisition/            # LangGraph requisition state machine
    ├── candidate/              # Resumes, submissions, outreach
    ├── resume_screener/        # Match scoring, GitHub analysis
    ├── interview/              # Schedules, ICS links, SMTP invite emails
    ├── candidate_portal/       # Candidate interview view
    ├── workorder/              # Work contracts and vendor assignments
    ├── onboarding/             # Compliance, background checks, provisioning
    ├── billing/                # Timesheets, expense claims, SOWs, invoices
    ├── workforce/              # Headcount analytics, spend tracking
    ├── hm_telegram_bot/        # Telegram Bot integration
    ├── hm_zoho_cliq/           # Zoho Cliq integration (Deluge webhooks)
    ├── hiring_manager_agent/   # Core multi-turn agent logic
    ├── superadmin_agent/       # Health checks, Groq key rotation
    └── shared/                 # Database connection, settings, helpers
```

### Module Responsibilities

| Module | Core Responsibility | Key Models / Entities |
| :--- | :--- | :--- |
| **`identity`** | Multi-tenant auth, user lifecycle, roles, vendor partnerships | `User`, `Tenant`, `VendorEngagement` |
| **`requisition`** | JD drafting, approval flows, budget limits | `Requisition` |
| **`candidate`** | Resume intake, candidate submissions, candidate pipeline | `Candidate`, `CandidateSubmission` |
| **`interview`** | Schedules, ICS calendar files, meeting room generation | `InterviewSchedule` |
| **`workorder`** | Contractor work orders, start/end dates, hourly billing caps | `WorkOrder` |
| **`onboarding`** | Provisioning checks, background verification, compliance docs | `OnboardingItem` |
| **`billing`** | Weekly contractor timesheets, expense claims, SOWs, invoices | `Timesheet`, `Expense`, `Invoice`, `SOW` |
| **`workforce`** | Aggregated analytics, contractor spend, headcount forecasts | Analytics aggregations |
| **`hm_zoho_cliq`** | Zoho Cliq Message & Action webhook processing | Deluge message cards & buttons |
| **`hm_telegram_bot`**| Telegram Bot polling, session management, keyboard builders | Telegram sessions & callbacks |

---

## 5. Frontend Application & User Portals

The frontend is a single-page application built with **React 18** and **Vite**, using a curated **Vanilla CSS Design System** located in [`frontend/src/index.css`](file:///Users/mac/Desktop/asimovex/TERMJOB/frontend/src/index.css).

```
frontend/src/
├── App.jsx                     # Route declarations and role-based guards
├── main.jsx                    # Application entrypoint
├── index.css                   # Unified CSS design system & tokens
├── context/                    # AuthContext and TenantContext
├── api/                        # HTTP client wrappers
└── pages/
    ├── SuperAdminDashboard.jsx # Platform admin, tenant management, key health
    ├── DirectorDashboard.jsx   # Requisition & Work Order approval dashboard
    ├── HiringManagerDashboard.jsx # Role management, candidate tracking, approvals
    ├── AiChat.jsx              # Web-based conversational hiring manager AI
    ├── RecruiterDashboard.jsx  # Vendor portal for receiving jobs & submitting candidates
    ├── FinanceDashboard.jsx    # Invoice verification, contractor billing, payouts
    ├── ProcurementDashboard.jsx# Vendor agreements and compliance
    └── interview/              # Candidate interview room & assessment view
```

### Role-Based Access Matrix

| Role | Permitted Pages & Capabilities |
| :--- | :--- |
| **SuperAdmin** | Platform configuration, tenant creation, global candidate pool, Groq key monitoring |
| **Director** | Requisition budget approval, work order issuance, executive agreements |
| **Hiring Manager** | Requisition drafting via AI, candidate shortlist review, interview scheduling, timesheet/expense approvals |
| **Recruiter / Vendor** | Reviewing dispatched requisitions, submitting candidate profiles and resumes, tracking candidate status |
| **Finance** | Approving vendor invoices, auditing contractor hours, verifying expense receipts |
| **Procurement** | Managing vendor compliance, standard master services agreements (MSA), onboarding checklists |
| **Candidate** | Viewing interview invitations, joining video meetings, completing profile assessments |

---

## 6. Database Schema & Data Models

TermJobs uses **MongoDB** with multi-tenant scoping. All documents carry a `tenant_id` field to isolate client organization data.

```mermaid
erDiagram
    TENANTS ||--o{ USERS : contains
    TENANTS ||--o{ REQUISITIONS : owns
    TENANTS ||--o{ WORKORDERS : executes
    REQUISITIONS ||--o{ CANDIDATE_SUBMISSIONS : receives
    CANDIDATE_SUBMISSIONS ||--o{ INTERVIEW_SCHEDULES : evaluated_by
    CANDIDATE_SUBMISSIONS ||--|| WORKORDERS : converts_to
    WORKORDERS ||--o{ TIMESHEETS : bills
    WORKORDERS ||--o{ EXPENSES : incurs
    WORKORDERS ||--o{ SOWS : formalized_in
    SOWS ||--o{ INVOICES : generates
```

### Key Collections & Schemas

#### 1. `tenants`
```json
{
  "_id": "ObjectId",
  "id": "tenant_123",
  "name": "Acme Corporation",
  "domain": "acme.com",
  "plan": "enterprise",
  "settings": {
    "currency": "USD",
    "require_director_approval": true
  },
  "created_at": "ISODate"
}
```

#### 2. `users`
```json
{
  "_id": "ObjectId",
  "id": "usr_456",
  "tenant_id": "tenant_123",
  "name": "Sarah Connor",
  "email": "sarah@acme.com",
  "hashed_password": "$2b$12$...",
  "role": "hiring_manager",
  "status": "active"
}
```

#### 3. `requisitions`
```json
{
  "_id": "ObjectId",
  "id": "req_789",
  "tenant_id": "tenant_123",
  "title": "Senior Cloud Infrastructure Engineer",
  "department": "Platform Engineering",
  "employment_type": "Contract",
  "duration": "6 Months",
  "budget_range": "$90 - $110 / hr",
  "skills": ["AWS", "Kubernetes", "Terraform", "Python"],
  "status": "pending_director_approval",
  "created_by": "usr_456",
  "description": "Full JD generated by LangGraph Requisition Agent...",
  "created_at": "ISODate"
}
```

#### 4. `candidate_submissions`
```json
{
  "_id": "ObjectId",
  "id": "cand_101",
  "tenant_id": "tenant_123",
  "requisition_id": "req_789",
  "vendor_id": "vendor_999",
  "candidate_name": "Alex Mercer",
  "email": "alex.mercer@gmail.com",
  "match_score": 92,
  "match_breakdown": {
    "skills_fit": 95,
    "experience_fit": 90,
    "rate_fit": 91
  },
  "github_profile": "https://github.com/alexmercer",
  "resume_file_url": "s3://termjobs-resumes/alex_resume.pdf",
  "status": "shortlisted"
}
```

#### 5. `interview_schedules`
```json
{
  "_id": "ObjectId",
  "id": "int_202",
  "tenant_id": "tenant_123",
  "candidate_id": "cand_101",
  "requisition_id": "req_789",
  "proposed_date": "2026-10-15",
  "proposed_time": "02:00 PM EST",
  "interview_type": "Technical Round",
  "meeting_link": "https://meet.google.com/xyz-abcd-efg",
  "passcode": "TJ-8849",
  "calendar_links": {
    "google": "https://calendar.google.com/calendar/render?...",
    "ics": "https://termjobs.in/api/interviews/int_202/calendar.ics"
  },
  "status": "confirmed"
}
```

#### 6. `workorders` & `timesheets`
```json
{
  "_id": "ObjectId",
  "id": "wo_303",
  "tenant_id": "tenant_123",
  "requisition_id": "req_789",
  "candidate_id": "cand_101",
  "vendor_id": "vendor_999",
  "hourly_rate": 95.0,
  "start_date": "2026-11-01",
  "end_date": "2027-05-01",
  "max_weekly_hours": 40,
  "status": "active"
}
```

---

## 7. API Endpoints & Integration Contracts

The backend exposes RESTful endpoints with full CORS and serverless route forwarding.

### 7.1 Authentication & Multi-Tenancy (`/api/auth`, `/api/identity`)
- `POST /api/auth/login`: Authenticates credentials; returns JWT bearer token and user role.
- `POST /api/auth/register`: Onboards new user accounts within a tenant.
- `GET /api/identity/tenants`: Lists tenant organizations (SuperAdmin only).
- `POST /api/identity/vendors`: Connects an approved staffing vendor to a tenant.

### 7.2 Requisition Service (`/api/requisition`)
- `POST /api/requisitions/agent/chat`: Multi-turn conversational endpoint invoking LangGraph state machine.
- `POST /api/requisitions`: Creates a draft requisition.
- `GET /api/requisitions`: Lists requisitions scoped to tenant and role.
- `PATCH /api/requisitions/{id}/approve`: Approves requisition for vendor dispatch (Director only).
- `POST /api/requisitions/{id}/dispatch`: Dispatches requisition to approved vendors.

### 7.3 Candidate & Screening Engine (`/api/candidate`, `/api/resume-screener`)
- `POST /api/candidates/submit`: Vendors submit candidate resumes (multipart PDF/DOCX) for an open requisition.
- `POST /api/resume-screener/match`: Triggers AI match score calculation between resume and requisition.
- `GET /api/candidates/shortlist`: Returns top-ranked candidates for a role.
- `PATCH /api/candidates/{id}/status`: Updates candidate pipeline stage (`Shortlisted`, `Rejected`, `Hired`).

### 7.4 Interview Logistics (`/api/interviews`)
- `POST /api/interviews/schedule`: Creates interview proposal, generates meeting room link, and triggers Gmail invitation.
- `GET /api/interviews/{id}/calendar.ics`: Returns standard RFC-5545 iCalendar file for Outlook/Apple Calendar sync.
- `POST /api/interviews/{id}/analyze-communication`: Submits interview transcript to AI analyzer.

### 7.5 Work Orders, Onboarding & Billing (`/api/workorder`, `/api/billing`)
- `POST /api/workorders`: Converts an accepted candidate into a formal contract work order.
- `GET /api/onboarding/{candidate_id}`: Retrieves onboarding compliance checklists (IT setup, background check, NDA).
- `POST /api/billing/timesheets`: Contractor submits weekly work hours.
- `PATCH /api/billing/timesheets/{id}/approve`: Hiring Manager approves timesheet for vendor payout.
- `POST /api/billing/invoices/generate`: Consolidates approved timesheets and expenses into an automated PDF invoice.

### 7.6 Zoho Cliq Enterprise Bot Webhook (`/api/zoho-cliq`)
- `POST /api/zoho-cliq/bot`: Main endpoint receiving inbound Deluge `invokeurl` POST requests from Zoho Cliq.
- `POST /api/zoho-cliq/actions`: Action handler for interactive buttons.
- `GET /api/zoho-cliq/health`: Integration health monitor and configuration check.

---

## 8. End-to-End Business Workflows

### Workflow 1: Requisition Creation to Director Approval
```mermaid
sequenceDiagram
    autonumber
    actor HM as Hiring Manager
    participant Agent as Requisition Agent (LangGraph)
    participant DB as MongoDB
    actor Dir as Director

    HM->>Agent: "Need a Senior React Developer, $80/hr, 6 months"
    Agent->>Agent: Run Heuristics & Guardrails
    Agent->>HM: Returns structured Requisition Draft Preview
    HM->>DB: Submits Draft for Approval
    DB-->>Dir: Notifies Director of pending Requisition
    Dir->>DB: Approves Requisition & Budget Band
    DB->>DB: Marks status = "Approved for Vendor Dispatch"
```

### Workflow 2: Vendor Sourcing to AI Screening & Match Scoring
```mermaid
sequenceDiagram
    autonumber
    actor Vendor as Staffing Vendor
    participant Backend as Candidate API
    participant AI as Resume Screener & GitHub Agent
    participant DB as MongoDB
    actor HM as Hiring Manager

    Vendor->>Backend: Uploads Resume (PDF) & Candidate Profile
    Backend->>AI: Extract text, parse skills, query GitHub
    AI->>AI: Compute Match Score (e.g. 92%)
    AI->>DB: Store Candidate with Match Breakdown
    DB-->>HM: Displays ranked candidates in Shortlist Pool
```

### Workflow 3: Interview Scheduling & Gmail SMTP Dispatch
```mermaid
sequenceDiagram
    autonumber
    actor HM as Hiring Manager (Web / Cliq / TG)
    participant Svc as Interview Service
    participant Mail as Gmail SMTP
    actor Cand as Candidate

    HM->>Svc: "Schedule interview with Alex Mercer for Thursday 3PM"
    Svc->>Svc: Generates Google Meet room & Passcode
    Svc->>Svc: Generates Google Calendar & .ics files
    Svc->>Mail: Dispatches formal invitation email
    Mail-->>Cand: Receives email with calendar event & room link
```

### Workflow 4: Work Order, Onboarding, Timesheets & Invoicing
```mermaid
sequenceDiagram
    autonumber
    actor HM as Hiring Manager
    participant WO as Work Order Service
    actor Cand as Candidate (Contractor)
    participant Bill as Billing Engine
    actor Fin as Finance

    HM->>WO: Hires candidate -> Generates Work Order (WO-303)
    WO->>Cand: Initiates Onboarding Checkpoints (NDA, Tech Provisioning)
    Cand->>Bill: Submits Weekly Timesheet (40 Hours)
    Bill-->>HM: Reviews & Approves Timesheet
    Bill->>Bill: Generates Vendor SOW & Monthly Invoice
    Fin->>Bill: Reviews and Disburses Vendor Invoice
```

---

## 9. Third-Party Integrations

### 9.1 Zoho Cliq Enterprise Bot Integration
The platform integrates directly into **Zoho Cliq**, allowing Hiring Managers to execute workflows from within their enterprise team chat.

- **Endpoint**: `https://termjobs.in/api/zoho-cliq/bot`
- **Deluge Middleware**: Zoho Cliq's Bot Message Handler invokes TermJobs via Deluge's `invokeurl`:

```deluge
// Zoho Cliq Message Handler Deluge Script
apiUrl = "https://termjobs.in/api/zoho-cliq/bot";

params = Map();
params.put("message", message);
params.put("user", user);
params.put("chat", chat);

headerMap = Map();
headerMap.put("Content-Type", "application/json");

resp = invokeurl
[
    url: apiUrl
    type: POST
    body: params.toString()
    headers: headerMap
];

if(resp != null)
{
    try
    {
        return resp.toMap();
    }
    catch (e)
    {
        return resp;
    }
}

resMap = Map();
resMap.put("text", "⚠️ Unable to connect to TermJobs backend.");
return resMap;
```

- **Interactive Card Schema**:
  Zoho Cliq strictly requires interactive buttons to be nested inside the `card` object, capped at **5 buttons** per message:

```json
{
  "text": "*Welcome to TermJobs AI Hiring Assistant!* 🤖\n\nI am your dedicated enterprise workforce assistant...",
  "card": {
    "title": "⚡ TermJobs Hiring Manager AI",
    "theme": "modern-inline",
    "buttons": [
      {
        "label": "⚡ Pending Works",
        "type": "+",
        "key": "menu:pending_works",
        "action": {
          "type": "invoke.function",
          "data": { "key": "menu:pending_works" }
        }
      },
      {
        "label": "👥 Candidates",
        "type": "+",
        "key": "menu:candidates",
        "action": {
          "type": "invoke.function",
          "data": { "key": "menu:candidates" }
        }
      },
      {
        "label": "👷 Working Hires",
        "type": "+",
        "key": "menu:accepted_candidates",
        "action": {
          "type": "invoke.function",
          "data": { "key": "menu:accepted_candidates" }
        }
      },
      {
        "label": "📋 Requisitions",
        "type": "+",
        "key": "menu:requisitions",
        "action": {
          "type": "invoke.function",
          "data": { "key": "menu:requisitions" }
        }
      },
      {
        "label": "📊 Pipeline Stats",
        "type": "+",
        "key": "menu:stats",
        "action": {
          "type": "invoke.function",
          "data": { "key": "menu:stats" }
        }
      }
    ]
  }
}
```

### 9.2 Telegram Bot Integration (`@hm_term_bot`)
Located in [`backend/modules/hm_telegram_bot/`](file:///Users/mac/Desktop/asimovex/TERMJOB/backend/modules/hm_telegram_bot/):
- Handles webhook updates and local polling.
- Inline keyboard builders render the same hiring manager actions (interview proposals, candidate shortlists, timesheet approval notifications) directly in Telegram chats.

### 9.3 Gmail SMTP Dispatcher
Located in [`backend/modules/interview/services/interview_service.py`](file:///Users/mac/Desktop/asimovex/TERMJOB/backend/modules/interview/services/interview_service.py):
- Dispatches professional HTML-formatted candidate interview invitations.
- Includes candidate portal login credentials, meeting room link, calendar links, and interview prep guidelines.

---

## 10. Infrastructure, Deployment & Security

### 10.1 Vercel Serverless Hosting Architecture
The application runs on Vercel's serverless compute infrastructure:
- **Root Rewrites (`vercel.json`)**:
  ```json
  {
    "rewrites": [
      {
        "source": "/api/(.*)",
        "destination": "/api/index.py?__vercel_path=/api/$1"
      },
      {
        "source": "/api",
        "destination": "/api/index.py?__vercel_path=/api"
      },
      {
        "source": "/health",
        "destination": "/api/index.py?__vercel_path=/health"
      },
      {
        "source": "/ping",
        "destination": "/api/index.py?__vercel_path=/ping"
      },
      {
        "source": "/(.*)",
        "destination": "/api/index.py?__vercel_path=/$1"
      }
    ]
  }
  ```
- **Cold-Start Guarding**:
  Database migrations and background polling loops are automatically bypassed when `VERCEL=1` is detected in the environment, preventing serverless cold-start timeouts.

### 10.2 Environment Configuration
Required environment variables in `.env`:

```ini
# Application Core
ENVIRONMENT=production
VERCEL=1
SECRET_KEY=your_jwt_secret_key_here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# MongoDB Atlas
MONGODB_URL=mongodb+srv://username:password@cluster.mongodb.net/termjobs?retryWrites=true&w=majority
DATABASE_NAME=termjobs

# AI & LLM (Groq)
GROQ_API_KEY=gsk_...
GROQ_API_KEYS=gsk_key1,gsk_key2,gsk_key3
LLM_PROVIDER=groq
LLM_MODEL=llama-3.3-70b-versatile

# Integrations
GMAIL_USER=notifications@termjobs.in
GMAIL_APP_PASSWORD=your_gmail_app_password
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
ZOHO_CLIQ_BOT_URL=https://cliq.zoho.in/api/v2/bots/hiringmanagerterm/message
```

### 10.3 Security & Compliance Controls
1. **Password Hashing**: Salted `bcrypt` hashing across all user credentials.
2. **Stateless JWT Authorization**: Bearer tokens with expiration and signature validation on all protected endpoints.
3. **Tenant Scoping**: Strict multi-tenant isolation enforcing `tenant_id` query filters on all database operations.
4. **Input Sanitization**: Pydantic models validate and sanitize all incoming payloads, protecting against injection attacks.

---

## 11. Quickstart Guide (Local Development)

### 1. Backend Setup
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
API Documentation will be available at: `http://localhost:8000/docs`.

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Web Application will be available at: `http://localhost:5173`.
