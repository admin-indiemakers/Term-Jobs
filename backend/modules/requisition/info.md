# Requisition Module — `modules/requisition/`

The requisition module owns the requirement-gathering and AI-driven JD generation step of the hiring funnel. It is the first module of the Term Jobs MVP, built standalone and tested offline, with an offline (Ollama) LLM used only where it is genuinely needed.

## 1. What this module does

A hiring manager names a role ("need a backend engineer"). The AI generates a complete, structured job requirement — a **structured role** plus a ready-to-publish **JD in Markdown** — grounded in the company's registered profile and tech stack, and always reviewed and approved by a human before it goes live.

### Core idea (LLM-aware design)
The LLM is an **accelerator, not the backbone**. Deterministic code does everything it can; the LLM only:
- phrases/generates the JD text, and
- fills structured-role fields the rules could not parse.

Every field the rules can extract (years, location, salary band, seniority, canonical skills) is handled without a model call.

## 2. Flow, end to end

1. Company registers → `company_profiles` row holds name, industry, location, tech stack.
2. Hiring manager starts a requisition with a `RoleIntent` (title + optional tech stack hint).
3. Agent loads the company profile and runs a **coverage check**: is the required stack ⊆ the registered stack?
4. **Covered** → generation proceeds immediately (zero intake questions).
5. **Uncovered** → a bounded **intake conversation** asks the manager to fill gaps (tech stack, seniority, years, location, salary band), one question at a time.
6. When gaps are closed (or the budget gate is hit), the **generate** step produces the JD + structured role.
7. Output is canonicalized, validated (pydantic), and confidence-gated.
8. A **decision record** is persisted every run (auditability).
9. The graph **pauses** for human approval. Approve → `PendingApproval` → `Published`; reject → back to `Draft`.

## 3. State machine

```
Draft -> Intake -> Structuring -> PendingApproval -> Published -> Closed
```

- `Intake` is its own state because the conversation is a core (and interruptible) part of the flow.
- Rejection anywhere before `Published` returns to `Draft` so the manager can re-run.
- All status changes go through the `StateMachine` (`domain/state.py`) — invalid transitions raise `InvalidTransition`.

## 4. Agent architecture (LangGraph)

The **Job Requirement Agent** is a LangGraph `StateGraph` with graph pauses persisted by a checkpointer (`MemorySaver` in tests — `PostgresSaver` in prod via `make_checkpointer`, so "graph pause persisted to Postgres" holds).

```
START
  -> budget_gate            (enforce intake-turn & tool-call budget)
  -> build_context          (load company profile + role intent from DB)
  -> coverage_check         (registered stack vs required stack)
      [covered]   -> generate
      [uncovered] -> intake_loop  (interrupt(*) for each answer)
                      -> generate once gaps are filled / budget met
  -> generate               (LLM: structured role, retry-bounded + sanitized)
  -> guardrail_check        (confidence gate + reversibility)
  -> persist_decision       (write DecisionRecord row)
  -> approval               (interrupt(*) — human decides)
      [approved] -> PendingApproval -> (service) Published
      [rejected] -> Draft
```

(*) Each `intake` question and the `approval` checkpoint is an `interrupt()`. The service resumes the same thread (`thread_id = requisition_id`) with `Command(resume=...)`.

### Guardrail loop (every run)
1. Budget gate — `max_intake_turns`, `max_tool_calls`.
2. Build context — profile + intent.
3. Structured generation with bounded retry (≤ `max_tool_calls`), LLM output **sanitized** before strict validation so small-model JSON quirks (e.g. `rate_band: [30]`) don't crash generation.
4. Pydantic schema validation (`StructuredRole`).
5. Confidence check (+ reversibility — never auto-publish).
6. Persist `DecisionRecord` regardless of dispatch/approval outcome.
7. Human approval checkpoint.

## 5. Cost discipline (LLM-load reduction)

- **3-tier model routing** (`MODEL_TIERS` in config) — currently all tiers map to `llama3.2:3b`; tiers are wired so larger models can be added without code changes.
- **Heuristics first** (`enrichment/heuristics.py`) — years, location, `₹`/`LPA`/`CTC`, seniority.
- **Canonical skills dictionary + RapidFuzz** (`enrichment/skills.py`) — "Postgres"→"postgresql", "JS"→"javascript"; word-boundary matching so "go" isn't detected inside "Django".
- **JD-cache** (`enrichment/cache.py`) — identical (profile, intent, answers) payloads skip the model.
- **Templated intake questions** (`agent/prompts.py`) — no LLM call to ask a question.
- **Langfuse tracing** — intentionally a no-op stub for now (full OSS self-host is a Phase-2 wiring task).

## 6. LLM client

- `llm/base.py` — `LLMClient` interface (`chat`, `generate_text`, `generate_structured`).
- `llm/ollama.py` — talks to the offline server via OpenAI-compatible `/v1/chat/completions`. `OLLAMA_BASE_URL` (default `http://192.168.29.78:11434`). Returns parsed JSON; strict validation lives in the agent's guardrail loop.
- `llm/mock.py` — deterministic `MockLLM` for offline tests/CI that reuses the same heuristics/dictionaries.

## 7. Events

Emitted on the shared in-process `EventBus` (`shared/events.py`), namespaced for downstream modules (candidate/ etc.) to subscribe:

- `requisition.created`
- `requisition.intake_started`
- `requisition.published`
- `requisition.closed`

## 8. Data model

| Table | Purpose |
|---|---|
| `company_profiles` | Registered company: name, industry, size, location, tech stack. Owned here for MVP; bridges to `identity/` later via `tenant_id`. |
| `requisitions` | The requisition record: status, intent, intake answers, generated structured role, JD markdown, coverage result, approval fields. |
| `decision_records` | Auditable record of every agent run: input context, output, confidence, guardrail status, reviewer, decision. |

## 9. Module layout

```
requisition/
├── domain/        schemas (pydantic), state machine, SQLAlchemy models
├── enrichment/    heuristics, canonical skills, JD cache
├── llm/           LLMClient interface, Ollama client, MockLLM
├── agent/         LangGraph graph, prompts, guardrails, JobRequirementAgent
├── services/      RequisitionService (create/intake/answer/approve/publish/close)
├── events.py      event name constants + emit helpers
└── tests/         offline suite + fixtures + golden eval + live ollama eval
```

Sibling `modules/shared/` holds config, DB session, and the event bus.

## 10. Running & testing

```bash
cd backend
uv sync --dev

# lint
uv run ruff check modules/

# offline unit + golden-mock eval (no network, no Postgres)
uv run pytest

# live eval against the offline LLM (auto-skips when Ollama unreachable)
uv run pytest -m ollama

# Postgres schema via Alembic (local pg running)
DATABASE_URL=postgresql://localhost/termejobs uv run alembic upgrade head
```

### Test coverage — what's verified
- State-machine transitions (valid + invalid) and terminal-state rules.
- Pydantic schema + guardrail logic (confidence gate, budget, rate-band).
- Coverage check: covered stacks skip intake; uncovered stacks trigger questions.
- Full lifecycle: `Draft → … → Published → Closed`, plus human **edit/reject** paths.
- Golden-fixture eval: every scenario in `tests/fixtures/golden_roles.json` must satisfy its expected role (skills, seniority, location) — the promised CI gate for prompt/model changes.
- Event emission at each lifecycle point.

## 11. Config (`.env.example`)

| Key | Default | Notes |
|---|---|---|
| `DATABASE_URL` | `postgresql://localhost/termejobs` | Alembic + engine |
| `OLLAMA_BASE_URL` | `http://192.168.29.78:11434` | Offline LLM server |
| `OLLAMA_DEFAULT_MODEL` | `llama3.2:3b` | Fallback for all tiers |
| `MODEL_TIERS` | JSON dict small/mid/large | 3-tier routing |
| `MAX_INTAKE_TURNS` | `8` | Intake budget gate |
| `MAX_TOOL_CALLS` | `5` | Structured-gen retry budget |
| `CONFIDENCE_THRESHOLD` | `0.7` | Guardrail gate |

## 12. Status & known notes

- **Working**: coverage-based intake routing, AI JD + structured role generation, human approval edit/reject, decision records, events, offline + live evals green, Postgres migrations applied.
- **Scoped out** (per MVP): FastAPI endpoints (services callable directly), `identity/` ownership of `company_profiles`, `candidate/` module, Langfuse wiring (stub), RLS policies for multi-tenant (tenant is passed as an opaque `tenant_id`).
- **Follow-ups**: real calendar-based interviewer-availability (affects the Interview Scheduling Agent, not this module); migrate JD-cache from in-memory to Redis/SQLite once shared infra lands.