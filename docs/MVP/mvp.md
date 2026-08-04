# Term Jobs - Redefined MVP

## Why this redefinition exists

The original v4 MVP scoped 4 agents around operations:
- Screening
- Timesheet Review
- Recon/Invoice Validation
- FAQ-only support

That assumed hiring itself was manual and automated only what happens after a hire (time, billing).

The actual product priority is different: automate the vendor-facing hiring funnel:
- JD in
- resumes screened
- interviews scheduled

This document replaces the agent/module scope in v4 and the Final Project Plan with a leaner MVP matched to that priority. Nothing about the underlying stack, module architecture pattern, or guardrail mechanics changes; only which modules and agents ship first.

---

## 1. MVP scope, restated

### In scope

| Module | Why it’s in |
|---|---|
| identity/ | Tenancy (client / consultancy), auth, roles - nothing else works without it |
| requisition/ | Holds the JD and requisition record; state machine for requisition lifecycle |
| candidate/ | Resume intake, candidate-to-requisition linking, interview state |

### In scope agents

| Agent | Trigger | Reads | Produces | Guardrail |
|---|---|---|---|---|
| Job Requirement Agent | requisition.created | Raw JD text | Normalized structured role (title, must-have skills, nice-to-have, seniority, location, rate band) | Always human-reviewed - hiring manager edits before publish |
| Candidate Screening Agent | candidate.linked_to_requisition | Resume, structured role, existing submissions for that req | Fit score, duplicate-submission flags | Human-reviewed by default; auto-shortlist/auto-reject available as a per-tenant opt-in, off by default |
| Interview Scheduling Agent | Candidate shortlisted (human-approved) | Interviewer availability, candidate availability (via comms) | Proposed interview slots, confirmed booking | Always human-reviewed for the interviewer side; candidate-facing scheduling comms can auto-send once a human has approved the shortlist |

### Explicitly out of MVP
- worker/
- compliance/
- time_expense/
- billing/
- analytics/

Deferred in full:
- Vendor Matching Agent
- Rate Benchmark Agent
- Performance Insight Agent
- Compliance Agent
- Timesheet Audit Agent
- Invoice Validation Agent

Additional exclusions:
- Multi-country support (India-only, single country pack)
- Auto-execute for anything beyond candidate shortlisting
- No auto-hire
- No auto-onboarding

---

## 2. Flow, end to end

1. Hiring Manager pastes/uploads JD
2. requisition.created event triggers the Job Requirement Agent
3. Structured role is produced
4. Hiring Manager reviews/edits and approves
5. Requisition is published to consultancy/vendor
6. Vendor recruiter submits candidate + resume
7. candidate.linked_to_requisition event triggers the Candidate Screening Agent
8. Fit score + duplicate-submission flags are produced
9. Approval Queue entry is created for Hiring Manager
10. Hiring Manager shortlists candidate
11. Interview Scheduling Agent is triggered
12. Candidate + interviewer availability is collected (email/WhatsApp)
13. Interview slot is proposed, confirmed, and both parties are notified

Every checkpoint above is a LangGraph graph pause, persisted to Postgres - the same mechanism as v4’s original design, just applied to this narrower flow.

---

## 3. Module detail

### 3.1 identity/

Tenant types:
- client
- consultancy

Platform admin exists but isn’t user-facing at MVP.

RBAC roles:
- Hiring Manager
- Recruiter (consultancy-side)
- Admin

RLS from day one, single country pack (India).

Open question carried forward:
- Does one consultancy span multiple client relationships as a single tenant, or a scoped record per relationship?

This blocks nothing at this narrow MVP scope (no billing yet), but should be answered before Phase 2 re-introduces billing.

### 3.2 requisition/

Domain entity:
- Requisition (raw JD, structured role once processed, status)

State machine:
- Draft -> Structuring -> PendingApproval -> Published -> Closed

The Job Requirement Agent writes into Structuring; human approval moves it to Published.

### 3.3 candidate/

Domain entities:
- Candidate
- Submission (links a candidate to a requisition)

State machine:
- Submitted -> Screened -> Shortlisted -> InterviewScheduled -> InterviewCompleted -> Rejected/Selected

The Screening Agent writes into Screened; human action moves it to Shortlisted.

The Interview Scheduling Agent writes into InterviewScheduled.

---

## 4. Agent mechanics (unchanged from v4/Final Plan)

All three agents run through the same guardrail loop:
1. budget gate
2. build context
3. tool loop (<= N calls)
4. pydantic schema validation
5. guardrail check (confidence / reversibility)
6. persist decision record
7. approval queue or auto-dispatch, only if tenant threshold allows

### Cost discipline
- 3-tier model routing (small/mid/large)
- Langfuse OSS tracing
- CI eval harness with golden fixtures before any prompt/model change ships

### Decision records
Every agent output is persisted as an auditable record, regardless of whether it was auto-dispatched or queued for human review.

No agent touches identity/ directly, consistent with the “Core stays deterministic” rule from the original architecture.

---

## 5. Build order

1. identity/
   - tenancy, roles, RLS
2. requisition/
   - Job Requirement Agent
3. candidate/
   - Candidate Screening Agent
4. Interview Scheduling Agent
   - comms integration (email/WhatsApp)

Each step is independently testable:
- Validate the Job Requirement Agent against fixture JDs before candidate/ exists
- Validate Screening against fixture resumes once candidate/ lands
- Validate Interview Scheduling last since it depends on both prior agents’ outputs

---

## 6. What’s deferred to Phase 2 (unchanged set, for reference)

- worker/
- compliance/
- time_expense/
- billing/
- analytics/

Agents deferred:
- Vendor Matching Agent
- Rate Benchmark Agent
- Performance Insight Agent
- Compliance Agent
- Timesheet Audit Agent
- Invoice Validation Agent

Other deferrals:
- Support Copilot (real RAG version - static FAQ only, if needed at all, at MVP)
- Second country pack
- Second KYC provider
- E-signature
- Payments

None of these are relevant until worker/ + billing/ are back in scope.

---

## 7. Open questions specific to this MVP

| Question | Blocks | Notes |
|---|---|---|
| What counts as “interviewer availability” input - calendar integration or manual entry? | Interview Scheduling Agent’s context-build step | Needs an answer before that agent’s tool loop can be specified |
| Does Screening Agent’s auto-shortlist opt-in ship at MVP or stay off entirely until trust is established? | candidate/ guardrail config | Recommend: off for MVP, revisit after eval data exists |
| Single JD format (free text) or structured intake form as well? | Job Requirement Agent’s input contract | Affects prompt design and schema validation strictness |

---

## Final note

This document supersedes the module/agent scope in v4 and the Final Project Plan for MVP purposes only. Architecture patterns, stack choices, and guardrail mechanics from those documents remain the source of truth and are unchanged here.
