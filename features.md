# TermJobs Platform Features Matrix

**TermJobs** is an AI-powered, multi-tenant Contingent Workforce Management (VMS), Technical Talent Screening, and Video Interview platform. It connects Enterprise Clients, Hiring Managers, Vendors/Staffing Agencies, Interview Panels, and Candidates into an automated recruitment-to-payroll lifecycle.

---

## 🏛️ Multi-Portal Architecture & Roles

TermJobs provides dedicated workspaces customized for every stakeholder in the hiring supply chain:

| Role / Portal | Target User | Primary Objective |
| :--- | :--- | :--- |
| **Super Admin Portal** | TermJobs Platform Operators | Global multi-tenant administration, candidate talent pool scraping/enrichment, AI outreach orchestration. |
| **Company Admin Portal** | Enterprise HR Heads / Procurement | Enterprise configuration, team management, approval hierarchies, rate cards, and vendor agreements. |
| **Hiring Manager Portal** | Department Leads & Engineering Managers | Requisition creation, AI matching & screening, interview reviews, contractor timesheets & expenses. |
| **Vendor / Recruiter Portal** | Staffing Agencies & Suppliers | Requisition broadcast access, candidate profile submissions, MSA signoffs, and invoice tracking. |
| **Director Portal** | Executive Leadership | High-value Work Order approvals, MSA/SOW governance signoffs, and high-level expenditure auditing. |
| **Finance Portal** | Accounts Payable & Billing Teams | Timesheet batch audits, contractor invoice reconciliation, margin analysis, and payout settlements. |
| **Procurement Portal** | Sourcing & Vendor Management | Vendor MSA agreements, compliance documentation, Work Order contracts, and SLA monitoring. |
| **Interviewer Portal** | Technical Panelists & Evaluators | Live coding rounds, technical rubric scorecards, question banks, and round debriefs. |
| **Candidate Portal** | Job Applicants & Contract Workers | Interview scheduling, live interview rooms, onboarding document submission, timesheets & expenses. |
| **Public Open Roles Portal** | External Job Seekers | Clean public talent career site for direct applicant profile submissions and resume parsing. |

---

## 🌟 Core Features by Functional Domain

### 1. 🤖 AI-Powered Requisition Management & Chat
* **Autonomous AI Requisition Copilot (`AiChat.jsx` / `hiring_manager_agent`):**
  * Natural language requisition builder: converts informal prompts into enterprise job requisitions with title, seniority, budget, skills, and JD.
  * Real-time conversational updates: edit requirements, change hourly rate caps, or adjust required years of experience via conversational chat.
  * Requisition duplication, history retention, and intelligent draft recovery.
* **Structured Multi-Step Creation Wizard (`NewRequisition.jsx`):**
  * Comprehensive JD specification, required vs. nice-to-have skill weighting, bill rates, and remote/hybrid work locations.
  * Budget thresholds, max target pay, supplier markup allowances, and department billing codes.
* **Requisition Lifecycle Governance:**
  * Status transitions: `DRAFT` ➔ `PENDING_APPROVAL` ➔ `ACTIVE` / `BROADCASTED` ➔ `FILLED` ➔ `CLOSED`.
  * Vendor broadcast targeting: selective release to preferred staffing agencies with confidentiality tiers.

---

### 2. ⚡ AI Candidate Sourcing, Screening & Resume Ranking
* **Automated Resume Parsing & Skill Extraction:**
  * PDF, DOCX, and TXT parsing with extraction of contact info, experience, tech stack, certifications, and education.
* **Semantic Ranking Engine (`ranking_service.py`):**
  * Embeddings-based matching calculating a 0–100% Relevance Match Score against Requisition specifications.
  * Experience gap analysis, missing critical keywords identification, and compensation suitability rating.
* **Autonomous Candidate Screening Agent (`candidate_screening_agent`):**
  * Automated pre-qualification screening questions.
  * Candidate pool deduplication across multiple staffing suppliers.
* **Candidate Shortlisting & Pipeline (`RequisitionCandidates.jsx`):**
  * Visual kanban / table view of candidates categorized by stage: `Submitted`, `Shortlisted`, `Interviewing`, `Offered`, `Accepted`, `Rejected`.
  * One-click stage progression with automated notification triggers to suppliers and candidates.

---

### 3. 🎥 End-to-End Interview Suite & Virtual Meeting Rooms
* **Self-Service Multi-Round Scheduler (`CandidateSchedule.jsx`):**
  * Candidate self-booking with calendar slot reservation and timezone normalization.
  * Automated Google Calendar / Outlook integration via calendar sync modules.
* **Live Technical Meeting Room (`InterviewMeetingRoomPage.jsx`):**
  * Built-in WebRTC real-time high-definition video and audio conferencing.
  * Interactive collaborative coding environment with syntax highlighting for 15+ programming languages.
  * Screen sharing, instant meeting chat, and participant state monitoring.
* **Structured Evaluation Rubrics & Scorecards (`EvaluationForm.jsx`):**
  * Multi-dimensional candidate evaluation (Technical Skills, Problem Solving, Communication, Culture Fit).
  * Panelist consensus scoring, qualitative feedback notes, and hire/no-hire decision logging.
* **Interviewer Staff Portal (`InterviewerStaffPortal.jsx`):**
  * Dedicated dashboard for interview panelists to view upcoming interview assignments, review candidate CVs, and submit post-round evaluations.

---

### 4. 📄 Work Orders, SOW & Enterprise Contract Governance
* **Statement of Work (SOW) Generator (`Workers.jsx` / `workorder` module):**
  * Automated Work Order generation linking Candidate, Vendor, Client Company, and Requisition MSA.
  * Auto-calculated bill rates, standard 8-hour workday terms, and 1.5× overtime multiplier policies.
* **Multi-Stage Work Order Approval Pipeline:**
  * 4-Stage visual governance tracker: `Draft` ➔ `Sent to Procurement` ➔ `Director Approved` ➔ `Active Execution`.
  * Exportable Work Order billing statements in plain-text and standardized formats.
* **Digital Signatory Workflows:**
  * Two-party authorization blocks for Supplier Authorized Signatory and Client Procurement / Executive Director.
* **Director & Procurement Work Order Dashboards (`DirectorWorkOrders.jsx`, `ManageProcurement.jsx`):**
  * Dedicated executive approval portals with contract expenditure limits and audit trails.

---

### 5. ⏱️ Workforce Attendance, Timesheets & Expense Management
* **Contractor Timesheet Tracking (`TimesheetApprovals.jsx`):**
  * Weekly timesheet submission with regular hours vs. overtime breakdown (>40 hours/week calculation).
  * Direct approval/rejection workflows with mandatory audit notes for rejections.
  * Weekly hours roll-up metrics and active deployment trackers.
* **Expense Claim Auditing (`ExpenseApprovals.jsx`):**
  * Expense logging with receipt attachments, categorization (Travel, Meals, Hardware, Internet, Office Supplies), and timestamps.
  * Line-item approval by Hiring Managers before inclusion into final vendor billing cycles.
* **Contractor Directory & Fleet Roster (`Workers.jsx`, `TeamOverview.jsx`):**
  * Complete directory of 100+ deployed contract personnel with client placement, active tenure, and bill rate cards.
  * Quick search across name, role, client company, work order reference number, or supplier.

---

### 6. 💰 Vendor Billing, AP Auditing & Finance Settlements
* **Vendor Billing Center (`VendorBilling.jsx` / `billing` module):**
  * Consolidated cycle billing (Weekly, Fortnightly, Monthly, Yearly).
  * Automatic summation of Base Contractor Cost + 1.5× Overtime + Approved Hiring Manager Expenses.
  * Supplier margin vs. Client gross billing visibility.
* **Finance Reconciliation Dashboard (`FinanceDashboard.jsx`):**
  * Accounts Payable auditing: approval of finalized billing sheets for payment disbursement.
  * Historical invoice records, tax computation placeholders, and exportable financial settlement sheets.

---

### 7. 🚀 Candidate Onboarding & Portal Access Provisioning
* **Candidate Portal (`CandidatePortal.jsx`, `CandidatePortalAccess.jsx`):**
  * Secure credential provisioning for contract personnel with automated email delivery of login access.
  * Self-service worker interface for timesheet submissions, expense claim filings, and assignment details.
* **Onboarding Compliance Management (`OnboardingManagement.jsx`):**
  * Verification workflows for Identity Proof, Background Check, Tax Forms, and Signed Non-Disclosure Agreements (NDAs).
  * Visual compliance completion gauges and missing document alert notifications.
* **Issue Reporting & Support Desk (`ReportedIssues.jsx`):**
  * Dedicated ticket submission channel for contractors to report equipment delays, billing discrepancies, or access issues.

---

### 8. 🌐 Multi-Channel Bot Integrations (Messaging & Chatbots)
TermJobs connects directly to enterprise team chat ecosystems via native bot modules:
* **Microsoft Teams Bot (`hm_teams_bot`):**
  * Adaptive Cards for instant candidate approvals, timesheet sign-offs, and requisition status notifications inside MS Teams.
* **Telegram Bot (`hm_telegram_bot`):**
  * Mobile alerts, instant quick-action approval callbacks, and hiring pipeline status checks.
* **Zoho Cliq Bot (`hm_zoho_cliq`):**
  * Native notifications and action cards for enterprise clients utilizing the Zoho ecosystem.
* **Internal Team Chat (`TeamChatDrawer.jsx` / `team_chat` module):**
  * In-app persistent team messaging enabling instant communication between Hiring Managers, Recruiters, and Admins.

---

### 9. 🛰️ Super Admin Global Talent Engine & AI Outreach
* **Candidate Talent Pool Management (`SuperAdminCandidatePool.jsx`):**
  * Centralized global talent repository aggregated across sourcing feeds, public applications, and past pipelines.
  * Advanced filtering by skills, years of experience, target compensation, and availability.
* **Autonomous AI Email Outreach Control (`SuperAdminOutreachControl.jsx`):**
  * Automated campaign sequencing for outreach to top candidates matching high-priority requisitions.
  * Rate-limited dispatch queues, dynamic template personalization, and response monitoring.
* **Tenant & Account Configuration (`ConfigureCompanyAccounts.jsx`, `ConfigureVendorAccounts.jsx`):**
  * Enterprise tenant onboarding, custom domain mapping, and staffing agency credential provisioning.

---

## 🎨 Design System & UI Architecture

* **Glassmorphic Enterprise Aesthetic:**
  * Ultra-modern translucent glass surfaces (`backdrop-blur-2xl`, subtle inner borders `border-white/70`, refined shadow elevations).
  * Tailored micro-interactions, responsive squircle avatars, and status pill badges.
* **Unified Design Tokens:**
  * Clean typographic hierarchy with sub-labels, bold metrics, and standard contrast ratios.
* **Responsive Layouts:**
  * Mobile-ready navigation drawers, full-width data tables with sticky pagination, and optimized modal dialogs.
