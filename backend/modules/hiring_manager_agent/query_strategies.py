"""Reusable Query Understanding Strategies for TermJobs.

Implements:
1. Contextual Rewrite
2. Query Decomposition
3. Query and Terminology Expansion
4. Multi-Query Retrieval
5. HyDE Retrieval
6. Step-Back Reasoning
7. Structured Query Translation & Filter Validation
"""
import re
import time
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from .query_models import (
    ConversationSlotState,
    StrategyExecutionRecord,
    StrategyType,
)

# Common technical acronyms in modern software hiring
TECH_ACRONYM_MAP = {
    "sre": "Site Reliability Engineer",
    "k8s": "Kubernetes",
    "qa": "Quality Assurance",
    "ml": "Machine Learning",
    "ai": "Artificial Intelligence",
    "fe": "Frontend Developer",
    "be": "Backend Developer",
    "devops": "DevOps Engineer",
    "devsecops": "DevSecOps Engineer",
    "ui/ux": "UI/UX Designer",
    "nlp": "Natural Language Processing",
    "dba": "Database Administrator",
}

SQL_INJECTION_PATTERN = re.compile(
    r"\b(select\s+.+\s+from|drop\s+table|delete\s+from|insert\s+into|union\s+select|update\s+.+\s+set|--|;|\bor\s+1\s*=\s*1\b|\band\s+1\s*=\s*1\b)\b",
    re.I
)


def rewrite_query(
    prompt: str,
    history: Optional[List[Dict[str, Any]]] = None,
    slot_state: Optional[ConversationSlotState] = None
) -> Tuple[str, bool, Optional[str], StrategyExecutionRecord]:
    """Strategy A: Contextual Rewrite.

    Resolves incomplete follow-up queries using conversation history and slot memory.
    Returns: (rewritten_prompt, is_rewritten, clarification_needed, record)
    """
    t0 = time.monotonic()
    history = history or []
    slot = slot_state or ConversationSlotState()
    text = prompt.strip()

    # Deictic references or incomplete modifier patterns
    is_followup = bool(re.search(
        r"\b(previous\s+one|the\s+last\s+one|that\s+one|same\s+role|its?\s+(?:openings?|headcount|skills?|budget|location|status)|"
        r"make\s+that\s+\d+|change\s+(?:it|openings?|headcount)\s+to\s+\d+|from\s+yesterday|how\s+about\s+(?:that|him|her|them)|"
        r"those\s+candidates?|what\s+about\s+(?:the\s+previous|that|him|her))\b",
        text, re.I
    ))

    # Also check short fragment follow-ups
    short_numeric_change = re.match(r"^(?:make\s+that\s+|set\s+to\s+|change\s+to\s+)?(\d+)(?:\s+openings?)?$", text, re.I)

    if not is_followup and not short_numeric_change:
        # Check if query already has a complete verb and subject
        rec = StrategyExecutionRecord(
            strategy=StrategyType.CONTEXTUAL_REWRITE,
            status="skipped",
            reason="Query is already standalone and contains no ambiguous references",
            input_data={"prompt": prompt},
            output_data={"rewritten": prompt},
            duration_ms=(time.monotonic() - t0) * 1000
        )
        return prompt, False, None, rec

    # Extract historical subject candidates/requisitions
    recent_role = slot.active_requisition_title or (slot.recent_roles[-1] if slot.recent_roles else None)
    recent_cand = slot.active_candidate_name or (slot.recent_candidates[-1] if slot.recent_candidates else None)
    recent_req_id = slot.active_requisition_id

    # Fallback to inspecting history turns directly if slot memory is blank
    if not recent_role and not recent_cand:
        for turn in reversed(history):
            content = str(turn.get("content") or turn.get("text") or "")
            role_m = re.search(r"\b([A-Z][a-zA-Z0-9\s/+#-]+(?:\s+Developer|\s+Engineer|\s+Architect|\s+Designer|\s+Manager))\b", content)
            if role_m and not recent_role:
                recent_role = role_m.group(1).strip()
            cand_m = re.search(r"\b(?:candidate|interview\s+with|for)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b", content)
            if cand_m and not recent_cand:
                recent_cand = cand_m.group(1).strip()
            if recent_role or recent_cand:
                break

    # If reference cannot be resolved reliably, flag for clarification
    if not recent_role and not recent_cand and not recent_req_id:
        rec = StrategyExecutionRecord(
            strategy=StrategyType.CONTEXTUAL_REWRITE,
            status="failed",
            reason="Ambiguous reference in follow-up could not be resolved from history",
            input_data={"prompt": prompt},
            duration_ms=(time.monotonic() - t0) * 1000
        )
        return (
            prompt,
            False,
            "Could you clarify which requisition or candidate you are referring to?",
            rec
        )

    # Perform rewrite
    rewritten = text
    if short_numeric_change and recent_role:
        new_count = short_numeric_change.group(1)
        rewritten = f"Update the requisition for {recent_role} to {new_count} openings"
    elif (m_make := re.search(r"\bmake\s+that\s+(\d+)\b", text, re.I)) and recent_role:
        count_val = m_make.group(1)
        rewritten = f"Update the requisition for {recent_role} to {count_val} openings"
    elif (m_change := re.search(r"\bchange\s+its\s+openings\s+to\s+(\d+)\b", text, re.I)) and recent_role:
        count_val = m_change.group(1)
        rewritten = f"Update the requisition for {recent_role} to {count_val} openings"
    elif re.search(r"\bprevious\s+one\b|\bthat\s+one\b", text, re.I) and recent_role:
        rewritten = re.sub(r"\b(the\s+)?(previous\s+one|that\s+one)\b", f"the {recent_role} requisition", rewritten, flags=re.I)
    elif re.search(r"\bhow\s+about\s+(?:him|her|them)\b", text, re.I) and recent_cand:
        rewritten = f"Show profile details and interview status for {recent_cand}"

    rec = StrategyExecutionRecord(
        strategy=StrategyType.CONTEXTUAL_REWRITE,
        status="executed",
        reason="Resolved anaphoric / follow-up reference to active context",
        input_data={"original": prompt, "active_role": recent_role, "active_candidate": recent_cand},
        output_data={"rewritten": rewritten},
        duration_ms=(time.monotonic() - t0) * 1000
    )
    return rewritten, True, None, rec


def decompose_query(prompt: str) -> Tuple[List[Dict[str, Any]], StrategyExecutionRecord]:
    """Strategy B: Query Decomposition.

    Breaks complex multi-part queries into smaller executable operations with dependency tracking.
    """
    t0 = time.monotonic()
    text = prompt.strip()

    # Look for compound conjunctions connecting distinct actionable verbs
    # e.g., "Show candidates for DevOps and compare their experience and schedule interview with Arjun"
    action_keywords = [
        (r"\b(show|list|view|fetch)\s+(?:the\s+)?(?:shortlisted\s+)?candidates?\b", "list_shortlisted_candidates"),
        (r"\b(compare|contrast)\s+(?:them|their\s+experience|candidates?)\b", "compare_shortlisted_candidates"),
        (r"\b(schedule|book|setup)\s+(?:an?\s+)?interview\b", "schedule_candidate_interview"),
        (r"\b(draft|create|make)\s+(?:a\s+)?requisition\b", "draft_hiring_requisition"),
        (r"\b(show|list)\s+(?:active\s+)?requisitions?\b", "list_hiring_requisitions"),
        (r"\b(approve|review)\s+timesheets?\b", "list_pending_timesheets"),
    ]

    matched_subtasks = []
    for pattern, tool_name in action_keywords:
        m = re.search(pattern, text, re.I)
        if m:
            matched_subtasks.append({
                "tool": tool_name,
                "span": m.span(),
                "action": m.group(0)
            })

    # Sort subtasks by appearance order
    matched_subtasks.sort(key=lambda x: x["span"][0])

    if len(matched_subtasks) <= 1:
        rec = StrategyExecutionRecord(
            strategy=StrategyType.QUERY_DECOMPOSITION,
            status="skipped",
            reason="Query is a single-intent request and does not require decomposition",
            input_data={"prompt": prompt},
            output_data={"tasks": [prompt]},
            duration_ms=(time.monotonic() - t0) * 1000
        )
        return [], rec

    tasks = []
    for idx, st in enumerate(matched_subtasks, 1):
        is_write = st["tool"] in ("schedule_candidate_interview", "draft_hiring_requisition", "approve_contractor_timesheet")
        tasks.append({
            "task_id": idx,
            "tool": st["tool"],
            "description": st["action"],
            "execution_order": idx,
            "type": "mutation" if is_write else "query",
            "depends_on": idx - 1 if idx > 1 else None
        })

    rec = StrategyExecutionRecord(
        strategy=StrategyType.QUERY_DECOMPOSITION,
        status="executed",
        reason=f"Decomposed multi-part query into {len(tasks)} distinct tasks",
        input_data={"prompt": prompt},
        output_data={"tasks": tasks},
        duration_ms=(time.monotonic() - t0) * 1000
    )
    return tasks, rec


def expand_query(prompt: str, intent: Optional[str] = None) -> Tuple[Dict[str, Any], StrategyExecutionRecord]:
    """Strategy C: Query and Terminology Expansion.

    Expands domain abbreviations and acronyms (e.g. SRE -> Site Reliability Engineer)
    without replacing user's explicit keywords or mutating exact identifiers/numbers.
    """
    t0 = time.monotonic()
    text = prompt.strip()

    # Skip expansion for exact date, numeric, or status filter queries
    if re.search(r"\b\d{4}-\d{2}-\d{2}\b|\b(?:today|yesterday|status:\s*\w+)\b", text, re.I):
        rec = StrategyExecutionRecord(
            strategy=StrategyType.QUERY_EXPANSION,
            status="skipped",
            reason="Exact date/status filter queries skip terminology expansion",
            input_data={"prompt": prompt},
            output_data={"expanded_terms": []},
            duration_ms=(time.monotonic() - t0) * 1000
        )
        return {"original": prompt, "expanded_terms": [], "expanded_query": prompt}, rec

    expanded_terms = []
    tokens = re.findall(r"\b[A-Za-z0-9/+-]+\b", text)
    for tok in tokens:
        lower_tok = tok.lower()
        if lower_tok in TECH_ACRONYM_MAP:
            expanded = TECH_ACRONYM_MAP[lower_tok]
            expanded_terms.append({
                "acronym": tok,
                "expansion": expanded
            })

    # Domain terminology mapping for candidate evaluation / approval
    domain_mappings = []
    cand_approval_pattern = (
        r"\b(?:is\s+there\s+any|are\s+there\s+any|show\s+me|show|list|view|fetch|get|check)?\s*(?:any\s+)?(?:unapproved|unaproved|pending\s+approval|awaiting\s+approval|awaiting\s+review)\s+(?:candidates?|candiates?|applicants?)\b|"
        r"\b(?:candidates?|candiates?|applicants?)\s+(?:pending\s+approval|awaiting\s+approval|awaiting\s+review|not\s+yet\s+approved|to\s+approve)\b"
    )
    m_cand_app = re.search(cand_approval_pattern, text, re.I)
    if m_cand_app:
        domain_mappings.append({
            "term": m_cand_app.group().strip(),
            "expansion": "candidates awaiting evaluation in Shortlist stage",
            "domain_stage": "Shortlist / Screening",
            "clarification": "In TermJobs, candidates awaiting your evaluation are categorized under Shortlisted."
        })

    if not expanded_terms and not domain_mappings:
        rec = StrategyExecutionRecord(
            strategy=StrategyType.QUERY_EXPANSION,
            status="skipped",
            reason="No known technical acronyms or domain abbreviations found in query",
            input_data={"prompt": prompt},
            output_data={"expanded_terms": [], "domain_mappings": []},
            duration_ms=(time.monotonic() - t0) * 1000
        )
        return {"original": prompt, "expanded_terms": [], "domain_mappings": [], "expanded_query": prompt}, rec

    # Create bounded alternate query containing the expanded wording alongside the original
    expanded_query = text
    for item in expanded_terms:
        # e.g., "Find SRE candidates" -> "Find SRE (Site Reliability Engineer) candidates"
        expanded_query = re.sub(
            rf"\b{re.escape(item['acronym'])}\b",
            f"{item['acronym']} ({item['expansion']})",
            expanded_query,
            flags=re.I
        )

    for dm in domain_mappings:
        expanded_terms.append({
            "acronym": dm["term"],
            "expansion": dm["expansion"],
            "domain_stage": dm["domain_stage"]
        })

    reasons = []
    if expanded_terms:
        reasons.append(f"Expanded {len(expanded_terms)} technical acronyms or domain concepts")
    if domain_mappings:
        reasons.append("Mapped candidate approval inquiry to Shortlist stage")

    rec = StrategyExecutionRecord(
        strategy=StrategyType.QUERY_EXPANSION,
        status="executed",
        reason="; ".join(reasons),
        input_data={"prompt": prompt},
        output_data={
            "expanded_terms": expanded_terms,
            "domain_mappings": domain_mappings,
            "expanded_query": expanded_query
        },
        duration_ms=(time.monotonic() - t0) * 1000
    )
    return {
        "original": prompt,
        "expanded_terms": expanded_terms,
        "domain_mappings": domain_mappings,
        "expanded_query": expanded_query
    }, rec


def generate_multi_queries(prompt: str, intent: str, max_queries: int = 3) -> Tuple[List[str], StrategyExecutionRecord]:
    """Strategy D: Multi-Query Retrieval.

    Generates 2-3 semantically complementary query formulations for candidate resume or knowledge search.
    Skips for exact filter/status/date queries.
    """
    t0 = time.monotonic()
    text = prompt.strip()

    # Skip when query is an exact structured filter or date query
    has_exact_filters = bool(re.search(
        r"\b(\d{4}-\d{2}-\d{2}|status|closed|open|active|pending|yesterday|today|count)\b",
        text, re.I
    ))
    if has_exact_filters:
        rec = StrategyExecutionRecord(
            strategy=StrategyType.MULTI_QUERY,
            status="skipped",
            reason="Query already contains exact structured filters or dates; multi-query skipped",
            input_data={"prompt": prompt},
            output_data={"queries": [prompt]},
            duration_ms=(time.monotonic() - t0) * 1000
        )
        return [prompt], rec

    # Only apply to candidate screening / resume searches or knowledge questions
    if not re.search(r"\b(candidate|candidates|resume|skills?|who\s+can|find\s+someone|experience\s+with)\b", text, re.I):
        rec = StrategyExecutionRecord(
            strategy=StrategyType.MULTI_QUERY,
            status="skipped",
            reason="Query is not a semantic candidate search or resume retrieval request",
            input_data={"prompt": prompt},
            output_data={"queries": [prompt]},
            duration_ms=(time.monotonic() - t0) * 1000
        )
        return [prompt], rec

    # Generate 2-3 bounded alternate formulations
    queries = [prompt]
    # Extract key skills or titles
    m_role = re.search(r"\b(?:for|in|find|show)\s+([A-Za-z0-9\s/+#-]+?)(?:\s+role|\s+position|\s+candidates?|$)", text, re.I)
    if m_role:
        target = m_role.group(1).strip()
        queries.append(f"shortlisted candidates with experience in {target}")
        queries.append(f"candidates evaluated for {target} position")

    queries = list(dict.fromkeys(queries))[:max_queries]
    rec = StrategyExecutionRecord(
        strategy=StrategyType.MULTI_QUERY,
        status="executed",
        reason=f"Generated {len(queries)} semantic search formulations for improved recall",
        input_data={"prompt": prompt},
        output_data={"queries": queries},
        duration_ms=(time.monotonic() - t0) * 1000
    )
    return queries, rec


def generate_hyde_doc(prompt: str, topic: str = "policy") -> Tuple[Optional[str], StrategyExecutionRecord]:
    """Strategy E: HyDE Retrieval (Hypothetical Document Embeddings / Knowledge Expansion).

    Generates a hypothetical document representation to improve knowledge retrieval.
    Skips for database/API filtering, dates, counts, and status queries.
    """
    t0 = time.monotonic()
    text = prompt.strip()

    # Skip for SQL/API filtering, exact entity lookups, dates, counts, and status queries
    is_structured = bool(re.search(
        r"\b(active|closed|draft|open|pending|count|\d{4}-\d{2}-\d{2}|today|yesterday|status)\b",
        text, re.I
    ))
    if is_structured:
        rec = StrategyExecutionRecord(
            strategy=StrategyType.HYDE_RETRIEVAL,
            status="skipped",
            reason="Structured filter / date / status query is not suitable for HyDE",
            input_data={"prompt": prompt},
            output_data={"hyde_doc": None},
            duration_ms=(time.monotonic() - t0) * 1000
        )
        return None, rec

    # Check if this is a policy, rule, or guideline inquiry
    is_policy_question = bool(re.search(
        r"\b(policy|policies|guideline|rule|workflow|how\s+does|what\s+is\s+our|director\s+approval|can\s+we\s+hire|full-time|contract\s+only)\b",
        text, re.I
    ))

    if not is_policy_question:
        rec = StrategyExecutionRecord(
            strategy=StrategyType.HYDE_RETRIEVAL,
            status="skipped",
            reason="Query does not target policies or unstructured guidelines",
            input_data={"prompt": prompt},
            output_data={"hyde_doc": None},
            duration_ms=(time.monotonic() - t0) * 1000
        )
        return None, rec

    # Formulate a synthetic hypothetical passage representing an ideal policy answer
    if re.search(r"\b(full-time|permanent|contract|employment)\b", text, re.I):
        hypo = (
            "TermJobs Operating Policy specifies that all hiring engagements must be contract-based. "
            "Permanent or full-time direct positions are not supported. Contract durations are typically 3, 6, or 12 months."
        )
    elif re.search(r"\b(interview|round|rubric|scheduling)\b", text, re.I):
        hypo = (
            "TermJobs Interview Policy outlines a multi-stage evaluation process: initial screening, technical/coding round, "
            "and cultural assessment, with video links automatically generated through Google Calendar integration."
        )
    elif re.search(r"\b(director|approval|publish)\b", text, re.I):
        hypo = (
            "TermJobs Requisition Governance dictates that Hiring Managers cannot directly publish requisitions. "
            "All requisitions must be submitted to the Director for mandatory approval before vendor agencies receive the job."
        )
    else:
        hypo = f"TermJobs Standard Operating Procedures regarding {text}: policy framework, approval rules, and workflows."

    rec = StrategyExecutionRecord(
        strategy=StrategyType.HYDE_RETRIEVAL,
        status="executed",
        reason="Generated hypothetical policy representation to aid knowledge retrieval",
        input_data={"prompt": prompt},
        output_data={"hyde_doc": hypo},
        duration_ms=(time.monotonic() - t0) * 1000
    )
    return hypo, rec


def generate_step_back_query(prompt: str) -> Tuple[Dict[str, Any], StrategyExecutionRecord]:
    """Strategy F: Step-Back Reasoning.

    Identifies higher-level diagnostic inquiries for broad questions (e.g., 'Why is our DevOps hiring pipeline slow?').
    Retrieves measured facts vs hypotheses.
    """
    t0 = time.monotonic()
    text = prompt.strip()

    # Step-back applies to 'why', 'how come', 'root cause', 'slow', 'bottleneck', 'increase' questions
    diagnostic_pattern = r"\b(why\s+(?:is|are|did|were)|what\s+is\s+causing|bottleneck|slow|delays?|increase\s+last\s+month|approval\s+times?)\b"
    if not re.search(diagnostic_pattern, text, re.I):
        rec = StrategyExecutionRecord(
            strategy=StrategyType.STEP_BACK,
            status="skipped",
            reason="Query is not a broad diagnostic question; step-back reasoning skipped",
            input_data={"prompt": prompt},
            duration_ms=(time.monotonic() - t0) * 1000
        )
        return {}, rec

    # Extract high-level systemic inquiry
    role_m = re.search(r"\b([A-Za-z0-9/+-]+(?:\s+DevOps|\s+Backend|\s+Engineer|\s+Developer|\s+Role)?)\s+hiring\b", text, re.I)
    role_ctx = role_m.group(1).strip() if role_m else "Overall"

    step_back = {
        "step_back_question": f"What are the stage conversion rates, pending reviews, and average cycle times for {role_ctx} requisitions?",
        "required_data_sources": ["requisition_metrics", "hiring_pipeline_stats", "pending_works"],
        "diagnostic_context": role_ctx
    }

    rec = StrategyExecutionRecord(
        strategy=StrategyType.STEP_BACK,
        status="executed",
        reason="Identified broader diagnostic context to retrieve underlying metrics and facts",
        input_data={"prompt": prompt},
        output_data=step_back,
        duration_ms=(time.monotonic() - t0) * 1000
    )
    return step_back, rec


def build_structured_filters(prompt: str, timezone_name: str = "Asia/Kolkata") -> Tuple[Dict[str, Any], StrategyExecutionRecord]:
    """Strategy G: Structured Query Translation & Filter Validation.

    Extracts validated structured parameters (status, date range, openings count, role)
    and enforces strict rejection of arbitrary SQL or unsupported filter arguments.
    """
    t0 = time.monotonic()
    text = prompt.strip()

    # 1. Security Check: Reject arbitrary SQL injection attempts
    if SQL_INJECTION_PATTERN.search(text):
        rec = StrategyExecutionRecord(
            strategy=StrategyType.STRUCTURED_FILTER,
            status="failed",
            reason="Blocked suspicious SQL injection pattern in query arguments",
            input_data={"prompt": prompt},
            duration_ms=(time.monotonic() - t0) * 1000
        )
        return {"rejected": True, "error": "Invalid filter characters or SQL syntax detected."}, rec

    filters: Dict[str, Any] = {}

    # 2. Status Extraction
    status_map = {
        "active": "open",
        "open": "open",
        "live": "open",
        "published": "open",
        "closed": "closed",
        "completed": "closed",
        "filled": "closed",
        "draft": "draft",
        "drafts": "draft",
        "pending": "pending",
        "pending approval": "pending",
        "inactive": "inactive"
    }
    for kw, val in status_map.items():
        if re.search(rf"\b{re.escape(kw)}\b", text, re.I):
            filters["status"] = val
            break

    # 3. Timezone-aware date resolution
    try:
        tz = ZoneInfo(timezone_name or "Asia/Kolkata")
    except (ZoneInfoNotFoundError, ValueError, TypeError):
        tz = ZoneInfo("Asia/Kolkata")
    today = datetime.now(timezone.utc).astimezone(tz).date()

    if re.search(r"\byesterday\b", text, re.I):
        filters["created_on"] = (today - timedelta(days=1)).isoformat()
    elif re.search(r"\btoday\b", text, re.I):
        filters["created_on"] = today.isoformat()
    else:
        iso_m = re.search(r"\b(\d{4}-\d{2}-\d{2})\b", text)
        if iso_m:
            try:
                filters["created_on"] = date.fromisoformat(iso_m.group(1)).isoformat()
            except ValueError:
                pass

    # Natural language month/day resolution
    if "created_on" not in filters:
        months = {name: num for num, name in enumerate(
            ('january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'), 1)}
        months.update({name[:3]: num for name, num in list(months.items())})
        month_pattern = '|'.join(months)
        m_match = re.search(rf'\b({month_pattern})\s+(\d{{1,2}})(?:st|nd|rd|th)?(?:,?\s+(\d{{4}}))?\b', text, re.I)
        if m_match:
            try:
                mon_str = m_match.group(1).lower()
                day_int = int(m_match.group(2))
                yr_int = int(m_match.group(3) or today.year)
                filters["created_on"] = date(yr_int, months[mon_str], day_int).isoformat()
            except (ValueError, KeyError):
                pass

    # 4. Numerical Headcount / Openings Extraction
    openings_m = re.search(r"\b(?:(\d+)\s+(?:openings?|headcount|positions?)|(\d+)\s+[a-z]+(?:\s+[a-z]+)?\s+(?:engineers?|developers?))\b", text, re.I)
    if openings_m:
        val = openings_m.group(1) or openings_m.group(2)
        if val:
            filters["openings"] = max(1, int(val))

    # 5. Role Keyword Extraction
    role_kw_m = re.search(r"\b([A-Za-z0-9/+-]+(?:\s+Developer|\s+Engineer|\s+Architect|\s+Designer|\s+Manager))\b", text, re.I)
    if role_kw_m:
        filters["role_title"] = role_kw_m.group(1).strip()

    rec = StrategyExecutionRecord(
        strategy=StrategyType.STRUCTURED_FILTER,
        status="executed",
        reason=f"Extracted {len(filters)} validated filter parameters with timezone {tz.key}",
        input_data={"prompt": prompt, "timezone": tz.key},
        output_data={"filters": filters},
        duration_ms=(time.monotonic() - t0) * 1000
    )
    return filters, rec
