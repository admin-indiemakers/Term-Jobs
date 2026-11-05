# TermJobs AI Hiring Manager Assistant — Implementation & Integration Plan

## 1. Project Overview & Guiding Principles

This implementation plan governs the development of the new, production-grade **AI Hiring Manager Assistant** for TermJobs. All work adheres to the core rules:
1. **Zero Modifications to NEXUS**: `D:\projects\nexus-workspace-compass` remains 100% read-only.
2. **Zero In-Place Modifications to Existing TermJobs Files**: All new code is developed exclusively within `D:\projects\Term-Jobs\ai aisstant page\`.
3. **Python-Native Backend**: Agent orchestration, tool registry, validation, and SSE streaming are built in Python (FastAPI + PyMongo).
4. **React / TypeScript Frontend**: Chat UI and interactive cards are built with React/TypeScript to integrate seamlessly into TermJobs' frontend stack.
5. **Approval Gate**: No existing TermJobs files will be edited without prior explicit review and consent from the user.

---

## 2. Directory Structure inside `D:\projects\Term-Jobs\ai aisstant page\`

```
ai aisstant page/
├── NEXUS_ANALYSIS.md                   # Audit of reference NEXUS assistant
├── NEXUS_TO_PYTHON_MAPPING.md          # TypeScript-to-Python architectural translation
├── TERMJOBS_ANALYSIS.md                # Audit of TermJobs HM routes & backend
├── AI_ASSISTANT_ARCHITECTURE.md        # Python agent architecture specification
├── TOOL_REGISTRY.md                    # Master tool catalog (14 domains / 35 tools)
├── IMPLEMENTATION_PLAN.md              # This staged implementation plan
│
├── backend/                            # Python 3.12 / FastAPI Subsystem
│   ├── __init__.py
│   ├── router.py                       # FastAPI APIRouter exposing SSE chat endpoints
│   ├── agent/
│   │   ├── __init__.py
│   │   ├── orchestrator.py             # Multi-step LLM execution loop & SSE generator
│   │   ├── context.py                  # Session & context window token manager
│   │   └── prompts.py                  # System prompts & HM persona directives
│   ├── tools/
│   │   ├── __init__.py
│   │   ├── registry.py                 # @hiring_tool decorator & schema generator
│   │   ├── context.py                  # ToolExecutionContext definition
│   │   ├── schemas/                    # Pydantic v2 argument models
│   │   │   ├── requisitions.py
│   │   │   ├── candidates.py
│   │   │   ├── interviews.py
│   │   │   ├── timesheets.py
│   │   │   └── expenses.py
│   │   └── handlers/                   # Asynchronous business handlers
│   │       ├── requisition_ops.py
│   │       ├── candidate_ops.py
│   │       ├── interview_ops.py
│   │       ├── workforce_ops.py
│   │       └── timesheet_ops.py
│   ├── proposals/
│   │   ├── __init__.py
│   │   ├── manager.py                  # Two-Phase Commit Proposal State Machine
│   │   └── models.py                   # MongoDB proposal schemas
│   └── audit/
│       ├── __init__.py
│       └── logger.py                   # Writes immutable audit records to `ai_actions`
│
└── frontend/                           # React / TypeScript Subsystem
    ├── index.ts                        # Main export entrypoint
    ├── hooks/
    │   └── useHiringManagerChat.ts     # SSE stream reader & message state manager
    ├── components/
    │   ├── ChatWorkspace.tsx           # Full layout container (Sidebar + Main Chat)
    │   ├── ChatSidebar.tsx             # Conversation history & filter chips
    │   ├── ChatMessageList.tsx         # Auto-scrolling message stream
    │   ├── ChatMessageBubble.tsx       # User & Assistant formatted bubbles
    │   ├── ChatInputComposer.tsx       # Auto-growing textarea & prompt suggestions
    │   └── ThinkingAccordion.tsx       # Collapsible tool execution trace
    └── cards/                          # Rich Interactive Contextual Cards
        ├── RequisitionDraftCard.tsx
        ├── CandidateComparisonCard.tsx
        ├── InterviewScheduleCard.tsx
        ├── TimesheetReviewCard.tsx
        ├── ExpenseReviewCard.tsx
        ├── ProposalConfirmationGate.tsx
        └── KPISummaryCard.tsx
```

---

## 3. Staged Implementation Roadmap

### Stage 1: Core Python Agent Engine & Foundation
- Scaffold the `backend/` directory structure within `ai aisstant page/`.
- Implement `ToolExecutionContext` and `@hiring_tool` registry system using Pydantic v2.
- Implement the `ProposalManager` state machine in MongoDB (`agent_proposals`).
- Implement the `AuditLogger` ensuring strict writes to `ai_actions`.
- Implement the asynchronous `HiringAgentOrchestrator` streaming RFC-compliant Server-Sent Events (SSE).

### Stage 2: Domain Tool Implementation (14 Domains)
- Implement handlers for:
  - **Requisitions**: Draft creation, updates, Director approval submission, listing.
  - **Job Descriptions**: LLM-driven enterprise JD generation and skill refining.
  - **Candidates**: Search, profile inspection, side-by-side comparison, 48-hour SLA checking.
  - **Interviews**: Availability check, scheduling proposals, LiveKit room setup, scorecards.
  - **Hiring Decisions**: Evidence-based recommendation, candidate offer acceptance.
  - **Workforce & Operations**: Contractor roster, timesheet approval/rejection with mandatory reasons, expense inspection, issue desk resolution.

### Stage 3: React / TypeScript Frontend & Dynamic Cards
- Implement `useHiringManagerChat.ts` custom hook with resilient streaming, auto-reconnect, and error handling.
- Construct the chat workspace UI inspired by NEXUS's visual polish (clean typography, subtle borders, card elevation, responsive layout).
- Develop domain-specific rich interactive cards:
  - `RequisitionDraftCard`: Live preview with direct edit/submit actions.
  - `CandidateComparisonCard`: Multi-column comparison of skills, experience, and match scores.
  - `ProposalConfirmationGate`: High-emphasis confirmation card for consequential operations.
  - `TimesheetReviewCard`: Daily hours breakdown with one-click approve/reject modal.

### Stage 4: Testing & Verification
- Execute isolated integration tests for all tools using test MongoDB collections.
- Validate role boundary defense: verify that requests for payouts, vendor onboarding, or cross-tenant queries are blocked.
- Validate multi-step execution: verify compound prompt flows (e.g., search candidates -> compare top 2 -> schedule interview).
- Validate audit trail: verify that every execution leaves a verifiable footprint in `ai_actions`.

---

## 4. Controlled Non-Destructive Integration Proposal

Once the new assistant is completely built, verified, and tested in isolation, integrating it with the main TermJobs application will require only **TWO** minimal, non-breaking modifications:

### 1. Backend Mount in `backend/main.py`:
```python
# Add new independent router without touching the old /api/hiring-manager-agent/
from ai_assistant_page.backend.router import router as new_hm_agent_router
app.include_router(new_hm_agent_router, prefix="/api/v2/hm-agent", tags=["Hiring Manager AI v2"])
```

### 2. Frontend Mount in `frontend/src/App.jsx`:
```jsx
// Mount the new assistant as a distinct route or tab
import { HiringManagerAIChatPage } from '../ai aisstant page/frontend';
// <Route path="/dashboard/hiring-manager/assistant-v2" element={<HiringManagerAIChatPage />} />
```

*Note: Neither change will be performed without the user's prior explicit review and approval.*