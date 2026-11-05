# Complete Architectural Audit: NEXUS AI Assistant
**Reference Project:** D:\projects\nexus-workspace-compass  
**Purpose:** Comprehensive baseline analysis to extract proven architectural patterns for the TermJobs Hiring Manager AI Agent.

---

## 1. Executive Summary & Core Philosophy

The NEXUS AI Assistant is not a generic question-answering chatbot. It is an **operational workspace agent** designed around four foundational architectural pillars:

1. **Grounded In Live Reality:** The assistant never invents team members, tasks, due dates, or workloads. All factual assertions are grounded in dynamic tool results and runtime database reads.
2. **Strict Identity & Permission Enforcement:** Actions are executed with the signed-in user's credentials. Client claims are never trusted; permissions are determined server-side from public.user_roles and enforced at both the database row-level and the tool pre-validation layer.
3. **Safety & Human-in-the-Loop Confirmation:** Single, low-risk changes execute directly with immediate audit logging. Consequential operations (bulk changes, project creation, destructive modifications) transition into pending proposals that render interactive confirmation cards in the chat UI.
4. **Complete Auditability:** Every tool invocation, whether successful, failed, pending, or rejected, writes an immutable audit record to i_actions.

---

## 2. Frontend Architecture & UI Patterns

### 2.1 Dual UI Entry Points
NEXUS implements two synchronized interfaces for AI interaction:
* **Full-Page Canvas (/ai & /ai/):** Implemented in src/components/nexus/ai-workspace-view.tsx. Features a multi-conversation sidebar (i_threads), conversation header, unified turn message cards, interactive proposal blocks, suggestion chips, voice transcript controls, and provider configuration modal.
* **Global Companion Side-Dock (AiPanel):** Implemented in src/components/nexus/ai-panel.tsx. A slide-over drawer accessible from any page via the global navigation header (keyboard shortcut or header icon), allowing users to query and operate on workspace tasks without leaving their current view.

### 2.2 Vercel AI SDK Integration
Both UIs leverage @ai-sdk/react (useChat):
* **Streaming Transport:** Communicates with the server via Server-Sent Events (SSE) over HTTP POST to /api/chat.
* **Multi-Step Tool Stream Handling:** Handles streaming tool execution, streaming tool arguments, intermediate tool results, and final synthesized text in a unified stream.
* **Message Grouping Pattern:** Consecutive assistant turns and tool executions belonging to the same user prompt are grouped into a single unified assistant card (groupedMessages memo in i-workspace-view.tsx), preventing fragmented message bubbles.
* **Auto-Scroll & Focus Recovery:** Automatically scrolls the active conversation to the newest response turn and refocuses the composer textarea upon stream completion.

### 2.3 Interactive Domain Cards (src/components/nexus/ai-cards.tsx)
Rather than relying purely on markdown text, NEXUS renders structured, actionable UI components directly inside the conversation stream:
1. **SavedTaskCard:** Rendered when a single task is created or updated. Displays task title, project, assignee avatar, due date pill, and deep-link click handler to open the task details drawer.
2. **BulkChangesCard:** Rendered when propose_bulk_changes is invoked. Displays the pending proposal ID, a list of proposed changes with diff chips (e.g. status → in_progress, ssign → Sarah Chen), and interactive **'Confirm & Save'** and **'Cancel'** buttons. Upon confirmation, calls a server function (confirmBulkChanges), invalidates React Query caches, and transitions the card state into a verified success summary.
3. **ProjectPlanCard:** Rendered when propose_project_plan is invoked. Presents project metadata, duration in weeks, risk factors, milestone timeline, and a breakdown of planned tasks with editable assignee selectors before final project creation.

### 2.4 Voice & Multimodal Interaction (src/lib/ai/voice.ts)
* **Speech-to-Text (STT):** Implemented via browser SpeechRecognition / webkitSpeechRecognition. Features an isActiveRef guard that prevents trailing asynchronous audio buffer flush events from repopulating the chat input bar after the user hits Enter. Supports 8 Indian and global languages (en-IN, hi-IN, ml-IN, etc.).
* **Text-to-Speech (TTS):** Browser SpeechSynthesis with markdown/code-block stripping (cleanTextForSpeech) and autoplay preference toggles.
* **Sarvam AI Voice Call:** Dedicated WebRTC voice call modal (sarvam-agent.ts) for real-time conversational spoken audio.

---

## 3. Backend & Agent Architecture (src/lib/ai/agent.server.ts)

### 3.1 LLM Gateway & Provider Abstraction
NEXUS supports multiple LLM providers configured per user:
* **OpenRouter:** Supports free and premium models via https://openrouter.ai/api/v1 with custom headers (HTTP-Referer, X-Title).
* **Google Gemini:** Uses Gemini's OpenAI-compatible endpoint (https://generativelanguage.googleapis.com/v1beta/openai/) with a custom createGeminiFetch stream transformer that injects missing 	ool_call.index attributes required by @ai-sdk/openai.
* **OpenAI:** Native integration with models like gpt-4o and gpt-4o-mini.

### 3.2 Authentication & Context Resolution
Before invoking the LLM, /api/chat:
1. Extracts the Bearer token from the Authorization header.
2. Validates session claims against Supabase Auth (sb.auth.getClaims).
3. Calls 
esolveContext(sb, userId, threadId) in workspace-ops.ts:
   * Resolves the user's team member ID (members table).
   * Resolves the authoritative workspace role (public.user_roles table: dmin, manager, or member).
4. Rejects unauthenticated or expired requests immediately with HTTP 401.

### 3.3 Dynamic System Prompt Construction
The system prompt is dynamically assembled on every turn:
* **Temporal Grounding:** Injects current local date, weekday, and user timezone (Intl.DateTimeFormat). Relative terms like *'Friday'* or *'next sprint'* are anchored strictly to real calendar dates.
* **Role Invariant Injection:** Injects user identity, role, and exact capability boundaries. If the user is a member, the prompt instructs the LLM that they may only change their own tasks and must refuse to reassign other people's work.
* **Directory Invariant Injection:** Serializes the complete team directory (id — name — job title — app role) and project list (id — name). The LLM is strictly prohibited from inventing non-existent members.
* **Strict Negative Constraints:** Explicit instruction to refuse unrelated general knowledge questions and ground all claims in tool outputs.

### 3.4 Multi-Step Tool Calling & Execution Loop
* Configured with stopWhen: stepCountIs(50) and maxRetries: 2.
* The agent can autonomously execute multi-step workflows:
  1. Search for a task or member.
  2. Inspect workload or project health.
  3. Formulate the update or proposal.
  4. Execute the tool call and verify database response.
  5. Formulate final natural-language confirmation.

### 3.5 Robust Error Translation
The backend captures upstream HTTP status codes (401, 402, 429, 503) and translates raw provider JSON errors into empathetic, actionable user guidance (e.g. rate limit wait times, credit exhaustion guidance, model availability alternatives).

---

## 4. Tool Registry & Operation Architecture (src/lib/ai/workspace-ops.ts)

### 4.1 Tool Inventory & Classification
NEXUS defines 8 core tools:

| Tool Name | Type | Purpose | Safety Level |
|---|---|---|---|
| get_team_workload | Read | Aggregates open, active, overdue, and upcoming tasks per member. | Safe (Direct execute) |
| list_projects | Read | Computes project health, progress percentage, deadline distance, and milestones. | Safe (Direct execute) |
| search_tasks | Read | Flexible multi-criteria query (title text, project, assignee, status, overdue, due horizon). | Safe (Direct execute) |
| get_recent_activity | Read | Retrieves chronological audit activity entries. | Safe (Direct execute) |
| create_task | Write | Creates a single task record directly in Supabase. | Guarded (Permission check) |
| update_task | Write | Updates a single task record directly in Supabase. | Guarded (Permission check) |
| propose_bulk_changes | Proposal | Stages modifications across multiple tasks into a pending proposal. | High-Risk (Requires user confirmation) |
| propose_project_plan | Proposal | Generates a multi-week project roadmap with milestones and tasks. | High-Risk (Requires user confirmation) |

### 4.2 Two-Phase Proposal Lifecycle
1. **Stage 1 (Proposal Creation):** When propose_bulk_changes or propose_project_plan is called, the tool validates record existence, records the payload into i_actions with status: 'pending', and returns { awaitingConfirmation: true, proposalId: id }. Nothing in the actual domain tables is altered.
2. **Stage 2 (User Confirmation or Rejection):** The UI presents the proposal card. If the user clicks 'Confirm', the server function pplyBulkProposal or pplyPlanProposal verifies the user's role, applies the changes atomically, updates i_actions to status: 'applied', logs activity, and sends notifications. If rejected, status is updated to 
ejected.

---

## 5. Summary of Reusable Design Patterns for TermJobs

1. **Server-Side Identity & Permissions:** Never pass role or tenant claims from the client prompt. The agent backend must resolve credentials from the validated session.
2. **Dual-Tier Tool Execution:** Low-risk reads and single edits execute directly; bulk or consequential modifications require structured confirmation cards.
3. **Dynamic System Prompt Context:** Inject date/time/timezone, user identity, permission boundaries, and relevant lookup directories directly into the prompt on each turn.
4. **Structured Interactive Cards:** Stream interactive UI cards (cards for candidates, requisitions, timesheets, schedules) alongside conversational text.
5. **Universal Audit Trail:** Log all AI actions (	ool, status, input, 
esult, ctor_id, 	imestamp) into a dedicated audit collection.
6. **Graceful Error Translation:** Intercept upstream LLM rate limits and provider timeouts, presenting clear recovery steps to the user.
