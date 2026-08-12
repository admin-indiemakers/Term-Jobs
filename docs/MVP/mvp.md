# Term Jobs - Redefined MVP (v2)

Vendor-facing hiring flow: JD intake -> resume analysis -> interview setup

> This revision updates the identity/RBAC model and the requisition-publish step from the original Redefined MVP doc. Everything else (agent mechanics, module scope, build order intent) is unchanged unless noted below.

## 0. Why this redefinition exists

The original v4 MVP scoped 4 agents around operations (Screening, Timesheet Review, Recon/Invoice Validation, FAQ-only support) - it assumed hiring itself was manual and automated what happens after a hire (time, billing).

The actual product priority is different: automate the vendor-facing hiring funnel - JD in, resumes screened, interviews scheduled - and defer time tracking and billing entirely. This document replaces the agent/module scope in v4 and the Final Project Plan with a leaner MVP matched to that priority. Nothing about the underlying stack, module architecture pattern, or guardrail mechanics changes - only which modules and agents ship first.

## 1. MVP scope, restated

In scope:

| Module | Why it's in |
|---|---|
| `identity/` | Tenancy (client / consultancy), auth, roles - nothing else works without it |
| `requisition/` | Holds the JD and requisition record; state machine for requisition lifecycle |
| `candidate/` | Resume intake, candidate-to-requisition linking, interview state |

In scope - agents:

| Agent | Trigger | Reads | Produces | Guardrail |
|---|---|---|---|---|
| Job Requirement Agent | `requisition.created` | Raw JD text | Normalized structured role (title, must-have skills, nice-to-have, seniority, location, rate band) | Always human-reviewed - hiring manager edits before publish |
| Candidate Screening Agent | `candidate.linked_to_requisition` | Resume, structured role, existing submissions for that req | Fit score, duplicate-submission flags | Human-reviewed by default; auto-shortlist/auto-reject available as a per-tenant opt-in, off by default |
| Interview Scheduling Agent | Candidate shortlisted (human-approved) | Interviewer availability, candidate availability (via comms) | Proposed interview slots, confirmed booking | Always human-reviewed for the interviewer side; candidate-facing scheduling comms can auto-send once a human has approved the shortlist |

Explicitly out of MVP:
- `worker/`, `compliance/`, `time_expense/`, `billing/`, `analytics/` - deferred in full
- Vendor Matching Agent, Rate Benchmark Agent, Performance Insight Agent, Compliance Agent
- Timesheet Audit Agent, Invoice Validation Agent
- Multi-country support (India-only, single country pack)
- Auto-execute for anything beyond candidate shortlisting - no auto-hire, no auto-onboarding

## 2. Flow, end to end

```
Admin (Term Jobs team) creates HR account
        |
        v
HR creates Hiring Manager account
        |
        v
Hiring Manager pastes/uploads JD
        |
        v
requisition.created event --> Job Requirement Agent
        |
        v
Structured role (title, skills, seniority, rate band)
        |
[checkpoint] Hiring Manager reviews/edits --> approves
        |
        v
[checkpoint] Hiring Manager/Admin select vendor subset from client's approved vendor list
        |
        v
Requisition published to selected consultancy/vendor(s) only
        |
        v
Recruiter (at a selected consultancy) sees the requisition, submits candidate + resume
        |
        v
candidate.linked_to_requisition event --> Candidate Screening Agent
        |
        v
Fit score + duplicate-submission flags
        |
[checkpoint] Approval Queue entry for Hiring Manager
        |
        v
Hiring Manager shortlists candidate
        |
        v
Interview Scheduling Agent triggered
        |
        v
Candidate + interviewer availability collected (email/WhatsApp)
        |
        v
Interview slot proposed --> confirmed --> both parties notified
```

Every checkpoint above is a LangGraph graph pause, persisted to Postgres - same mechanism as v4's original design, just applied to this narrower flow.

## 3. Module detail

### 3.1 `identity/`

**Tenant types:** `client`, `consultancy` (Admin is platform-level, not scoped to a tenant)

**Role hierarchy and provisioning chain:**

```
Admin (single, platform-level "super admin" - Term Jobs team only)
 ├── creates --> HR ──creates--> Hiring Manager
 └── creates --> Recruiter (consultancy-side)
```

| Role | Created by | Scope / responsibilities |
|---|---|---|
| Admin | n/a (root, Term Jobs internal) | Single platform-level super admin. Creates HR accounts, creates Recruiter accounts, maintains client<->vendor allowlists. |
| HR | Admin | Client-side. Creates Hiring Manager accounts. Oversight/view access over the Hiring Managers they created - does not post JDs, does not trigger `requisition.created`. |
| Hiring Manager | HR | Client-side. Posts/pastes the JD (this is what fires `requisition.created`), reviews/approves the structured role, selects vendor subset at publish, shortlists candidates. |
| Recruiter | Admin | Consultancy-side. Sees only requisitions assigned to their own consultancy (via the vendor-assignment step below). Submits candidates. |

Note: this is a materially bigger Admin surface than the original doc assumed ("platform admin exists but isn't user-facing at MVP"). Admin is now user-facing at MVP - it has to be, since it's the sole root for both the HR->Hiring Manager chain and the Recruiter chain, and it owns vendor-allowlist management. `identity/` build-out needs an Admin console, not just RLS and role definitions.

**Client<->vendor allowlist:** Admin maintains which consultancies are eligible to receive JDs for a given client (many-to-many: `client_tenant_id` x `vendor_tenant_id`). This is the *eligible pool* - it does not mean a vendor automatically receives every JD from that client (see 3.2).

, from day one, single country pack (India).

Open question carried forward: does one consultancy span multiple client relationships as a single tenant, or a scoped record per relationship? Blocks nothing at this narrow MVP scope (no billing yet), but should be answered before Phase 2 re-introduces billing. The mirror-image question now also applies to Recruiter scoping - see section 7.

### 3.2 `requisition/`

**Domain entity:** Requisition (raw JDagf, structured role once processed, status)

**State machine:** `Draft -> Structuring -> PendingApproval -> Published -> Closed`

- Job Requirement Agent writes into `Structuring`
- Human approval (Hiring Manager) moves it to `PendingApproval` -> `Published`

**Vendor assignment at publish:** publishing is no longer a broadcast to all vendors. At the `Published` transition, Hiring Manager (or Admin) selects a subset of the client's approved vendors (from the 3.1 allowlist) for that specific requisition. This is per-JD, not a client-level default - the same client's approved vendor pool can be split differently across different requisitions.

Suggested implementation: a `RequisitionVendorAssignment` join table (`requisition_id` x `vendor_tenant_id`), constrained so only vendors on that client's allowlist can be assigned. A recruiter's requisition visibility is then: requisitions where their consultancy appears in this assignment table.

### 3.3 `candidate/`

**Domain entity:** Candidate, Submission (links candidate to a requisition)

**State machine:** `Submitted -> Screened -> Shortlisted -> InterviewScheduled -> InterviewCompleted -> Rejected/Selected`

- Screening Agent writes into `Screened`; human action moves to `Shortlisted`
- Interview Scheduling Agent writes into `InterviewScheduled`

## 4. Agent mechanics (unchanged from v4/Final Plan)

See `agents.md` for full detail. Summary: all three agents run through the same guardrail loop (budget gate -> build context -> tool loop -> schema validation -> guardrail check -> persist decision record -> approval queue or auto-dispatch). No agent touches `identity/` directly - consistent with the "Core stays deterministic" rule from the original architecture.

## 5. Build order

1. `identity/` - tenancy, roles, RLS, **and Admin console** (account creation for HR/Recruiter, vendor allowlist management) - this is now a harder dependency than originally scoped, since nothing downstream can be provisioned without it
2. `requisition/` + Job Requirement Agent + vendor-assignment-at-publish
3. `candidate/` + Candidate Screening Agent
4. Interview Scheduling Agent (comms integration - email/WhatsApp)

Each step is independently testable: you can validate the Job Requirement Agent against fixture JDs before Candidate module exists, then validate Screening against fixture resumes once `candidate/` lands, then Interview Scheduling last since it depends on both prior agents' outputs.

## 6. What's deferred to Phase 2 (unchanged set, for reference)

- `worker/`, `compliance/`, `time_expense/`, `billing/`, `analytics/`
- Vendor Matching Agent, Rate Benchmark Agent, Performance Insight Agent, Compliance Agent, Timesheet Audit Agent, Invoice Validation Agent
- Support Copilot (real RAG version - static FAQ only, if needed at all, at MVP)
- Second country pack
- Second KYC provider, e-signature, payments - none of these are relevant until `worker/` + `billing/` are back in scope

## 7. Open questions specific to this MVP

| Question | Blocks | Notes |
|---|---|---|
| What counts as "interviewer availability" input - calendar integration or manual entry? | Interview Scheduling Agent's context-build step | Needs an answer before that agent's tool loop can be specified |
| Does Screening Agent's auto-shortlist opt-in ship at MVP or stay off entirely until trust is established? | `candidate/` guardrail config | Recommend: off for MVP, revisit after eval data exists |
| Single JD format (free text) or structured intake form as well? | Job Requirement Agent's input contract | Affects prompt design and schema validation strictness |
| Does one consultancy span multiple client relationships as a single tenant, or a scoped record per relationship? | `identity/` tenancy model, Phase 2 billing | Carried forward from v1 of this doc |
| Is a Recruiter scoped to exactly one consultancy tenant, or can Admin create a recruiter spanning multiple consultancies? | `identity/` RLS, `candidate/` submission visibility | Mirror-image of the question above; likely 1:1 but not yet confirmed |
| Does HR's oversight extend into `candidate/` (screening results, shortlists) or stop at requisition-level activity? | Candidate Screening Agent decision-record visibility | Affects whether HR needs read access beyond requisition status |

---

This document supersedes the module/agent scope in v4, the Final Project Plan, and v1 of this Redefined MVP doc for MVP purposes only. Architecture patterns, stack choices, and guardrail mechanics from those documents remain the source of truth and are unchanged here.