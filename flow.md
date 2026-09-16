# Term Jobs Platform — End-to-End System Architecture & Process Flowcharts

**Document Version:** 1.0  
**Target Audience:** Engineering, Product, QA, Architecture & Operations  
**System:** Term Jobs (Enterprise Contract Workforce & Vendor Management System)  
**Date:** September 2026  

---

## Table of Contents
1. [Master System High-Level Architecture](#1-master-system-high-level-architecture)
2. [Multi-Tenant Onboarding & RBAC Ecosystem](#2-multi-tenant-onboarding--rbac-ecosystem)
3. [Unified Authentication & Dynamic Route Guarding](#3-unified-authentication--dynamic-route-guarding)
4. [Job Requisition Lifecycle & Director Governance Flowchart](#4-job-requisition-lifecycle--director-governance-flowchart)
5. [Vendor Candidate Sourcing & Duplicate Prevention Flowchart](#5-vendor-candidate-sourcing--duplicate-prevention-flowchart)
6. [AI Resume Screening & Semantic Scoring Engine](#6-ai-resume-screening--semantic-scoring-engine)
7. [LiveKit AI Video Interview & Evaluation Engine](#7-livekit-ai-video-interview--evaluation-engine)
8. [Commercial Work Order (SOW) & Multi-Tier Sign-Off Flowchart](#8-commercial-work-order-sow--multi-tier-sign-off-flowchart)
9. [Digital Candidate Onboarding & Activation Gates](#9-digital-candidate-onboarding--activation-gates)
10. [Active Contractor Timesheets, Approvals & Billing Flowchart](#10-active-contractor-timesheets-approvals--billing-flowchart)
11. [Contractor Offboarding & 48-Hour Deactivation Lifecycle](#11-contractor-offboarding--48-hour-deactivation-lifecycle)
12. [System State Machine & Database Entity Mapping](#12-system-state-machine--database-entity-mapping)

---

## 1. Master System High-Level Architecture

```mermaid
flowchart TD
    subgraph Frontend_Client ["Frontend (Vite / React SPA)"]
        UI_Login["Unified Auth (/login)"]
        UI_SA["Super Admin Dashboard"]
        UI_Admin["Company Admin Portal"]
        UI_Dir["Director Governance Portal"]
        UI_HM["Hiring Manager Workspace"]
        UI_Vendor["Vendor Partner Portal"]
        UI_Cand["Candidate / Contractor Portal"]
        UI_LiveKit["LiveKit Interview Room"]
    end

    subgraph Edge_Gateway ["Vercel Edge / API Gateway"]
        Rewrite["/api/* Route Handler"]
        CORS["CORS & Origin Security Filter"]
    end

    subgraph Backend_FastAPI ["Backend (FastAPI Core Server)"]
        Mod_Auth["Identity & RBAC Engine"]
        Mod_Req["Requisition State Machine"]
        Mod_Screen["Screening & Match Engine"]
        Mod_LiveKit["LiveKit Room & Token Service"]
        Mod_WO["Work Order & Agreement Engine"]
        Mod_TS["Timesheet & Billing Engine"]
        Mod_Off["Offboarding & Lifecycle Worker"]
    end

    subgraph External_AI_Services ["External Cloud & AI Integrations"]
        Groq["Groq Cloud LLM (Llama 3.3)"]
        LiveKit_Cloud["LiveKit Cloud WebRTC Server"]
        Resend["Resend / SMTP Email Provider"]
        GCal["Google Calendar API"]
    end

    subgraph Persistence_Layer ["Multi-Engine Persistence"]
        MongoDB[("MongoDB Atlas (Docs, SOWs, Logs, Checklists)")]
        SQLite[("SQLAlchemy Engine (Requisitions & Rate Cards)")]
    end

    UI_Login --> Edge_Gateway
    UI_SA --> Edge_Gateway
    UI_Admin --> Edge_Gateway
    UI_Dir --> Edge_Gateway
    UI_HM --> Edge_Gateway
    UI_Vendor --> Edge_Gateway
    UI_Cand --> Edge_Gateway
    UI_LiveKit <--> LiveKit_Cloud

    Edge_Gateway --> Backend_FastAPI

    Backend_FastAPI --> MongoDB
    Backend_FastAPI --> SQLite
    Backend_FastAPI --> Groq
    Backend_FastAPI --> LiveKit_Cloud
    Backend_FastAPI --> Resend
    Backend_FastAPI --> GCal
```

---

## 2. Multi-Tenant Onboarding & RBAC Ecosystem

```mermaid
flowchart TD
    Start([Super Admin Provisions Ecosystem]) --> SelectType{Entity To Onboard?}
    
    %% Company Flow
    SelectType -->|Company / Enterprise| OnboardCo["Fill Company Name, Industry, Size, HQ Location, Admin Name, Email, Password"]
    OnboardCo --> CheckCoName{Company Name Available?}
    CheckCoName -->|No| CoNameErr[Display Taken Warning] --> OnboardCo
    CheckCoName -->|Yes| CreateCoTenant["POST /api/auth/tenants (type=company)"]
    CreateCoTenant --> CreateCoAdmin["POST /api/auth/users (role=Admin)"]
    CreateCoAdmin --> CoActive[Company Workspace Initialized with Clean Rate Cards]

    %% Vendor Flow
    SelectType -->|Staffing Agency / Vendor| OnboardVen["Fill Agency Name, Specializations, Location, Admin Name, Email, Password"]
    OnboardVen --> CheckVenName{Agency Name Available?}
    CheckVenName -->|No| VenNameErr[Display Taken Warning] --> OnboardVen
    CheckVenName -->|Yes| CreateVenTenant["POST /api/auth/tenants (type=vendor)"]
    CreateVenTenant --> CreateVenAdmin["POST /api/auth/users (role=Recruiter)"]
    CreateVenAdmin --> VenActive[Vendor Agency Initialized]

    %% Engagement Flow
    CoActive --> Engage["Company Admin / Super Admin Engages Vendor"]
    VenActive --> Engage
    Engage --> GenMSA["Establish Master Services Agreement (MSA) & Tiered Margin Rules"]
    GenMSA --> ReadyToSource[Vendor Authorized to Receive Published Requisitions]
```

---

## 3. Unified Authentication & Dynamic Route Guarding

```mermaid
flowchart TD
    UserNav([User Navigates to Platform]) --> HasToken{Valid JWT in Storage?}
    
    HasToken -->|No| ShowLogin["Render Unified Login Page (/login)"]
    HasToken -->|Yes| ValidateMe["GET /api/auth/me"]

    ShowLogin --> SubmitCreds["Submit Email + Password"]
    SubmitCreds --> Authenticate["POST /api/auth/token"]
    
    Authenticate --> AuthCheck{Credentials Valid?}
    AuthCheck -->|No| ShowAuthError["Show 'Invalid email or password'"] --> ShowLogin
    AuthCheck -->|Yes| IssueJWT["Generate JWT (claims: user_id, role, tenant_id, tenant_name)"]
    IssueJWT --> RouteUser

    ValidateMe --> TokenCheck{Token Active & Unexpired?}
    TokenCheck -->|Invalid / Expired| ClearStorage["Wipe LocalStorage & Redirect to /login"]
    TokenCheck -->|Valid| RouteUser{User Role Evaluator}

    RouteUser -->|Super Admin| R_SA["/dashboard/superadmin (Full System Oversight)"]
    RouteUser -->|Admin| R_Admin["/dashboard/admin (Company Operations & Rates)"]
    RouteUser -->|Director| R_Dir["/dashboard/director (Executive Approvals & SOWs)"]
    RouteUser -->|Hiring Manager| R_HM["/dashboard/hiring-manager (Pipeline & Interviews)"]
    RouteUser -->|Vendor / Recruiter| R_Vendor["/dashboard/vendor (Sourcing & Submissions)"]
    RouteUser -->|Candidate / Contractor| R_Cand["/dashboard/candidate (Portal & Timesheets)"]

    LegacyRedirect["User hits /candidate/login or /director/login"] --> RedirectToUnified["Permanent Redirect to /login with state"]
```

---

## 4. Job Requisition Lifecycle & Director Governance Flowchart

```mermaid
flowchart TD
    subgraph Intake_Phase ["1. Intake & Definition"]
        HM_Start([Hiring Manager Initiates Requisition]) --> HM_Input["Input Job Title, Dept, Role Details, Experience, Budget Cap"]
        HM_Input --> JD_Engine["Generate Structured Role & Candidate Requirements"]
        JD_Engine --> ReqDraft["Status: DRAFT"]
    end

    subgraph Rate_Check ["2. Rate Card Compliance"]
        ReqDraft --> RateCardVal{Max Rate <= Agreed Rate Card?}
        RateCardVal -->|Exceeds Cap| VarianceFlag["Flag Variance Warning & Require HR/Admin Justification"]
        RateCardVal -->|Within Cap| SubmitApproval["Submit for Governance Sign-off"]
        VarianceFlag --> SubmitApproval
        SubmitApproval --> StatusPending["Status: PENDING_APPROVAL"]
    end

    subgraph Director_Governance ["3. Director Review & Action"]
        StatusPending --> DirectorQueue["Appears in Director Approvals Queue (/dashboard/director)"]
        DirectorQueue --> DirectorDecision{Director Action}
        
        DirectorDecision -->|Reject| ReqReject["Enter Rejection Reason"]
        ReqReject --> POST_Reject["POST /requisitions/{id}/reject"]
        POST_Reject --> SetStructuring["Status: Structuring, director_approved: False"]
        SetStructuring --> HM_Notify["Hiring Manager Notified with Feedback to Revise"]
        HM_Notify --> HM_Input

        DirectorDecision -->|Approve| POST_Approve["POST /requisitions/{id}/director-approve"]
        POST_Approve --> SetApproved["director_approved: True, director_approved_by: Director"]
        SetApproved --> ClearCache["Invalidate System Cache (_cache.clear())"]
        ClearCache --> SyncMongo["Sync Status to MongoDB & SQLite"]
        SyncMongo --> InstantUI["Director Table Reflects Green 'Approved' Badge"]
    end

    subgraph Publishing ["4. Vendor Broadcast"]
        InstantUI --> PublishReady["Requisition Unlocked for Publishing"]
        PublishReady --> HM_Publish["Hiring Manager Clicks 'Publish Requisition'"]
        HM_Publish --> POST_Publish["POST /api/requisitions/{id}/publish"]
        POST_Publish --> StatusPublished["Status: PUBLISHED"]
        StatusPublished --> Broadcast["Webhooks & Notifications Dispatched to Engaged Vendors"]
    end
```

---

## 5. Vendor Candidate Sourcing & Duplicate Prevention Flowchart

```mermaid
flowchart TD
    Vendor([Vendor Recruiter Opens Requisitions Board]) --> ViewOpen["Browse Requisitions with Status: PUBLISHED"]
    ViewOpen --> SelectReq["Select Requisition & Click 'Submit Candidate'"]
    
    SelectReq --> FormInput["Fill Candidate Name, Email, Phone, Expected Rate, Upload Resume PDF"]
    FormInput --> SubmitAction["POST /api/candidates/submit"]
    
    SubmitAction --> CheckEmailDup{Email Already Exists for this Requisition?}
    CheckEmailDup -->|Yes| BlockDup["400 Error: Candidate Already Submitted by another vendor"]
    BlockDup --> FormInput

    CheckEmailDup -->|No| RateCapCheck{Candidate Rate <= Requisition Max Rate?}
    RateCapCheck -->|No| BlockRate["400 Error: Rate exceeds maximum approved ceiling"]
    BlockRate --> FormInput

    RateCapCheck -->|Yes| SaveCandidate["Insert into candidate_submissions (Status: Submitted)"]
    SaveCandidate --> TriggerScreening["Trigger Asynchronous AI Resume Screening Engine"]
```

---

## 6. AI Resume Screening & Semantic Scoring Engine

```mermaid
flowchart TD
    NewCandidate([Candidate Resume Submitted]) --> ParsePDF["PDF Parser & OCR Extracts Text"]
    ParsePDF --> ExtractEntities["Extract Experience, Tech Stack, Education, Projects"]
    
    ExtractEntities --> LoadJD["Fetch Requisition Structured Role & Mandatory Skills"]
    LoadJD --> GroqScoring["Groq LLM Semantic Match Analysis"]
    
    GroqScoring --> CalculateMetrics["Compute Multi-Dimensional Breakdown:
    - Tech Stack Overlap (40%)
    - Domain Relevance (30%)
    - Experience Alignment (20%)
    - Education / Certifications (10%)"]
    
    CalculateMetrics --> GenSummary["Synthesize Executive Summary, Strengths, and Red Flags"]
    GenSummary --> SaveScore["Persist AI Match Score (0-100%) in DB"]
    
    SaveScore --> ScoreThreshold{Match Score Evaluator}
    ScoreThreshold -->|Score >= 75%| HighMatch["Tag: High Match (Shortlist Recommendation)"]
    ScoreThreshold -->|50% - 74%| MediumMatch["Tag: Moderate Match (Manual Review Required)"]
    ScoreThreshold -->|Score < 50%| LowMatch["Tag: Low Match (Review or Fast-Reject)"]
    
    HighMatch --> Pipeline["Display in Hiring Manager Candidate Kanban"]
    MediumMatch --> Pipeline
    LowMatch --> Pipeline
```

---

## 7. LiveKit AI Video Interview & Evaluation Engine

```mermaid
flowchart TD
    ScheduleStart([Hiring Manager Requests AI Interview]) --> GenRoom["POST /api/interviews/session/create"]
    GenRoom --> CreateLKRoom["LiveKit API Creates Secure WebRTC Room"]
    CreateLKRoom --> GenTokens["Generate Candidate JWT & AI Agent Worker Token"]
    GenTokens --> SendInvite["Email Candidate with Single-Click Interview Link"]

    SendInvite --> CandJoins([Candidate Enters Interview URL])
    CandJoins --> MediaCheck["Browser Requests Camera & Microphone Permissions"]
    MediaCheck --> ConnectLK["Candidate Connects to LiveKit Room via WebRTC"]
    
    ConnectLK --> AgentGreeting["AI Avatar Bot Joins & Greets Candidate"]
    AgentGreeting --> QuestionLoop["Loop: Technical & Behavioral Questions"]

    subgraph RealTime_Interaction ["Real-time Voice & Video Loop"]
        QuestionLoop --> AIBotSpeaks["TTS Engine Speaks Question"]
        AIBotSpeaks --> CandidateAnswers["Candidate Speaks Answer"]
        CandidateAnswers --> SileroVAD["Client-side Silero VAD Detects Speech Boundaries"]
        SileroVAD --> STT["LiveKit Audio Stream Transcribed via STT"]
        STT --> TranscriptLog["Real-time Transcript Buffered into Session"]
        TranscriptLog --> Evaluator["LLM Evaluates Depth & Follow-up Needed"]
        Evaluator --> NextQuestion{More Questions?}
        NextQuestion -->|Yes| QuestionLoop
        NextQuestion -->|No| Conclude["AI Avatar Concludes Interview & Closes Room"]
    end

    Conclude --> GenerateReport["Post-Interview Synthesis:
    - Technical Knowledge Score
    - Problem-solving Rating
    - Communication & Clarity
    - Full Timestamped Transcript"]
    GenerateReport --> SaveInterviewResult["Save to interview_evaluations Collection"]
    SaveInterviewResult --> HMReview["Hiring Manager Reviews Scorecard & Selects Candidate"]
```

---

## 8. Commercial Work Order (SOW) & Multi-Tier Sign-Off Flowchart

```mermaid
flowchart TD
    CandidateSelected([Candidate Selected for Hire]) --> HM_Offer["HM / Procurement Drafts Commercial Terms:
    - Deployed Personnel Name
    - Pay Rate to Worker ($/hr or ₹/hr)
    - Bill Rate to Client ($/hr or ₹/hr)
    - Contract Duration & Start Date
    - Overtime Terms (1.5x) & Payment Terms"]

    HM_Offer --> CreateSOW["POST /api/work-orders/generate"]
    CreateSOW --> CalcMargin["System Calculates Supplier Margin % and Grand Total Cap"]
    CalcMargin --> SaveDraft["Persist SOW in sow_documents & work_orders (Status: Draft)"]

    SaveDraft --> Step1_Procurement["Step 1: Procurement Authorization"]
    Step1_Procurement --> ProcSign["Procurement Team Reviews Commercials & Rates"]
    ProcSign --> POST_ProcAuth["POST /api/workforce/procurement/sow/{id}/authorize"]
    POST_ProcAuth --> StatusPendingDirector["Status: Pending Director Approval"]

    StatusPendingDirector --> Step2_Director["Step 2: Executive Director Sign-off"]
    Step2_Director --> DirectorViews["Director Reviews Work Order in /dashboard/director/work-orders"]
    DirectorViews --> DirDecision{Director Decision}

    DirDecision -->|Request Revision| Revise["POST /request-revision with Commercial Notes"]
    Revise --> VendorNotified["Vendor / Procurement Notified to Adjust Rates"]
    VendorNotified --> HM_Offer

    DirDecision -->|Reject| DirReject["POST /reject with Formal Reason"]
    DirReject --> SOWRejected["Status: Rejected by Director"]

    DirDecision -->|Approve & Sign| POST_DirApprove["POST /api/workforce/procurement/sow/{id}/director-approve"]
    POST_DirApprove --> ExecuteDoc["MongoDB Updates:
    - sow_documents: 'Approved by Director', director_approved: True
    - work_orders: 'ACTIVE', agreement_status: 'Approved'
    - onboarding_checklists: Unlocked"]
    ExecuteDoc --> InstantDirUI["Director UI Instantly Shows Green 'Approved by Director'"]
    InstantDirUI --> Step3_Candidate["Step 3: Digital Offer Dispatched to Candidate"]
```

---

## 9. Digital Candidate Onboarding & Activation Gates

```mermaid
flowchart TD
    OfferDispatched([Candidate Receives Offer Email]) --> OpenPortal["Candidate Logs in to Candidate Portal"]
    OpenPortal --> ViewOffer["Review Digital Offer Letter & Work Order Summary"]
    ViewOffer --> SignOffer["Candidate Signs Offer Digitally"]
    
    SignOffer --> UnlockOnboarding["System Transitions Status to: ONBOARDING"]
    UnlockOnboarding --> GateChecklist["Display Onboarding Checklist:
    1. Government ID / Passport Upload (KYC)
    2. Tax Identification (PAN / SSN / W-9)
    3. Emergency Contact Details
    4. Direct Deposit / Bank Account Details
    5. Signed Non-Disclosure & Security Policy"]

    GateChecklist --> CandidateSubmits["Candidate Fills and Uploads All Items"]
    CandidateSubmits --> VerifyDocs["HR / Onboarding Lead Verifies Uploaded Documents"]

    VerifyDocs --> DocsValid{All Documents Verified?}
    DocsValid -->|Deficient| RequestResubmit["Flag Incomplete Item; Candidate Resubmits"]
    RequestResubmit --> GateChecklist

    DocsValid -->|Approved| ClearGates["Clear All Blocking Activation Gates"]
    ClearGates --> PromoteToContractor["Update Role to Active CONTRACTOR"]
    PromoteToContractor --> ActivateTimesheet["Timesheet Logging Module Activated in Portal"]
```

---

## 10. Active Contractor Timesheets, Approvals & Billing Flowchart

```mermaid
flowchart TD
    ContractorActive([Contractor on Active Work Order]) --> WeeklyCycle["Weekly Work Cycle Begins"]
    WeeklyCycle --> LogHours["Contractor Logs Hours Daily (Monday - Friday)"]
    LogHours --> CheckOT["Calculate Regular Hours (up to 40h/wk) vs Overtime (>40h/wk)"]

    CheckOT --> SaveDraftTS["Save as Draft Timesheet"]
    SaveDraftTS --> SubmitWeek["Contractor Clicks 'Submit Timesheet for Approval'"]
    SubmitWeek --> StatusSubmitted["Timesheet Status: SUBMITTED (Read-only for Contractor)"]

    StatusSubmitted --> HMReviewTS["Hiring Manager Receives Approval Task"]
    HMReviewTS --> HMDecision{Hiring Manager Review}

    HMDecision -->|Reject| RejectTS["Reject with Note (e.g. 'Hours logged for public holiday')"]
    RejectTS --> StatusRejected["Timesheet Status: REJECTED"]
    StatusRejected --> NotifyContractor["Contractor Notified to Correct and Re-submit"]
    NotifyContractor --> LogHours

    HMDecision -->|Approve| ApproveTS["Click 'Approve Timesheet'"]
    ApproveTS --> StatusApproved["Timesheet Status: APPROVED (Permanently Locked)"]

    subgraph Automated_Billing_Cycle ["Automated Invoicing & Margins"]
        StatusApproved --> TriggerBilling["Weekly / Monthly Billing Cron Triggers"]
        TriggerBilling --> FetchApproved["Query timesheets where status = 'APPROVED' & invoiced = false"]
        FetchApproved --> CalcInvoice["For Each Contractor:
        - Client Invoice = Total Hours × Approved Bill Rate
        - Vendor Payout = Total Hours × Approved Pay Rate
        - Gross Platform Margin = Client Invoice - Vendor Payout"]
        CalcInvoice --> GenPDF["Generate Itemized Invoice PDF with PO # & Tax"]
        GenPDF --> SaveInvoice["Save to billing_invoices (Status: Generated)"]
        SaveInvoice --> NotifyFinance["Admin & Vendor Receive Digital Invoices"]
    end
```

---

## 11. Contractor Offboarding & 48-Hour Deactivation Lifecycle

```mermaid
flowchart TD
    InitiateOffboarding([Hiring Manager Initiates Offboarding]) --> OffboardForm["Select Contractor, Termination Reason (Contract End / Performance / Resignation), Last Working Day"]
    OffboardForm --> POST_InitOffboard["POST /api/offboarding/initiate"]
    
    POST_InitOffboard --> CreateOffboardRecord["Insert into offboarding_records (Status: PENDING_CANDIDATE)"]
    CreateOffboardRecord --> NotifyCandOffboard["Candidate Notified to Complete Exit Verification"]

    NotifyCandOffboard --> CandLogsIn["Candidate Logs in to Portal"]
    CandLogsIn --> ExitChecklist["Candidate Completes Matching Onboarding/Offboarding Checklist:
    - Company Asset Return Acknowledgment
    - Knowledge Transfer Sign-off
    - Security Access Revocation Agreement
    - Final Expense Submission Confirmation"]

    ExitChecklist --> SubmitExit["Candidate Ticks All Items & Submits Exit Checklist"]
    SubmitExit --> POST_CompleteOffboard["POST /api/offboarding/candidate-complete"]

    subgraph State_Freezing_Phase ["Phase 1: Freezing & 48-Hour Grace Period"]
        POST_CompleteOffboard --> FreezeTimesheets["Timesheet Status Updated to: FROZEN (No new entries allowed)"]
        FreezeTimesheets --> SetGracePeriod["Set grace_period_expires_at = NOW + 48 HOURS"]
        SetGracePeriod --> UpdateUserStatus["User is_active remains TRUE for 48 hours with grace banner"]
        UpdateUserStatus --> CandidateBanner["Candidate Sees Banner: 'Account access expires in XX hours. Download tax documents and pay slips.'"]
    end

    subgraph Deactivation_Phase ["Phase 2: Total Deactivation & Email Reuse"]
        CandidateBanner --> ClockTick{"48 Hours Expired?"}
        ClockTick -->|No| ReadOnlyAccess["Candidate Can View Past Timesheets & Download Pay Slips"]
        ClockTick -->|Yes| AutoDeactivateCron["Background Worker: process_expired_offboardings()"]
        
        AutoDeactivateCron --> DisableUser["Set users.is_active = FALSE & is_offboarded = TRUE"]
        DisableUser --> UnblockEmail["Clear / Rename Email Constraint to Allow Re-application (e.g. email_reapplication_enabled=True)"]
        UnblockEmail --> TerminateSessions["Invalidate all Active JWTs & Sessions for User"]
        TerminateSessions --> LoginFails["Subsequent Login Attempts Return: 'Account deactivated.'"]
        LoginFails --> ReapplyAvailable["Vendor Can Now Re-submit This Email for Future Roles"]
    end
```

---

## 12. System State Machine & Database Entity Mapping

### 12.1 Core Entity State Transitions

| Entity | Initial State | Intermediate States | Final State |
| :--- | :--- | :--- | :--- |
| **Requisition** | `Draft` | `Intake` &rarr; `Structuring` &rarr; `PendingApproval` | `Published` / `Closed` |
| **Director Sign-off** | `Unapproved` (`director_approved: False`) | `Under Executive Review` | `Approved` (`director_approved: True`) |
| **Candidate Submission** | `Submitted` | `Screened` &rarr; `Shortlisted` &rarr; `Interviewing` | `Offered` / `Rejected` |
| **Work Order / SOW** | `Draft` | `Pending Procurement` &rarr; `Pending Director Approval` | `Approved by Director` / `ACTIVE` |
| **Candidate Onboarding** | `Pending Offer` | `Offer Signed` &rarr; `KYC Verification` | `Completed` &rarr; `Contractor Activated` |
| **Timesheet** | `Draft` | `Submitted` &rarr; `Under HM Review` | `Approved` (Locked) / `Frozen` (Offboarded) |
| **Contractor Lifecycle** | `Active Contractor` | `Pending Offboarding Checklist` &rarr; `48-Hour Grace Period` | `Deactivated` (Email Re-usable) |

---

### 12.2 Database Storage Architecture

```mermaid
erDiagram
    TENANTS ||--o{ USERS : "contains"
    TENANTS ||--o{ REQUISITIONS : "owns"
    TENANTS ||--o{ VENDOR_ENGAGEMENTS : "engages"
    
    REQUISITIONS ||--o{ CANDIDATE_SUBMISSIONS : "receives"
    CANDIDATE_SUBMISSIONS ||--o{ INTERVIEW_EVALUATIONS : "undergoes"
    CANDIDATE_SUBMISSIONS ||--|| WORK_ORDERS : "binds"
    
    WORK_ORDERS ||--|| SOW_DOCUMENTS : "generates"
    WORK_ORDERS ||--|| ONBOARDING_CHECKLISTS : "provisions"
    WORK_ORDERS ||--o{ TIMESHEETS : "logs"
    WORK_ORDERS ||--o{ BILLING_INVOICES : "bills"
    WORK_ORDERS ||--|| OFFBOARDING_RECORDS : "concludes"

    USERS {
        string id PK
        string email
        string role
        string tenant_id FK
        boolean is_active
        boolean is_offboarded
    }

    REQUISITIONS {
        string id PK
        string title
        string status
        boolean director_approved
        string director_approved_by
        timestamp director_approved_at
        float max_rate
    }

    WORK_ORDERS {
        string id PK
        string candidate_id FK
        string status
        string agreement_status
        boolean director_approved
        float bill_rate
        float pay_rate
    }

    TIMESHEETS {
        string id PK
        string workorder_id FK
        string status
        float regular_hours
        float overtime_hours
        boolean is_frozen
    }

    OFFBOARDING_RECORDS {
        string id PK
        string candidate_id FK
        string status
        timestamp grace_period_expires_at
        boolean checklist_completed
    }
```

---

## 13. System Governance & Compliance Verification

1. **Multi-Tenant Boundary:** Every API request validates JWT `tenant_id`. No tenant can query or modify another company's requisitions, candidates, or billing documents.
2. **Director Approval Gate:** No requisition can be published to vendors without `director_approved: True`. No Work Order can activate timesheets without Director executive authorization.
3. **Double Submission Prevention:** Candidate email submissions are unique per requisition. Resumes cannot be dual-represented by multiple vendors.
4. **Billing Integrity:** Approved timesheets cannot be edited. Offboarded contractors have their timesheet entry immediately frozen upon exit checklist submission.
5. **Offboarding Compliance:** Contractors retain 48-hour document retrieval access before automated deactivation renders credentials inactive while releasing the email for future engagements.
