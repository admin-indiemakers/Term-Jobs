"""LangGraph state machine for the Job Requirement Agent.

Graph (each intake turn and the approval checkpoint is a persisted graph pause):

    START -> budget_gate -> build_context -> coverage_check
        coverage_check -> [covered] generate
        coverage_check -> [uncovered] intake_loop -> (interrupt for answer)
            intake_loop -> generate once gaps are filled / budget met
    generate -> guardrail_check -> persist_decision -> approval(interrupt) -> END

The checkpointer (MemorySaver for tests, PostgresSaver in prod) persists graph
state across the pauses, matching the MVP's "graph pause persisted to Postgres".
"""
import re
from typing import Any, TypedDict

from langgraph.checkpoint.memory import MemorySaver
from langgraph.checkpoint.mongodb import MongoDBSaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import Command, interrupt

from ...shared.config import settings
from ...shared.db import client as mongo_client
from ..domain import models, schemas
from ..domain.state import StateMachine
from ..enrichment import heuristics, skills
from ..llm.base import LLMClient
from . import guardrails, prompts


def make_checkpointer():
    """MongoDB-backed checkpointer for graph-pause persistence.

    Persists graph checkpoints in Mongo so interrupted flows (intake questions,
    approval checkpoints) survive server restarts. Falls back to an in-memory
    checkpointer when running against a mock/offline DB (tests).
    """
    try:
        return MongoDBSaver(
            mongo_client,
            db_name=settings.mongo_db_name,
            checkpoint_collection_name="graph_checkpoints",
            writes_collection_name="graph_checkpoint_writes",
        )
    except Exception:  # noqa: BLE001 - tests run without a live Mongo client
        return MemorySaver()


class AgentState(TypedDict, total=False):
    requisition_id: str
    status: str
    profile: dict
    intent: dict
    answers: list[dict]
    asked_questions: list[dict]
    parsed: dict
    missing_skills: list[str]
    covered: bool
    intake_turns: int
    tool_calls: int
    structured_role: dict
    jd_markdown: str
    guardrail_status: str
    decision_record_id: str
    refine_instruction: str
    refine_turns: int


def _ensure_contract_section(jd: str, contract_duration: str) -> str:
    """Guarantee the JD always states the contract duration (mandatory section)."""
    if re.search(r"contract duration|contract period|engagement", jd, re.IGNORECASE):
        return jd
    value = contract_duration.strip() or "To be confirmed"
    return jd.rstrip() + f"\n\n## Contract duration / engagement\n\n{value}\n"


def _jd_sections(contract_duration: str) -> str:
    return prompts.JD_SECTIONS.format(contract_duration=contract_duration or "To be confirmed")


def _sanitize_role(raw: dict) -> None:
    """Coerce small-model JSON quirks before strict schema validation."""
    rate_band = raw.get("rate_band")
    if rate_band is not None and (
        not isinstance(rate_band, (list, tuple)) or len(rate_band) != 2
    ):
        # e.g. a single value -> drop so the parsed intake answer fills it.
        raw.pop("rate_band", None)
    confidence = raw.get("confidence")
    if confidence is not None:
        try:
            confidence = float(confidence)
        except (TypeError, ValueError):
            confidence = None
        if confidence is None or not (0.0 <= confidence <= 1.0):
            raw.pop("confidence", None)


def _load_context(session_factory, requisition_id: str) -> tuple[dict, dict] | None:
    with session_factory() as session:
        req = session.get(models.Requisition, requisition_id)
        if req is None:
            raise ValueError(f"requisition {requisition_id} not found")
        intent = req.intent or {}
        profile = {}
        if req.company_profile_id:
            prof = session.get(models.CompanyProfile, req.company_profile_id)
            if prof:
                profile = schemas.CompanyProfile(
                    name=prof.name,
                    industry=prof.industry,
                    size=prof.size,
                    location=prof.location,
                    tech_stack=prof.tech_stack or [],
                    notes=prof.notes,
                ).model_dump()
    return profile, intent


def _compute_gaps(parsed: dict) -> list[str]:
    """Which required fields are still unknown, in priority order."""
    gaps = []
    if not parsed.get("skills"):
        gaps.append("stack")
    if not parsed.get("seniority"):
        gaps.append("seniority")
    if not parsed.get("years"):
        gaps.append("years")
    if not parsed.get("location"):
        gaps.append("location")
    if parsed.get("rate_band") is None:
        gaps.append("rate")
    if not parsed.get("contract_duration"):
        gaps.append("contract")
    return [g for g in prompts.GAP_ORDER if g in gaps]


def _parse_answer(value: str, question_id: str) -> dict:
    extracted = heuristics.extract_from_text(value)
    parsed = {}
    if question_id == "stack":
        parsed["skills"] = skills.skills_in_text(value) or [value.strip().lower()]
    elif question_id == "seniority" and extracted["seniority"]:
        parsed["seniority"] = extracted["seniority"].value
    elif question_id == "years":
        years = extracted["years"]
        # A bare number in the years question ("3") still means 3 years.
        bare = value.strip()
        if years is None and bare.isdigit() and len(bare) <= 2:
            years = int(bare)
        if years is not None:
            parsed["years"] = years
    elif question_id == "location" and extracted["location"]:
        parsed["location"] = extracted["location"]
    elif question_id == "rate" and extracted["rate_band"]:
        parsed["rate_band"] = extracted["rate_band"]
    elif question_id == "contract" and extracted["contract_duration"]:
        parsed["contract_duration"] = extracted["contract_duration"]
    return parsed


def _parse_prompt(prompt: str) -> dict:
    """Direct-prompt mode: fill parsed fields from one free-form paragraph."""
    extracted = heuristics.extract_from_text(prompt)
    return {
        "skills": skills.skills_in_text(prompt),
        "seniority": extracted["seniority"].value if extracted["seniority"] else None,
        "years": extracted["years"],
        "location": extracted["location"],
        "rate_band": extracted["rate_band"],
        "contract_duration": extracted["contract_duration"],
    }


def build_graph(llm: LLMClient, session_factory, checkpointer=None):
    def budget_gate(state: AgentState) -> AgentState:
        guardrails.enforce_budget(state.get("intake_turns", 0), state.get("tool_calls", 0))
        return {}

    def build_context(state: AgentState) -> AgentState:
        profile, intent = _load_context(session_factory, state["requisition_id"])
        return {"profile": profile, "intent": intent}

    def coverage_check(state: AgentState) -> AgentState:
        intent = state["intent"]
        required = list(intent.get("tech_stack_hint") or [])
        required += skills.skills_in_text(intent.get("description", ""))
        registered = state["profile"].get("tech_stack", [])
        covered, missing = skills.is_covered(required, registered)
        return {"covered": covered, "missing_skills": missing}

    def _route_after_coverage(state: AgentState) -> str:
        if (state["intent"].get("prompt") or "").strip():
            return "generate"  # direct-prompt mode: no intake Q&A, generate now
        if state["covered"]:
            return "generate"
        return "intake_loop"

    def intake_loop(state: AgentState) -> AgentState:
        gaps = _compute_gaps(state["parsed"])
        if not gaps:
            return {"status": schemas.RequisitionStatus.STRUCTURING.value}
        if state["intake_turns"] >= settings.max_intake_turns:
            # Budget met; generate with whatever we have rather than blocking.
            return {"status": schemas.RequisitionStatus.STRUCTURING.value}

        qid = gaps[0]
        question = prompts.NEXT_QUESTION_TEMPLATES[qid]
        asked = list(state["asked_questions"]) + [{"id": qid, "text": question}]
        state["asked_questions"] = asked
        state["intake_turns"] += 1

        answer = interrupt(question)  # pause for the human answer
        state["answers"] = list(state["answers"]) + [{"question_id": qid, "value": answer}]
        parsed = dict(state["parsed"])
        parsed.update(_parse_answer(answer, qid))
        state["parsed"] = parsed
        return {
            "asked_questions": state["asked_questions"],
            "answers": state["answers"],
            "parsed": parsed,
            "intake_turns": state["intake_turns"],
        }

    def _route_after_intake(state: AgentState) -> str:
        if state["status"] == schemas.RequisitionStatus.STRUCTURING.value:
            return "generate"
        return "intake_loop"

    def generate(state: AgentState) -> AgentState:
        profile = schemas.CompanyProfile.model_validate(state["profile"])
        intent = schemas.RoleIntent.model_validate(state["intent"])
        calls = state["tool_calls"]

        instruction = (state.get("refine_instruction") or "").strip()
        if instruction:
            # Refinement loop: apply the manager's edit request to the current
            # role + JD, then come back to the approval checkpoint.
            refine_turns = state.get("refine_turns", 0)
            guardrails.enforce_budget(refine_turns + 1, calls, turns_label="refinement")
            role = schemas.StructuredRole.model_validate(state["structured_role"])
            current_jd = state.get("jd_markdown") or ""

            role_prompt = prompts.ROLE_REFINE_PROMPT.format(
                profile=profile.model_dump_json(),
                role=role.model_dump_json(),
                instruction=instruction,
            )
            raw = llm.generate_structured(role_prompt, schemas.StructuredRole)
            _sanitize_role(raw)
            role = guardrails.validate_role(raw)
            role.must_have_skills = skills.canonicalize_skills(role.must_have_skills)
            role.nice_to_have_skills = skills.canonicalize_skills(role.nice_to_have_skills)

            jd_prompt = prompts.JD_REFINE_PROMPT.format(
                profile=profile.model_dump_json(),
                jd=current_jd,
                role=role.model_dump_json(),
                instruction=instruction,
                sections=_jd_sections(role.contract_duration),
            )
            jd_markdown = _ensure_contract_section(
                llm.generate_text(jd_prompt), role.contract_duration
            )

            return {
                "structured_role": role.model_dump(),
                "jd_markdown": jd_markdown,
                "tool_calls": calls,
                "refine_turns": refine_turns + 1,
                "status": schemas.RequisitionStatus.STRUCTURING.value,
            }

        answers = "\n".join(f"- {a['value']}" for a in state["answers"])

        role_prompt = prompts.ROLE_EXTRACTION_PROMPT.format(
            profile=profile.model_dump_json(),
            intent=intent.model_dump_json(),
            answers=answers,
        )

        last_error = None
        role = None
        calls = state["tool_calls"]
        while role is None and calls < settings.max_tool_calls:
            calls += 1
            try:
                raw = llm.generate_structured(role_prompt, schemas.StructuredRole)
                _sanitize_role(raw)
                role = guardrails.validate_role(raw)
            except Exception as exc:  # noqa: BLE001 - bounded retry over small-model JSON quirks
                last_error = exc

        if role is None:
            raise guardrails.GuardrailError(f"could not produce a valid role: {last_error}")

        role.must_have_skills = skills.canonicalize_skills(role.must_have_skills)
        role.nice_to_have_skills = skills.canonicalize_skills(role.nice_to_have_skills)
        # Fold ingested details when LLM left them blank
        if not role.location and state["parsed"].get("location"):
            role.location = state["parsed"]["location"]
        if role.rate_band is None and state["parsed"].get("rate_band"):
            role.rate_band = state["parsed"]["rate_band"]
        if not role.contract_duration and state["parsed"].get("contract_duration"):
            role.contract_duration = state["parsed"]["contract_duration"]

        jd_prompt = prompts.JD_GENERATION_PROMPT.format(
            profile=profile.model_dump_json(),
            intent=intent.model_dump_json(),
            role=role.model_dump_json(),
            sections=_jd_sections(role.contract_duration),
        )
        jd_markdown = _ensure_contract_section(
            llm.generate_text(jd_prompt), role.contract_duration
        )

        return {
            "structured_role": role.model_dump(),
            "jd_markdown": jd_markdown,
            "tool_calls": calls,
            "status": schemas.RequisitionStatus.STRUCTURING.value,
        }

    def guardrail_check(state: AgentState) -> AgentState:
        role = schemas.StructuredRole.model_validate(state["structured_role"])
        gate = guardrails.confidence_gate(role)
        # Confidence blocked does not hard-stop; it flags the record for human
        # scrutiny. Reversibility is guaranteed by the approval checkpoint.
        declined = guardrails.reversibility_ok()
        if not declined:
            raise guardrails.GuardrailError("reversibility check failed")
        return {"guardrail_status": gate}

    def persist_decision(state: AgentState) -> AgentState:
        with session_factory() as session:
            req = session.get(models.Requisition, state["requisition_id"])
            req.status = state["status"] or schemas.RequisitionStatus.STRUCTURING.value
            req.structured_role = state["structured_role"]
            req.generated_jd_markdown = state["jd_markdown"]
            req.coverage_result = {
                "covered": state["covered"],
                "missing_skills": state["missing_skills"],
            }
            if state.get("refine_instruction"):
                req.refinement_log = (req.refinement_log or []) + [
                    {
                        "instruction": state["refine_instruction"],
                        "structured_role": state["structured_role"],
                        "jd_markdown": state["jd_markdown"],
                    }
                ]
            record = models.DecisionRecord(
                requisition_id=state["requisition_id"],
                agent_name="job_requirement_agent",
                input_context={
                    "profile": state["profile"],
                    "intent": state["intent"],
                    "answers": state["answers"],
                },
                output={
                    "structured_role": state["structured_role"],
                    "jd_markdown": state["jd_markdown"],
                },
                confidence=state["structured_role"]["confidence"],
                guardrail_status=state["guardrail_status"],
            )
            session.add(record)
            session.commit()
            session.refresh(record)
            return {"decision_record_id": record.id}

    def approval(state: AgentState) -> AgentState:
        decision = interrupt(
            {
                "checkpoint": "approval",
                "structured_role": state["structured_role"],
                "jd_markdown": state["jd_markdown"],
            }
        )
        # Refinement request: loop back to generate with the manager's feedback.
        if isinstance(decision, dict) and isinstance(decision.get("instruction"), str):
            return Command(
                goto="generate",
                update={"refine_instruction": decision["instruction"].strip()},
            )
        status = schemas.RequisitionStatus.DRAFT.value  # default: revisit
        if isinstance(decision, dict) and decision.get("decision"):
            if decision["decision"] == "approved":
                status = schemas.RequisitionStatus.PENDING_APPROVAL.value
            elif decision["decision"] == "rejected":
                status = schemas.RequisitionStatus.DRAFT.value
        with session_factory() as session:
            req = session.get(models.Requisition, state["requisition_id"])
            sm = StateMachine(schemas.RequisitionStatus(req.status))
            sm.transition(schemas.RequisitionStatus(status))
            req.status = sm.status.value
            if isinstance(decision, dict) and decision.get("edited_role"):
                req.structured_role = decision["edited_role"]
                state["structured_role"] = decision["edited_role"]
            session.commit()
        return {"status": status}

    graph = StateGraph(AgentState)
    graph.add_node("budget_gate", budget_gate)
    graph.add_node("build_context", build_context)
    graph.add_node("coverage_check", coverage_check)
    graph.add_node("intake_loop", intake_loop)
    graph.add_node("generate", generate)
    graph.add_node("guardrail_check", guardrail_check)
    graph.add_node("persist_decision", persist_decision)
    graph.add_node("approval", approval)

    graph.add_edge(START, "budget_gate")
    graph.add_edge("budget_gate", "build_context")
    graph.add_edge("build_context", "coverage_check")
    graph.add_conditional_edges("coverage_check", _route_after_coverage, {
        "generate": "generate",
        "intake_loop": "intake_loop",
    })
    graph.add_conditional_edges("intake_loop", _route_after_intake, {
        "generate": "generate",
        "intake_loop": "intake_loop",
    })
    graph.add_edge("generate", "guardrail_check")
    graph.add_edge("guardrail_check", "persist_decision")
    graph.add_edge("persist_decision", "approval")
    graph.add_edge("approval", END)

    return graph.compile(checkpointer=checkpointer or MemorySaver())


class JobRequirementAgent:
    """Runs the Job Requirement Agent graph and manages interrupt/resume."""

    def __init__(self, llm: LLMClient, session_factory, checkpointer=None) -> None:
        self.session_factory = session_factory
        self.graph = build_graph(llm, session_factory, checkpointer=checkpointer)

    def _config(self, requisition_id: str) -> dict:
        return {"configurable": {"thread_id": requisition_id}}

    def run(self, requisition_id: str, resume: Any = None) -> tuple[AgentState, Any]:
        """Run the graph until an interrupt or completion.

        Returns (state, interrupt_value). For an intake question the
        interrupt_value is a string; for approval it is the checkpoint dict.
        If the flow completed, interrupt_value is None.
        """
        profile, intent = _load_context(self.session_factory, requisition_id)
        initial: AgentState = {
            "requisition_id": requisition_id,
            "status": schemas.RequisitionStatus.INTAKE.value,
            "profile": profile,
            "intent": intent,
            "answers": [],
            "asked_questions": [],
            "parsed": {},
            "missing_skills": [],
            "covered": False,
            "intake_turns": 0,
            "tool_calls": 0,
        }
        # Direct-prompt mode: the whole role is described in one paragraph, so
        # parse everything up front and skip the intake conversation.
        prompt = (intent.get("prompt") or "").strip()
        if prompt:
            initial["answers"] = [{"question_id": "prompt", "value": prompt}]
            initial["parsed"] = _parse_prompt(prompt)
            initial["status"] = schemas.RequisitionStatus.STRUCTURING.value
        config = self._config(requisition_id)
        result = self.graph.stream(
            Command(resume=resume) if resume is not None else dict(initial),
            config=config,
            stream_mode="values",
        )
        state = dict(initial)
        interrupt_value = None
        for chunk in result:
            state = dict(chunk)
            if "__interrupt__" in chunk:
                interrupt_value = chunk["__interrupt__"][0].value
                break
        return state, interrupt_value