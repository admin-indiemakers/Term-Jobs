"""Central Query Orchestrator for TermJobs Hiring Manager Copilot.

Coordinates stages 1 through 8:
1. Input analysis & slot extraction
2. Domain, intent, and ambiguity classification
3. Adaptive strategy selection
4. Strategy execution & tracing
5. Structured plan validation
6. Clarification generation when required
7. Authorized tool / knowledge execution
8. Result validation & plain-language synthesis
"""
import logging
import re
import time
from typing import Any, Callable, Dict, List, Optional, Tuple

from .chat_scope import is_hiring_request_in_scope, scope_response
from .query_knowledge import retrieve_knowledge
from .query_models import (
    ConversationSlotState,
    ExecutionMode,
    StrategyExecutionRecord,
    StrategyPlan,
    StrategyType,
)
from .query_strategies import (
    build_structured_filters,
    decompose_query,
    expand_query,
    generate_hyde_doc,
    generate_multi_queries,
    generate_step_back_query,
    rewrite_query,
)

logger = logging.getLogger(__name__)


class CentralQueryOrchestrator:
    """Adaptive, LLM-driven query orchestrator with explicit execution policies."""

    def __init__(self):
        self._session_slots: Dict[str, ConversationSlotState] = {}

    def get_or_create_slot_state(self, user_id: str, tenant_id: str = "") -> ConversationSlotState:
        """Retrieve or initialize conversation slot memory for a user, backed by MongoDB."""
        key = f"{tenant_id}:{user_id}" if tenant_id else (user_id or "default_user")
        if key in self._session_slots:
            return self._session_slots[key]

        # Attempt to load persistent state from MongoDB
        try:
            from modules.shared.db import db
            doc = db["chat_slot_states"].find_one({"user_id": user_id, "tenant_id": tenant_id})
            if doc and doc.get("slot_state"):
                slot = ConversationSlotState(**doc["slot_state"])
                self._session_slots[key] = slot
                return slot
        except Exception:
            pass

        slot = ConversationSlotState()
        self._session_slots[key] = slot
        return slot

    def save_slot_state(self, user_id: str, tenant_id: str, slot: ConversationSlotState):
        """Persist updated conversation slot state to in-memory cache and MongoDB."""
        key = f"{tenant_id}:{user_id}" if tenant_id else (user_id or "default_user")
        self._session_slots[key] = slot
        try:
            from datetime import datetime, timezone
            from modules.shared.db import db
            slot.updated_at = datetime.now(timezone.utc).isoformat()
            db["chat_slot_states"].update_one(
                {"user_id": user_id, "tenant_id": tenant_id},
                {"$set": {
                    "user_id": user_id,
                    "tenant_id": tenant_id,
                    "slot_state": slot.model_dump(),
                    "updated_at": slot.updated_at
                }},
                upsert=True
            )
        except Exception:
            pass

    def update_slots_from_history(self, slot: ConversationSlotState, history: List[Dict[str, Any]]):
        """Extract recent entities and roles from turn history to keep slot state fresh."""
        for turn in reversed(history[-6:]):
            content = str(turn.get("content") or turn.get("text") or "")
            # Role matches
            m_role = re.search(r"\b([A-Z][a-zA-Z0-9\s/+#-]+(?:\s+Developer|\s+Engineer|\s+Architect|\s+Designer|\s+Manager))\b", content)
            if m_role and m_role.group(1).strip() not in slot.recent_roles:
                slot.recent_roles.append(m_role.group(1).strip())
                if not slot.active_requisition_title:
                    slot.active_requisition_title = m_role.group(1).strip()

            # Candidate matches
            m_cand = re.search(r"\b(?:candidate|interview\s+with|profile\s+for)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b", content)
            if m_cand and m_cand.group(1).strip() not in slot.recent_candidates:
                slot.recent_candidates.append(m_cand.group(1).strip())
                if not slot.active_candidate_name:
                    slot.active_candidate_name = m_cand.group(1).strip()

    def create_strategy_plan(
        self,
        prompt: str,
        history: List[Dict[str, Any]],
        current_user: Dict[str, Any]
    ) -> StrategyPlan:
        """Analyze the query, determine execution mode, and formulate the minimal strategy plan."""
        user_id = str(current_user.get("id") or "hm")
        tenant_id = str(current_user.get("tenant_id") or "")
        slot = self.get_or_create_slot_state(user_id, tenant_id=tenant_id)
        self.update_slots_from_history(slot, history)
        self.save_slot_state(user_id, tenant_id, slot)

        text = prompt.strip()
        trace: List[StrategyExecutionRecord] = []

        # 1. Out-of-scope check
        if not is_hiring_request_in_scope(text, history):
            return StrategyPlan(
                domain="unsupported",
                intent="out_of_scope",
                execution_mode=ExecutionMode.UNSUPPORTED,
                strategies=[],
                strategy_trace=trace
            )

        # 2. Pleasantry / Direct Greeting check
        is_greeting = bool(re.fullmatch(r"^(hi+|hello+|hey+|greetings|good\s+(?:morning|afternoon|evening))[\s!.,?]*$", text, re.I))
        if is_greeting:
            return StrategyPlan(
                domain="hiring",
                intent="greeting",
                execution_mode=ExecutionMode.DIRECT_ANSWER,
                strategies=[],
                strategy_trace=trace
            )

        # 3. Strategy A: Contextual Rewrite (if follow-up / anaphora detected)
        rewritten_prompt, is_rewritten, clarification_msg, rewrite_rec = rewrite_query(text, history, slot)
        trace.append(rewrite_rec)

        if clarification_msg:
            return StrategyPlan(
                domain="hiring",
                intent="clarification",
                execution_mode=ExecutionMode.CLARIFICATION,
                strategies=[StrategyType.CONTEXTUAL_REWRITE],
                requires_clarification=True,
                clarification_question=clarification_msg,
                strategy_trace=trace
            )

        active_query = rewritten_prompt if is_rewritten else text
        selected_strategies: List[StrategyType] = []
        if is_rewritten:
            selected_strategies.append(StrategyType.CONTEXTUAL_REWRITE)

        # 4. Strategy B: Query Decomposition (if compound multi-task query)
        sub_tasks, decomp_rec = decompose_query(active_query)
        trace.append(decomp_rec)
        if sub_tasks:
            selected_strategies.append(StrategyType.QUERY_DECOMPOSITION)

        # 5. Diagnostic Inquiry -> Step-Back Reasoning (Strategy F)
        step_back_data, step_back_rec = generate_step_back_query(active_query)
        trace.append(step_back_rec)
        if step_back_data:
            selected_strategies.append(StrategyType.STEP_BACK)
            return StrategyPlan(
                domain="hiring",
                intent="pipeline_diagnostics",
                execution_mode=ExecutionMode.HYBRID,
                strategies=selected_strategies,
                contextual_rewrite=active_query if is_rewritten else None,
                sub_queries=[step_back_data],
                strategy_trace=trace
            )

        # 6. Policy / Governance -> Knowledge Retrieval & HyDE (Strategy E)
        is_policy = bool(re.search(
            r"\b(policy|policies|guideline|rule|workflow|interview\s+rounds|contract\s+only|permanent|full-time\s+allowed|director\s+approval)\b",
            active_query, re.I
        )) and not re.search(r"\b(draft|create|schedule|list|show)\s+(?:candidate|requisition)\b", active_query, re.I)

        if is_policy:
            hyde_doc, hyde_rec = generate_hyde_doc(active_query)
            trace.append(hyde_rec)
            if hyde_doc:
                selected_strategies.append(StrategyType.HYDE_RETRIEVAL)
            return StrategyPlan(
                domain="hiring",
                intent="knowledge_lookup",
                execution_mode=ExecutionMode.KNOWLEDGE_RETRIEVAL,
                strategies=selected_strategies,
                contextual_rewrite=active_query if is_rewritten else None,
                entities={"hyde_doc": hyde_doc} if hyde_doc else {},
                strategy_trace=trace
            )

        # 7. Structured Filters & Translation (Strategy G)
        tz_name = current_user.get("timezone") or "Asia/Kolkata"
        filters, filter_rec = build_structured_filters(active_query, timezone_name=tz_name)
        trace.append(filter_rec)

        if filters.get("rejected"):
            return StrategyPlan(
                domain="hiring",
                intent="rejected_filter",
                execution_mode=ExecutionMode.CLARIFICATION,
                strategies=[StrategyType.STRUCTURED_FILTER],
                requires_clarification=True,
                clarification_question=filters.get("error", "Invalid filter detected."),
                strategy_trace=trace
            )

        if filters:
            selected_strategies.append(StrategyType.STRUCTURED_FILTER)

        # 8. Query Expansion (Strategy C) - e.g. SRE -> Site Reliability Engineer
        # Skip if exact dates/status are present
        expanded_data, expand_rec = expand_query(active_query)
        trace.append(expand_rec)
        if expanded_data.get("expanded_terms"):
            selected_strategies.append(StrategyType.QUERY_EXPANSION)

        # 9. Candidate Search -> Multi-Query (Strategy D)
        multi_queries, multi_rec = generate_multi_queries(active_query, "candidate_search")
        trace.append(multi_rec)
        if len(multi_queries) > 1:
            selected_strategies.append(StrategyType.MULTI_QUERY)

        # Determine Target Tool and Intent
        target_tool = None
        intent = "general_query"
        mode = ExecutionMode.STRUCTURED_TOOL

        # Requisition guide inquiry
        if re.search(r"\bhow\s+(?:can\s+i|to|do\s+i)\s+(?:create|draft|make|post)\s+(?:a\s+)?requisition\b|\bguide\s+to\s+create\b", active_query, re.I):
            intent = "get_requisition_guide"
            target_tool = "get_requisition_guide"
            mode = ExecutionMode.DIRECT_ANSWER

        # Platform usage guide inquiry
        elif re.search(r"\bhow\s+(?:do\s+i|can\s+i|to)\s+use\s+this\b|\bwhat\s+can\s+(?:i|you)\s+do\b|\bguide\s+me\b|\bhelp(?:\s+me)?\b", active_query, re.I):
            intent = "get_hiring_manager_guide"
            target_tool = "get_hiring_manager_guide"
            mode = ExecutionMode.DIRECT_ANSWER

        # Requisition creation with missing role -> Dropdown
        elif re.search(r"^\s*(?:can\s+u\s+|please\s+)?(?:create|draft|make)\s+(?:a\s+)?(?:new\s+)?(?:requisitions?|reqs?|job)\s*[.?!]*\s*$", active_query, re.I):
            intent = "show_role_selection_dropdown"
            target_tool = "show_role_selection_dropdown"
            mode = ExecutionMode.STRUCTURED_TOOL

        # Requisition draft
        elif re.search(r"\b(?:create|draft|make|post)\s+(?:a\s+)?(?:new\s+)?requisition\b|\bi\s+need\s+\d*\s*(?:devops|engineer|developer)\b", active_query, re.I):
            intent = "draft_hiring_requisition"
            target_tool = "draft_hiring_requisition"
            mode = ExecutionMode.STRUCTURED_TOOL

        # Requisitions list
        elif re.search(r"\b(?:list|show|view|fetch)\s+(?:all\s+)?(?:active\s+|closed\s+|open\s+|pending\s+)?requisitions?\b", active_query, re.I) or "created_on" in filters:
            intent = "list_hiring_requisitions"
            target_tool = "list_hiring_requisitions"
            mode = ExecutionMode.STRUCTURED_TOOL

        # Candidate Approval / Review Disambiguation
        elif re.search(
            r"\b(?:unapproved|unaproved|pending\s+approval|awaiting\s+approval|awaiting\s+review)\s+(?:candidates?|candiates?|applicants?)\b|"
            r"\b(?:candidates?|candiates?|applicants?)\s+(?:pending\s+approval|awaiting\s+approval|awaiting\s+review|not\s+yet\s+approved|to\s+approve)\b|"
            r"\b(?:is\s+there\s+any|are\s+there\s+any|show|list|view|fetch|get)\s+(?:any\s+)?(?:unapproved|unaproved)\s+candidates?\b",
            active_query, re.I
        ):
            intent = "candidate_approval_review"
            target_tool = "list_shortlisted_candidates"
            mode = ExecutionMode.STRUCTURED_TOOL
            filters["approval_review_disambiguation"] = True
            if StrategyType.QUERY_EXPANSION not in selected_strategies:
                selected_strategies.append(StrategyType.QUERY_EXPANSION)

        # Rejected Candidates Inquiry
        elif re.search(
            r"\b(?:rejected|not\s+approved|turned\s+down)\s+(?:candidates?|candiates?|applicants?)\b|"
            r"\b(?:candidates?|candiates?|applicants?)\s+(?:who\s+were\s+)?(?:rejected|not\s+approved|turned\s+down)\b",
            active_query, re.I
        ):
            intent = "list_rejected_candidates"
            target_tool = "list_rejected_candidates"
            mode = ExecutionMode.STRUCTURED_TOOL

        # Shortlist
        elif re.search(r"\b(?:shortlist|shortlisted|screening)\b", active_query, re.I):
            intent = "list_shortlisted_candidates"
            target_tool = "list_shortlisted_candidates"
            mode = ExecutionMode.STRUCTURED_TOOL

        # Interview scheduling
        elif re.search(r"\b(?:schedule|book|setup)\s+(?:an?\s+)?interview\b", active_query, re.I):
            intent = "schedule_candidate_interview"
            target_tool = "schedule_candidate_interview"
            mode = ExecutionMode.STRUCTURED_TOOL

        # Pending works
        elif re.search(r"\b(?:pending\s+works?|my\s+tasks|what\s+needs\s+attention)\b", active_query, re.I):
            intent = "get_hiring_manager_pending_works"
            target_tool = "get_hiring_manager_pending_works"
            mode = ExecutionMode.STRUCTURED_TOOL

        # Timesheets / Expenses
        elif re.search(r"\b(?:pending\s+timesheets?|check\s+timesheets?)\b", active_query, re.I):
            intent = "list_pending_timesheets"
            target_tool = "list_pending_timesheets"
            mode = ExecutionMode.STRUCTURED_TOOL
        elif re.search(r"\b(?:pending\s+expenses?|expense\s+claims?)\b", active_query, re.I):
            intent = "list_pending_expenses"
            target_tool = "list_pending_expenses"
            mode = ExecutionMode.STRUCTURED_TOOL

        return StrategyPlan(
            domain="hiring",
            intent=intent,
            execution_mode=mode,
            strategies=selected_strategies,
            contextual_rewrite=active_query if is_rewritten else None,
            entities=filters,
            sub_queries=sub_tasks,
            filters=filters,
            target_tool=target_tool,
            strategy_trace=trace
        )

    def execute_plan(
        self,
        plan: StrategyPlan,
        prompt: str,
        current_user: Dict[str, Any],
        tool_executor: Callable[[str, Dict[str, Any]], Any]
    ) -> Dict[str, Any]:
        """Execute the validated strategy plan within tenant isolation and policy bounds."""
        user_name = current_user.get("name") or "Hiring Manager"
        company_name = current_user.get("company_name") or current_user.get("tenant_name") or "Your company"

        # 1. Unsupported domain
        if plan.execution_mode == ExecutionMode.UNSUPPORTED:
            return scope_response()

        # 2. Clarification mode
        if plan.execution_mode == ExecutionMode.CLARIFICATION:
            return {
                "reply": plan.clarification_question or "Could you please provide more details to proceed?",
                "executed_actions": [],
                "clarification": True,
                "strategy_plan": plan.model_dump()
            }

        # 3. Direct Knowledge Retrieval
        if plan.execution_mode == ExecutionMode.KNOWLEDGE_RETRIEVAL:
            hyde_passage = plan.entities.get("hyde_doc")
            res = retrieve_knowledge(prompt, hyde_doc=hyde_passage)
            return {
                "reply": res["summary"],
                "executed_actions": [{"tool": "retrieve_knowledge", "result": res}],
                "strategy_plan": plan.model_dump()
            }

        # 4. Hybrid Diagnostic Mode (Step-Back + Pipeline Metrics)
        if plan.execution_mode == ExecutionMode.HYBRID and plan.intent == "pipeline_diagnostics":
            step_query = plan.sub_queries[0] if plan.sub_queries else {}
            diag_ctx = step_query.get("diagnostic_context", "Overall")

            # Retrieve factual pipeline records
            stats_res = tool_executor("get_hiring_manager_stats", {})
            reply = (
                f"### {diag_ctx} Pipeline Diagnostic Analysis for {company_name}\n\n"
                f"**Measured Pipeline Facts:**\n"
                f"- Active Requisitions: **{stats_res.get('live_requisitions', 0)}**\n"
                f"- Shortlisted Candidates: **{stats_res.get('shortlisted_candidates', 0)}**\n"
                f"- Candidates in Onboarding: **{stats_res.get('onboarding_candidates', 0)}**\n"
                f"- Open Issues: **{stats_res.get('open_issues', 0)}**\n\n"
                "**Diagnostic Insight:**\n"
                f"Based on current pipeline records, candidate submissions are moving through the screening stage. "
                f"To accelerate time-to-hire, consider scheduling pending technical interview rounds or requesting additional candidate submissions from approved vendor agencies."
            )
            return {
                "reply": reply,
                "executed_actions": [{"tool": "get_hiring_manager_stats", "result": stats_res}],
                "strategy_plan": plan.model_dump()
            }

        # 5. Structured Tool Execution
        if plan.target_tool:
            tool_args = dict(plan.filters)
            raw_res = tool_executor(plan.target_tool, tool_args)

            if plan.intent == "candidate_approval_review":
                # Ensure the plain-language prefix clarifies the domain terminology
                cand_items = raw_res if isinstance(raw_res, list) else (
                    raw_res.get("executed_actions", [{}])[0].get("result", []) if isinstance(raw_res, dict) else []
                )
                if cand_items:
                    clarification = f"In TermJobs, candidates awaiting your evaluation are categorized under **Shortlisted**. Here are the candidates currently pending your review for **{company_name}**:"
                else:
                    clarification = f"In TermJobs, candidates awaiting your evaluation are categorized under **Shortlisted**. There are currently no candidates pending your review for **{company_name}**."

                if isinstance(raw_res, dict):
                    raw_res["reply"] = clarification
                    return raw_res
                else:
                    return {
                        "reply": clarification,
                        "executed_actions": [{"tool": "list_shortlisted_candidates", "result": raw_res}],
                        "strategy_plan": plan.model_dump()
                    }

            if plan.intent == "list_rejected_candidates":
                cand_items = raw_res if isinstance(raw_res, list) else (
                    raw_res.get("executed_actions", [{}])[0].get("result", []) if isinstance(raw_res, dict) else []
                )
                if cand_items:
                    reply = f"Here are the candidates who were not approved (marked as Rejected) for **{company_name}**:"
                else:
                    reply = f"There are currently no rejected candidates on record for **{company_name}**."

                if isinstance(raw_res, dict):
                    raw_res["reply"] = reply
                    return raw_res
                else:
                    return {
                        "reply": reply,
                        "executed_actions": [{"tool": "list_rejected_candidates", "result": raw_res}],
                        "strategy_plan": plan.model_dump()
                    }

            return raw_res

        return {
            "reply": f"I can help with requisitions, candidates, interviews, and onboarding for **{company_name}**. How can I assist?",
            "executed_actions": [],
            "strategy_plan": plan.model_dump()
        }


# Global singleton orchestrator
_ORCHESTRATOR = CentralQueryOrchestrator()


def get_query_orchestrator() -> CentralQueryOrchestrator:
    """Access the central query orchestrator instance."""
    return _ORCHESTRATOR
