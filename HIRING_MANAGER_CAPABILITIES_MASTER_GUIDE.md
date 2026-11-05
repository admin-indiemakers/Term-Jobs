# HIRING MANAGER PORTAL — COMPREHENSIVE CAPABILITIES, CONTROLS & WORKFLOW SPECIFICATION

**Project:** Term-Jobs  
**System Role:** Hiring Manager (`Hiring Manager` / `HR`)  
**Scope:** Complete frontend interface, pages, interactive controls, data collection in every operational situation, business flows, AI reasoning features, and backend integrations.  
**Document Status:** Master Architecture & Implementation Reference  

---

## TABLE OF CONTENTS
1. [Executive Role Overview & Access Boundaries](#1-executive-role-overview--access-boundaries)
2. [Global Navigation & Workspace Architecture](#2-global-navigation--workspace-architecture)
3. [Page-by-Page Audit & Control Inventory](#3-page-by-page-audit--control-inventory)
   - [3.1. AI Hiring Assistant & Reasoning Workspace (`/dashboard/hiring-manager`)](#31-ai-hiring-assistant--reasoning-workspace-dashboardhiring-manager)
   - [3.2. Hiring Manager Dashboard Overview (`/dashboard/hiring-manager/chat`)](#32-hiring-manager-dashboard-overview-dashboardhiring-managerchat)
   - [3.3. Requisition Directory & Lifecycle Management (`/dashboard/requisitions`)](#33-requisition-directory--lifecycle-management-dashboardrequisitions)
   - [3.4. Create Requisition Studio (`/dashboard/requisitions/new`)](#34-create-requisition-studio-dashboardrequisitionsnew)
   - [3.5. Requisition Detail, JD Preview & Approval (`/dashboard/requisitions/:id`)](#35-requisition-detail-jd-preview--approval-dashboardrequisitionsid)
   - [3.6. Candidate Pool, AI Screening & Shortlisting (`/dashboard/requisitions/:id/candidates`)](#36-candidate-pool-ai-screening--shortlisting-dashboardrequisitionsidcandidates)
   - [3.7. Candidate Interview Scheduling & Timelines (`/dashboard/requisitions/:reqId/candidates/:candidateId`)](#37-candidate-interview-scheduling--timelines-dashboardrequisitionsreqidcandidatescandidateid)
   - [3.8. LiveKit Video Room & Interview Evaluation Panel (`/interview-panel/:candidateId`)](#38-livekit-video-room--interview-evaluation-panel-interview-panelcandidateid)
   - [3.9. Interviews & AI Speech Analytics Hub (`/dashboard/interviews`)](#39-interviews--ai-speech-analytics-hub-dashboardinterviews)
   - [3.10. Accepted Candidates & Onboarding Management (`/dashboard/candidates/accepted` & `onboarding`)](#310-accepted-candidates--onboarding-management-dashboardcandidatesaccepted--onboarding)
   - [3.11. Candidate Portal Access (`/dashboard/candidates/portal-access`)](#311-candidate-portal-access-dashboardcandidatesportal-access)
   - [3.12. Reported Workplace & Contractor Issues (`/dashboard/candidates/issues`)](#312-reported-workplace--contractor-issues-dashboardcandidatesissues)
   - [3.13. Workforce Team Overview (`/dashboard/workforce/team`)](#313-workforce-team-overview-dashboardworkforceteam)
   - [3.14. Weekly Timesheet Approvals Queue (`/dashboard/workforce/timesheets`)](#314-weekly-timesheet-approvals-queue-dashboardworkforcetimesheets)
   - [3.15. Contractor Expense Approvals Queue (`/dashboard/workforce/expenses`)](#315-contractor-expense-approvals-queue-dashboardworkforceexpenses)
4. [Situation-by-Situation Data Collection & Processing Matrix](#4-situation-by-situation-data-collection--processing-matrix)
   - [Situation 1: Setting Up & Customizing Requisition Interview Rounds](#situation-1-setting-up--customizing-requisition-interview-rounds)
   - [Situation 2: Scheduling an Interview Round (Interviewer & Candidate)](#situation-2-scheduling-an-interview-round-interviewer--candidate)
   - [Situation 3: Conducting Live Interview & Scoring Candidate Evaluation](#situation-3-conducting-live-interview--scoring-candidate-evaluation)
   - [Situation 4: Authoring a Requisition in the 7-Tab Studio](#situation-4-authoring-a-requisition-in-the-7-tab-studio)
   - [Situation 5: Drafting a Requisition via Conversational AI Chat](#situation-5-drafting-a-requisition-via-conversational-ai-chat)
   - [Situation 6: AI Enterprise Job Description (JD) Generation](#situation-6-ai-enterprise-job-description-jd-generation)
   - [Situation 7: Submitting Requisition for Director Approval vs. Direct Self-Publishing](#situation-7-submitting-requisition-for-director-approval-vs-direct-self-publishing)
   - [Situation 8: Locking & Releasing Candidate Shortlist (48-Hour SLA)](#situation-8-locking--releasing-candidate-shortlist-48-hour-sla)
   - [Situation 9: Rejecting a Candidate Profile](#situation-9-rejecting-a-candidate-profile)
   - [Situation 10: Final Hiring Decision: "Accept & Onboard" Candidate](#situation-10-final-hiring-decision-accept--onboard-candidate)
   - [Situation 11: Weekly Contractor Timesheet Approval](#situation-11-weekly-contractor-timesheet-approval)
   - [Situation 12: Weekly Contractor Timesheet Rejection (Mandatory Rationale)](#situation-12-weekly-contractor-timesheet-rejection-mandatory-rationale)
   - [Situation 13: Contractor Project Expense Claim Approval](#situation-13-contractor-project-expense-claim-approval)
   - [Situation 14: Contractor Project Expense Claim Rejection](#situation-14-contractor-project-expense-claim-rejection)
   - [Situation 15: Contractor Onboarding / Workplace Issue Triage & Resolution](#situation-15-contractor-onboarding--workplace-issue-triage--resolution)
   - [Situation 16: Candidate Self-Service Portal Access & Credential Management](#situation-16-candidate-self-service-portal-access--credential-management)
   - [Situation 17: Google Calendar OAuth Connection & Real-Time Sync](#situation-17-google-calendar-oauth-connection--real-time-sync)
   - [Situation 18: Hiring Manager Profile & Account Modification](#situation-18-hiring-manager-profile--account-modification)
5. [Complete Page-by-Page Button & Control Catalog](#5-complete-page-by-page-button--control-catalog)
6. [Global Header Controls, Modals & Utility Drawers](#6-global-header-controls-modals--utility-drawers)
7. [End-to-End Business Workflows & State Machines](#7-end-to-end-business-workflows--state-machines)
8. [Complete Backend API Registry for Hiring Managers](#8-complete-backend-api-registry-for-hiring-managers)
9. [Security, Governance & Multi-Tenant Isolation](#9-security-governance--multi-tenant-isolation)

---

# 1. EXECUTIVE ROLE OVERVIEW & ACCESS BOUNDARIES

In the **Term-Jobs** platform, the **Hiring Manager (HM)** is the enterprise staffing authority responsible for defining talent requirements, architecting requisitions, screening candidate profiles, organizing and executing interview rounds, submitting technical/cultural evaluations, hiring contractors, approving weekly timesheets, auditing project expense claims, and managing workforce operations.

### Key Operational Responsibilities:
1. **Requisition Authoring:** Define contract, contract-to-hire, and full-time requirements using the multi-tab Requisition Studio or conversational AI assistant.
2. **Director Approval Governance:** Obey company-level tenant policies where requisitions either require Executive Director signoff or can be directly self-published.
3. **Candidate Screening & Shortlisting:** Review candidate submissions from staffing agencies within the 48-hour SLA window, examine AI resume match scores, and lock candidate shortlists.
4. **Interview Orchestration & Evaluation:** Schedule interview rounds, sync events with Google Calendar, conduct live WebRTC interviews via LiveKit, and submit structured evaluation scorecards.
5. **Hiring Decision Handoff:** Issue "Accept & Onboard" decisions that trigger automated work order generation for Procurement and candidate portal provisioning.
6. **Active Workforce Supervision:** Review and approve/reject weekly contractor timesheets, review contractor expense claims with receipt audit, and triage reported onboarding blockers.

### What Hiring Managers CANNOT Do (Role Separation):
- **Cannot onboard companies or vendors:** Handled exclusively by Super Admin.
- **Cannot countersign master vendor agreements (MSA):** Handled by Directors.
- **Cannot execute financial payouts or generate UTR bank references:** Handled exclusively by Finance Officers.
- **Cannot create vendor billing line items or change SOW billing terms:** Handled by Procurement.

---

# 2. GLOBAL NAVIGATION & WORKSPACE ARCHITECTURE

The Hiring Manager workspace is enclosed in `DashboardLayout.jsx` with tenant isolation (`tenant_id`) and role guard verification.

### 2.1 Navigation Sidebar Menu Items

| Sidebar Section | Item Label | Route (`to`) | Icon | Active Badge / Counter | Purpose |
|---|---|---|---|---|---|
| **WORKSPACE** | **AI Chat** | `/dashboard/hiring-manager` | `Icons.Chat` | — | Full-page conversational AI Assistant with dynamic right-hand workbench drawer. |
| **WORKSPACE** | **Dashboard** | `/dashboard/hiring-manager/chat` | `Icons.Dashboard` | — | Mission-control cockpit displaying KPIs, pipeline status, and recent activity. |
| **HIRING** | **Requisitions** | `/dashboard/requisitions` | `Icons.Requisitions` | Total active req count (`hmCounts.requisitions`) | Requisitions list with subtabs for Published, Pending, Drafted, Completed, History. |
| **HIRING** | **New Requisition** | `/dashboard/requisitions/new` | `Icons.Plus` | — | 7-tab requisition creation studio with AI job description generation. |
| **CANDIDATES** | **Candidates** | `/dashboard/candidates` | `Icons.Diamond` | Candidate count (`hmCounts.candidates`) | Candidate pool directory, AI resume screening scores, and shortlist locking. |
| **CANDIDATES** | **Reported Issues** | `/dashboard/candidates/issues` | `Icons.Flag` | Open issues badge (`hmCounts.openIssues`) | Triage onboarding blockers and contractor workplace issues. |
| **CANDIDATES** | **Portal Access** | `/dashboard/candidates/portal-access` | `Icons.PortalAccess` | — | Manage candidate self-service accounts and resend login invitations. |
| **WORKFORCE** | **Team Overview** | `/dashboard/workforce/team` | `Icons.Team` | — | Roster of active contractors, hourly billing rates, and contract dates. |
| **WORKFORCE** | **Timesheets** | `/dashboard/workforce/timesheets` | `Icons.Timesheet` | Pending timesheets badge (`hmCounts.pendingTimesheets`) | Weekly contractor hours review with daily breakdown and Approve/Reject. |
| **WORKFORCE** | **Expenses** | `/dashboard/workforce/expenses` | `Icons.Receipt` | Pending expenses badge (`hmCounts.pendingExpenses`) | Audit contractor expense reimbursements, view receipts, and Approve/Reject. |

---

# 3. PAGE-BY-PAGE AUDIT & CONTROL INVENTORY

---

## 3.1. AI Hiring Assistant & Reasoning Workspace (`/dashboard/hiring-manager`)

**Component:** [frontend/src/pages/HiringManagerDashboard.jsx](file:///d:/projects/Term-Jobs/frontend/src/pages/HiringManagerDashboard.jsx)  
**Backend Router:** [backend/modules/hiring_manager_agent/router.py](file:///d:/projects/Term-Jobs/backend/modules/hiring_manager_agent/router.py)  

This is the primary AI interface for the Hiring Manager. It combines an LLM conversational chat on the left with an expandable multi-panel interactive workbench on the right.

### Controls, Buttons & UI Elements:

#### Header & Top Action Bar:
1. **Google Calendar Connect Button (`GoogleCalendarConnect`):**
   - Displays connection badge (`Connected: email@domain.com` or `Connect Google Calendar`).
   - Clicking opens OAuth flow to connect primary calendar for automatic interview sync.
2. **Interviews & Calendar Quick Trigger (`hm-calendar-link`):**
   - Button showing `<Calendar size={14} /> Interviews <ChevronRight size={13} />`.
   - Opens the global `CalendarModal` for visual scheduling.
3. **Notification Bell:** Real-time notifications popover.
4. **Tenant Logo & Brand Avatar:** Displays tenant company initials/logo.

#### Chat Conversation Stream (Left Area):
5. **Interactive Requisition Draft Card:**
   - Rendered inline when the AI drafts or identifies a job requirement.
   - **Edit Role Button:** Opens full editing modal (`editingDraftData`).
   - **Generate Enterprise JD Button (`Sparkles` icon):** Calls `/api/hiring-manager/agent/generate-jd` using company website scraping + prompt context.
   - **Send to Director for Approval / Publish Requisition Button:** Dynamically updates based on tenant policy (`companyRequiresDirectorApproval`):
     - If approval required: sends requisition to Director (`PendingApproval`).
     - If approval disabled: immediately publishes requisition (`Published`).
   - **Missing Requirements Warning:** Red warning pill highlighting missing fields (e.g. `Must provide: Work location, Target start date`).
6. **Interactive Candidate Profile Card:**
   - Displays candidate name, role, AI screening score ring (0-100%), matching skills badges.
   - **Preview Resume Button:** Opens `ResumePreviewModal` with PDF rendering.
   - **Shortlist Candidate Button:** Moves candidate into the interview pipeline.
   - **Schedule Interview Button:** Spawns `CompanyInterviewScheduleCard`.
7. **Interactive Interview Schedule Card (`CompanyInterviewScheduleCard`):**
   - Editable Date Picker input.
   - Editable Time Slot Picker input (with timezone conversion).
   - Duration Selector pills (`15 min`, `30 min`, `45 min`, `60 min`).
   - **LiveKit Room Provisioning Checkbox:** Automatically provisions a video interview room.
   - **Confirm & Dispatch Button:** Syncs with Google Calendar, sends candidate email invite, and creates interview round in database.
8. **Interactive Quick Action Chips:**
   - Pre-populated prompt pills: `"Draft a Python developer role"`, `"Show candidates for Senior React"`, `"Check pending timesheets"`, `"Any onboarding blockers?"`.

#### Prompt Input Console:
9. **Text Input Field:** Auto-resizing textarea with placeholder `"Ask AI assistant to draft a role, screen candidates, or schedule interviews..."`.
10. **Voice Input Mic Button (`isListening`):**
    - Triggers browser Web Speech API for hands-free speech-to-text dictation.
    - Pulsing red animation when recording.
11. **Send Message Button (`ArrowUp` / `Send`):** Sends prompt to backend Groq AI agent.

#### Right-Hand Dynamic Workbench (`activePanel`):
12. **Overview Panel:** Real-time metrics on live requisitions, shortlisted applicants, active contractors, and urgent blockers.
13. **Requisition Workbench (6-Tab Drawer):**
    - **Director Template Selector Dropdown:** Loads role blueprints pre-configured by Executive Directors.
    - **Tab 1: Role:** Role title, Department, Job Family, Seniority level, Experience band.
    - **Tab 2: Skills:** Must-have skill pills, Nice-to-have skill pills, Certifications.
    - **Tab 3: Engagement:** Contract type, Duration (months), Target start date, Expected end date, Extension likelihood.
    - **Tab 4: Budget & Commercials:** Rate basis (Hourly/Monthly/Annual), Currency, Internal ceiling, Vendor floor rate, Vendor cap rate.
    - **Tab 5: Work Setup:** Work mode (Remote/Hybrid/Onsite), Primary location, Overtime policy, Timezone.
    - **Tab 6: Process & Governance:** Vendor submission deadline, Max candidates per vendor, Interview stages.
    - **Save Draft & Submit Buttons:** Persists draft or initiates director approval.

---

## 3.2. Hiring Manager Dashboard Overview (`/dashboard/hiring-manager/chat`)

**Component:** [frontend/src/pages/HiringManagerChat.jsx](file:///d:/projects/Term-Jobs/frontend/src/pages/HiringManagerChat.jsx)  

The traditional executive dashboard providing instant visibility over hiring metrics, pipeline health, and urgent administrative actions.

### Controls & Metrics:
1. **Metric Card 1: Active Requisitions:** Displays count of live, published requisitions. Clicking navigates to `/dashboard/requisitions/published`.
2. **Metric Card 2: Total Candidates:** Displays total candidates across active pipelines. Clicking navigates to `/dashboard/candidates`.
3. **Metric Card 3: Upcoming Interviews:** Count of scheduled interview rounds. Clicking navigates to `/dashboard/interviews`.
4. **Metric Card 4: Pending Timesheets:** Count of timesheets awaiting HM approval. Clicking navigates to `/dashboard/workforce/timesheets`.
5. **AI Assistant Launch Banner:** Prominent CTA card `"Create a contract role with AI"` with one-click navigation to AI Chat.
6. **Active Requisitions Table / Cards:**
   - Filter pills: `All`, `Published`, `Pending Approval`, `Draft`.
   - Card rows with requisition title, department, location, headcount openings, candidate count, and creation date.
   - Clickable row navigates directly to Requisition Detail.
7. **Recent Activity Feed:**
   - Chronological stream of events (requisition created, candidate shortlisted, interview completed, timesheet submitted).
   - Relative timestamps (`Just now`, `15m ago`, `2h ago`) with timezone normalization.

---

## 3.3. Requisition Directory & Lifecycle Management (`/dashboard/requisitions`)

**Component:** [frontend/src/pages/requisitions/RequisitionOverview.jsx](file:///d:/projects/Term-Jobs/frontend/src/pages/requisitions/RequisitionOverview.jsx)  

The central repository for searching, filtering, and organizing all requisitions across their lifecycle stages.

### Controls, Tabs & Actions:

#### Navigation Tabs:
1. **Published Tab (`/dashboard/requisitions/published`):** Live requisitions open for staffing vendor submissions.
2. **Pending Approval Tab (`/dashboard/requisitions/pending-approval`):** Requisitions submitted to Executive Directors awaiting signoff.
3. **Drafted Tab (`/dashboard/requisitions/drafted`):** Unsubmitted or work-in-progress drafts.
4. **Completed Tab (`/dashboard/requisitions/completed`):** Successfully filled or closed roles.
5. **History Tab (`/dashboard/requisitions/history`):** Complete historical audit of all created requisitions.

#### Search & Filter Bar:
6. **Search Input:** Real-time text search filtering by role title, department, or keywords.
7. **Department Filter Dropdown:** Filter by Engineering, Product, Design, Operations, etc.
8. **Engagement Type Filter Dropdown:** Filter by Contract, Contract-to-Hire, Full-Time.
9. **Sort By Dropdown:** Newest first, Oldest first, Highest budget, Most openings.

#### Requisition Card Actions:
10. **View Candidates Button:** Direct jump to `/dashboard/requisitions/:id/candidates`.
11. **Edit Draft Button:** Opens editor for drafted requisitions.
12. **Delete Draft Button (`Trash2` icon):** Deletes unsubmitted draft with confirmation modal.
13. **Copy Shareable Link Button:** Copies candidate-facing or requisition link to clipboard.
14. **New Requisition CTA Button (`Plus` icon):** Navigates to `/dashboard/requisitions/new`.

---

## 3.4. Create Requisition Studio (`/dashboard/requisitions/new`)

**Component:** [frontend/src/pages/requisitions/NewRequisition.jsx](file:///d:/projects/Term-Jobs/frontend/src/pages/requisitions/NewRequisition.jsx)  

A comprehensive 7-tab wizard for architecting contract requisitions with granular compliance and commercial definitions.

### Form Tabs & Inputs:

#### Tab 1: Role
- **Job Title Input:** Text field with role title autocomplete.
- **Department Dropdown:** Engineering, Marketing, Finance, Legal, etc.
- **Seniority Level Dropdown:** Junior, Mid, Senior, Lead, Principal.
- **Min / Max Experience Sliders/Inputs:** Years of required experience.
- **Role Summary / Job Description Textarea:** Formatted or plain markdown.
- **AI Enhance JD Button (`Sparkles`):** Uses AI to generate a polished job description.

#### Tab 2: Skills
- **Skill Input Field with Enter-to-Add:** Adds tag badges.
- **Predefined Skill Chips:** Clickable chips for popular skills (React, Python, AWS, Docker, Kubernetes, etc.).
- **Must-Have vs Nice-to-Have Toggles:** Classifies skills for candidate match scoring.

#### Tab 3: Engagement
- **Engagement Type:** Radio pills for `Contract`, `Contract-to-Hire`, `Full-time`.
- **Duration (Months):** Duration integer input with automatic end-date calculator.
- **Target Start Date Picker:** Calendar input validating future start date.
- **Headcount Openings:** Number of positions needed.

#### Tab 4: Commercials (Budget)
- **Currency Dropdown:** INR (₹), USD ($), EUR (€), GBP (£).
- **Rate Basis Dropdown:** `Hourly rate`, `Monthly retainer`, `Annual package`.
- **Internal Ceiling Rate:** Maximum rate budget approved internally.
- **Vendor Floor & Cap Rates:** The rate window exposed to staffing vendors.
- **Overtime Allowed Toggle:** Yes/No switch.

#### Tab 5: Work Setup
- **Work Mode:** `Remote`, `Hybrid`, `Onsite`.
- **Primary Work Location:** City and Country inputs.
- **Timezone Dropdown:** IST, EST, PST, CST, GMT, CET, SGT, AEST, UTC.
- **Working Hours / Shift Presets:** Standard Day (9:30 AM–6:30 PM), Morning Shift, Early Shift, Afternoon Shift, US Overlay, Flexible.
- **Equipment Provision:** `Company-provided`, `Vendor-provided`, `BYOD`.

#### Tab 6: Compliance
- **Background Verification Checkbox:** Mandatory background check flag.
- **Drug Screening Checkbox:** Optional screening flag.
- **NDA Required Checkbox:** Non-disclosure requirement flag.
- **Contract Agreement Type:** Consultancy agreement, NDA-only, MSA-linked.

#### Tab 7: Process
- **Vendor Submission Deadline:** Date picker setting the 48-hour submission cutoff.
- **Max Submissions Per Vendor:** Limits candidate volume per supplier.
- **Interview Rounds Builder:**
  - Add Round Button.
  - Round Type: Technical, Managerial, HR, Coding, System Design.
  - Duration: 30m, 45m, 60m.

#### Bottom Action Controls:
- **Save as Draft Button:** Saves without submitting.
- **Submit for Director Approval / Publish Button:** Automatically initiates the required transition based on tenant policy.

---

## 3.5. Requisition Detail, JD Preview & Approval (`/dashboard/requisitions/:id`)

**Component:** [frontend/src/pages/requisitions/RequisitionDetail.jsx](file:///d:/projects/Term-Jobs/frontend/src/pages/requisitions/RequisitionDetail.jsx)  

In-depth inspection view for published or pending requisitions.

### Controls:
1. **Status Banner:** Shows `Published`, `Pending Approval`, or `Draft`.
2. **Submit for Approval Button:** Active when requisition is drafted and requires director sign-off.
3. **Publish Requisition Button:** Active when direct publishing is permitted.
4. **Edit Requisition Button:** Re-opens the form editor (disabled once published).
5. **View Candidate Pipeline Button:** Jumps to candidate review page.
6. **JD Formatted / Markdown Toggle:** Switches between rich typography view and raw markdown.
7. **Copy JD Button:** Copies job description to clipboard.
8. **Requisition Specifications Grid:** Displays all budget, work setup, compliance, and shift details.

---

## 3.6. Candidate Pool, AI Screening & Shortlisting (`/dashboard/requisitions/:id/candidates`)

**Component:** [frontend/src/pages/candidates/RequisitionCandidates.jsx](file:///d:/projects/Term-Jobs/frontend/src/pages/candidates/RequisitionCandidates.jsx)  

The candidate review workstation where HM inspects AI match ratings, examines resumes, and manages pipeline stages.

### Controls & Evaluation Tools:

#### Top Bar & Shortlist SLA:
1. **48-Hour Shortlist Countdown Timer:**
   - Displays time remaining for vendor submissions (`formatShortlistCountdown`: e.g. `14h 22m 10s`).
   - Alerts HM when candidate pool is ready for review.
2. **Lock & Release Shortlist Button (`Send Now`):**
   - Locks vendor submissions and immediately releases candidate profiles for interviewing.
3. **Set Interview Process Button:**
   - Opens `SetInterviewProcessModal` to configure rounds for this specific requisition.

#### Candidate Matrix & Table Filters:
4. **Pipeline Status Filter Pills:**
   - `All Applicants`, `Screened`, `Shortlisted`, `Interviewing`, `Accepted`, `Rejected`.
5. **Candidate Search Bar:** Filters by candidate name, skill, or vendor.
6. **Sort Options:** Highest AI Match Score, Lowest Rate, Most Experience, Submission Date.

#### Candidate Row / Card Controls:
7. **AI Match Score Ring (`ScoreRing`):**
   - Visual SVG gauge displaying 0–100% score computed by Groq LLM analyzing resume against requisition skills.
8. **Skills Match Badges:**
   - Green pills for matched skills, grey/red pills for missing requirements.
9. **Preview Resume Button (`Eye` icon):**
   - Opens `ResumePreviewModal` with PDF rendering, zoom, and download controls.
10. **Shortlist Button (`Check` icon):**
    - Moves candidate from `Screened` to `Shortlisted`.
11. **Reject Button (`X` icon):**
    - Opens rejection prompt, moving candidate to `Rejected`.
12. **Schedule Interview Button (`Calendar` icon):**
    - Spawns `ScheduleInterviewModal` to set up date, time, and LiveKit room.
13. **Accept & Onboard Button (`UserCheck` icon):**
    - Final hiring action: moves candidate to `Accepted`, generates draft Work Order, and provisions portal credentials.

#### Candidate Side Inspection Drawer:
14. Displays deep candidate bio, total experience years, current vendor company, hourly billing rate, contact information, and AI scoring justification notes.

---

## 3.7. Candidate Interview Scheduling & Timelines (`/dashboard/requisitions/:reqId/candidates/:candidateId`)

**Component:** [frontend/src/pages/candidates/CandidateSchedule.jsx](file:///d:/projects/Term-Jobs/frontend/src/pages/candidates/CandidateSchedule.jsx)  

Dedicated timeline view tracking an individual candidate's progression through multiple interview rounds.

### Controls:
1. **Round Stepper Timeline (`RoundTimeline`):**
   - Visual numbered sequence: Round 1 (Screening) → Round 2 (Technical) → Round 3 (Managerial) → Final Offer.
2. **Create Next Round Button:** Adds another interview stage.
3. **Join Video Room Button (`Video` icon):** Directly launches the LiveKit video meeting room for scheduled interviews.
4. **Reschedule Round Button:** Opens modal to change interview timestamp.
5. **Cancel Round Button:** Cancels interview and sends cancellation email.
6. **View Scorecard Button:** Opens completed evaluation metrics and interviewer ratings.

---

## 3.8. LiveKit Video Room & Interview Evaluation Panel (`/interview-panel/:candidateId`)

**Component:** [frontend/src/pages/candidates/CandidateInterviewPanel.jsx](file:///d:/projects/Term-Jobs/frontend/src/pages/candidates/CandidateInterviewPanel.jsx)  
**Video Integration:** `LiveKit Cloud` WebRTC Client  

The live interview workspace where the Hiring Manager conducts technical interviews and submits ratings.

### Controls & Evaluation Rubric:
1. **WebRTC Video / Audio Tile:** Real-time video feeds with mute, camera toggle, screen share, and fullscreen controls.
2. **Candidate Resume Drawer:** Side panel displaying candidate resume during the call.
3. **Structured Scoring Sliders / Radios (1 to 5 Stars):**
   - **Technical Competency:** Evaluates coding, design, and core technology stack.
   - **Problem Solving:** Evaluates analytical thinking and algorithmic ability.
   - **System Design & Architecture:** Evaluates scalability and trade-offs.
   - **Communication & Team Fit:** Evaluates clarity and cultural alignment.
4. **Overall Recommendation Radios:**
   - `Strong Hire`, `Hire`, `Leaning Hire`, `Leaning No Hire`, `Strong No Hire`.
5. **Interviewer Written Feedback Textarea:** Detailed notes on candidate strengths and weaknesses.
6. **Submit Final Scorecard Button:** Finalizes evaluation, stores feedback in database, and notifies team.

---

## 3.9. Interviews & AI Speech Analytics Hub (`/dashboard/interviews`)

**Component:** [frontend/src/interview/pages/HiringManagerInterviews.jsx](file:///d:/projects/Term-Jobs/frontend/src/interview/pages/HiringManagerInterviews.jsx)  

Hub for monitoring interview completion across all candidates and reviewing AI speech analytics.

### Controls:
1. **Interview Rounds Table:** List of scheduled, in-progress, and completed interviews.
2. **Audio/Video Playback Player:** Listens to recorded interview audio chunks (WebM/WAV).
3. **AI Speech Analytics Indicators:**
   - **Words Per Minute (WPM):** Candidate speech cadence indicator.
   - **Filler Word Density:** Tracks frequency of `"um"`, `"uh"`, `"like"`.
   - **Confidence Score:** AI-derived confidence percentage.
4. **Transcript Review Viewer:** Full AI-generated interview transcript with timestamped speaker turns.

---

## 3.10. Accepted Candidates & Onboarding Management (`/dashboard/candidates/accepted` & `onboarding`)

**Component:** [frontend/src/pages/candidates/AcceptedCandidates.jsx](file:///d:/projects/Term-Jobs/frontend/src/pages/candidates/AcceptedCandidates.jsx) & [frontend/src/pages/candidates/OnboardingManagement.jsx](file:///d:/projects/Term-Jobs/frontend/src/pages/candidates/OnboardingManagement.jsx)  

Tracks candidates who have cleared all interview rounds and moved into contracting.

### Controls:
1. **Accepted Hires Table:** Candidate name, hired role title, vendor supplier, hourly rate, target start date.
2. **Onboarding Checklist Status:**
   - Background Check (`Pending` / `Completed`).
   - Document Collection (`Pending` / `Verified`).
   - Equipment Provisioning (`Dispatched` / `Delivered`).
   - Contract Execution (`Pending Signature` / `Executed`).
3. **View Work Order Shell:** Inspects the drafted SOW sent to Procurement.
4. **Mark Onboarding Complete Button:** Transitions candidate into active team contractor status.

---

## 3.11. Candidate Portal Access (`/dashboard/candidates/portal-access`)

**Component:** [frontend/src/pages/candidates/CandidatePortalAccess.jsx](file:///d:/projects/Term-Jobs/frontend/src/pages/candidates/CandidatePortalAccess.jsx)  

Manages self-service candidate portal credentials.

### Controls:
1. **User Accounts List:** Candidate email, portal username, status (`Active` / `Disabled`), last login date.
2. **Resend Invite Button:** Dispatches email with login instructions and credentials.
3. **Toggle Account Status Switch:** Disables or re-enables portal access.
4. **Search Input:** Filters accounts by candidate name or email.

---

## 3.12. Reported Workplace & Contractor Issues (`/dashboard/candidates/issues`)

**Component:** [frontend/src/pages/candidates/ReportedIssues.jsx](file:///d:/projects/Term-Jobs/frontend/src/pages/candidates/ReportedIssues.jsx)  

Triage queue for issues reported by candidates during onboarding or project work (hardware issues, VPN problems, invoice inquiries).

### Controls:
1. **Issue Cards Stream:**
   - Filter pills: `All`, `Open`, `In Progress`, `Resolved`.
   - Priority indicators: `Critical` (red), `High` (orange), `Medium` (yellow), `Low` (blue).
2. **Issue Detail Modal:** Displays full issue description and reporter details.
3. **Resolve Issue Modal:**
   - Status dropdown: `In Progress`, `Resolved`, `Dismissed`.
   - Resolution Notes Textarea: Explains corrective action taken.
   - **Confirm Resolution Button:** Updates issue status and notifies contractor.

---

## 3.13. Workforce Team Overview (`/dashboard/workforce/team`)

**Component:** [frontend/src/pages/workforce/TeamOverview.jsx](file:///d:/projects/Term-Jobs/frontend/src/pages/workforce/TeamOverview.jsx)  

Master roster of all active contractors working under the Hiring Manager's supervision.

### Controls:
1. **Contractor Cards / Table:**
   - Worker name, job title, department, supplier vendor, hourly rate.
   - Contract Start & End dates.
   - Contract Health indicator: `Active`, `Ending Soon` (within 30 days).
2. **Timesheet History Shortcut:** Jumps directly to contractor's timesheet logs.
3. **Worker Detail Drawer:** Complete contract audit, logged hours summary, and contact information.

---

## 3.14. Weekly Timesheet Approvals Queue (`/dashboard/workforce/timesheets`)

**Component:** [frontend/src/pages/workforce/TimesheetApprovals.jsx](file:///d:/projects/Term-Jobs/frontend/src/pages/workforce/TimesheetApprovals.jsx)  
**Backend Router:** [backend/modules/workforce/router.py](file:///d:/projects/Term-Jobs/backend/modules/workforce/router.py)  

Weekly timekeeping review where contractors submit hours for payment approval.

### Controls:
1. **Pending Count Header Badge:** Prominent counter of timesheets awaiting action.
2. **Filter Controls:**
   - Status pills: `All`, `Pending`, `Approved`, `Rejected`.
   - Filter by Candidate dropdown.
3. **Accordion Expandable Timesheet Card:**
   - Contractor name, role, vendor, total hours submitted for the week.
   - Clicking expands the **Daily Hours Breakdown Table** (Mon, Tue, Wed, Thu, Fri, Sat, Sun) with daily task notes.
4. **Approve Timesheet Button (`CheckCircle` icon):**
   - Immediately approves timesheet and routes hours to Finance for invoicing.
5. **Reject Timesheet Button (`XCircle` icon):**
   - Opens rejection modal with mandatory **Rejection Reason Textarea**.
   - Submits rejection and alerts contractor to resubmit corrected hours.

---

## 3.15. Contractor Expense Approvals Queue (`/dashboard/workforce/expenses`)

**Component:** [frontend/src/pages/workforce/ExpenseApprovals.jsx](file:///d:/projects/Term-Jobs/frontend/src/pages/workforce/ExpenseApprovals.jsx)  

Reimbursement review queue for contractor expenses (travel, software licenses, project equipment).

### Controls:
1. **Financial Metrics Header:** Displays total pending expense claims amount (e.g. `₹45,000 Pending`).
2. **Filter Controls:** Filter by `All`, `Pending`, `Approved`, `Rejected`.
3. **Expense Claims Table:**
   - Contractor name, expense date, category (Travel, Hardware, Meals, Software, Other), amount, currency.
   - Description / Justification text.
4. **View Receipt Button (`Eye` icon):**
   - Opens `ReceiptPreviewModal` displaying uploaded invoice/receipt image or PDF.
5. **Approve Expense Button:** Authorizes claim for reimbursement.
6. **Reject Expense Button:** Opens modal requiring rejection rationale.

---

# 4. SITUATION-BY-SITUATION DATA COLLECTION & PROCESSING MATRIX

This section details **what exact data is collected, entered, validated, stored, and routed across every operational situation** in the Hiring Manager portal.

---

### Situation 1: Setting Up & Customizing Requisition Interview Rounds
- **Component File:** `frontend/src/components/SetInterviewProcessModal.jsx`
- **When Triggered:** HM clicks **"Set Interview Process"** on `/dashboard/requisitions/:id/candidates` or configures rounds in `NewRequisition.jsx`.
- **Data Collected & Captured:**
  | Field Name | Type | Constraints / Options | Purpose |
  |---|---|---|---|
  | `template` | String | `technical`, `non_technical`, `executive`, `custom` | Preset blueprint selection |
  | `rounds[].id` | String | Unique string (`r-1`, `r-2`) | Identifier for round tracking |
  | `rounds[].title` | String | e.g. "Technical Coding", "System Design", "Cultural Fit" | Display name for candidate & interviewer |
  | `rounds[].description` | String | Plain text description | Evaluation guidelines |
  | `rounds[].type` | Enum | `Technical`, `HR`, `Manager`, `Final`, `Screening`, `Leadership` | Round icon & evaluator assignment rule |
  | `rounds[].order` | Integer | 0 to N (via drag-and-drop handles) | Progression sequence |
- **Payload Dispatched:** `POST /api/interviews/process/template`
  ```json
  {
    "requisition_id": "req-10294",
    "template": "technical",
    "rounds": [
      { "id": "r-1", "title": "Technical Assessment", "type": "Technical", "description": "Core stack coding" },
      { "id": "r-2", "title": "Hiring Manager Discussion", "type": "Manager", "description": "Architecture & team alignment" }
    ]
  }
  ```
- **Storage Target:** MongoDB collection `interview_process_templates` / `requisitions.interview_rounds`.
- **Downstream Impact:** Candidate timelines on this requisition automatically populate with these specific sequential stages.

---

### Situation 2: Scheduling an Interview Round (Interviewer & Candidate)
- **Component File:** `frontend/src/components/ScheduleInterviewModal.jsx` & `CompanyInterviewScheduleCard.jsx`
- **When Triggered:** HM clicks **"Schedule Interview"** on any shortlisted candidate card or AI chat card.
- **Data Collected & Captured:**
  | Field Name | Type | Mandatory? | Description / Validations |
  |---|---|---|---|
  | `candidate_id` | String | Yes | ID of applicant in `candidate_submissions` |
  | `round_id` | String | Yes | Target round sequence ID |
  | `round_type` | Enum | Yes | `Technical`, `HR`, `Manager`, `Final`, `Screening` |
  | `scheduled_date` | Date (ISO) | Yes | Validated to ensure date is today or in future (`>= todayForDeadline()`) |
  | `scheduled_time` | String | Yes | 12-hour format e.g. `10:30 AM` (validated against past times if date is today) |
  | `scheduled_timezone`| String | Yes | e.g. `Asia/Kolkata` or connected Google Calendar timezone |
  | `duration_minutes` | Integer | Yes | `15`, `30`, `45`, or `60` |
  | `interviewer_id` | String | Yes | User ID of designated interviewer staff |
  | `interviewer_name` | String | Yes | Display name of interviewer |
  | `interviewer_email`| String | Yes | Target Google Calendar recipient |
  | `notes` | String | No | Custom interview briefing notes |
- **Real-Time Validation & Conflict Prevention:**
  - `getInterviewerAvailability()` checks interviewer's database schedule + connected Google Calendar events.
  - `getCandidateSlotConflict()` ensures candidate does not have overlapping interview sessions.
- **Payload Dispatched:** `POST /api/interviews/schedule`
- **Storage Target:** MongoDB collection `interview_rounds` and `interview_schedules`.
- **Downstream Impact:**
  - Auto-provisions LiveKit WebRTC video meeting room link (`/interview/room/:roundId`).
  - Creates calendar event in connected Google Calendar with meeting link.
  - Dispatches email invitation with video room link to candidate and interviewer.

---

### Situation 3: Conducting Live Interview & Scoring Candidate Evaluation
- **Component File:** `frontend/src/interview/components/EvaluationForm.jsx` & `CandidateInterviewPanel.jsx`
- **When Triggered:** HM attends interview or reviews completed interview recording to submit scorecard.
- **Data Collected & Captured:**
  | Evaluation Criteria | Type | Scoring Scale | Description |
  |---|---|---|---|
  | `scores.technical` | Integer | 1 to 5 Stars | Technical depth, framework mastery, code quality |
  | `scores.communication` | Integer | 1 to 5 Stars | Articulation, clarity, active listening, composure |
  | `scores.problem_solving`| Integer | 1 to 5 Stars | Algorithmic logic, analytical deduction, edge cases |
  | `scores.culture` | Integer | 1 to 5 Stars | Collaboration, humility, work ethic, company culture fit |
  | `verdict` | Enum | `Strong Yes`, `Yes`, `Maybe`, `No`, `No Show` | Final hiring recommendation verdict |
  | `strengths` | String | Free-form textarea | Noted candidate technical and behavioral strengths |
  | `weaknesses` | String | Free-form textarea | Red flags, gaps in experience, or skill concerns |
  | `notes` | String | Free-form textarea | Executive summary / recommendation rationale |
  | `evaluated_by` | String | Mandatory | HM / Interviewer full name |
  | `evaluator_email` | String | Mandatory | HM / Interviewer official email |
- **Automated AI Speech Telemetry Captured Simultaneously:**
  - Audio recording chunks captured via WebRTC stream (`MediaRecorder`).
  - `words_per_minute` (Speech cadence).
  - `filler_words_count` (`"um"`, `"ah"`, `"like"` count and density percentage).
  - `confidence_score` (0–100 derived sentiment index).
- **Payload Dispatched:** `POST /api/interviews/rounds/{round_id}/evaluations`
- **Storage Target:** MongoDB collection `interview_rounds.evaluation` and `interview_evaluations`.
- **Downstream Impact:** Updates candidate pipeline scorecard badge and unlocks next round creation or final hiring decision.

---

### Situation 4: Authoring a Requisition in the 7-Tab Studio
- **Component File:** `frontend/src/pages/requisitions/NewRequisition.jsx`
- **When Triggered:** HM clicks **"New Requisition"** in the sidebar.
- **Data Collected & Form Schema:**
  - **Tab 1: Role:** `title` (string, required), `department` (dropdown, required), `seniority` (Junior/Mid/Senior/Lead/Principal), `min_experience` (years), `max_experience` (years), `job_description` (markdown).
  - **Tab 2: Skills:** `must_have_skills` (array of strings, required), `nice_to_have_skills` (array), `certifications` (array).
  - **Tab 3: Engagement:** `engagement_type` (`Contract` / `Contract-to-Hire` / `Full-time`), `duration_months` (number, required for contract), `target_start_date` (future date), `headcount` (integer >= 1).
  - **Tab 4: Commercials:** `budget_cap_currency` (`INR`, `USD`, `EUR`, `GBP`), `rate_basis` (`Hourly rate`, `Monthly retainer`, `Annual package`), `ceiling_internal` (number), `vendor_floor` (number), `vendor_cap` (number), `overtime_allowed` (boolean).
  - **Tab 5: Work Setup:** `work_mode` (`Remote`, `Hybrid`, `Onsite`), `primary_location` (string city/country), `timezone` (e.g. `IST`), `shift_timings` (e.g. `09:30 - 18:30`), `equipment_provision` (`Company-provided` / `Vendor-provided` / `BYOD`).
  - **Tab 6: Compliance:** `background_check_required` (boolean), `drug_test_required` (boolean), `nda_required` (boolean), `contract_template` (string).
  - **Tab 7: Process:** `submission_deadline` (date, sets 48h SLA), `vendor_candidate_limit` (integer, max profiles per vendor), `interview_rounds` (array).
- **Payload Dispatched:** `POST /api/requisitions`
- **Storage Target:** MongoDB collection `requisitions`.

---

### Situation 5: Drafting a Requisition via Conversational AI Chat
- **Component File:** `frontend/src/pages/HiringManagerDashboard.jsx` & `backend/modules/hiring_manager_agent/agent.py`
- **When Triggered:** HM sends prompt like *"I need a Senior Python Developer in Bangalore for 6 months"*.
- **Data Extracted & Collected:**
  - Extracted fields: `title` = "Senior Python Developer", `department` = "Core Product Engineering", `primary_location` = "Bangalore", `work_mode` = "Hybrid", `experience_band` = "Senior (5-7 yrs)", `hiring_model` = "Vendor Managed", `engagement_type` = "Contract (6 Months)".
  - Missing field tracking: AI checks 6 mandatory enterprise fields (`Role Title`, `Department`, `Work Location`, `Required Experience`, `Hiring Model`, `Target Start Date`, `Skills`).
  - If any mandatory field is missing, AI formulates specific follow-up questions while generating an editable interactive draft card.
- **Payload Dispatched:** `POST /api/hiring-manager/agent/chat`
  ```json
  {
    "prompt": "I need a Senior Python Developer in Bangalore for 6 months",
    "history": [...],
    "current_user": { "id": "hm-01", "name": "Sarah", "tenant_id": "tenant-acme" }
  }
  ```
- **Storage Target:** MongoDB `requisitions` (as `Draft` state) and session message stream.

---

### Situation 6: AI Enterprise Job Description (JD) Generation
- **Component File:** `frontend/src/pages/HiringManagerDashboard.jsx` & `backend/modules/hiring_manager_agent/router.py`
- **When Triggered:** HM clicks **"Generate JD" (`Sparkles` icon)** on a draft requisition card.
- **Data Collected & Ingested:**
  - Input: `requisition_id`, `title`, `department`, `skills`, `experience_level`.
  - Company Website Crawling: System retrieves tenant's public website URL from `company_profiles`, fetches HTML using `urllib` / `httpx`, and parses public context via `_CompanyWebsiteText`.
- **Payload Dispatched:** `POST /api/hiring-manager/agent/generate-jd`
- **Output Generated & Saved:**
  - Comprehensive 5-section enterprise JD (Role Mission, Core Responsibilities, Technical Requirements, Working Environment, Compensation & Benefits).
  - Automatically updates `requisitions.job_description` and refreshes the role summary in the interactive draft card.

---

### Situation 7: Submitting Requisition for Director Approval vs. Direct Self-Publishing
- **Component File:** `frontend/src/pages/HiringManagerDashboard.jsx` (lines 920–950)
- **When Triggered:** HM clicks **"Send to Director for Approval"** or **"Publish Requisition"**.
- **Data Evaluated:**
  - Backend checks tenant policy `company_profiles.require_director_approval`.
- **Processing Logic:**
  - **Case A: Approval Required (`require_director_approval == true`):**
    - Status transitions to `PendingApproval`.
    - `isSubmittedForApproval` = `true`.
    - Generates notification and email alert for Executive Directors.
    - Requisition is locked from vendor view until Director approval.
  - **Case B: Approval Disabled (`require_director_approval == false`):**
    - Status transitions immediately to `Published`.
    - Requisition becomes visible to approved staffing vendors.
    - 48-hour submission countdown timer starts.
- **Payload Dispatched:** `POST /api/requisitions/{id}/submit-for-approval`

---

### Situation 8: Locking & Releasing Candidate Shortlist (48-Hour SLA)
- **Component File:** `frontend/src/pages/candidates/RequisitionCandidates.jsx`
- **When Triggered:** HM clicks **"Lock & Release Shortlist" (`Send Now`)** or 48-hour SLA timer expires.
- **Data Collected:** `requisition_id`, `shortlisted_candidate_ids` (array of selected applicant IDs).
- **Processing:** Locks the requisition from further agency submissions; updates requisition status to `Shortlist Locked`.
- **Payload Dispatched:** `POST /api/requisitions/{id}/shortlist/send-now`
- **Downstream Impact:** Unlocks interview round scheduling for all shortlisted candidates and notifies staffing vendors.

---

### Situation 9: Rejecting a Candidate Profile
- **Component File:** `frontend/src/pages/candidates/RequisitionCandidates.jsx`
- **When Triggered:** HM clicks **"Reject" (`X` icon)** on any candidate card.
- **Data Collected:** `candidate_id`, `requisition_id`, `rejection_reason` (optional feedback notes, e.g. "Insufficient hands-on Kubernetes experience").
- **Payload Dispatched:** `POST /api/interviews/candidates/{id}/decision` with `{"decision": "Rejected", "notes": "..."}`
- **Storage Target:** MongoDB collection `candidate_submissions.status = "Rejected"`.
- **Downstream Impact:** Candidate is removed from active consideration; vendor agency receives automated status update.

---

### Situation 10: Final Hiring Decision: "Accept & Onboard" Candidate
- **Component File:** `frontend/src/pages/candidates/RequisitionCandidates.jsx`
- **When Triggered:** HM clicks **"Accept & Onboard" (`UserCheck` icon)** after candidate clears final interview round.
- **Data Collected:**
  - `candidate_id`, `requisition_id`, `decision: "Accepted"`.
  - `hiring_notes`: Summary justification for selection.
  - Rate & Start date confirmed from requisition parameters.
- **Payload Dispatched:** `POST /api/interviews/candidates/{id}/decision`
- **Downstream Multi-Module Automation:**
  1. Updates `candidate_submissions.status = "Accepted"`.
  2. Spawns draft **Work Order / SOW** in `db["work_orders"]` routed to Procurement.
  3. Initializes **Onboarding Checklist** records in `db["onboarding_checklists"]`.
  4. Automatically provisions self-service credentials in `db["candidate_portal_users"]` and dispatches welcome email to candidate.

---

### Situation 11: Weekly Contractor Timesheet Approval
- **Component File:** `frontend/src/pages/workforce/TimesheetApprovals.jsx`
- **When Triggered:** HM clicks **"Approve" (`CheckCircle` icon)** on a pending contractor timesheet card.
- **Data Collected:** `timesheet_id`, `approver_id` (HM User ID), `approved_at` (UTC timestamp), `notes` (optional).
- **Processing:**
  - Validates total hours logged for the week (e.g. 40 hours).
  - Updates `timesheets.status = "APPROVED"`.
- **Payload Dispatched:** `POST /api/workforce/timesheets/{id}/approve` with `{"notes": ""}`
- **Downstream Impact:**
  - Approved hours are routed to Finance Work Orders (`db["finance_work_orders"]`).
  - Invoice line items become eligible for monthly billing cycle consolidation.
  - Contractor dashboard receives "Timesheet Approved" notification.

---

### Situation 12: Weekly Contractor Timesheet Rejection (Mandatory Rationale)
- **Component File:** `frontend/src/pages/workforce/TimesheetApprovals.jsx`
- **When Triggered:** HM clicks **"Reject" (`XCircle` icon)** on a timesheet card.
- **Data Collected:**
  | Field Name | Type | Mandatory? | Validation Rule |
  |---|---|---|---|
  | `timesheet_id` | String | Yes | Target timesheet ID |
  | `reject_reason`| String | **YES** | Cannot be empty or whitespace; must describe reason (e.g. "Logged 8 hours on national holiday Oct 24 without authorization") |
- **Payload Dispatched:** `POST /api/workforce/timesheets/{id}/reject` with `{"notes": reject_reason}`
- **Storage Target:** MongoDB collection `timesheets.status = "REJECTED"`, `timesheets.rejection_reason`.
- **Downstream Impact:** Contractor's portal unlocks the timesheet for editing and displays the HM's rejection rationale for correction.

---

### Situation 13: Contractor Project Expense Claim Approval
- **Component File:** `frontend/src/pages/workforce/ExpenseApprovals.jsx`
- **When Triggered:** HM audits contractor expense receipt and clicks **"Approve"**.
- **Data Audited & Collected:** `expense_id`, `contractor_id`, `amount`, `currency`, `category` (Travel, Hardware, Software, Meals, Other), `receipt_url`, `approver_id`.
- **Payload Dispatched:** `POST /api/workforce/expenses/{id}/approve`
- **Storage Target:** MongoDB collection `expenses.status = "Approved"`.
- **Downstream Impact:** Expense reimbursement is approved and forwarded to Finance Officer dashboard for payout.

---

### Situation 14: Contractor Project Expense Claim Rejection
- **Component File:** `frontend/src/pages/workforce/ExpenseApprovals.jsx`
- **When Triggered:** HM reviews expense claim and clicks **"Reject"**.
- **Data Collected:** `expense_id`, `reject_reason` (**Mandatory** textarea explaining policy violation, e.g. "Non-approved software subscription").
- **Payload Dispatched:** `POST /api/workforce/expenses/{id}/reject` with `{"notes": reject_reason}`
- **Storage Target:** MongoDB collection `expenses.status = "Rejected"`, `expenses.rejection_reason`.

---

### Situation 15: Contractor Onboarding / Workplace Issue Triage & Resolution
- **Component File:** `frontend/src/pages/candidates/ReportedIssues.jsx`
- **When Triggered:** HM reviews a blocker reported by a contractor and clicks **"Resolve"**.
- **Data Collected:**
  | Field Name | Type | Mandatory? | Options |
  |---|---|---|---|
  | `issue_id` | String | Yes | Target issue ticket ID |
  | `status` | Enum | Yes | `in_progress`, `resolved`, `dismissed` |
  | `resolution_notes`| String | **Yes** | Explanation of resolution (e.g. "IT provisioned corporate VPN access on Oct 30") |
- **Payload Dispatched:** `PATCH /api/onboarding/issues/{id}` with `{"status": status, "resolution_notes": resolution_notes}`
- **Storage Target:** MongoDB collection `onboarding_issues`.
- **Downstream Impact:** Issue ticket is closed, and contractor receives status resolution alert.

---

### Situation 16: Candidate Self-Service Portal Access & Credential Management
- **Component File:** `frontend/src/pages/candidates/CandidatePortalAccess.jsx`
- **When Triggered:** HM manages candidate accounts or resends invite links.
- **Data Collected & Action:**
  - **Resend Invite:** `POST /api/auth/portal-users/{id}/resend-invite` (re-generates secure token and emails candidate).
  - **Toggle Status:** `POST /api/auth/portal-users/{id}/toggle-status` (toggles `is_active` boolean between `true` and `false`).

---

### Situation 17: Google Calendar OAuth Connection & Real-Time Sync
- **Component File:** `frontend/src/components/GoogleCalendarConnect.jsx`
- **When Triggered:** HM clicks **"Connect Google Calendar"** in the header.
- **Data Collected & Processed:**
  - OAuth 2.0 authorization code from Google Identity.
  - Captures connected user email, primary calendar ID, and local timezone.
- **Payload Dispatched:** `POST /api/calendar/connect`
- **Storage Target:** `users.google_calendar_token` (encrypted OAuth refresh token).
- **Downstream Impact:** Automatic two-way scheduling sync during interview slot booking.

---

### Situation 18: Hiring Manager Profile & Account Modification
- **Component File:** `frontend/src/components/EditAccountModal.jsx`
- **When Triggered:** HM clicks **"Edit Profile"** in the top navigation or user menu.
- **Data Collected:**
  - `name`: Display full name.
  - `email`: Official email address.
  - `current_password`: Required for verification if changing password.
  - `new_password`: Optional new password string.
  - `avatar_url`: Profile photo URL or upload.
- **Payload Dispatched:** `PATCH /api/auth/me`
- **Storage Target:** MongoDB / SQLAlchemy `users` record.

---

# 5. COMPLETE PAGE-BY-PAGE BUTTON & CONTROL CATALOG

This section inventories **every interactive button, toggle, dropdown, input, tab, and control** across the Hiring Manager portal, detailing its capabilities and behavior.

---

### Page: AI Hiring Assistant (`/dashboard/hiring-manager`)

| Button / Control Label | Icon | UI Location | Capability / Action Triggered | State Conditions |
|---|---|---|---|---|
| **Connect Google Calendar** | `Calendar` | Top Header | Launches Google OAuth popup to connect primary calendar. | Changes to green badge `Connected` when authorized. |
| **Interviews & Calendar Link** | `Calendar` + `ChevronRight` | Top Header | Opens the 3-view `CalendarModal` for visual scheduling. | Always accessible. |
| **Notification Bell** | `Bell` | Top Header | Toggles popover showing live requisition & candidate alerts. | Shows red counter badge when unread alerts exist. |
| **Edit Role Button** | `Pencil` | Requisition Draft Card | Opens modal to manually adjust title, skills, location, rate. | Available on active draft cards. |
| **Generate Enterprise JD** | `Sparkles` | Requisition Draft Card | Scrapes company website context and generates complete JD. | Shows spinning loader during generation. |
| **Send to Director / Publish** | `ShieldCheck` / `Sparkles` | Requisition Draft Card | Submits requisition for approval or publishes directly based on policy. | Disabled while saving or if mandatory fields are missing. |
| **Preview Resume** | `Eye` | Candidate Card | Opens `ResumePreviewModal` with PDF rendering and zoom controls. | Always accessible for screened candidates. |
| **Shortlist Candidate** | `Check` | Candidate Card | Moves candidate into the interview pipeline. | Disabled if already shortlisted. |
| **Schedule Interview** | `Calendar` | Candidate Card | Spawns `CompanyInterviewScheduleCard` in conversation. | Accessible for shortlisted candidates. |
| **Duration Selector Pills** | `Clock` | Interview Schedule Card | Sets round duration (`15m`, `30m`, `45m`, `60m`). | Active pill highlighted in black. |
| **Confirm & Dispatch Interview** | `Check` | Interview Schedule Card | Creates calendar event, LiveKit room, and emails candidate. | Disabled if slot has conflict. |
| **Mic / Voice Input Button** | `Mic` | Prompt Input Bar | Starts speech-to-text recording using browser Web Speech API. | Pulses red when active (`isListening`). |
| **Send Prompt Button** | `ArrowUp` | Prompt Input Bar | Sends text prompt to Groq AI reasoning agent. | Disabled when input is empty. |
| **Workbench Tab Switchers** | Various | Right Drawer Header | Switches between `Role`, `Skills`, `Engagement`, `Budget`, `Setup`, `Process`. | Active tab highlighted. |
| **Director Template Select** | `ChevronDown` | Right Workbench | Populates all 6 tabs with pre-configured role template. | Displays all approved company templates. |

---

### Page: Requisition Directory (`/dashboard/requisitions`)

| Button / Control Label | Icon | UI Location | Capability / Action Triggered | State Conditions |
|---|---|---|---|---|
| **Published Tab** | `Briefcase` | Tab Bar | Filters list to live, open requisitions receiving candidates. | Displays active count badge. |
| **Pending Approval Tab** | `Hourglass` | Tab Bar | Filters list to requisitions awaiting Executive Director signoff. | Displays pending count badge. |
| **Drafted Tab** | `FileText` | Tab Bar | Filters list to incomplete/unsubmitted requisition drafts. | Displays draft count badge. |
| **Completed Tab** | `CheckCircle2` | Tab Bar | Filters list to closed or successfully filled requisitions. | Displays completed count badge. |
| **All History Tab** | `History` | Tab Bar | Complete chronological archive of all company requisitions. | Always accessible. |
| **Search Input** | `Search` | Filter Bar | Instant text search across role titles and departments. | Clears via `X` button. |
| **Department Filter** | `ChevronDown` | Filter Bar | Filters requisitions by department. | Defaults to "All Departments". |
| **New Requisition CTA** | `Plus` | Top Right | Navigates to the 7-tab Requisition Creation Studio (`/new`). | Always accessible. |
| **View Candidates** | `Users` | Card Footer | Navigates directly to candidate review workspace for role. | Active on published/in-review roles. |
| **Edit Draft** | `Pencil` | Card Footer | Opens requisition editor for drafted specifications. | Hidden on published roles. |
| **Delete Draft** | `Trash2` | Card Footer | Opens confirmation modal and deletes drafted record from DB. | Only available on unsubmitted drafts. |
| **Copy Link** | `Copy` | Card Footer | Copies requisition URL to system clipboard with success toast. | Always accessible. |

---

### Page: Candidate Pool & Review (`/dashboard/requisitions/:id/candidates`)

| Button / Control Label | Icon | UI Location | Capability / Action Triggered | State Conditions |
|---|---|---|---|---|
| **Lock & Release Shortlist** | `Send` / `Lock` | Header Bar | Locks vendor submissions and releases profiles to interviewers. | Disabled after 48h deadline has already expired. |
| **Set Interview Process** | `SlidersHorizontal` | Header Bar | Opens `SetInterviewProcessModal` to configure rounds. | Always accessible. |
| **Status Filter Pills** | Various | Subheader | Filters candidate list by `All`, `Screened`, `Shortlisted`, `Interviewing`, `Accepted`, `Rejected`. | Active pill highlighted in dark styling. |
| **Preview Resume** | `FileText` | Candidate Row | Opens full PDF viewer with zoom, rotate, and download controls. | Always accessible. |
| **Shortlist Button** | `Check` | Candidate Row | Advances candidate into technical interview queue. | Hidden once already shortlisted. |
| **Schedule Interview** | `Calendar` | Candidate Row | Opens modal to book date, time, and assign interviewer. | Active for shortlisted applicants. |
| **Accept & Onboard** | `UserCheck` | Candidate Row | Final hiring decision: generates Work Order and candidate login. | Active after interview completion. |
| **Reject Candidate** | `X` | Candidate Row | Prompts for rejection reason and moves candidate to `Rejected`. | Always accessible. |

---

### Page: Weekly Timesheet Approvals (`/dashboard/workforce/timesheets`)

| Button / Control Label | Icon | UI Location | Capability / Action Triggered | State Conditions |
|---|---|---|---|---|
| **Status Filter Pills** | `Filter` | Filter Bar | Filters timesheets by `All`, `Pending`, `Approved`, `Rejected`. | Displays count badge on `Pending`. |
| **Expand Breakdown** | `ChevronDown` | Timesheet Card | Expands accordion showing daily hours (Mon–Sun) & task notes. | Toggles between open and collapsed. |
| **Approve Timesheet** | `CheckCircle` | Timesheet Card | Authorizes contractor hours and routes to Finance for billing. | Disabled while action is processing. |
| **Reject Timesheet** | `XCircle` | Timesheet Card | Opens rejection modal requiring a mandatory reason note. | Disabled while action is processing. |
| **Submit Rejection** | `AlertTriangle` | Rejection Modal | Confirms rejection, unlocks timesheet for contractor edits. | Disabled if reason text is empty. |
| **Cancel Rejection** | `X` | Rejection Modal | Dismisses rejection modal without changing timesheet state. | Always accessible. |

---

### Page: Contractor Expense Approvals (`/dashboard/workforce/expenses`)

| Button / Control Label | Icon | UI Location | Capability / Action Triggered | State Conditions |
|---|---|---|---|---|
| **Status Filter Pills** | `Filter` | Filter Bar | Filters claims by `All`, `Pending`, `Approved`, `Rejected`. | Shows pending count & sum amount. |
| **View Receipt** | `Eye` / `FileText` | Expense Row | Opens receipt modal displaying uploaded invoice image or PDF. | Active if receipt attachment exists. |
| **Approve Expense** | `CheckCircle` | Expense Row | Authorizes expense claim for finance reimbursement. | Disabled while submitting. |
| **Reject Expense** | `XCircle` | Expense Row | Opens rejection modal with mandatory explanation field. | Disabled while submitting. |

---

### Page: Reported Issues Triage (`/dashboard/candidates/issues`)

| Button / Control Label | Icon | UI Location | Capability / Action Triggered | State Conditions |
|---|---|---|---|---|
| **Issue Filter Pills** | `Filter` | Filter Bar | Filters blocker tickets by `All`, `Open`, `In Progress`, `Resolved`. | Displays open count badge. |
| **View Issue Details** | `Eye` | Issue Card | Opens modal showing full contractor description & metadata. | Always accessible. |
| **Resolve Ticket Button** | `CheckCircle2` | Issue Card | Opens resolution dialog to enter corrective actions taken. | Hidden on already resolved tickets. |
| **Confirm Resolution** | `Check` | Resolution Modal | Saves resolution notes, closes ticket, and notifies worker. | Disabled if notes are empty. |

---

# 6. GLOBAL HEADER CONTROLS, MODALS & UTILITY DRAWERS

### 6.1 Global Calendar Modal (`CalendarModal.jsx`)
- **Month / Week / Day Segmented Toggle:**
  - **Month View:** Displays 35/42-cell calendar matrix with colored event dots.
  - **Week View:** Displays 7-day column grid with week date range navigation (`<` `Oct 25 – 31, 2026` `>`) and week schedule list.
  - **Day View:** Displays hourly timeline schedule (8:00 AM – 6:00 PM) with event cards and availability markers.
- **Header Navigation Buttons:** `<` Previous, `>` Next, and `Today` quick-jump button.
- **Right Schedule Inspector:** Detailed event inspection cards with direct links to interview and requisition portals.

### 6.2 Notification Bell (`NotificationBell.jsx`)
- Live WebSocket/polling alert stream.
- Tracks: Director approval decisions, new agency candidate submissions, interview confirmations, and timesheet submissions.

### 6.3 Team Chat Drawer (`TeamChatDrawer.jsx`)
- Slide-out real-time internal messaging interface for communicating with Recruiters, Directors, and hiring staff.

### 6.4 Edit Account Modal (`EditAccountModal.jsx`)
- Updates Hiring Manager profile information: Name, Email, Avatar URL, and Password changes.

---

# 7. END-TO-END BUSINESS WORKFLOWS & STATE MACHINES

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          HIRING MANAGER LIFECYCLE                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
             ┌───────────────────────┴───────────────────────┐
             ▼                                               ▼
   [FLOW 1: REQUISITION CREATION]                  [FLOW 2: WORKFORCE MGMT]
   • Draft in Wizard or AI Chat                    • Weekly Timesheet Review
   • Generate Enterprise JD                        • Expense Claims Audit
   • Director Approval Check                       • Onboarding Issue Triage
             │                                               │
             ▼                                               ▼
   [FLOW 3: CANDIDATE SCREENING]                   [FINANCIAL ROUTING]
   • 48-Hour Vendor SLA window                     • Approved hours -> Finance
   • AI Resume Match Scoring (0-100%)              • Invoice & Payment
   • Lock & Release Shortlist
             │
             ▼
   [FLOW 4: INTERVIEW ORCHESTRATION]
   • Multi-Round Scheduling (Google Cal Sync)
   • LiveKit WebRTC Video Room
   • Candidate Evaluation Scorecard
             │
             ▼
   [FLOW 5: FINAL DECISION & HANDOFF]
   • "Accept & Onboard" Action
   • Work Order Shell -> Procurement
   • Candidate Portal Account Issued
```

---

# 8. COMPLETE BACKEND API REGISTRY FOR HIRING MANAGERS

| HTTP Method | API Endpoint | Description | Auth Role |
|---|---|---|---|
| `POST` | `/api/hiring-manager/agent/chat` | Main conversational AI reasoning assistant | `Hiring Manager`, `HR` |
| `GET` | `/api/hiring-manager/agent/flow-settings` | Retrieves tenant director approval policy | `Hiring Manager`, `HR` |
| `POST` | `/api/hiring-manager/agent/generate-jd` | Generates enterprise JD using company website | `Hiring Manager`, `HR` |
| `GET` | `/requisitions` | Lists company requisitions with status filter | `Hiring Manager`, `HR` |
| `POST` | `/requisitions` | Creates new requisition record | `Hiring Manager`, `HR` |
| `GET` | `/requisitions/{id}` | Gets single requisition specification | `Hiring Manager`, `HR` |
| `PUT` | `/requisitions/{id}` | Updates drafted requisition | `Hiring Manager`, `HR` |
| `DELETE`| `/requisitions/{id}` | Deletes drafted requisition | `Hiring Manager`, `HR` |
| `POST` | `/requisitions/{id}/submit-for-approval`| Submits requisition to Director | `Hiring Manager`, `HR` |
| `POST` | `/requisitions/{id}/publish` | Self-publishes requisition (if policy allows)| `Hiring Manager`, `HR` |
| `GET` | `/requisitions/{id}/candidates` | Lists candidate submissions for requisition | `Hiring Manager`, `HR` |
| `POST` | `/api/candidates/shortlist` | Moves candidate to Shortlisted status | `Hiring Manager`, `HR` |
| `POST` | `/api/interviews/candidates/{id}/decision` | Submits Accept & Onboard or Reject | `Hiring Manager`, `HR` |
| `GET` | `/api/interviews/company` | Lists scheduled interviews for tenant | `Hiring Manager`, `HR` |
| `POST` | `/api/interviews/schedule` | Schedules interview & generates LiveKit room | `Hiring Manager`, `HR` |
| `POST` | `/api/interviews/rounds/{id}/evaluations` | Submits interview scorecard and ratings | `Hiring Manager`, `HR` |
| `GET` | `/api/workforce/team` | Lists active contractors working under HM | `Hiring Manager`, `HR` |
| `GET` | `/api/workforce/timesheets` | Lists contractor weekly timesheets | `Hiring Manager`, `HR` |
| `POST` | `/api/workforce/timesheets/{id}/approve` | Approves weekly contractor hours | `Hiring Manager`, `HR` |
| `POST` | `/api/workforce/timesheets/{id}/reject` | Rejects timesheet with reason note | `Hiring Manager`, `HR` |
| `GET` | `/api/workforce/expenses` | Lists contractor expense claims | `Hiring Manager`, `HR` |
| `POST` | `/api/workforce/expenses/{id}/approve` | Approves expense reimbursement | `Hiring Manager`, `HR` |
| `POST` | `/api/workforce/expenses/{id}/reject` | Rejects expense claim with reason note | `Hiring Manager`, `HR` |
| `GET` | `/api/onboarding/issues` | Lists reported onboarding and workplace blockers | `Hiring Manager`, `HR` |
| `PATCH`| `/api/onboarding/issues/{id}` | Resolves or updates issue ticket | `Hiring Manager`, `HR` |
| `POST` | `/api/auth/portal-users/{id}/resend-invite`| Resends candidate portal access email | `Hiring Manager`, `HR` |

---

# 9. SECURITY, GOVERNANCE & MULTI-TENANT ISOLATION

1. **Multi-Tenant Scoping:** Every database operation automatically applies `tenant_id = current_user.tenant_id`. Hiring Managers can never see or modify requisitions, applicants, or contractors of other organizations.
2. **Treasury Separation:** Hiring Managers verify and approve **timesheets and expense validity**, but are barred from treasury operations, bank disbursements, and UTR generation.
3. **Role Enforcement:** Frontend route guards (`RequireAuth` and `DashboardAccessGuard`) and FastAPI backend dependencies (`Depends(get_current_user)`) enforce `role in ('Hiring Manager', 'HR')`.
4. **Audit Immutability:** State changes (approvals, rejections, status updates) record the user ID, timestamp, and client request ID for audit traceability.
