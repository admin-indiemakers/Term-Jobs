# Term Jobs Platform — Comprehensive QA Te**Document Version:** 1.0  
st Case Plan

**Target Audience:** QA Lead / Head of QA / Engineering Team  
**System Under Test:** Term Jobs (Enterprise Contract Workforce & Vendor Management System)  
**Date:** September 2026  

---

## 1. Executive Summary & Scope

### 1.1 Objective
This document defines the end-to-end Master Test Plan and detailed Test Cases for the **Term Jobs** platform. It serves as the baseline for manual, automated, functional, regression, and security testing prior to production sign-off.

### 1.2 System Overview
Term Jobs is an AI-powered enterprise contract workforce platform unifying:
- Multi-tenant Organization & Vendor Onboarding
- Requisition Management & Approval Workflows
- Vendor Candidate Submissions & Resume Screening
- AI-assisted Video Interviews (LiveKit WebRTC)
- Digital Offer Letters & Candidate Onboarding Checklists
- Contractor Timesheets, Approvals & Billing Invoices
- Contractor Offboarding (Freezing Timesheets, 48-hour Grace Period Access & Deactivation)
- Role-Based Access Control across Super Admin, Admin, Hiring Manager, Vendor, Candidate, and Contractor

### 1.3 Test Environments
| Environment | Frontend URL | Backend API | Database |
| :--- | :--- | :--- | :--- |
| **Local Dev** | `http://localhost:5173` | `http://localhost:8000` | MongoDB Local / Test Atlas |
| **Staging / Vercel** | `https://termjobs.vercel.app` | `https://term-jobs-j8ja-seven.vercel.app` | MongoDB Atlas Staging |
| **Production** | Production Domain | Production API Gateway | MongoDB Atlas Replica Set |

---

## 2. Roles & Permissions (RBAC) Matrix

| Feature / Module | Super Admin | Company Admin | Hiring Manager | Vendor Partner | Candidate / Contractor |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Onboard New Companies / Vendors** | Full | None | None | None | None |
| **Manage Tenant Accounts & Rate Cards** | Full | Tenant-Only | None | None | None |
| **Create / Approve Requisitions** | View | Full | Create & View Own | View Published | None |
| **Submit Candidates against Requisitions** | None | None | None | Full | None |
| **Evaluate Resumes / Schedule Interviews** | View | Full | Full | View Status | View Own Schedule |
| **LiveKit AI Video Interview** | None | View Score | View Score | None | Attend |
| **Issue Work Orders & Offer Letters** | View | Full | View Own | View Own Placements | Sign Own Offer |
| **Onboarding Checklist** | Audit | Review & Verify | Review | None | Complete Own Tasks |
| **Submit Weekly Timesheets** | None | None | None | None | Full (Active Contractor) |
| **Approve / Reject Timesheets** | Audit | Full | Full (Assigned) | View Placements | None |
| **Initiate Contractor Offboarding** | Full | Full | Full (Own Contractors) | View Status | Complete Exit Checklist |
| **Workforce Billing & Invoices** | Full | Tenant Spend | None | Vendor Invoices | View Own Pay Slips |

---

## 3. Test Suites & Detailed Test Cases

---

### Test Suite 1: Authentication & Session Management (Unified Login)

| Test ID | Test Case Title | Pre-conditions | Test Steps | Expected Result | Priority |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-AUTH-01** | Unified Login for Super Admin | Super Admin user exists | 1. Navigate to `/login`<br>2. Enter Super Admin credentials<br>3. Submit form | Authenticated, JWT stored, redirected to `/dashboard/superadmin` | **P0** |
| **TC-AUTH-02** | Unified Login for Company Admin | Company Admin user exists | 1. Navigate to `/login`<br>2. Enter Company Admin credentials<br>3. Submit form | Authenticated, redirected to `/dashboard/admin` | **P0** |
| **TC-AUTH-03** | Unified Login for Hiring Manager | Hiring Manager user exists | 1. Navigate to `/login`<br>2. Enter HM credentials<br>3. Submit form | Authenticated, redirected to `/dashboard/hiring-manager` | **P0** |
| **TC-AUTH-04** | Unified Login for Staffing Vendor | Vendor user exists | 1. Navigate to `/login`<br>2. Enter Vendor credentials<br>3. Submit form | Authenticated, redirected to `/dashboard/vendor` | **P0** |
| **TC-AUTH-05** | Unified Login for Candidate / Contractor | Candidate exists | 1. Navigate to `/login`<br>2. Enter Candidate credentials<br>3. Submit form | Authenticated, redirected to `/dashboard/candidate` | **P0** |
| **TC-AUTH-06** | Separate Candidate Login Route Redirect | None | 1. Navigate directly to `/candidate/login` | System redirects to `/login` with clean return URL parameter | **P1** |
| **TC-AUTH-07** | Invalid Password / Unregistered Email | None | 1. Enter invalid email or incorrect password<br>2. Submit | Inline error message displayed: "Invalid email or password", no token issued | **P0** |
| **TC-AUTH-08** | Token Expiration & Route Guarding | Expired or missing token | 1. Attempt to open `/dashboard/admin` directly without auth | Blocked; redirected to `/login` with session expired toast | **P1** |
| **TC-AUTH-09** | Logout & Token Invalidation | User is logged in | 1. Click Profile -> Logout | Token cleared from storage, user redirected to `/login`, back button does not restore session | **P1** |

---

### Test Suite 2: Multi-Tenant Onboarding & Account Management

| Test ID | Test Case Title | Pre-conditions | Test Steps | Expected Result | Priority |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-ONB-01** | Onboard Company via Super Admin Modal | Super Admin logged in | 1. Click "Onboard Company"<br>2. Enter Company Name, Industry, Size, Location, Admin Name, Email, Password<br>3. Submit | Company tenant and primary admin account created; success alert shown; modal closes | **P0** |
| **TC-ONB-02** | Onboard Vendor via Super Admin Modal | Super Admin logged in | 1. Click "Onboard Vendor"<br>2. Enter Agency Name, Specializations, Location, Admin Name, Email, Password<br>3. Submit | Vendor tenant and admin created; appears in active vendor registry | **P0** |
| **TC-ONB-03** | AI Auto-Fill Removal Verification | Super Admin logged in | 1. Open "Onboard Company" modal<br>2. Open "Onboard Vendor" modal | Verify that NO "Auto-fill with AI" button, banner, or Groq API calls exist; form requires manual input | **P0** |
| **TC-ONB-04** | Duplicate Tenant Name Validation | "Acme Corp" exists | 1. Enter "Acme Corp" in Company Name field<br>2. Wait for live validation | Inline warning "Company name already taken"; submit button is disabled | **P1** |
| **TC-ONB-05** | Guest Partner Vendor Onboarding | Admin logged in | 1. Go to Partner Vendors<br>2. Click "+ Onboard Guest Vendor"<br>3. Enter details manually<br>4. Submit | Guest vendor created and listed under Partner Vendors tab without AI auto-fill buttons | **P1** |
| **TC-ONB-06** | Filter Active Companies & Vendors | Multiple companies exist | 1. View Companies table on Super Admin dashboard | Only ACTIVE companies are displayed; archived or purged mock tenants do not appear | **P1** |

---

### Test Suite 3: Requisition Management & Approval Workflows

| Test ID | Test Case Title | Pre-conditions | Test Steps | Expected Result | Priority |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-REQ-01** | Create Requisition (Draft) | Hiring Manager logged in | 1. Click "Create Requisition"<br>2. Fill Title, Department, Budget/Rate, Skills, Job Description<br>3. Save as Draft | Requisition created with status `DRAFT`; visible only to creator | **P0** |
| **TC-REQ-02** | Submit Requisition for Approval | Requisition in `DRAFT` | 1. Click "Submit for Approval" | Status changes to `PENDING_APPROVAL`; notification sent to Company Admin | **P0** |
| **TC-REQ-03** | Admin Approves Requisition | Admin logged in | 1. Navigate to Approval queue<br>2. Review rate card & budget<br>3. Click "Approve" | Status updates to `OPEN`; broadcasted to engaged staffing vendors | **P0** |
| **TC-REQ-04** | Admin Rejects Requisition with Reason | Admin logged in | 1. Open Pending Requisition<br>2. Click "Reject"<br>3. Enter reason ("Exceeds budget cap") | Status updates to `REJECTED`; creator notified with rejection reason | **P1** |
| **TC-REQ-05** | Requisition Rate Cap Enforcement | Requisition created | 1. Attempt to set Max Hourly Rate higher than company rate card cap | Validation error displayed; form prevents submission over cap | **P1** |

---

### Test Suite 4: Vendor Submissions & Candidate Sourcing

| Test ID | Test Case Title | Pre-conditions | Test Steps | Expected Result | Priority |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-SRC-01** | Vendor Views Open Requisitions | Vendor logged in | 1. Navigate to Requisitions board | Only requisitions open to this vendor or public are visible; rates match vendor tier | **P0** |
| **TC-SRC-02** | Vendor Submits Candidate with Resume | Requisition `OPEN` | 1. Click "Submit Candidate"<br>2. Enter Candidate Name, Email, Phone, Bill Rate<br>3. Upload resume (PDF)<br>4. Submit | Candidate record created; resume parsed; candidate appears in HM's incoming pool | **P0** |
| **TC-SRC-03** | Duplicate Candidate Detection (Same Email) | Candidate "John Doe" submitted | 1. Another vendor attempts to submit same email address for same role | System flags duplicate; blocks second submission with "Candidate already submitted" | **P0** |
| **TC-SRC-04** | Candidate Bill Rate Exceeds Max Requisition Rate | Requisition max is $85/hr | 1. Vendor submits candidate with Bill Rate = $95/hr | Form rejects submission: "Candidate rate exceeds maximum allowed rate ($85.00)" | **P1** |
| **TC-SRC-05** | Resume Parser File Type & Size Limits | None | 1. Upload .exe or file > 15MB<br>2. Upload valid PDF/DOCX (3MB) | Invalid file rejected with format/size error; valid PDF accepted and text extracted | **P2** |

---

### Test Suite 5: Resume Screening & AI Matching

| Test ID | Test Case Title | Pre-conditions | Test Steps | Expected Result | Priority |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-SCR-01** | Automated Resume Screening Score | Candidate submitted | 1. Open Candidate detail panel<br>2. Review AI Match Score | Match score (0–100%) computed based on skills, experience, and JD requirements | **P1** |
| **TC-SCR-02** | Shortlist Candidate | HM logged in | 1. Select candidate in screening stage<br>2. Click "Shortlist for Interview" | Candidate stage updates to `SHORTLISTED`; candidate notified to schedule interview | **P0** |
| **TC-SCR-03** | Reject Candidate with Feedback | HM logged in | 1. Select candidate<br>2. Click "Reject Candidate"<br>3. Select reason | Status updates to `REJECTED`; vendor receives rejection feedback notification | **P1** |

---

### Test Suite 6: Interview Scheduling & AI Video Interview (LiveKit)

| Test ID | Test Case Title | Pre-conditions | Test Steps | Expected Result | Priority |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-INT-01** | Schedule Human Interview (Google Calendar) | Candidate shortlisted | 1. Click "Schedule Interview"<br>2. Pick Date, Time, Interviewers<br>3. Confirm | Calendar invite sent with Google Meet/room link to both candidate and interviewers | **P1** |
| **TC-INT-02** | Launch AI Video Interview Room (LiveKit) | Candidate enters room | 1. Candidate clicks interview link<br>2. Allow mic & camera permissions<br>3. Connect to room | LiveKit WebRTC room establishes; audio/video streams active; AI avatar greets candidate | **P0** |
| **TC-INT-03** | AI Questioning & Speech-to-Text Transcription | AI interview underway | 1. AI bot asks technical question<br>2. Candidate speaks response<br>3. VAD (Voice Activity Detection) triggers | Candidate audio transcribed in real time; conversation turn logged into session history | **P1** |
| **TC-INT-04** | Interview Evaluation Report Generation | Interview concludes | 1. Candidate completes all questions or ends call | Evaluation report generated with technical score, communication score, and transcript | **P1** |

---

### Test Suite 7: Digital Offer, Work Order & Onboarding

| Test ID | Test Case Title | Pre-conditions | Test Steps | Expected Result | Priority |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-ONBD-01** | Generate Digital Offer & Work Order | Candidate selected | 1. Click "Make Offer & Generate Work Order"<br>2. Fill Start Date, Duration, Pay Rate, Bill Rate<br>3. Issue Offer | Work order draft created; offer email dispatched to candidate with secure portal link | **P0** |
| **TC-ONBD-02** | Candidate Accepts & Signs Digital Offer | Candidate receives link | 1. Open offer letter in Candidate Portal<br>2. Review terms<br>3. Click "Accept & Sign Offer" | Offer signed; candidate status moves to `ONBOARDING`; checklist unlocks | **P0** |
| **TC-ONBD-03** | Candidate Completes Onboarding Checklist | Candidate in onboarding | 1. Candidate completes Identity Verification, Tax Forms, Emergency Contact, Bank Details | Each item checks off; overall onboarding progress shows 100% | **P0** |
| **TC-ONBD-04** | HM / Admin Approves Completed Onboarding | All checklist items done | 1. Admin/HM reviews uploaded documents<br>2. Click "Verify & Activate Contractor" | Candidate promoted to active `CONTRACTOR`; timesheet module activated; start date set | **P0** |

---

### Test Suite 8: Timesheet Submission, Approval & Locking

| Test ID | Test Case Title | Pre-conditions | Test Steps | Expected Result | Priority |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-TS-01** | Contractor Logs Weekly Hours | Active Contractor | 1. Open Timesheets tab<br>2. Enter 8 hours/day (Mon-Fri)<br>3. Save Draft | 40 hours saved in draft state; calculations show correct regular hours | **P0** |
| **TC-TS-02** | Contractor Submits Timesheet | 40 hours logged | 1. Click "Submit Timesheet for Approval" | Status updates to `SUBMITTED`; fields become read-only; assigned HM receives approval task | **P0** |
| **TC-TS-03** | Hiring Manager Approves Timesheet | Timesheet in `SUBMITTED` | 1. HM reviews hours<br>2. Click "Approve Timesheet" | Status changes to `APPROVED`; locked against further edits; queued for invoice generation | **P0** |
| **TC-TS-04** | Hiring Manager Rejects Timesheet with Note | Timesheet in `SUBMITTED` | 1. HM clicks "Reject"<br>2. Enters reason ("Incorrect hours on Wednesday") | Status changes to `REJECTED`; unlocked for contractor to correct and re-submit | **P1** |
| **TC-TS-05** | Overtime Calculation & Cap Enforcement | Overtime allowed | 1. Contractor logs 50 hours (10 hrs overtime) | System correctly separates Regular (40h) and OT (10h) based on rate rules | **P1** |

---

### Test Suite 9: Contractor Offboarding Workflow (Critical)

| Test ID | Test Case Title | Pre-conditions | Test Steps | Expected Result | Priority |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-OFF-01** | Hiring Manager Initiates Offboarding | Active Contractor | 1. Go to Contractor Profile<br>2. Click "Initiate Offboarding"<br>3. Select reason (Contract End / Performance / Resignation)<br>4. Submit offboarding checklist | Offboarding state set to `PENDING_CANDIDATE_COMPLETION`; candidate notified | **P0** |
| **TC-OFF-02** | Candidate Receives & Submits Exit Checklist | Offboarding initiated | 1. Candidate logs in to Candidate Portal<br>2. Views matching onboarding/offboarding fields (Asset return, Knowledge transfer, Final signoff)<br>3. Ticks all checkboxes<br>4. Clicks "Complete Offboarding" | All items checked; exit checklist submitted successfully | **P0** |
| **TC-OFF-03** | Timesheet Freezing upon Offboarding | Exit checklist completed | 1. Check contractor's timesheet status | Timesheets immediately freeze (`FROZEN`); no new hours can be submitted or edited | **P0** |
| **TC-OFF-04** | 48-Hour Grace Period Access | Exit checklist completed | 1. Candidate logs in within 48 hours of offboarding | Candidate can log in; sees banner "Account scheduled for deactivation in X hours"; can download past pay slips/tax docs; operational tabs disabled | **P0** |
| **TC-OFF-05** | Total Account Deactivation after 48 Hours | 48 hours expired | 1. Advance clock / run deactivation job<br>2. Candidate attempts login | Login fails with "Account deactivated. Please contact support."; session terminated | **P0** |
| **TC-OFF-06** | Email Re-availability after Deactivation | Account deactivated | 1. Vendor attempts to register or submit candidate using same email for a new role | Email is available; system does not block new registration with duplicate error | **P0** |

---

### Test Suite 10: Vendor Billing, Invoicing & Margins

| Test ID | Test Case Title | Pre-conditions | Test Steps | Expected Result | Priority |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-BILL-01** | Automatic Invoice Generation from Timesheet | Timesheet `APPROVED` | 1. Run weekly billing cycle | Invoice generated multiplying Approved Hours × Bill Rate; Vendor Pay = Hours × Pay Rate | **P0** |
| **TC-BILL-02** | Margin Calculation Verification | Bill Rate: $100/hr, Pay: $75/hr | 1. Review generated invoice for 40 hours | Gross Bill: $4,000, Vendor Payout: $3,000, Platform Margin: $1,000 (25%) calculated accurately | **P1** |
| **TC-BILL-03** | Company Admin Downloads PDF Invoice | Invoice in `GENERATED` | 1. Go to Billing & Invoices<br>2. Click "Download Invoice PDF" | Clean PDF downloaded with itemized contractor hours, rates, tax, and PO number | **P1** |

---

### Test Suite 11: Security, Tenant Isolation & Boundary Testing

| Test ID | Test Case Title | Pre-conditions | Test Steps | Expected Result | Priority |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-SEC-01** | Cross-Tenant Data Isolation (IDOR) | Tenant A and Tenant B exist | 1. Authenticate as Company Admin A<br>2. Attempt GET `/api/requisitions/{id_belonging_to_B}` | API returns `403 Forbidden` or `404 Not Found`; no data leaked | **P0** |
| **TC-SEC-02** | Vendor Privacy Isolation | Vendor A and Vendor B exist | 1. Authenticate as Vendor A<br>2. Attempt to view candidates submitted by Vendor B | Candidate list returns only Vendor A's candidates; Vendor B records hidden | **P0** |
| **TC-SEC-03** | Unauthorized Role Privilege Escalation | Candidate user logged in | 1. Send POST request to `/api/auth/tenants` using Candidate token | Request rejected with `403 Forbidden: Super Admin or Admin only` | **P0** |
| **TC-SEC-04** | Input Sanitization & XSS Prevention | Any input field | 1. Enter `<script>alert('xss')</script>` in Company Name or Notes field<br>2. Save and view in UI | Input safely escaped and rendered as plaintext without executing script | **P1** |
| **TC-SEC-05** | CORS Policy & Preflight Enforcement | Staging deployment | 1. Send cross-origin request from unauthorized domain | Blocked by CORS policy; no `Access-Control-Allow-Origin` for unauthorized origins | **P1** |

---

### Test Suite 12: Performance & Cross-Browser Compatibility

| Test ID | Test Case Title | Target Platform | Test Steps | Expected Result | Priority |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-PERF-01** | Initial Page Load & Bundle Size | Desktop Chrome | 1. Open platform with cleared cache<br>2. Measure LCP and FCP | FCP < 1.2s, LCP < 2.5s; no blocking console errors | **P2** |
| **TC-PERF-02** | Candidate Board Virtualization / Load | 500+ candidate records | 1. Open Candidate Pipeline board with 500+ records | Smooth scrolling (60fps); no browser freezing | **P2** |
| **TC-COMP-01** | Cross-Browser Compatibility | Chrome, Safari, Firefox, Edge | 1. Execute TC-AUTH-01 through TC-ONB-02 across all 4 browsers | Consistent layout, styling, and functionality across all browsers | **P1** |
| **TC-COMP-02** | Responsive Mobile / Tablet Layout | iOS Safari & Android Chrome | 1. Open site at 375px, 768px, 1024px widths<br>2. Test login and candidate profile view | Responsive layout, hamburger navigation works, no horizontal overflow | **P2** |

---

## 4. Defect Severity & Classification Guidelines

| Severity Level | Definition | SLA for Fix |
| :--- | :--- | :--- |
| **Critical (Blocker)** | System crash, data loss, login failure, security vulnerability (IDOR), offboarding failure, timesheet billing inaccuracy. | < 4 hours |
| **Major (P1)** | Core business workflow blocked (e.g. cannot approve requisition, upload resume, or schedule interview) with no workaround. | < 24 hours |
| **Moderate (P2)** | Feature works partially or has a viable workaround (e.g. filter issue, minor calculation display delay). | < 3 days |
| **Minor (P3)** | Cosmetic defects, minor typography/alignment issues, non-breaking warnings in console. | Next sprint |

---

## 5. QA Entry & Exit Criteria

### 5.1 Entry Criteria for Formal Testing
- [x] All backend unit and integration tests passing (`pytest backend/tests/`).
- [x] Frontend production bundle compiles cleanly (`npm run build` exits 0).
- [x] Test databases seeded with representative tenant data and test credentials.
- [x] API endpoints healthy (`/health` returns status: 200).

### 5.2 Exit / Release Criteria
- [ ] 100% execution of P0 (Critical) and P1 (Major) test cases.
- [ ] 0 open Critical or Major defects.
- [ ] Offboarding workflow 48-hour deactivation and timesheet freeze verified.
- [ ] Multi-tenant isolation verified with automated security tests.
- [ ] Formal sign-off by QA Lead and Engineering Lead.

---

## 6. Test Execution Sign-Off

| Role | Name | Signature / Status | Date |
| :--- | :--- | :--- | :--- |
| **Head of QA** | ________________________ | `[ ] APPROVED  [ ] REJECTED` | ____________ |
| **Lead Developer** | ________________________ | `[ ] APPROVED  [ ] REJECTED` | ____________ |
| **Product Manager** | ________________________ | `[ ] APPROVED  [ ] REJECTED` | ____________ |
