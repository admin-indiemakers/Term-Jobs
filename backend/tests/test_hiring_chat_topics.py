import pytest

from modules.hiring_manager_agent.chat_scope import is_hiring_request_in_scope, SCOPE_REPLY


@pytest.mark.parametrize('prompt', ['what is photosynthesis', 'wwhat is photosynthasis', 'tell me a joke', 'explain gravity'])
def test_unrelated_questions_remain_outside_hiring_with_history(prompt):
    history = [{'role': 'assistant', 'content': 'I can help with hiring requisitions and candidates.'}]
    assert not is_hiring_request_in_scope(prompt)
    assert not is_hiring_request_in_scope(prompt, history)


@pytest.mark.parametrize('prompt', ['Draft requisition', 'DevSecOps candidates', 'Pipeline summary', 'Schedule interview', 'show my team', 'show expense for approval', 'hi'])
def test_hiring_workflows_remain_available(prompt):
    assert is_hiring_request_in_scope(prompt)


def test_bounded_followup_requires_hiring_context():
    assert is_hiring_request_in_scope('set the skills to Python', [{'sender': 'user', 'text': 'draft a requisition'}])
    assert not is_hiring_request_in_scope('yes')


def test_router_rejects_repeated_unrelated_questions_before_integrations(monkeypatch):
    from modules.hiring_manager_agent import router
    monkeypatch.setattr(router, 'model_available', lambda: False)
    from modules.identity.domain.models import User
    def unexpected(*args, **kwargs):
        pytest.fail('Unrelated prompt must not reach the agent')
    monkeypatch.setattr(router, 'run_hiring_manager_agent_chat', unexpected)
    user = User(id='hm', tenant_id='company', role='Hiring Manager')
    history = []
    for _ in range(2):
        result = router.hiring_manager_agent_chat(router.HiringManagerChatRequest(prompt='what is photosynthesis', history=history), user)
        assert result['reply'] == SCOPE_REPLY
        assert result['executed_actions'] == []
        history += [{'role': 'user', 'content': 'what is photosynthesis'}, {'role': 'assistant', 'content': result['reply']}]
