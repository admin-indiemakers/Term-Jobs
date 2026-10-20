"""Legacy fallback remains available when no model is configured."""
from unittest.mock import Mock

import pytest

from modules.hiring_manager_agent import agent


@pytest.fixture(autouse=True)
def offline_fallback(monkeypatch):
    monkeypatch.setattr(agent, 'model_available', lambda: False)
    monkeypatch.setattr(agent, 'is_hiring_request_in_scope', lambda *args: True)
    monkeypatch.setattr(agent, 'run_hiring_manager_agent_chat', getattr(agent.run_hiring_manager_agent_chat, '__wrapped__', agent.run_hiring_manager_agent_chat))


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
    assert getattr(agent.httpx.post, 'call_count', 0) == 0


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
    result: dict = agent.run_hiring_manager_agent_chat(prompt, current_user={
        'id': 'test-hm', 'name': 'Test Manager', 'tenant_id': 'test-tenant',
    })
    lookup.assert_called_once()
    assert lookup.call_args.args[:2] == ('test-hm', 'test-tenant')
    assert lookup.call_args.args[2] in ('all', 'closed')
    assert result['executed_actions'] == [{'tool': 'list_hiring_requisitions', 'result': rows}]
    assert 'closed requisitions' in str(result['reply']).lower()
    if not has_closed:
        assert 'Found 0 closed requisitions' in str(result['reply']) or 'no closed requisitions' in str(result['reply'])


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
    result: dict = agent.run_hiring_manager_agent_chat(prompt, current_user={
        'id': 'test-hm', 'name': 'Test Manager', 'tenant_id': 'test-tenant',
    })
    actions: list = result.get('executed_actions', [])
    assert [a.get('tool') for a in actions if isinstance(a, dict)] == ['get_hiring_manager_guide']
    assert 'how to use TermJobs' in str(result['reply'])
    roles.assert_not_called()


@pytest.mark.parametrize('prompt', [
    'how can i create a requisition',
    'how can i create a requisition?',
    'how to create a requistion',
    'how to create a requistion by suing the chat',
    'how do i create a requisition',
    'how to draft a requisition',
    'guideline to create a requisition',
    'steps to create a requisition',
    'how to post a role',
])
def test_requisition_guide_questions(monkeypatch, prompt):
    monkeypatch.setattr(agent, '_get_tenant_company_context', lambda _: {'company_name': 'Test Company'})
    roles = Mock(side_effect=AssertionError('Must not start role selection'))
    monkeypatch.setattr(agent, 'get_unique_predefined_roles', roles)
    result: dict = agent.run_hiring_manager_agent_chat(prompt, current_user={
        'id': 'test-hm', 'name': 'Test Manager', 'tenant_id': 'test-tenant',
    })
    actions: list = result.get('executed_actions', [])
    assert [a.get('tool') for a in actions if isinstance(a, dict)] == ['get_requisition_guide']
    assert 'HOW TO CREATE A REQUISITION' in str(result['reply'])
    roles.assert_not_called()

