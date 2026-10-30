"""Legacy fallback remains available when no model is configured."""
from unittest.mock import Mock

import pytest

from modules.hiring_manager_agent import agent


@pytest.fixture(autouse=True)
def offline_fallback(monkeypatch):
    monkeypatch.setattr(agent, 'model_available', lambda: False)
    monkeypatch.setattr(agent, 'is_hiring_request_in_scope', lambda *args: True)
    monkeypatch.setattr(agent, 'run_hiring_manager_agent_chat', agent.run_hiring_manager_agent_chat.__wrapped__)


@pytest.mark.parametrize("prompt", [
    "can you create a new urequsition",
    "CAN YOU CREATE A NEW UREQUSITION?",
    "create a new urequsitions",
    "can you create a new requisition",
    "create a new requsition",
    "draft a req",
])
@pytest.mark.parametrize("has_templates", [True, False])
def test_creation_opens_tenant_role_selection(monkeypatch, prompt, has_templates):
    roles = [{"title": "Backend Engineer"}] if has_templates else []
    lookup = Mock(return_value=roles)
    monkeypatch.setattr(agent, "get_unique_predefined_roles", lookup)
    monkeypatch.setattr(agent, "_get_tenant_company_context", lambda _: {
        "company_name": "Test Company",
    })
    monkeypatch.setattr(agent, "db", Mock(side_effect=AssertionError("Unexpected DB access")))
    monkeypatch.setattr(agent, "settings", Mock(groq_api_key="test-key"))
    monkeypatch.setattr(agent.httpx, "post", Mock(side_effect=AssertionError("Unexpected LLM call")))

    result = agent.run_hiring_manager_agent_chat(
        prompt,
        history=[{"role": "assistant", "content": "How can I assist with hiring?"}],
        current_user={"id": "test-hm", "name": "Test Manager", "tenant_id": "test-tenant"},
    )

    assert result["executed_actions"] == [{
        "tool": "show_role_selection_dropdown", "result": {"roles": roles},
    }]
    assert all(call.args == ("test-tenant",) for call in lookup.call_args_list)
    agent.httpx.post.assert_not_called()


@pytest.mark.parametrize("prompt", [
    "i need a fd engineer",
    "I need a FD enginner",
    "Hire a forward deployed engineer",
])
def test_fd_engineer_request_keeps_forward_deployed_title(prompt):
    result = {
        "reply": "I've drafted the requisition for **Full Stack Development Engineer**.",
        "executed_actions": [{
            "tool": "draft_hiring_requisition",
            "result": {
                "title": "Full Stack Development Engineer",
                "job_description": "Seeking a Full Stack Development Engineer.",
            },
        }],
    }

    normalized = agent.normalize_fd_engineer_request(prompt, result)

    assert normalized["executed_actions"][0]["result"]["title"] == "Forward Deployed Engineer"
    assert normalized["executed_actions"][0]["result"]["job_description"] == "Seeking a Forward Deployed Engineer."
    assert "Forward Deployed Engineer" in normalized["reply"]


def test_fd_normalization_does_not_rewrite_other_roles():
    result = {"executed_actions": [{
        "tool": "draft_hiring_requisition",
        "result": {"title": "Full Stack Engineer"},
    }]}

    assert agent.normalize_fd_engineer_request("I need a full stack engineer", result) is result
    assert result["executed_actions"][0]["result"]["title"] == "Full Stack Engineer"


def test_submission_error_lists_missing_fields_instead_of_claiming_director_submission():
    result = {
        "reply": "The requisition was sent to the Director.",
        "executed_actions": [{
            "tool": "submit_for_director_approval",
            "result": {
                "error": "Complete required details first.",
                "require_director_approval": False,
                "missing_required_fields": ["Hiring model", "Target start date", "Required skills"],
            },
        }],
    }

    normalized = agent.request_missing_requisition_details(result)

    assert "couldn't publish" in normalized["reply"]
    assert "Hiring model, Target start date, Required skills" in normalized["reply"]
    assert "sent to the Director" not in normalized["reply"]


def test_requisition_draft_is_recovered_from_chat_history():
    draft = {"title": "Sales Executive", "skills": ["Negotiation", "CRM"]}
    history = [{
        "role": "assistant",
        "content": f"Review this draft.\nDraft context: {__import__('json').dumps(draft)}",
    }]

    assert agent.requisition_draft_from_history(history) == draft


@pytest.mark.parametrize(("shorthand", "expected"), [
    ("WFO", "On-site"),
    ("work from office", "On-site"),
    ("WFH", "Remote"),
    ("Hybrid", "Hybrid"),
])
def test_requisition_work_mode_shorthand_is_normalized(shorthand, expected):
    assert agent.normalize_requisition_work_mode(shorthand) == expected


@pytest.mark.parametrize(("phrase", "expected"), [
    ("hiring model - direct hiring", "Direct Hiring"),
    ("direct hire", "Direct Hiring"),
    ("vendor-managed", "Vendor Managed"),
])
def test_explicit_staffing_model_is_captured_independently_of_remote_location(phrase, expected):
    assert agent.normalize_requisition_hiring_model(
        "To be confirmed", phrase, "Location: REMOTE"
    ) == expected


def test_work_mode_in_role_summary_does_not_fill_staffing_model_or_replace_city():
    draft = agent.draft_requisition_preview(
        title="Sales Executive",
        department="Sales",
        location="Calicut",
        experience_level="Mid (2-4 yrs)",
        skills="Docker, PostgreSQL",
        job_description="Work 5 days WFO in Calicut.",
        target_start_date="November 2026",
    )

    assert draft["location"] == "Calicut"
    assert draft["hiring_model"] == "To be confirmed"
    assert "Hiring model" in draft["missing_required_fields"]


def test_explicit_hiring_model_is_saved_on_draft_separately_from_remote_work_mode():
    draft = agent.draft_requisition_preview(
        title="Backend Developer",
        department="Engineering",
        location="Remote",
        experience_level="Junior (0-1 years)",
        skills="Node.js, Python",
        hiring_model="direct hiring",
        target_start_date="November 2026",
    )

    assert draft["hiring_model"] == "Direct Hiring"
    assert "Hiring model" not in draft["missing_required_fields"]


def test_direct_hire_followup_updates_active_draft_when_ai_returns_no_tool_action(monkeypatch):
    from modules.hiring_manager_agent import applications

    draft = {
        "title": "QA Tester",
        "department": "Engineering",
        "location": "Remote",
        "experience_level": "Fresher",
        "employment_type": "Contract",
        "hiring_model": "To be confirmed",
        "target_start_date": "November 2026",
        "skills": ["Good ability in testing"],
        "job_description": "Perform functional and regression testing.",
    }
    history = [{
        "role": "assistant",
        "content": (
            "Before this requisition can be published, please provide: Hiring model.\n"
            f"Draft context: {__import__('json').dumps(draft)}"
        ),
    }]
    monkeypatch.setattr(agent, "model_available", lambda: True)
    monkeypatch.setattr(agent, "run_model_hiring_chat", lambda *args: {"reply": "Okay.", "executed_actions": []})
    monkeypatch.setattr(applications, "application_reply", lambda *args: None)

    result = agent.run_hiring_manager_agent_chat(
        "i need direct hire",
        history=history,
        current_user={"id": "test-hm", "tenant_id": "test-tenant"},
    )

    updated = result["executed_actions"][0]["result"]
    assert updated["hiring_model"] == "Direct Hiring"
    assert updated["missing_required_fields"] == []
    assert "Direct Hiring" in result["reply"]


def test_existing_draft_work_mode_does_not_satisfy_staffing_model_requirement():
    draft = {
        "title": "Sales Executive",
        "department": "Sales",
        "location": "Calicut",
        "experience": "Mid (2-4 yrs)",
        "experience_level": "Mid (2-4 yrs)",
        "hiring_model": "To be confirmed",
        "target_start_date": "November 2026",
        "skills": ["Docker", "PostgreSQL", "REST APIs"],
        "summary": "Work five days WFO in Calicut.",
    }
    result = {
        "reply": "Please provide the missing details.",
        "executed_actions": [{"tool": "draft_hiring_requisition", "result": draft}],
    }

    normalized = agent.request_missing_requisition_details(result)

    assert draft["hiring_model"] == "To be confirmed"
    assert draft["missing_required_fields"] == ["Hiring model"]


def test_model_outage_still_applies_answers_to_missing_draft_fields(monkeypatch):
    from modules.hiring_manager_agent import applications

    monkeypatch.setattr(agent, "model_available", lambda: True)
    monkeypatch.setattr(agent, "run_model_hiring_chat", lambda *args: None)
    monkeypatch.setattr(applications, "application_reply", lambda *args: None)
    draft = {
        "title": "DevOps Engineer",
        "department": "Engineering",
        "location": "Calicut",
        "experience_level": "Mid (2-4 yrs)",
        "employment_type": "Contract",
        "hiring_model": "To be confirmed",
        "target_start_date": "November 2026",
        "skills": "To be confirmed",
        "salary_range": "₹1,000 / hr",
        "job_description": "DevOps Engineer contract role.",
    }
    history = [{
        "role": "assistant",
        "content": (
            "To complete the draft, could you confirm the Hiring model and Required skills?\n"
            f"Draft context: {__import__('json').dumps(draft)}"
        ),
    }]

    result = agent.run_hiring_manager_agent_chat(
        "Direct hire and needs Python",
        history=history,
        current_user={"id": "test-hm", "tenant_id": "test-tenant"},
    )

    updated = result["executed_actions"][0]["result"]
    assert updated["hiring_model"] == "Direct Hiring"
    assert updated["skills"] == ["Python"]
    assert updated["missing_required_fields"] == []
    assert "AI service is temporarily unavailable" not in result["reply"]


@pytest.mark.parametrize('prompt', [
    'can u show me closed requsition',
    'show closed requisitions',
    'can you list completed jobs',
    'show filled roles',
])
@pytest.mark.parametrize('has_closed', [True, False])
def test_closed_queries_use_status_filter(monkeypatch, prompt, has_closed):
    rows = [{'id': 'closed-1', 'title': 'Backend Engineer', 'status': 'Closed'}] if has_closed else []
    lookup = Mock(return_value=rows)
    monkeypatch.setattr(agent, 'list_hiring_requisitions', lookup)
    monkeypatch.setattr(agent, '_get_tenant_company_context', lambda _: {'company_name': 'Test Company'})
    result = agent.run_hiring_manager_agent_chat(prompt, current_user={
        'id': 'test-hm', 'name': 'Test Manager', 'tenant_id': 'test-tenant',
    })
    lookup.assert_called_once()
    assert lookup.call_args.args[:2] == ('test-hm', 'test-tenant')
    assert lookup.call_args.args[2] in ('all', 'closed')
    assert result['executed_actions'] == [{'tool': 'list_hiring_requisitions', 'result': rows}]
    assert 'closed requisitions' in result['reply'].lower()
    if not has_closed:
        assert 'Found 0 closed requisitions' in result['reply'] or 'no closed requisitions' in result['reply']


@pytest.mark.parametrize('prompt', [
    'how do i use this as a hiring manager',
    'how to use this',
    'what can I do as a hiring manager',
    'explain my role',
    'help me',
])
def test_usage_questions_open_guide_before_creation_or_llm(monkeypatch, prompt):
    monkeypatch.setattr(agent, '_get_tenant_company_context', lambda _: {'company_name': 'Test Company'})
    roles = Mock(side_effect=AssertionError('Must not start role selection'))
    monkeypatch.setattr(agent, 'get_unique_predefined_roles', roles)
    result = agent.run_hiring_manager_agent_chat(prompt, current_user={
        'id': 'test-hm', 'name': 'Test Manager', 'tenant_id': 'test-tenant',
    })
    assert [a['tool'] for a in result['executed_actions']] == ['get_hiring_manager_guide']
    assert 'how to use TermJobs' in result['reply']
    roles.assert_not_called()
