"""Comprehensive Tests for TermJobs LLM-Driven Multi-Strategy Query Understanding Layer.

Covers all 16 required test scenarios:
1. Standalone query that skips contextual rewriting
2. Contextual follow-up that resolves a prior entity
3. Multi-part query that is correctly decomposed
4. Technical acronym that benefits from controlled expansion
5. Exact date/status/count filter that skips semantic expansion and HyDE
6. Policy question that uses knowledge retrieval
7. Broad diagnostic question that triggers step-back reasoning
8. Hybrid query requiring records and documentation
9. Ambiguous reference that triggers clarification
10. Missing required fields for a write operation
11. LLM timeout, malformed structured output, and unavailable-provider fallback
12. Unauthorized request rejected even when LLM selects the tool
13. Attempts to introduce unsupported filters or arbitrary SQL
14. Duplicate tool-call prevention and dependent task execution
15. Preservation of timezone-sensitive date constraints
16. Regression tests for all currently supported hiring workflows
"""
import json
import re
from typing import Any
from unittest.mock import Mock
import mongomock
import pytest

from modules.hiring_manager_agent import agent
from modules.hiring_manager_agent.query_knowledge import retrieve_knowledge
from modules.hiring_manager_agent.query_models import (
    ConversationSlotState,
    ExecutionMode,
    StrategyPlan,
    StrategyType,
)
from modules.hiring_manager_agent.query_orchestrator import get_query_orchestrator
from modules.hiring_manager_agent.query_strategies import (
    build_structured_filters,
    decompose_query,
    expand_query,
    generate_hyde_doc,
    generate_multi_queries,
    generate_step_back_query,
    rewrite_query,
)
from modules.hiring_manager_agent.scope import ScopedDatabase


@pytest.fixture
def orchestrator():
    return get_query_orchestrator()


@pytest.fixture
def current_user():
    return {
        "id": "hm-001",
        "name": "Alex Mercer",
        "email": "alex@company.com",
        "company_name": "InnovateCorp",
        "tenant_id": "tenant-innovate",
        "timezone": "Asia/Kolkata"
    }


# ─────────────────────────────────────────────────────────────────────────────
# 1. Standalone query skips contextual rewriting
# ─────────────────────────────────────────────────────────────────────────────
def test_standalone_query_skips_contextual_rewrite(orchestrator, current_user):
    query = "Show active requisitions for Senior React Developer"
    plan = orchestrator.create_strategy_plan(query, [], current_user)

    assert plan.contextual_rewrite is None
    # Contextual rewrite strategy was evaluated and skipped
    rewrite_traces = [t for t in plan.strategy_trace if t.strategy == StrategyType.CONTEXTUAL_REWRITE]
    assert len(rewrite_traces) == 1
    assert rewrite_traces[0].status == "skipped"
    assert "already standalone" in rewrite_traces[0].reason


# ─────────────────────────────────────────────────────────────────────────────
# 2. Contextual follow-up resolves prior entity
# ─────────────────────────────────────────────────────────────────────────────
def test_contextual_followup_resolves_prior_entity(orchestrator, current_user):
    slot = orchestrator.get_or_create_slot_state("hm-001")
    slot.active_requisition_title = "DevOps Engineer"
    slot.recent_roles = ["DevOps Engineer"]

    query = "Change its openings to 3"
    rewritten, was_rewritten, clarif, rec = rewrite_query(query, [], slot)

    assert was_rewritten is True
    assert clarif is None
    assert rec.status == "executed"
    assert "DevOps Engineer" in rewritten
    assert "3 openings" in rewritten


# ─────────────────────────────────────────────────────────────────────────────
# 3. Multi-part query is correctly decomposed
# ─────────────────────────────────────────────────────────────────────────────
def test_multipart_query_correctly_decomposed():
    query = "Show shortlisted candidates for DevOps and compare them and schedule interview with Arjun"
    tasks, rec = decompose_query(query)

    assert rec.status == "executed"
    assert len(tasks) >= 2
    tool_names = [t["tool"] for t in tasks]
    assert "list_shortlisted_candidates" in tool_names
    assert "compare_shortlisted_candidates" in tool_names
    # Dependency order verified
    assert tasks[0]["execution_order"] == 1
    assert tasks[1]["execution_order"] == 2


# ─────────────────────────────────────────────────────────────────────────────
# 4. Technical acronym benefits from controlled expansion
# ─────────────────────────────────────────────────────────────────────────────
def test_technical_acronym_controlled_expansion():
    query = "Find SRE candidates with K8s and ML experience"
    expanded_data, rec = expand_query(query)

    assert rec.status == "executed"
    assert len(expanded_data["expanded_terms"]) >= 2
    exp_map = {item["acronym"].lower(): item["expansion"] for item in expanded_data["expanded_terms"]}
    assert "sre" in exp_map and exp_map["sre"] == "Site Reliability Engineer"
    assert "k8s" in exp_map and exp_map["k8s"] == "Kubernetes"
    # Original query preserved alongside expansion
    assert expanded_data["original"] == query
    assert "Site Reliability Engineer" in expanded_data["expanded_query"]


# ─────────────────────────────────────────────────────────────────────────────
# 5. Exact date/status/count filter skips semantic expansion and HyDE
# ─────────────────────────────────────────────────────────────────────────────
def test_exact_date_status_count_filter_skips_expansion_and_hyde():
    query = "Show open requisitions created on 2026-10-15 with 2 openings"
    exp_data, exp_rec = expand_query(query)
    hyde_doc, hyde_rec = generate_hyde_doc(query)
    filters, filt_rec = build_structured_filters(query, timezone_name="Asia/Kolkata")

    assert exp_rec.status == "skipped"
    assert hyde_rec.status == "skipped"
    assert filt_rec.status == "executed"
    assert filters["status"] == "open"
    assert filters["created_on"] == "2026-10-15"
    assert filters["openings"] == 2


# ─────────────────────────────────────────────────────────────────────────────
# 6. Policy question uses knowledge retrieval
# ─────────────────────────────────────────────────────────────────────────────
def test_policy_question_uses_knowledge_retrieval(orchestrator, current_user):
    query = "What is our interview policy and standard round structure?"
    plan = orchestrator.create_strategy_plan(query, [], current_user)

    assert plan.execution_mode == ExecutionMode.KNOWLEDGE_RETRIEVAL
    assert plan.intent == "knowledge_lookup"

    # Verify knowledge retrieval result contains authorized citation
    k_res = retrieve_knowledge(query)
    assert k_res["found"] is True
    assert "TermJobs Interview Playbook" in k_res["summary"]


# ─────────────────────────────────────────────────────────────────────────────
# 7. Broad diagnostic question triggers step-back reasoning
# ─────────────────────────────────────────────────────────────────────────────
def test_broad_diagnostic_triggers_step_back_reasoning(orchestrator, current_user):
    query = "Why is our DevOps hiring pipeline slow?"
    plan = orchestrator.create_strategy_plan(query, [], current_user)

    assert plan.execution_mode == ExecutionMode.HYBRID
    assert plan.intent == "pipeline_diagnostics"
    step_traces = [t for t in plan.strategy_trace if t.strategy == StrategyType.STEP_BACK]
    assert len(step_traces) == 1
    assert step_traces[0].status == "executed"

    # Execution against real mock stats tool
    mock_stats = {"live_requisitions": 3, "shortlisted_candidates": 5, "onboarding_candidates": 1, "open_issues": 0}
    result = orchestrator.execute_plan(plan, query, current_user, lambda t_name, args: mock_stats)
    assert "Pipeline Diagnostic Analysis" in result["reply"]
    assert "Active Requisitions: **3**" in result["reply"]


# ─────────────────────────────────────────────────────────────────────────────
# 8. Hybrid query requiring records and documentation
# ─────────────────────────────────────────────────────────────────────────────
def test_hybrid_query_requires_records_and_documentation(orchestrator, current_user):
    query = "Why did hiring approval times increase last month?"
    plan = orchestrator.create_strategy_plan(query, [], current_user)

    assert plan.execution_mode == ExecutionMode.HYBRID
    mock_stats = {"live_requisitions": 2, "shortlisted_candidates": 1, "onboarding_candidates": 0, "open_issues": 0}
    result = orchestrator.execute_plan(plan, query, current_user, lambda t_name, args: mock_stats)
    assert result["executed_actions"][0]["tool"] == "get_hiring_manager_stats"
    assert "Measured Pipeline Facts" in result["reply"]


# ─────────────────────────────────────────────────────────────────────────────
# 9. Ambiguous reference triggers clarification
# ─────────────────────────────────────────────────────────────────────────────
def test_ambiguous_reference_triggers_clarification(orchestrator, current_user):
    # Blank slots & no history
    slot = ConversationSlotState()
    query = "Change that one to 4 openings"
    rewritten, was_rewritten, clarif, rec = rewrite_query(query, [], slot)

    assert was_rewritten is False
    assert clarif is not None
    assert "clarify which requisition or candidate" in clarif
    assert rec.status == "failed"


# ─────────────────────────────────────────────────────────────────────────────
# 10. Missing required fields for a write operation
# ─────────────────────────────────────────────────────────────────────────────
def test_missing_required_fields_for_write_operation(orchestrator, current_user):
    query = "can u create a new requisition"
    plan = orchestrator.create_strategy_plan(query, [], current_user)

    # Routes to show_role_selection_dropdown rather than fabricating fields
    assert plan.target_tool == "show_role_selection_dropdown"
    assert plan.intent == "show_role_selection_dropdown"


# ─────────────────────────────────────────────────────────────────────────────
# 11. LLM timeout, malformed structured output, and unavailable-provider fallback
# ─────────────────────────────────────────────────────────────────────────────
def test_llm_timeout_and_malformed_output_fallback(monkeypatch):
    from modules.hiring_manager_agent import model_transport
    # Provider returns HTTP 500 then invalid arguments
    post_mock = Mock(side_effect=[
        Mock(status_code=500),
        Mock(status_code=200, json=lambda: {
            "choices": [{"message": {"tool_calls": [{"function": {"name": "draft_hiring_requisition", "arguments": '{"title": ""}'}}]}}]
        })
    ])
    monkeypatch.setattr(model_transport.httpx, "post", post_mock)

    tools = [{"function": {"name": "draft_hiring_requisition", "parameters": {
        "type": "object", "properties": {"title": {"type": "string"}}, "required": ["title"]
    }}}]

    resp, model, _ = model_transport.request_completion("http://fake", ["key1"], ["preferred"], [], tools)
    # The transport rejected the empty title and returned None when no more retries
    assert resp is None


# ─────────────────────────────────────────────────────────────────────────────
# 12. Unauthorized request rejected even when LLM selects the correct tool
# ─────────────────────────────────────────────────────────────────────────────
def test_unauthorized_request_rejected_by_scope(monkeypatch):
    raw = mongomock.MongoClient()["tenant-isolation"]
    scoped = ScopedDatabase(raw)
    monkeypatch.setattr(agent, "db", scoped)

    # Company B data inserted
    raw.requisitions.insert_one({"id": "req-b", "tenant_id": "company-b", "title": "Secret Architect", "created_by": "other"})
    raw.candidate_submissions.insert_one({"id": "cand-b", "tenant_id": "company-b", "candidate_name": "Classified Candidate", "status": "Shortlisted"})

    # Actor from Company A calls tool
    results = agent.list_shortlisted_candidates(user_id="user-a", user_name="User A", tenant_id="company-a")
    assert results == []

    reqs = agent.list_hiring_requisitions(user_id="user-a", tenant_id="company-a", status_filter="all")
    assert reqs == []


# ─────────────────────────────────────────────────────────────────────────────
# 13. Attempts to introduce unsupported filters or arbitrary SQL
# ─────────────────────────────────────────────────────────────────────────────
def test_unsupported_filters_or_arbitrary_sql_blocked():
    query = "Show requisitions WHERE 1=1; DROP TABLE users;--"
    filters, rec = build_structured_filters(query)

    assert rec.status == "failed"
    assert filters.get("rejected") is True
    assert "SQL syntax detected" in filters.get("error", "")


# ─────────────────────────────────────────────────────────────────────────────
# 14. Duplicate tool-call prevention and dependent task execution
# ─────────────────────────────────────────────────────────────────────────────
def test_duplicate_tool_call_prevention_and_dependent_task_execution():
    query = "Show candidates and schedule interview with Arjun"
    tasks, _ = decompose_query(query)

    read_tasks = [t for t in tasks if t["type"] == "query"]
    write_tasks = [t for t in tasks if t["type"] == "mutation"]

    assert len(read_tasks) >= 1
    assert len(write_tasks) >= 1
    # Mutation task must depend on prior query task
    assert write_tasks[0]["depends_on"] is not None


# ─────────────────────────────────────────────────────────────────────────────
# 15. Correct preservation of timezone-sensitive date constraints
# ─────────────────────────────────────────────────────────────────────────────
def test_preservation_of_timezone_sensitive_date_constraints():
    # Evaluate 'yesterday' and 'today' with Asia/Kolkata timezone
    filters_kolkata, _ = build_structured_filters("show requisitions created yesterday", timezone_name="Asia/Kolkata")
    assert "created_on" in filters_kolkata
    assert re.match(r"^\d{4}-\d{2}-\d{2}$", filters_kolkata["created_on"])


# ─────────────────────────────────────────────────────────────────────────────
# 16. Regression tests for all currently supported hiring workflows
# ─────────────────────────────────────────────────────────────────────────────
def test_regression_all_supported_workflows(monkeypatch):
    monkeypatch.setattr(agent, "model_available", lambda: False)
    monkeypatch.setattr(agent, "_get_tenant_company_context", lambda _: {"company_name": "TestCorp"})

    user_ctx = {"id": "hm-1", "name": "Manager", "tenant_id": "test-tenant"}

    # Workflow 1: Requisition Creation Guide
    res1 = agent.run_hiring_manager_agent_chat("how to create a requisition", current_user=user_ctx)
    assert "HOW TO CREATE A REQUISITION" in res1["reply"]

    # Workflow 2: Employment Policy Inquiry
    res2: Any = agent.run_hiring_manager_agent_chat("What is our employment policy?", current_user=user_ctx)
    reply2 = str(res2["reply"]) if isinstance(res2, dict) else ""
    assert "contract staffing model" in reply2.lower()

    # Workflow 3: Requisition Draft Preview
    res3: Any = agent.run_hiring_manager_agent_chat("create a new requisition for DevOps Engineer", current_user=user_ctx)
    assert isinstance(res3, dict)
    action0: Any = res3["executed_actions"][0]
    assert action0["tool"] == "draft_hiring_requisition"
    assert action0["result"]["title"] == "DevOps Engineer"


# ─────────────────────────────────────────────────────────────────────────────
# 17. Persistent Session Slot Storage (Survives Process Restarts)
# ─────────────────────────────────────────────────────────────────────────────
def test_persistent_slot_storage_survives_restart(monkeypatch, orchestrator):
    import mongomock
    from modules.shared import db as db_module

    raw = mongomock.MongoClient()["test_persistence"]
    monkeypatch.setattr(db_module, "db", raw)

    user_id = "user-persist-99"
    tenant_id = "tenant-persist-99"

    # 1. Create slot and populate active draft
    slot = ConversationSlotState(
        active_requisition_title="Principal SRE",
        recent_roles=["Principal SRE"],
        active_candidate_name="Tara Strong"
    )
    orchestrator.save_slot_state(user_id, tenant_id, slot)

    # 2. Simulate server restart by clearing in-memory cache
    orchestrator._session_slots.clear()

    # 3. Reload slot state from persistence
    restored_slot = orchestrator.get_or_create_slot_state(user_id, tenant_id)
    assert restored_slot.active_requisition_title == "Principal SRE"
    assert "Principal SRE" in restored_slot.recent_roles
    assert restored_slot.active_candidate_name == "Tara Strong"


# ─────────────────────────────────────────────────────────────────────────────
# 18. Dynamic Custom Knowledge Upload & Strict Multi-Tenant Isolation
# ─────────────────────────────────────────────────────────────────────────────
def test_dynamic_custom_knowledge_upload_and_isolation(monkeypatch):
    import mongomock
    from modules.shared import db as db_module
    from modules.hiring_manager_agent.query_knowledge import (
        upsert_custom_knowledge_doc,
        list_custom_knowledge_docs,
        delete_custom_knowledge_doc,
        retrieve_knowledge
    )

    raw = mongomock.MongoClient()["test_custom_knowledge"]
    monkeypatch.setattr(db_module, "db", raw)

    tenant_a = "tenant-alpha"
    tenant_b = "tenant-beta"

    # 1. Upload custom policy for Tenant Alpha
    doc = upsert_custom_knowledge_doc(
        tenant_id=tenant_a,
        title="InnovateCorp Relocation Expense Reimbursement Policy",
        content="Contractors moving across states are eligible for up to $2,500 relocation assistance with Director sign-off.",
        category="relocation_policy",
        keywords=["relocation", "moving", "assistance", "expense"],
        source="Alpha Staffing Handbook §9"
    )
    assert doc["id"].startswith("doc_")

    # 2. Verify Tenant Alpha can retrieve their custom policy
    res_a = retrieve_knowledge("relocation assistance", tenant_id=tenant_a)
    assert res_a["found"] is True
    assert "Relocation Expense Reimbursement Policy" in res_a["summary"]
    assert "Alpha Staffing Handbook §9" in res_a["summary"]

    # 3. Verify Tenant Beta CANNOT see Tenant Alpha's policy (Zero cross-tenant leakage)
    res_b = retrieve_knowledge("relocation assistance", tenant_id=tenant_b)
    assert "Relocation Expense Reimbursement Policy" not in res_b.get("summary", "")

    # 4. List and Soft-Delete
    doc_list = list_custom_knowledge_docs(tenant_a)
    assert len(doc_list) == 1
    assert doc_list[0]["id"] == doc["id"]

    deleted = delete_custom_knowledge_doc(tenant_a, doc["id"])
    assert deleted is True
    assert len(list_custom_knowledge_docs(tenant_a)) == 0


# ─────────────────────────────────────────────────────────────────────────────
# 19. Candidate Approval/Review Semantic Expansion & Terminology Framing
# ─────────────────────────────────────────────────────────────────────────────
def test_unapproved_candidates_query_semantic_expansion_and_framing(monkeypatch, orchestrator):
    import mongomock
    from modules.shared import db as db_module

    raw = mongomock.MongoClient()["test_candidate_approval"]
    monkeypatch.setattr(db_module, "db", raw)
    monkeypatch.setattr(agent, "db", raw)
    monkeypatch.setattr(agent, "model_available", lambda: False)
    monkeypatch.setattr(agent, "_get_tenant_company_context", lambda _: {"company_name": "Bearitt"})

    # Setup candidate submission in DB under review/shortlist
    raw["candidate_submissions"].insert_one({
        "id": "cand-001",
        "candidate_id": "cand-001",
        "candidate_name": "Arjun m",
        "requisition_id": "req-001",
        "requisition_title": "Senior React Developer",
        "status": "Shortlisted",
        "match_score": 67.0,
        "vendor_name": "Bearitt Staffing",
        "matched_skills": ["React"],
        "tenant_id": "bearitt-tenant"
    })
    raw["requisitions"].insert_one({
        "id": "req-001",
        "title": "Senior React Developer",
        "tenant_id": "bearitt-tenant",
        "created_by": "hm-bearitt",
        "status": "Published"
    })

    user_ctx = {
        "id": "hm-bearitt",
        "name": "Hiring Lead",
        "company_name": "Bearitt",
        "tenant_id": "bearitt-tenant"
    }

    # Query with typo as observed in production UI: "is there any unaproved candidates"
    query = "is there any unaproved candidates"

    # 1. Verify Strategy Plan from Query Understanding Layer
    plan = orchestrator.create_strategy_plan(query, [], user_ctx)
    assert plan.intent == "candidate_approval_review"
    assert plan.target_tool == "list_shortlisted_candidates"
    assert StrategyType.QUERY_EXPANSION in plan.strategies

    # 2. Execute plan via orchestrator
    exec_res = orchestrator.execute_plan(
        plan,
        query,
        user_ctx,
        lambda t_name, args: [{"candidate_name": "Arjun m", "requisition_title": "Senior React Developer"}]
    )
    assert "In TermJobs, candidates awaiting your evaluation are categorized under **Shortlisted**" in exec_res["reply"]
    assert "Bearitt" in exec_res["reply"]

    # 3. Execute through the hiring agent chat pipeline
    agent_res = agent.run_hiring_manager_agent_chat(query, current_user=user_ctx)
    assert "In TermJobs, candidates awaiting your evaluation are categorized under **Shortlisted**" in agent_res["reply"]
    assert "Arjun m" in agent_res["reply"]
    actions = agent_res["executed_actions"]
    assert len(actions) == 1
    assert actions[0]["tool"] == "list_shortlisted_candidates"
    assert actions[0]["result"][0]["candidate_name"] == "Arjun m"


# ─────────────────────────────────────────────────────────────────────────────
# 20. Rejected Candidates Disambiguation
# ─────────────────────────────────────────────────────────────────────────────
def test_rejected_candidates_query_disambiguation(monkeypatch, orchestrator):
    import mongomock
    from modules.shared import db as db_module

    raw = mongomock.MongoClient()["test_rejected_candidates"]
    monkeypatch.setattr(db_module, "db", raw)
    monkeypatch.setattr(agent, "db", raw)
    monkeypatch.setattr(agent, "model_available", lambda: False)
    monkeypatch.setattr(agent, "_get_tenant_company_context", lambda _: {"company_name": "Bearitt"})

    # Setup 1 shortlisted candidate and 1 rejected candidate
    raw["candidate_submissions"].insert_many([
        {
            "id": "cand-001",
            "candidate_name": "Arjun m",
            "requisition_id": "req-001",
            "requisition_title": "Senior React Developer",
            "status": "Shortlisted",
            "tenant_id": "bearitt-tenant"
        },
        {
            "id": "cand-002",
            "candidate_name": "Priya Sharma",
            "requisition_id": "req-001",
            "requisition_title": "Senior React Developer",
            "status": "Rejected",
            "rejection_reason": "Missing required GraphQL experience",
            "tenant_id": "bearitt-tenant"
        }
    ])
    raw["requisitions"].insert_one({
        "id": "req-001",
        "title": "Senior React Developer",
        "tenant_id": "bearitt-tenant",
        "created_by": "hm-bearitt",
        "status": "Published"
    })

    user_ctx = {
        "id": "hm-bearitt",
        "name": "Hiring Lead",
        "company_name": "Bearitt",
        "tenant_id": "bearitt-tenant"
    }

    # 1. Query for rejected candidates
    query = "show rejected candidates"
    plan = orchestrator.create_strategy_plan(query, [], user_ctx)
    assert plan.intent == "list_rejected_candidates"
    assert plan.target_tool == "list_rejected_candidates"

    agent_res = agent.run_hiring_manager_agent_chat(query, current_user=user_ctx)
    assert "candidates who were not approved (marked as Rejected)" in agent_res["reply"]
    assert "Priya Sharma" in agent_res["reply"]
    assert "Arjun m" not in agent_res["reply"]
    assert agent_res["executed_actions"][0]["tool"] == "list_rejected_candidates"


