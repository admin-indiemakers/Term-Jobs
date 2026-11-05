# TermJobs AI Hiring Manager Assistant Architecture (Python-Native)

## 1. System Architecture Overview

The TermJobs AI Hiring Manager Assistant is engineered as a high-reliability, tool-using autonomous agent that operates directly on the TermJobs contingent workforce platform. Built with **FastAPI** and **Python 3.12**, it replicates the rich conversational and execution capabilities of the reference NEXUS assistant while operating natively within TermJobs' **MongoDB / PyMongo** environment.

```
+-----------------------------------------------------------------------------------+
|                            TermJobs React Frontend                                |
|  - Modern Conversational UI (Vite + React + Tailwind)                             |
|  - Real-Time SSE Stream Consumer (`useHiringManagerChat.ts`)                      |
|  - Contextual Interactive UI Cards (Requisition, Candidate, Timesheet, etc.)      |
|  - Two-Phase Confirmation Dialogs & Audit Badges                                  |
+------------------------------------------^----------------------------------------+
                                           | HTTP POST /api/v2/hm-agent/chat (SSE Stream)
                                           v
+-----------------------------------------------------------------------------------+
|                        FastAPI Agent Gateway & Router                             |
|  - JWT Authentication & Context Hydration (`tenant_id`, `user_id`, `role`)        |
|  - Conversation Session Persistence (`agent_conversations`, `agent_messages`)     |
+------------------------------------------^----------------------------------------+
                                           |
                                           v
+-----------------------------------------------------------------------------------+
|                    Python Agent Orchestration Engine                              |
|  - Multi-Turn Execution Loop (`HiringAgentOrchestrator`)                          |
|  - Prompt Assembly & Context Window Token Pruning                                 |
|  - LLM Provider Abstraction (OpenAI / Anthropic / Local)                          |
|  - Dynamic Tool Calling & Parameter Validation (Pydantic v2)                      |
|  - Proposal & Confirmation State Machine (`ProposalManager`)                      |
+-------------------+-----------------------------------+---------------------------+
                    |                                   |
                    v                                   v
+-------------------------------------+   +-----------------------------------------+
|     Domain Tool Registry (14 Domains)   |   |        Security & Audit Layer           |
|  - Requisition Management Tools     |   |  - Mandatory Tenant Scoping Filter      |
|  - Candidate Screening & Compare    |   |  - HM Ownership Verification            |
|  - Interview Scheduling & Calendar  |   |  - Strict Role Boundary Enforcement     |
|  - Timesheet & Expense Approvals    |   |  - Immutable Audit Logging (`ai_actions`|
|  - Workforce & Issue Desk Tools     |   +--------------------+--------------------+
+-------------------+-----------------+                        |
                    |                                          |
                    v                                          v
+-----------------------------------------------------------------------------------+
|                        TermJobs MongoDB Storage Layer                             |
|  - `requisitions`, `candidates`, `interviews`, `timesheets`, `expenses`, etc.     |
+-----------------------------------------------------------------------------------+
```

---

## 2. Persona & Prompt Engineering Hierarchy

The agent operates under a rigorously defined system prompt hierarchy designed to prevent hallucinations, enforce enterprise tone, and preserve role boundaries:

### 2.1 Persona Definition ("Aura - AI Hiring Operations Manager")
- **Role**: Intelligent operational coworker for the enterprise Hiring Manager.
- **Tone**: Professional, crisp, decisive, transparent, and empathetic to recruitment deadlines.
- **Competence**: Deep understanding of requisition lifecycles, contractor billing, candidate evaluation rubrics, interview logistics, and compliance rules.

### 2.2 System Prompt Assembly Pipeline
Every turn dynamically constructs a specialized system prompt with injected session variables:
1. **Core Operating Directives**:
   - Always prioritize real data over speculative estimates.
   - Never invent candidate experience, skills, match scores, or interview outcomes.
   - Flag 48-hour SLA countdowns for newly submitted candidates.
   - Enforce tenant Director approval policy on all requisition workflows.
   - Refuse any request to execute financial payouts, onboard vendors, or edit legal contracts.
2. **Current Session Envelope**:
   - `Authenticated User`: Name, Email, Hiring Manager ID.
   - `Tenant`: Organization Name, Tenant ID.
   - `Active Requisition Scope`: List of current open/draft requisition IDs owned by this HM.
   - `System Timestamp`: UTC and localized timezone for calendar scheduling.

---

## 3. Four Operating Execution Modes

To ensure safe, intuitive operations, the agent transitions seamlessly between four modes:

| Execution Mode | Applicable Scenarios | Execution Pattern | Safety Mechanism |
| :--- | :--- | :--- | :--- |
| **1. Direct Query Mode** | "Show candidates for the Python role", "What timesheets are pending?", "Summarize interview feedback" | Read-only tool execution -> Format response -> Emit structured result card | Zero state change; runs immediately without confirmation. |
| **2. Interactive Drafting Mode** | "Draft a job description for a Senior DevOps Engineer", "Add Kubernetes and Terraform to requirements" | Generates or patches draft document in conversation memory -> Renders live editable preview card | Requisition draft saved to DB with `status='DRAFT'`; does not publish. |
| **3. Multi-Step Execution Mode** | "Find the best 2 candidates for Req #101 and schedule technical interviews for Wednesday afternoon" | Multi-step loop: Step 1 (Search & Rank) -> Step 2 (Check Calendar Slots) -> Step 3 (Prepare Scheduling Proposals) | Decomposes compound instructions; halts if an intermediate step fails. |
| **4. Two-Phase Confirmation Gate** | "Publish requisition", "Reject candidate with feedback", "Approve weekly timesheet", "Resolve issue ticket" | Tool flags `requires_confirmation=True` -> Creates pending proposal -> Renders confirmation card with exact impact | Execution PAUSED until HM explicitly clicks "Confirm" or responds in chat. |

---

## 4. Human-in-the-Loop Proposal Engine

Consequential or irreversible operations cannot be executed autonomously without human consent. The proposal engine operates as follows:

```
[User Request] 
      │
      ▼
[Agent Plans Action] ──► [Tool flagged as requires_confirmation=True]
                                 │
                                 ▼
                     [Create Proposal in MongoDB `agent_proposals`]
                     - Status: 'PENDING'
                     - Action: 'reject_candidate'
                     - Target: Candidate ID & Name
                     - Mandatory Reason: "Candidate lacks required AWS experience"
                     - Impact Summary: "Candidate will receive formal rejection email"
                                 │
                                 ▼
                     [Stream `proposal-required` Event to Frontend]
                     - Chat UI displays High-Emphasis Confirmation Card
                     - Buttons: [Approve & Execute] / [Cancel Action]
                                 │
                     ┌───────────┴───────────┐
                     ▼                       ▼
            [User Clicks Approve]   [User Clicks Cancel]
                     │                       │
                     ▼                       ▼
          [Execute Tool Handler]  [Mark Proposal CANCELLED]
          [Log to `ai_actions`]   [Inform User of Abort]
          [Stream Success Card]
```

---

## 5. Context Window & Memory Management

To maintain long-running conversations without token exhaustion or hallucination:
1. **Pinned System Prompt**: The system prompt and dynamic context envelope are never truncated.
2. **Atomic Tool-Pair Sliding Window**: LLM conversations require that every tool call message has an immediate corresponding tool result message. Truncation trims from the oldest conversational turns while ensuring tool call/result pairs are never separated.
3. **Database Schema**:
   - `agent_conversations`: Holds `conversation_id`, `user_id`, `tenant_id`, `title`, `created_at`, `updated_at`.
   - `agent_messages`: Holds individual messages (`role`, `content`, `tool_calls`, `tool_results`, `ui_cards`, `timestamp`).

---

## 6. Audit Logging & Verification Mechanism

Every state-modifying action is verified and recorded to the `ai_actions` collection:
- **Pre-execution Verification**: Verifies resource exists and belongs to the authenticated tenant.
- **Post-execution Verification**: Queries the updated record to confirm the state change was committed by PyMongo.
- **Audit Record Schema**:
  ```python
  class AIActionAuditRecord(BaseModel):
      tenant_id: str
      user_id: str
      user_role: str
      action: str
      target_collection: str
      target_id: str
      parameters: dict
      execution_status: str  # "SUCCESS" | "FAILED" | "ABORTED"
      previous_state: Optional[dict]
      new_state: Optional[dict]
      timestamp: datetime
  ```

---

## 7. Frontend User Experience Architecture

The frontend component tree is organized for clean separation of concerns, high aesthetic polish, and seamless streaming:

```
[ChatWorkspaceContainer]
  │
  ├── [ConversationSidebar]
  │     ├── New Chat Button
  │     ├── Conversation History List (Grouped by Today, Yesterday, Previous)
  │     └── Hiring Manager Quick Filters
  │
  └── [ChatMainPanel]
        ├── [ChatHeader] (Agent identity, active requisition selector, status indicator)
        ├── [MessageStreamArea]
        │     ├── [UserMessageBubble]
        │     ├── [AssistantMessageBubble]
        │     │     ├── [ThinkingIndicator] (Collapsible tool execution steps)
        │     │     ├── [MarkdownRenderer]
        │     │     └── [DynamicCardHost]
        │     │           ├── <RequisitionDraftCard />
        │     │           ├── <CandidateComparisonTable />
        │     │           ├── <InterviewScheduleCard />
        │     │           ├── <TimesheetApprovalCard />
        │     │           └── <ProposalConfirmationGate />
        │     └── [AutoScrollAnchor]
        │
        └── [ChatInputComposer]
              ├── Prompt Suggestions Carousel ("Review pending timesheets", "Top Python candidates")
              ├── Textarea with Auto-Grow
              ├── Attachment Button (Resume / Document drop)
              └── Send / Stop Streaming Controls
```