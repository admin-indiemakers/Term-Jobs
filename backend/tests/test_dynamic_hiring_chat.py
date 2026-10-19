"""Model tool responses are mocked; no paid API or live tenant data is used."""
import json
from unittest.mock import Mock

import pytest

from modules.hiring_manager_agent import agent


@pytest.fixture
def model(monkeypatch):
    from modules.superadmin_agent import groq_manager
    from modules.calendar.services import assistant
    monkeypatch.setattr(assistant, 'contextual_candidate', lambda *args: {'candidate_name': 'Hashil', 'id': 'submission-1', 'requisition_id': 'req-1', 'requisition_title': 'Engineer'})
    monkeypatch.setattr(agent, 'model_available', lambda: True)
    monkeypatch.setattr(groq_manager, 'get_all_groq_keys', lambda: ['test-key'])
    monkeypatch.setattr(agent, '_get_tenant_company_context', lambda _: {'company_name': 'Test Company'})
    post = Mock()
    monkeypatch.setattr(agent.httpx, 'post', post)
    return post


def completion(message):
    return Mock(status_code=200, json=lambda: {'choices': [{'message': message}]})


@pytest.mark.parametrize('prompt', [
    'I need two DevOps engineers for a project starting next month',
    'Our platform team is short a pair of infrastructure people; can you get a draft ready?',
    'HII I NEED TWO DEVOPS ENGINNERS FOR A PORJCT',
])
def test_semantic_tool_selection_runs_before_keyword_rejection(model, prompt):
    model.return_value = completion({'tool_calls': [{'id': 'draft', 'function': {
        'name': 'draft_hiring_requisition', 'arguments': json.dumps({
            'title': 'DevOps Engineer', 'openings': 2, 'skills': 'AWS, Terraform',
            'target_start_date': 'November 2026',
        }),
    }}]})
    result = agent.run_hiring_manager_agent_chat.__wrapped__(prompt, [], {'id': 'hm', 'tenant_id': 'company', 'name': 'Manager'})
    card = result['executed_actions'][0]['result']
    assert card['title'] == 'DevOps Engineer'
    assert card['openings'] == 2
    assert card['target_start_date'] == 'November 2026'
    assert card['salary_range'] == 'To be confirmed'
    assert card['location'] == 'To be confirmed'
    model.assert_called_once()
    assert model.call_args.kwargs['json']['messages'][-1]['content'] == prompt


def test_followup_receives_previous_assistant_and_user_context(model):
    model.return_value = completion({'content': 'Should those three openings stay remote?'})
    history = [{'role': 'user', 'content': 'Need two platform engineers'},
               {'role': 'assistant', 'content': 'Draft context: {"title":"Platform Engineer","openings":2}'}]
    result = agent.run_model_hiring_chat('make that three, same role', history, {'id': 'hm', 'tenant_id': 'company'})
    sent = model.call_args.kwargs['json']['messages']
    assert sent[1:3] == history
    assert result['reply'] == 'Should those three openings stay remote?'


def test_outage_is_explicit_and_does_not_fall_back_to_keyword_draft(model):
    model.return_value = Mock(status_code=503)
    result = agent.run_hiring_manager_agent_chat.__wrapped__('create requisition for DevOps engineer', [], {'id': 'hm', 'tenant_id': 'company'})
    assert result['ai_unavailable'] is True
    assert result['executed_actions'] == []


def test_ambiguous_request_can_ask_for_clarification_without_creating_a_card(model):
    model.return_value = completion({'content': 'Which role does the project need?'})
    result = agent.run_hiring_manager_agent_chat.__wrapped__('We need two people next month', [], {'id': 'hm', 'tenant_id': 'company'})
    assert result['reply'] == 'Which role does the project need?'
    assert result['executed_actions'] == []


@pytest.mark.parametrize('employment', ['', 'Permanent', 'Full-Time', 'Part-Time', 'To be confirmed', 'Contract'])
def test_draft_enforces_contract_only(employment):
    card = agent.draft_requisition_preview(title='DevOps Engineer', employment_type=employment)
    assert card['employment_type'] == 'Contract'


def test_contract_duration_is_preserved_without_inventing_one():
    assert agent.draft_requisition_preview(title='Engineer', employment_type='Contract (3 Months)')['employment_type'] == 'Contract (3 Months)'
    assert agent.draft_requisition_preview(title='Engineer')['employment_type'] == 'Contract'


def test_model_instructions_never_ask_for_permanent_employment(model):
    model.return_value = completion({'content': 'I can draft the contract role now.'})
    agent.run_model_hiring_chat('I need two DevOps engineers', [], {'id': 'hm', 'tenant_id': 'company'})
    instructions = model.call_args.kwargs['json']['messages'][0]['content']
    assert 'NEVER ask whether a job is permanent' in instructions
    assert 'draft immediately' in instructions


@pytest.mark.parametrize('greeting', ['HI', 'hi', 'hello!', 'Hey', 'good morning'])
def test_greeting_never_replays_draft_from_history(model, greeting):
    model.return_value = completion({'content': 'Hello! How can I help?'})
    history = [{'role': 'user', 'content': 'Draft a DevOps Engineer requisition'},
               {'role': 'assistant', 'content': 'Draft context: {"title":"DevOps Engineer","skills":["AWS","Terraform"]}'}]
    result = agent.run_model_hiring_chat(greeting, history, {'id': 'hm', 'tenant_id': 'company'})
    assert result['executed_actions'] == []
    payload = model.call_args.kwargs['json']
    assert 'tools' not in payload
    assert len(payload['messages']) == 2
    assert payload['messages'][-1]['content'] == greeting


def test_hallucinated_tool_call_on_greeting_is_never_executed(model, monkeypatch):
    draft = Mock(side_effect=AssertionError('A greeting must not create a draft'))
    monkeypatch.setattr(agent, 'draft_requisition_preview', draft)
    model.return_value = completion({'tool_calls': [{'function': {
        'name': 'draft_hiring_requisition', 'arguments': '{"title":"DevOps Engineer"}',
    }}]})
    result = agent.run_model_hiring_chat('HI', [], {'id': 'hm', 'tenant_id': 'company'})
    assert result is None
    draft.assert_not_called()


@pytest.mark.parametrize('arguments', [{'status': 'all'}, {'status': 'all', 'created_on': '2026-10-14'}])
def test_named_date_limits_tool_cards_and_synthesis_data(model, monkeypatch, arguments):
    monkeypatch.setattr(agent, 'list_hiring_requisitions', lambda *args: [
        {'id': 'wanted', 'title': 'React Developer', 'status': 'Published', 'created_at': '2026-10-14T09:10:00Z'},
        {'id': 'unwanted', 'title': 'DevOps Engineer', 'status': 'Pending Approval', 'created_at': '2026-10-17T09:10:00Z'},
    ])
    model.side_effect = [completion({'tool_calls': [{'id': 'list', 'function': {
        'name': 'list_hiring_requisitions', 'arguments': json.dumps(arguments),
    }}]}), completion({'content': 'Found one matching requisition.'})]
    result = agent.run_model_hiring_chat('can u show me the requisition i made on october 14', [], {'id': 'hm', 'tenant_id': 'company'})
    assert [r['id'] for r in result['executed_actions'][0]['result']] == ['wanted']
    model.assert_called_once()
    assert '1 matching requisition' in result['reply']


@pytest.mark.parametrize('chosen_status', ['all', 'open', 'pending'])
def test_pending_typo_query_never_shows_published_records(model, monkeypatch, chosen_status):
    rows = [
        {'id': 'live', 'title': 'React Developer', 'status': 'Published'},
        {'id': 'pending', 'title': 'DevOps Engineer', 'status': 'Pending Approval'},
    ]
    monkeypatch.setattr(agent, 'list_hiring_requisitions', lambda *args: rows)
    model.return_value = completion({'tool_calls': [{'id': 'list', 'function': {
        'name': 'list_hiring_requisitions', 'arguments': json.dumps({'status': chosen_status}),
    }}]})
    result = agent.run_model_hiring_chat('hi can u show me the pending requsitions', [], {'id': 'hm', 'tenant_id': 'company'})
    assert [r['id'] for r in result['executed_actions'][0]['result']] == ['pending']
    assert '1 matching requisition' in result['reply']
    model.assert_called_once()


@pytest.mark.parametrize('time,expected', [('4 pm', '16:00'), ('04:30 PM', '16:30'), ('12 am', '00:00'), ('12 pm', '12:00'), ('16:00', '16:00')])
def test_proposal_normalizes_time_for_native_input(time, expected):
    assert agent.schedule_candidate_interview('Hashil', proposed_date='2026-10-17', proposed_time=time)['proposed_time'] == expected


def test_user_time_is_preserved_when_model_omits_it(model):
    model.return_value = completion({'tool_calls': [{'id': 'schedule', 'function': {
        'name': 'schedule_candidate_interview', 'arguments': json.dumps({'candidate_identifier': 'Hashil', 'proposed_date': '2026-10-17'}),
    }}]})
    result = agent.run_model_hiring_chat('can u setup interview with hashil today 4 pm', [], {'id': 'hm', 'tenant_id': 'company'})
    card = result['executed_actions'][0]['result']
    assert card['proposed_time'] == '16:00'
    assert card['candidate_submission_id'] == 'submission-1'
    assert card['requisition_id'] == 'req-1'
