# System Architecture & Flow Diagram

This document contains the complete system architecture, end-to-end business flow, and lifecycle state machine diagrams for the **TERMJOB / Bearitt** platform.

---

## 1. High-Level System Architecture

```mermaid
graph TB
    subgraph Users ["Actors & Client Roles"]
        HM["👔 Hiring Manager"]
        DIR["👑 Company Director"]
        REC["🏢 Vendor / Recruiter"]
        CAND["🧑‍💻 Candidate"]
        SA["🛡️ Super Admin"]
    end

    subgraph Frontend ["Frontend Web Application (React + Vite + Tailwind)"]
        direction TB
        UI_AUTH["Auth Context & Session Guard (JWT / RBAC)"]
        UI_HM["Hiring Manager Portal<br/>• Requisition Intake & AI Refinement<br/>• Pipeline & Shortlisted Candidates"]
        UI_DIR["Director Dashboard<br/>• Requisition Approvals<br/>• Agreements (MSA/SOW)<br/>• Work Orders"]
        UI_REC["Vendor & Recruiter Portal<br/>• Requisition Feed<br/>• Candidate Submission & Billing Breakdown"]
        UI_CAND["Candidate Real-Time Portal<br/>• WebRTC AI Interview Room<br/>• Status Tracking"]
        UI_SA["Super Admin Console<br/>• Multi-Tenant Administration<br/>• LLM Keys & System Diagnostics"]
    end

    subgraph Gateway ["FastAPI Application Gateway (:8000)"]
        direction TB
        CORS["CORS & Request Middleware"]
        AUTH_ROUTER["/api/auth (Identity & Multi-Tenancy)"]
        REQ_ROUTER["/requisitions (Requisition Engine)"]
        CAND_ROUTER["/api/candidates (Candidate Ingestion & Matching)"]
        INT_ROUTER["/interview (Pipecat / Real-Time Interview)"]
        WF_ROUTER["/workforce & /workorder (SOW, MSA, Billing)"]
        SA_ROUTER["/api/superadmin (Agent & System Diagnostics)"]
    end

    subgraph AI_Engine ["AI & Real-Time Intelligence Engine"]
        GROQ["Groq LLM (Llama 3.3 / Multi-Key Rotation)"]
        PIPECAT["Pipecat Real-Time AI Audio/Video Pipeline"]
        WEBRTC["SmallWebRTC Media Transport"]
        OCR["Resume & CV Parser / Semantic Extractor"]
    end

    subgraph Storage ["Persistence & Data Stores"]
        SQLITE[("SQLite (requisition.db)<br/>• Requisitions, Structured Roles<br/>• Tenants, Users, Models")]
        MONGO[("MongoDB Atlas<br/>• Resumes, Live Sync<br/>• System Logs, Interview Transcripts")]
        FS[("File System (uploads/)<br/>• Candidate Resumes & Documents")]
    end

    %% User to Frontend Mappings
    HM --> UI_AUTH
    DIR --> UI_AUTH
    REC --> UI_AUTH
    CAND --> UI_AUTH
    SA --> UI_AUTH

    UI_AUTH --> UI_HM
    UI_AUTH --> UI_DIR
    UI_AUTH --> UI_REC
    UI_AUTH --> UI_CAND
    UI_AUTH --> UI_SA

    %% Frontend to API
    UI_HM -->|REST API| REQ_ROUTER
    UI_DIR -->|REST API| REQ_ROUTER
    UI_DIR -->|REST API| WF_ROUTER
    UI_REC -->|REST API| CAND_ROUTER
    UI_REC -->|REST API| WF_ROUTER
    UI_CAND -->|WebRTC + REST| INT_ROUTER
    UI_SA -->|REST API| SA_ROUTER
    UI_AUTH -->|REST API| AUTH_ROUTER

    %% Gateway to Modules
    Gateway --> REQ_ROUTER
    Gateway --> CAND_ROUTER
    Gateway --> INT_ROUTER
    Gateway --> WF_ROUTER
    Gateway --> SA_ROUTER

    %% Modules to AI Engine
    REQ_ROUTER -->|Intake Questions & JD Generation| GROQ
    CAND_ROUTER -->|Resume Text Extraction| OCR
    CAND_ROUTER -->|Scoring & Semantic Eval| GROQ
    INT_ROUTER -->|Conversational Agent| PIPECAT
    PIPECAT -->|LLM Prompts & Responses| GROQ
    PIPECAT <-->|Live Media Streaming| WEBRTC
    WEBRTC <-->|Audio/Video Stream| UI_CAND

    %% Modules to Data Layer
    AUTH_ROUTER --> SQLITE
    REQ_ROUTER --> SQLITE
    REQ_ROUTER --> MONGO
    CAND_ROUTER --> SQLITE
    CAND_ROUTER --> MONGO
    CAND_ROUTER --> FS
    INT_ROUTER --> MONGO
    WF_ROUTER --> SQLITE
    WF_ROUTER --> MONGO
    SA_ROUTER --> MONGO
```

---

## 2. End-to-End Operational Lifecycle & Sequence Flow

```mermaid
sequenceDiagram
    autonumber
    actor HM as 👔 Hiring Manager
    actor DIR as 👑 Company Director
    actor REC as 🏢 Vendor / Recruiter
    actor CAND as 🧑‍💻 Candidate
    participant API as 🚀 FastAPI Backend
    participant AI as 🧠 AI Engine (Groq / Pipecat)
    participant DB as 💾 Data Layer (SQLite + MongoDB)

    %% Phase 1: Requisition Creation & AI Structuring
    Note over HM, AI: Phase 1: Requisition Creation & AI Structuring
    HM->>API: 1. Create Requisition (Title, Dept, Ceilings)
    API->>DB: Save Requisition (Status: Draft)
    HM->>API: 2. Start AI Intake
    API->>AI: Analyze job parameters & generate gap questions
    AI-->>HM: Returns targeted intake questions
    HM->>API: 3. Submit intake answers
    API->>AI: Structure role & generate JD markdown
    AI-->>API: Structured Role Criteria & JD Markdown
    API->>DB: Save (Status: Structuring)

    %% Phase 2: Director Approval & Automatic Publication
    Note over HM, DIR: Phase 2: Director Approval & Automatic Publication
    HM->>API: 4. Submit for Approval (POST /requisitions/{id}/approve)
    API->>DB: Update (Status: PendingApproval)
    Note over DIR: Director reviews commercial parameters & rate cards
    alt Director Rejects
        DIR->>API: POST /requisitions/{id}/reject (with feedback)
        API->>DB: Update (Status: Structuring, rejection_reason set)
        API-->>HM: Alert: Revision requested with Director notes
    else Director Approves
        DIR->>API: POST /requisitions/{id}/director-approve
        API->>DB: Update (Status: Published, director_approved: True)
        API->>DB: Trigger service.publish & broadcast to vendors
        API-->>HM: Status updated to Published (Live to Vendors)
    end

    %% Phase 3: Vendor Submission & AI Resume Screening
    Note over REC, CAND: Phase 3: Vendor Candidate Submission & AI Screening
    REC->>API: 5. View Published Requisitions in Portal
    REC->>API: 6. Upload Candidate Resume PDF (Per-vendor candidate limit enforced)
    API->>AI: 7. OCR & Extract skills, experience, qualifications
    AI->>AI: 8. Match candidate against Structured Role Criteria
    AI-->>API: Candidate Match Score (0–100%) & Evaluation Breakdown
    API->>DB: Store Candidate & Screening Report

    %% Phase 4: AI Voice/Video Interview
    Note over CAND, AI: Phase 4: AI Voice/Video Live Interview
    HM->>API: 9. Shortlist Candidate & invite to AI Interview
    CAND->>API: 10. Join Interview via WebRTC Portal
    API->>AI: Initialize Pipecat agent with Role Questions
    AI<<->>CAND: Conduct interactive real-time technical & behavioral interview
    AI->>API: Generate Transcript & Overall Performance Score
    API->>DB: Store Interview Results in MongoDB
    HM->>API: 11. Review candidate interview scoring & Accept Candidate

    %% Phase 5: Workforce SOW, Work Order & Final Approval
    Note over HM, DIR: Phase 5: Workforce Agreement, SOW & Onboarding
    HM->>API: 12. Initiate SOW & Work Order generation
    API->>DB: Create SOW (commercial rates, start/end dates, limits)
    DIR->>API: 13. Director Sign-off on SOW & Work Order
    API->>DB: Mark SOW & Work Order as "Approved by Director" / ACTIVE
    API-->>REC: Issue executed Work Order & Billing Schedule
    API-->>CAND: Issue onboarding packet & credentials
```

---

## 3. Requisition State Machine Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Draft: HM creates new role
    Draft --> Intake: HM triggers AI Intake
    Intake --> Structuring: Answers submitted & JD generated
    Structuring --> PendingApproval: HM clicks "Proceed to Approval"
    
    state PendingApproval {
        [*] --> AwaitingDirectorReview
        AwaitingDirectorReview --> Rejected: Director requests revisions
        AwaitingDirectorReview --> Approved: Director approves
    }

    Rejected --> Structuring: HM updates criteria based on Director feedback
    Approved --> Published: Automatically promoted to Published (Live)
    
    state Published {
        [*] --> VisibleToVendors
        VisibleToVendors --> CandidateSubmission
        CandidateSubmission --> AIScreening
        AIScreening --> AIInterview
        AIInterview --> CandidateAccepted
    }

    Published --> Closed: HM or Admin closes requisition / role filled
    Closed --> [*]
```

---

## 4. Component Directory & Responsibilities

| Layer | Primary Tech | Key Files / Modules | Core Responsibility |
| :--- | :--- | :--- | :--- |
| **Frontend** | React 18, Vite, Tailwind CSS, Lucide | `src/pages/requisitions/*`<br/>`src/pages/Director*`<br/>`src/pages/candidates/*` | Provides dedicated role-based portals for Hiring Managers, Directors, Vendors, Candidates, and Admins. |
| **API Gateway** | FastAPI, Python 3.12 | `backend/main.py`<br/>`backend/modules/identity/*` | Route handling, authentication/JWT verification, multi-tenant workspace scoping, rate card checks. |
| **Requisition Core** | SQLAlchemy, Pydantic | `backend/modules/requisition/*` | State machine management, question generation, JD assembly, publication triggers. |
| **AI Resume Screener** | Groq LLM, OCR/PDF parsing | `backend/modules/resume_screener/*`<br/>`backend/modules/candidate_screening_agent/*` | Extracts text from CVs, matches against structured role specs, and calculates objective match scores. |
| **AI Interview Engine** | Pipecat, SmallWebRTC | `backend/modules/interview/*` | Real-time conversational voice/video interviewing, dynamic follow-up questioning, transcript scoring. |
| **Workforce & Agreements** | SQLAlchemy, MongoDB | `backend/modules/workforce/*`<br/>`backend/modules/workorder/*` | Statements of Work (SOW), Master Service Agreements (MSA), Director digital signatures, vendor billing. |
| **Persistence** | SQLite + MongoDB Atlas | `backend/modules/shared/db.py`<br/>`backend/requisition.db` | Dual-persistence engine: SQLite for relational transactional consistency; MongoDB for document sync and search. |
