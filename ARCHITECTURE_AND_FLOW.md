# System Architecture & Flow Diagram (Direct Talent Pool Model)

This document contains the complete system architecture, operational lifecycle, and state machine diagrams for the **TERMJOB / Bearitt** platform, reflecting the **Direct Talent Pool** architecture with no vendor intermediary.

---

## 1. High-Level System Architecture

```mermaid
graph TB
    subgraph Users ["Actors & Stakeholders"]
        CAND["🧑‍💻 Candidate (Public Applicant)"]
        HM["👔 Hiring Manager"]
        DIR["👑 Company Director"]
        SA["🛡️ Super Admin (Governance & AI Auditing)"]
    end

    subgraph Frontend ["Frontend Web Application (React + Vite + Tailwind)"]
        direction TB
        UI_FORM["Public Candidate Join Form (/join/candidate)<br/>• No login required, instant 1-click submit<br/>• Name, Email, Role, Resume Drag & Drop"]
        UI_HM["Hiring Manager Hub<br/>• Requisitions & AI Intake Structuring<br/>• Ranked Shortlist & Candidate Selection<br/>• Onboarding Coordinator"]
        UI_DIR["Director Console<br/>• Requisition Sign-off<br/>• Direct Contractor SOW Approvals"]
        UI_CAND["Candidate Magic-Link Experience<br/>• WebRTC AI Interview Room<br/>• Direct Offer & SOW Review"]
        UI_SA["Super Admin Console<br/>• AI Key Rotation & Prompt Governance<br/>• Talent Pool Quality & Audit Trail"]
    end

    subgraph Gateway ["FastAPI Backend Gateway (:8000)"]
        direction TB
        AUTH_ROUTER["/api/auth (Company RBAC & Session)"]
        REQ_ROUTER["/requisitions (Requisition Lifecycle)"]
        CAND_ROUTER["/candidates (Public Ingestion & Talent Pool)"]
        INT_ROUTER["/interview (Pipecat Live Interview Engine)"]
        WF_ROUTER["/workforce & /workorder (Direct SOW & Terms)"]
        SA_ROUTER["/api/superadmin (AI & Key Management)"]
    end

    subgraph AI_Engine ["Platform & AI Intelligence Layer"]
        GROQ["Groq LLM (Llama 3.3 / Auto Key Rotation)"]
        PIPECAT["Pipecat Audio/Video AI Pipeline"]
        WEBRTC["SmallWebRTC Media Transport"]
        OCR["Resume & CV Parser / Skill Extractor"]
        MATCHER["AI Pool Scorer (JD vs. Talent Pool)"]
    end

    subgraph Storage ["Unified Data Layer"]
        SQLITE[("SQLite (requisition.db)<br/>• Requisitions, SOWs, Direct Contracts")]
        MONGO[("MongoDB Atlas<br/>• Candidate Pool, Resumes, Transcripts<br/>• Audit Logs")]
        FS[("File System (uploads/)<br/>• Resume Documents")]
    end

    %% Flow connections
    CAND -->|Direct form submission| UI_FORM
    UI_FORM -->|POST /candidates/join (No Login)| CAND_ROUTER
    HM --> UI_HM
    DIR --> UI_DIR
    SA --> UI_SA

    UI_HM --> REQ_ROUTER
    UI_HM --> CAND_ROUTER
    UI_DIR --> REQ_ROUTER
    UI_DIR --> WF_ROUTER
    UI_CAND --> INT_ROUTER
    UI_CAND --> WF_ROUTER
    UI_SA --> SA_ROUTER

    %% AI Pipeline
    CAND_ROUTER --> OCR
    OCR --> MONGO
    REQ_ROUTER --> GROQ
    REQ_ROUTER --> MATCHER
    MATCHER --> GROQ
    MATCHER --> MONGO
    INT_ROUTER --> PIPECAT
    PIPECAT --> GROQ
    PIPECAT <--> WEBRTC
    WEBRTC <--> UI_CAND
    WF_ROUTER --> GROQ

    %% Data persistence
    AUTH_ROUTER --> SQLITE
    REQ_ROUTER --> SQLITE
    CAND_ROUTER --> MONGO
    CAND_ROUTER --> FS
    WF_ROUTER --> SQLITE
    WF_ROUTER --> MONGO
    SA_ROUTER --> MONGO
```

---

## 2. End-to-End Operational Lifecycle Flow (Direct Candidate Pool)

```mermaid
sequenceDiagram
    autonumber
    actor CAND as 🧑‍💻 Candidate
    actor HM as 👔 Hiring Manager
    actor DIR as 👑 Company Director
    participant API as 🚀 FastAPI Backend
    participant AI as 🧠 AI & Matching Engine
    participant DB as 💾 Talent Pool & Database

    %% Step 0: Candidate joins directly
    Note over CAND, DB: Step 0: Candidate joins (Frictionless Public Form)
    CAND->>API: 0. Fill public form & upload resume (No Login Required)
    API->>AI: Parse resume text & extract skills via OCR/LLM
    API->>DB: Save in review-gated Candidate Pool (Status: In Pool)
    API-->>CAND: Instant confirmation screen: "Enrolled in Talent Pool"

    %% Step 1 & 2: Company posts JD & AI Scores Pool
    Note over HM, AI: Step 1 & 2: Requisition Approval & AI Pool Scoring
    HM->>API: 1. Create Requisition & complete AI structuring
    DIR->>API: Formally approve requisition
    API->>DB: Status: Published (Live to Platform)
    API->>AI: 2. Automatically score new JD against all candidates in Pool
    AI->>DB: Generate ranked shortlist with match scores (0–100%)

    %% Step 3 & 4: Company review & AI Interview
    Note over HM, CAND: Step 3 & 4: Ranked Shortlist Review & AI Interview
    HM->>API: 3. Review ranked shortlist of matched candidates
    HM->>API: 4. Invite top candidate(s) to AI Voice/Video Interview
    API-->>CAND: Email secure interview magic link (/interview/room/{id})
    CAND->>API: Join AI interview session (WebRTC)
    AI<<->>CAND: Conduct real-time interactive technical & behavioral interview
    AI->>DB: Save interview recording, transcript, and score

    %% Step 5, 6, 7: Selection, AI SOW & Sign-off
    Note over HM, DIR: Step 5, 6 & 7: Candidate Selection & Direct SOW Sign-off
    HM->>API: 5. Select winning candidate after interview review
    API->>AI: 6. AI drafts direct Contractor SOW (Rate, Dates, Scope, Terms)
    DIR->>API: 6. Director reviews and digitally signs SOW
    API->>DB: SOW Status: Approved by Director / ACTIVE
    HM->>API: 7. Hiring Manager coordinates the start date

    %% Step 8, 9, 10: Candidate Portal, Onboarding & Pool Return
    Note over CAND, DB: Step 8, 9 & 10: Offer, Onboarding & Lifecycle Loop
    API-->>CAND: 8 & 9. Send magic link to Candidate Portal (Offer, Documents, SOW)
    CAND->>API: Accept offer & submit onboarding documents
    API->>DB: 10. Candidate Active on Engagement (Timesheets & Deliverables)
    Note over CAND, DB: Contract Completion Loop
    DB-->>DB: Contract ends / completed
    DB->>DB: Candidate automatically returns to Candidate Pool for future roles!
```

---

## 3. Requisition & Talent Pool State Machine

```mermaid
stateDiagram-v2
    [*] --> InPool: Candidate submits public form (No Login)
    
    state CandidatePool {
        InPool --> Scored: Requisition published & AI scores pool
        Scored --> Shortlisted: HM reviews ranked list & selects for interview
        Shortlisted --> Interviewing: Candidate completes AI interview
        Interviewing --> Selected: HM selects candidate
        Selected --> OfferAndSOW: AI drafts SOW & Director signs
        OfferAndSOW --> ActiveEngagement: Candidate starts contract
        ActiveEngagement --> InPool: Returns to pool when contract ends
    }
```
