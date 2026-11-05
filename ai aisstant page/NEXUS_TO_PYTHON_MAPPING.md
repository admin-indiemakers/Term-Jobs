# NEXUS TypeScript to TermJobs Python Architectural Translation

## 1. Executive Summary

The NEXUS Workspace Compass AI Assistant (`D:\projects\nexus-workspace-compass`) provides a reference-grade AI agent experience:
- Natural, conversational multi-turn dialogue with continuous context awareness.
- Native tool-calling integrated with business logic and database operations.
- Two-phase execution pattern: direct execution for queries/low-risk updates vs. structured **proposals** for consequential or bulk modifications.
- Complete audit logging (`ai_actions`) tracking actor, tool, parameters, and outcome.
- Rich contextual UI cards rendered directly in the chat stream with interactive actions.

NEXUS implements this using **TypeScript**, **Next.js / Vercel AI SDK (`ai`)**, **Zod**, and **Supabase (PostgreSQL + RLS)**.

TermJobs (`D:\projects\Term-Jobs`), in contrast, is powered by a **FastAPI + PyMongo (MongoDB Atlas)** backend and a **Vite + React** frontend.

This document details the exact architectural translation from NEXUS TypeScript to native, idiomatic **Python 3.12 (FastAPI, Pydantic v2, PyMongo, Server-Sent Events)** for the new independent Hiring Manager Assistant.

---

## 2. Comprehensive Architectural Mapping Table

| NEXUS Architectural Component (TypeScript) | NEXUS Implementation (`nexus-workspace-compass`) | TermJobs Target Implementation (Python / FastAPI) | Technical Rationale & Specifications |
| :--- | :--- | :--- | :--- |
| **Agent Orchestration Engine** | `streamText` from Vercel AI SDK (`ai/agent.server.ts`) | Custom Asynchronous Agent Loop (`agent_orchestrator.py`) using `AsyncOpenAI` or LiteLLM client | Native Python async control loop (`while step < MAX_STEPS`) allowing custom multi-step planning, iterative tool calling, and fine-grained event streaming. |
| **Tool Definition & Schemas** | `tool({ description, parameters: z.object({...}), execute })` using **Zod** | Pydantic v2 `BaseModel` classes converted to OpenAI/Anthropic tool schemas (`tool_registry.py`) | Pydantic provides type validation, automatic JSON schema generation (`model_json_schema()`), field descriptions, and runtime argument coercion. |
| **Tool Execution Dispatcher** | Direct asynchronous dispatch inside `execute: async (args) => {...}` | Dynamic registry with `@hiring_tool` decorator and `ToolDispatcher.execute(name, args, context)` | Injects authenticated Hiring Manager context (`tenant_id`, `user_id`, `db_session`), verifies permissions, and catches errors gracefully. |
| **Streaming Protocol** | `toDataStreamResponse()` / Vercel AI data stream protocol | Standard **Server-Sent Events (SSE)** via `fastapi.responses.StreamingResponse(media_type="text/event-stream")` | Language-agnostic, RFC-compliant streaming. Emits events: `text-delta`, `tool-call`, `tool-result`, `proposal-required`, `error`, `done`. |
| **Human-in-the-Loop Proposal Engine** | `createProposal(...)` saving to `ai_proposals` table, returning proposal ID to client | `ProposalManager` storing pending actions in `agent_proposals` collection; returns `proposal_card` payload | Consequential actions (publish requisition, reject candidate, approve/reject timesheets, resolve issues) require explicit HM confirmation. |
| **Database Access Layer** | Supabase JavaScript client (`createClient`) with Postgres Row-Level Security (RLS) | PyMongo Async Session via TermJobs `modules.shared.db.get_session()` with explicit Python tenant scoping | MongoDB lacks Postgres RLS; tenant isolation (`tenant_id`) and HM ownership (`created_by == user.id`) MUST be strictly injected into every MongoDB query. |
| **Conversation Persistence** | Supabase tables: `conversations`, `conversation_messages` | MongoDB collections: `agent_conversations`, `agent_messages` | Stores conversation metadata, full message history (user, assistant, tool calls, tool results), and active proposal states. |
| **Audit Logging** | Supabase table: `ai_actions` (recording actor, action, payload, status) | MongoDB collection: `ai_actions` via `AuditLogger.log_action(...)` | Immutable audit trail recording `tenant_id`, `user_id`, `action`, `parameters`, `result`, `ip_address`, `timestamp`. |
| **Frontend State & Streaming Hook** | `useChat` from `@ai-sdk/react` | Custom React Hook `useHiringManagerChat.ts` consuming the SSE stream via `fetch` + `ReadableStreamDefaultReader` | Full control over custom event rendering (tool cards, proposal confirmation gates, candidate preview widgets, rich tables). |
| **Context Window Management** | In-memory message truncation in `agent.server.ts` | Sliding window token counter with system prompt pinning and tool-call pair preservation | Ensures message history never exceeds LLM context limits while never breaking orphaned `tool_call` / `tool_result` pairs. |

---

## 3. Tool Calling & Validation Translation

### 3.1 NEXUS Pattern (TypeScript + Zod)
```typescript
// NEXUS: src/lib/ai/workspace-ops.ts
import { tool } from 'ai';
import { z } from 'zod';

export const createProjectTool = tool({
  description: 'Create a new project in the workspace',
  parameters: z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    budget: z.number().positive(),
  }),
  execute: async ({ name, description, budget }) => {
    // Direct DB call or proposal creation
    return { success: true, projectId: '...' };
  }
});
```

### 3.2 TermJobs Target Pattern (Python 3.12 + Pydantic v2)
```python
# TermJobs: ai assistant page/backend/tools/schemas/requisition_tools.py
from typing import Optional, List
from pydantic import BaseModel, Field
from ..registry import hiring_tool, ToolExecutionContext, ToolResult

class CreateRequisitionDraftInput(BaseModel):
    title: str = Field(..., description="Job title, e.g. 'Senior Python Backend Engineer'")
    department: str = Field(..., description="Department, e.g. 'Engineering', 'Product'")
    headcount: int = Field(1, ge=1, description="Number of open positions")
    primary_skills: List[str] = Field(..., min_length=1, description="Mandatory technical skills")
    secondary_skills: Optional[List[str]] = Field(default_factory=list, description="Optional / nice-to-have skills")
    min_experience_years: int = Field(0, ge=0, description="Minimum years of experience required")
    budget_max: float = Field(..., gt=0, description="Maximum allocated budget or hourly/daily rate")
    work_mode: str = Field(..., description="Work arrangement: 'Remote', 'Hybrid', 'Onsite'")
    location: str = Field(..., description="Location or timezone requirement, e.g. 'Bangalore, India'")
    description: Optional[str] = Field(None, description="Enterprise job description markdown")

@hiring_tool(
    name="create_requisition_draft",
    description="Creates a draft job requisition for the Hiring Manager to review and submit for Director approval.",
    input_model=CreateRequisitionDraftInput,
    requires_confirmation=False  # Draft creation is non-destructive
)
async def create_requisition_draft_handler(args: CreateRequisitionDraftInput, ctx: ToolExecutionContext) -> ToolResult:
    # 1. Enforce Tenant and User Scoping
    req_doc = {
        "tenant_id": ctx.tenant_id,
        "created_by": ctx.user_id,
        "status": "DRAFT",
        "title": args.title,
        "department": args.department,
        "headcount": args.headcount,
        "primary_skills": args.primary_skills,
        "secondary_skills": args.secondary_skills,
        "min_experience_years": args.min_experience_years,
        "budget_max": args.budget_max,
        "work_mode": args.work_mode,
        "location": args.location,
        "description": args.description or "",
        "created_at": ctx.timestamp,
        "updated_at": ctx.timestamp,
    }
    
    # 2. Persist via TermJobs DB Session
    result = await ctx.db["requisitions"].insert_one(req_doc)
    
    # 3. Audit Log Action
    await ctx.audit_logger.log(
        action="create_requisition_draft",
        target_id=str(result.inserted_id),
        details=args.model_dump()
    )
    
    return ToolResult(
        success=True,
        data={
            "requisition_id": str(result.inserted_id),
            "title": args.title,
            "status": "DRAFT",
            "message": "Requisition draft created successfully. Review the draft below before submitting for Director approval."
        },
        ui_card="requisition_draft_card"
    )
```

---

## 4. Multi-Step Execution Loop in Python

NEXUS uses the Vercel AI SDK `maxSteps: 5` property to allow the model to chain tool calls. In Python, we implement this as an explicit, observable execution loop:

```python
# ai assistant page/backend/agent/orchestrator.py
class HiringAgentOrchestrator:
    def __init__(self, llm_client, tool_registry, max_steps: int = 6):
        self.client = llm_client
        self.registry = tool_registry
        self.max_steps = max_steps

    async def run_turn(self, conversation_history: list, ctx: ToolExecutionContext):
        messages = list(conversation_history)
        step = 0

        while step < self.max_steps:
            step += 1
            
            # 1. Call LLM with tool definitions
            response = await self.client.chat.completions.create(
                model="gpt-4o", # or configured TermJobs LLM
                messages=messages,
                tools=self.registry.get_openai_tools_schema(),
                tool_choice="auto",
                stream=True
            )
            
            # 2. Stream tokens to client
            accumulated_content = ""
            tool_calls_buffer = {}

            async for chunk in response:
                delta = chunk.choices[0].delta
                if delta.content:
                    accumulated_content += delta.content
                    yield {"type": "text-delta", "content": delta.content}
                
                if delta.tool_calls:
                    for tc in delta.tool_calls:
                        idx = tc.index
                        if idx not in tool_calls_buffer:
                            tool_calls_buffer[idx] = {"id": tc.id, "name": tc.function.name, "args": ""}
                        if tc.function.arguments:
                            tool_calls_buffer[idx]["args"] += tc.function.arguments

            # 3. If no tool calls, conversation turn is complete
            if not tool_calls_buffer:
                messages.append({"role": "assistant", "content": accumulated_content})
                break

            # 4. Process tool calls
            assistant_msg = {
                "role": "assistant",
                "content": accumulated_content or None,
                "tool_calls": [
                    {"id": tc["id"], "type": "function", "function": {"name": tc["name"], "arguments": tc["args"]}}
                    for tc in tool_calls_buffer.values()
                ]
            }
            messages.append(assistant_msg)

            for tc in tool_calls_buffer.values():
                tool_name = tc["name"]
                tool_args = json.loads(tc["args"])
                
                yield {"type": "tool-start", "tool": tool_name, "args": tool_args}
                
                # Check confirmation requirement
                if self.registry.requires_confirmation(tool_name):
                    proposal_id = await self.registry.create_proposal(tool_name, tool_args, ctx)
                    yield {
                        "type": "proposal-required",
                        "proposal_id": proposal_id,
                        "tool": tool_name,
                        "args": tool_args,
                        "summary": self.registry.describe_proposal(tool_name, tool_args)
                    }
                    return  # Wait for user confirmation in next turn
                
                # Execute tool
                result = await self.registry.execute(tool_name, tool_args, ctx)
                yield {"type": "tool-result", "tool": tool_name, "result": result.to_dict()}
                
                messages.append({
                    "role": "tool",
                    "tool_call_id": tc["id"],
                    "content": json.dumps(result.data)
                })
```

---

## 5. Security & Isolation: Supabase RLS vs. Python PyMongo

In NEXUS, Supabase enforces multi-tenancy at the PostgreSQL level via RLS policies (`auth.uid() = user_id`).

In TermJobs, MongoDB Atlas has no table-level RLS. **Security must be enforced in the Python application layer**:

1. **Context Injection**: Every tool receives `ToolExecutionContext` created strictly from the validated JWT token (`tenant_id`, `user_id`, `role="HIRING_MANAGER"`). User-provided prompts CANNOT override this context.
2. **Mandatory Query Filtering**: Every PyMongo query MUST include `{"tenant_id": ctx.tenant_id}`.
3. **Ownership Enforcing**: Operations modifying requisitions, candidates, or timesheets must check that the Hiring Manager owns or is assigned to the resource (`created_by == ctx.user_id` or assigned department).
4. **Hard Role Boundary Checks**: The tool registry will REFUSE to register or execute any action outside HM scope (e.g., vendor onboarding, payout execution, SOW billing changes).

---

## 6. Audit Trail Translation

NEXUS writes every tool outcome to the `ai_actions` Supabase table.
In TermJobs Python, we replicate this schema exactly inside MongoDB `ai_actions`:

```json
{
  "_id": ObjectId("..."),
  "tenant_id": "tenant_enterprise_01",
  "user_id": "user_hm_456",
  "user_email": "hm@company.com",
  "action": "approve_timesheet",
  "target_resource": "timesheet",
  "target_id": "ts_789",
  "parameters": {"timesheet_id": "ts_789", "approved_hours": 40},
  "result": {"status": "SUCCESS", "previous_state": "SUBMITTED", "new_state": "APPROVED"},
  "proposal_id": "prop_123",
  "ip_address": "192.168.1.1",
  "user_agent": "Mozilla/5.0...",
  "timestamp": "2026-10-31T00:30:00Z"
}
```

---

## 7. Frontend Streaming Protocol (SSE)

FastAPI streams events using standard SSE format:
```
event: text-delta
data: {"content": "I have analyzed the candidates..."}

event: tool-start
data: {"tool": "search_candidates", "args": {"requisition_id": "req_1"}}

event: tool-result
data: {"tool": "search_candidates", "result": {"count": 3, "candidates": [...]}, "ui_card": "candidate_comparison_card"}

event: done
data: {}
```

The React frontend handles these cleanly in a standard `EventSource` or `fetch` stream reader, rendering interactive cards with zero dependency on the Vercel proprietary protocol.