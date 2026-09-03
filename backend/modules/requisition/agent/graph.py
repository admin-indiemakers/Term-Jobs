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
import json
import re
from typing import Any, TypedDict

from langgraph.checkpoint.memory import MemorySaver
from langgraph.checkpoint.mongodb import MongoDBSaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import Command, interrupt

from ...shared.config import settings
from ...shared.db import client as _mongo_client_fn
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
            _mongo_client_fn(),
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
    intake_meta: dict
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


_PAYMENT_FIELDS = (
    "rate_band",
    "ceiling_internal",
    "range_vendors_see",
    "rate_card_cap",
    "total_engagement_value",
    "budget_approved",
    "budget_reference",
    "variance_approved",
)


def _role_for_jd(role: schemas.StructuredRole) -> str:
    """Serialize the role for JD generation WITHOUT any payment/compensation
    fields, so the JD never leaks rates, ceilings, or engagement value."""
    data = role.model_dump()
    for field in _PAYMENT_FIELDS:
        data.pop(field, None)
    return json.dumps(data)


def _sanitize_role(raw: dict) -> None:
    """Coerce small-model JSON quirks before strict schema validation."""
    for field in ("rate_band", "range_vendors_see"):
        value = raw.get(field)
        if value is not None and (
            not isinstance(value, (list, tuple)) or len(value) != 2
        ):
            # e.g. a single value -> drop so the parsed intake answer fills it.
            raw.pop(field, None)
    for field in ("ceiling_internal", "rate_card_cap"):
        value = raw.get(field)
        if isinstance(value, (list, tuple)):
            # LLM sometimes emits a range as a 2-tuple; keep the upper bound.
            raw[field] = value[-1] if value else None
        elif value is not None:
            try:
                raw[field] = int(value)
            except (TypeError, ValueError):
                raw.pop(field, None)
    confidence = raw.get("confidence")
    if confidence is not None:
        try:
            confidence = float(confidence)
        except (TypeError, ValueError):
            confidence = None
        if confidence is None or not (0.0 <= confidence <= 1.0):
            raw.pop("confidence", None)


def _load_context(session_factory, requisition_id: str) -> tuple[dict, dict, dict] | None:
    with session_factory() as session:
        req = session.get(models.Requisition, requisition_id)
        if req is None:
            raise ValueError(f"requisition {requisition_id} not found")
        intent = req.intent or {}
        intake_meta = req.intake_meta or {}
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
    return profile, intent, intake_meta


def _compute_gaps(parsed: dict) -> list[str]:
    """Which required fields are still unknown, in priority order."""
    gaps = []
    if not parsed.get("skills"):
        gaps.append("stack")
    if not parsed.get("seniority"):
        parsed["seniority"] = "Mid"
    if not parsed.get("years"):
        gaps.append("years")
    if not parsed.get("location"):
        gaps.append("location")
    if parsed.get("rate_band") is None:
        gaps.append("rate")
    if not parsed.get("contract_duration"):
        gaps.append("contract")
    return [g for g in prompts.GAP_ORDER if g in gaps]


def _parse_answer(value: Any, question_id: str) -> dict:
    if isinstance(value, dict):
        value = str(value.get("answer") or value.get("text") or value)
    elif not isinstance(value, str):
        value = str(value)
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


def _min_experience_years(text: str) -> int | None:
    """Lower bound of an experience range ('5 – 8 years' -> 5) for seniority."""
    m = re.search(r"(\d{1,2}(?:\.\d+)?)\s*[-–]\s*\d{1,2}(?:\.\d+)?", text)
    if m:
        return int(float(m.group(1)))
    return heuristics.extract_from_text(text)["years"]


def _seniority_from_years(years: int) -> str:
    """Infer a seniority level from years of experience when the form did not
    state one explicitly (e.g. '4 – 7 years' -> Senior)."""
    if years >= 9:
        return "Principal"
    if years >= 7:
        return "Lead"
    if years >= 4:
        return "Senior"
    if years >= 2:
        return "Mid"
    return "Junior"


def _prefill_to_parsed(prefill: dict) -> dict:
    """Seed the intake state from fields already filled in the New Requisition
    form, so the agent only asks about real gaps instead of re-asking for
    values the hiring manager already provided."""
    if not prefill:
        return {}
    parsed: dict = {}

    skills_list = prefill.get("must_have_skills") or []
    if skills_list:
        parsed["skills"] = [str(s).lower() for s in skills_list]

    title = prefill.get("title") or prefill.get("role_title") or prefill.get("role") or ""
    raw_text = prefill.get("raw_text") or prefill.get("job_description") or ""

    sen = prefill.get("seniority")
    if not sen and title:
        sen_obj = heuristics.parse_seniority(title)
        if sen_obj:
            sen = sen_obj.value
    if not sen and raw_text:
        sen_obj = heuristics.parse_seniority(raw_text)
        if sen_obj:
            sen = sen_obj.value

    if sen:
        parsed["seniority"] = sen

    if prefill.get("experience"):
        years = _min_experience_years(str(prefill["experience"]))
        if years is not None:
            parsed["years"] = years
            if not parsed.get("seniority"):
                parsed["seniority"] = _seniority_from_years(years)

    if not parsed.get("seniority") and title:
        parsed["seniority"] = "Mid"

    locations = prefill.get("work_locations") or []
    if locations:
        parsed["location"] = locations[0]

    min_val = prefill.get("range_vendors_see_min")
    max_val = prefill.get("range_vendors_see_max")
    if min_val in (None, ""):
        min_val = prefill.get("ceiling_internal")
    if min_val not in (None, "") and max_val not in (None, ""):
        parsed["rate_band"] = (min_val, max_val)

    if prefill.get("duration"):
        parsed["contract_duration"] = prefill["duration"]

    return parsed


def build_graph(llm: LLMClient, session_factory, checkpointer=None):
    def budget_gate(state: AgentState) -> AgentState:
        guardrails.enforce_budget(state.get("intake_turns", 0), state.get("tool_calls", 0))
        return {}

    def build_context(state: AgentState) -> AgentState:
        profile, intent, intake_meta = _load_context(session_factory, state["requisition_id"])
        return {"profile": profile, "intent": intent, "intake_meta": intake_meta}

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
        if not (state.get("intake_meta") or {}).get("prefill") and state["covered"]:
            return "generate"
        if not _compute_gaps(state.get("parsed") or {}):
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

    def _apply_prefill(role: schemas.StructuredRole, prefill: dict) -> schemas.StructuredRole:
        """Apply pre-filled values from intake_meta to the generated role.

        Only fills in fields that are empty/None in the generated role.
        """
        if not prefill:
            return role

        data = role.model_dump()

        # Role tab fields
        if prefill.get("job_title"):
            data["title"] = prefill["job_title"]
        if not data.get("job_family") and prefill.get("job_family"):
            data["job_family"] = prefill["job_family"]
        if not data.get("must_have_skills") and prefill.get("must_have_skills"):
            data["must_have_skills"] = prefill["must_have_skills"]
        if not data.get("nice_to_have_skills") and prefill.get("nice_to_have_skills"):
            data["nice_to_have_skills"] = prefill["nice_to_have_skills"]
        if not data.get("seniority") and prefill.get("seniority"):
            data["seniority"] = prefill["seniority"]
        if not data.get("experience") and prefill.get("experience"):
            data["experience"] = prefill["experience"]
        if not data.get("headcount") and prefill.get("headcount"):
            data["headcount"] = prefill["headcount"]
        if not data.get("certifications") and prefill.get("certifications"):
            data["certifications"] = prefill["certifications"]

        # Engagement tab fields
        if not data.get("engagement_type") and prefill.get("engagement_type"):
            data["engagement_type"] = prefill["engagement_type"]
        if not data.get("duration") and prefill.get("duration"):
            data["duration"] = prefill["duration"]
        if not data.get("start_date") and prefill.get("start_date"):
            data["start_date"] = prefill["start_date"]
        if not data.get("ends_on") and prefill.get("ends_on"):
            data["ends_on"] = prefill["ends_on"]
        if data.get("extension_likely") is False and prefill.get("extension_likely") is not None:
            data["extension_likely"] = prefill["extension_likely"]
        if not data.get("max_notice_period") and prefill.get("max_notice_period"):
            data["max_notice_period"] = prefill["max_notice_period"]

        # Commercials tab fields
        if data.get("ceiling_internal") is None:
            c = prefill.get("ceiling_internal")
            if c in (None, ""):
                c = prefill.get("internal_ceiling")
            if c not in (None, ""):
                data["ceiling_internal"] = c

        if data.get("range_vendors_see") is None or data.get("range_vendors_see") == (None, None):
            min_val = prefill.get("range_vendors_see_min")
            if min_val is None:
                min_val = prefill.get("vendor_range_min")
            max_val = prefill.get("range_vendors_see_max")
            if max_val is None:
                max_val = prefill.get("vendor_range_max")
            if min_val is None and max_val is None and prefill.get("range_vendors_see"):
                rvs = prefill.get("range_vendors_see")
                if isinstance(rvs, (list, tuple)) and len(rvs) == 2:
                    min_val, max_val = rvs[0], rvs[1]
            if min_val is None and max_val is None and prefill.get("rate_band"):
                rb = prefill.get("rate_band")
                if isinstance(rb, (list, tuple)) and len(rb) == 2:
                    min_val, max_val = rb[0], rb[1]
            if min_val is not None or max_val is not None:
                data["range_vendors_see"] = (min_val, max_val)

        if data.get("rate_band") is None or data.get("rate_band") == (None, None):
            if data.get("range_vendors_see"):
                data["rate_band"] = data.get("range_vendors_see")
            elif prefill.get("rate_band"):
                rb = prefill.get("rate_band")
                if isinstance(rb, (list, tuple)) and len(rb) == 2:
                    data["rate_band"] = (rb[0], rb[1])

        if data.get("rate_card_cap") is None:
            cap = prefill.get("rate_card_cap")
            if cap in (None, ""):
                cap = prefill.get("cap")
            if cap not in (None, ""):
                data["rate_card_cap"] = cap
        if not data.get("total_engagement_value") and prefill.get("total_engagement_value"):
            data["total_engagement_value"] = prefill["total_engagement_value"]
        if not data.get("cost_centre") and prefill.get("cost_centre"):
            data["cost_centre"] = prefill["cost_centre"]
        if data.get("budget_approved") is False and prefill.get("budget_approved") is not None:
            data["budget_approved"] = prefill["budget_approved"]
        if not data.get("budget_reference") and prefill.get("budget_reference"):
            data["budget_reference"] = prefill["budget_reference"]
        if data.get("variance_approved") is False and prefill.get("variance_approved") is not None:
            data["variance_approved"] = prefill["variance_approved"]
    
        # Work setup tab fields
        if not data.get("work_mode") and prefill.get("work_mode"):
            data["work_mode"] = prefill["work_mode"]
        if not data.get("work_locations") and prefill.get("work_locations"):
            data["work_locations"] = prefill["work_locations"]
        if not data.get("working_hours") and prefill.get("working_hours"):
            data["working_hours"] = prefill["working_hours"]
        if not data.get("location_remote_policy") and prefill.get("location_remote_policy"):
            data["location_remote_policy"] = prefill["location_remote_policy"]
        if not data.get("onsite_requirement") and prefill.get("onsite_requirement"):
            data["onsite_requirement"] = prefill["onsite_requirement"]
        if not data.get("equipment_provisioning") and prefill.get("equipment_provisioning"):
            data["equipment_provisioning"] = prefill["equipment_provisioning"]
    
        # Compliance tab fields
        if not data.get("background_check") and prefill.get("background_check"):
            data["background_check"] = prefill["background_check"]
        if data.get("background_check_required") is False and prefill.get("background_check_required") is not None:
            data["background_check_required"] = prefill["background_check_required"]
        if not data.get("nda_contract_type") and prefill.get("nda_contract_type"):
            data["nda_contract_type"] = prefill["nda_contract_type"]
        if not data.get("work_authorization") and prefill.get("work_authorization"):
            data["work_authorization"] = prefill["work_authorization"]
        if data.get("client_site_access") is False and prefill.get("client_site_access") is not None:
            data["client_site_access"] = prefill["client_site_access"]
        if data.get("security_clearance_required") is False and prefill.get("security_clearance_required") is not None:
            data["security_clearance_required"] = prefill["security_clearance_required"]
        if not data.get("security_clearance_notes") and prefill.get("security_clearance_notes"):
            data["security_clearance_notes"] = prefill["security_clearance_notes"]
    
        # Process tab fields
        if not data.get("hiring_manager") and prefill.get("hiring_manager"):
            data["hiring_manager"] = prefill["hiring_manager"]
        if not data.get("submission_deadline") and prefill.get("submission_deadline"):
            data["submission_deadline"] = prefill["submission_deadline"]
        if not data.get("priority") and prefill.get("priority"):
            data["priority"] = prefill["priority"]
    
        return schemas.StructuredRole.model_validate(data)


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
                    role=_role_for_jd(role),
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

            # Include details already provided on the New Requisition form so the
            # LLM mirrors them instead of guessing (seniority is often inferred
            # from experience, location from work_locations, etc.).
            parsed = state.get("parsed") or {}
            provided_facts = []
            if parsed.get("skills"):
                provided_facts.append("Required skills (from form): " + ", ".join(parsed["skills"]))
            if parsed.get("seniority"):
                provided_facts.append(f"Seniority (from form): {parsed['seniority']}")
            if parsed.get("years"):
                provided_facts.append(f"Required experience (from form): {parsed['years']}+ years")
            if parsed.get("location"):
                provided_facts.append(f"Location (from form): {parsed['location']}")
            if parsed.get("rate_band"):
                provided_facts.append(f"Rate band (from form): INR {parsed['rate_band']}")
            if parsed.get("contract_duration"):
                provided_facts.append(f"Contract duration (from form): {parsed['contract_duration']}")
            if provided_facts:
                answers = (answers + "\n" if answers else "") + "\n".join(f"- {f}" for f in provided_facts)

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
                except RuntimeError:
                    # Client already exhausted its own retry/backoff budget.
                    raise
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
            # Apply pre-filled values from intake_meta (New Requisition form)
            prefill = dict(state.get("intake_meta", {}).get("prefill", {}))
            # Fall back to values derived during intake (e.g. seniority inferred
            # from the form's experience field) when they were not stored.
            if not prefill.get("seniority") and state.get("parsed", {}).get("seniority"):
                prefill["seniority"] = state["parsed"]["seniority"]
            role = _apply_prefill(role, prefill)

            jd_prompt = prompts.JD_GENERATION_PROMPT.format(
                profile=profile.model_dump_json(),
                intent=intent.model_dump_json(),
                role=_role_for_jd(role),
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
        profile, intent, intake_meta = _load_context(self.session_factory, requisition_id)
        prefill = dict(intake_meta.get("prefill") or {})
        # Infer a seniority level from experience so the agent neither asks for
        # it nor leaves it blank when the form only states years of experience.
        if not prefill.get("seniority") and prefill.get("experience"):
            years = _min_experience_years(str(prefill["experience"]))
            if years is not None:
                prefill["seniority"] = _seniority_from_years(years)
        if prefill:
            intake_meta = {**(intake_meta or {}), "prefill": prefill}
        initial: AgentState = {
            "requisition_id": requisition_id,
            "status": schemas.RequisitionStatus.INTAKE.value,
            "profile": profile,
            "intent": intent,
            "intake_meta": intake_meta,
            "answers": [],
            "asked_questions": [],
            "parsed": _prefill_to_parsed(prefill),
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
        persisted = self.graph.get_state(config)
        if resume is not None and "requisition_id" not in (persisted.values or {}):
            # No persisted thread state for this requisition (e.g. intake was
            # started under an older/restarted server before checkpoints
            # existed, or a prior run crashed before saving state). A resume
            # on an empty thread would run the graph with no state and crash;
            # restart from the seeded initial state instead.
            resume = None
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
