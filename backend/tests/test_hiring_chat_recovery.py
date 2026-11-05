"""Exercise screenshot conversations through real routing and scoped database reads."""
from datetime import datetime
from unittest.mock import Mock

import mongomock
import pytest

from modules.hiring_manager_agent import agent
from modules.hiring_manager_agent.draft_recovery import recover_staffing_request
from modules.hiring_manager_agent.scope import ScopedDatabase, authorized_chat


@pytest.fixture
def chat(monkeypatch):
    database = mongomock.MongoClient().db
    monkeypatch.setattr(agent, 'db', ScopedDatabase(database))
    monkeypatch.setattr(agent, 'model_available', lambda: True)
    model = Mock(return_value=None)
    monkeypatch.setattr(agent, 'run_model_hiring_chat', model)
    handler = authorized_chat(database)(agent.run_hiring_manager_agent_chat.__wrapped__)
    return database, model, lambda text, history=None: handler(text, history, {'id': 'hm', 'tenant_id': 'our-company'})


def test_screenshot_shortlist_query_is_a_scoped_requisition_join(chat):
    db, model, send = chat
    db.requisitions.insert_many([
        {'id':'ours', 'title':'DevOps Engineer', 'tenant_id':'our-company', 'created_by':'hm'},
        {'id':'empty', 'title':'QA Tester', 'tenant_id':'our-company', 'created_by':'hm'},
        {'id':'other-manager', 'title':'Private role', 'tenant_id':'our-company', 'created_by':'someone-else'},
        {'id':'other-company', 'title':'Private role', 'tenant_id':'another-company', 'created_by':'hm'},
    ])
    db.candidate_submissions.insert_many([
        {'id':'a', 'requisition_id':'ours', 'status':'Shortlisted', 'tenant_id':'our-company'},
        {'id':'b', 'requisition_id':'empty', 'status':'Applied', 'tenant_id':'our-company'},
        {'id':'c', 'requisition_id':'other-manager', 'status':'Shortlisted', 'tenant_id':'our-company'},
        {'id':'d', 'requisition_id':'other-company', 'status':'Shortlisted', 'tenant_id':'another-company'},
        {'id':'e', 'requisition_id':'ours', 'status':'Shortlisted', 'tenant_id':'another-company'},
    ])
    result = send('show me requisitions with shortlisted candidates')
    action = result['executed_actions'][0]
    assert action['tool'] == 'list_hiring_requisitions'
    assert [r['id'] for r in action['result']] == ['ours']
    assert action['result'][0]['shortlisted_count'] == 1
    model.assert_not_called()


def test_empty_shortlist_result_does_not_fall_through_to_model(chat):
    _, model, send = chat
    result = send('show me requisitions with shortlisted candidates')
    assert result['executed_actions'][0]['result'] == []
    assert 'No requisitions' in result['reply']
    model.assert_not_called()


def test_staffing_request_recovers_without_reusing_submitted_role(chat):
    db, model, send = chat
    history = [{'role':'assistant', 'content':'QA Tester requisition has been sent to the Director for approval.'}]
    result = send('a I need a devops engineer with 2 years experience starting work next month', history)
    draft = result['executed_actions'][0]['result']
    assert draft['title'] == 'DevOps Engineer'
    assert draft['experience_level'] == '2 years'
    assert draft['target_start_date'] != 'To be confirmed'
    assert draft['skills'] == 'To be confirmed'
    assert 'Required skills' in draft['missing_required_fields']
    assert not draft['is_complete']
    assert db.requisitions.count_documents({}) == 0
    model.assert_called_once()


def test_next_month_handles_year_boundary():
    draft = recover_staffing_request('I need a DevOps engineer starting next month', now=datetime(2026, 12, 31))
    assert draft['target_start_date'] == 'January 2027'


@pytest.mark.parametrize('prompt', ['I do not need a developer', 'What does a developer do?', 'send all requisitions', 'I need help with my developer interview'])
def test_ambiguous_or_non_creation_requests_do_not_create_drafts(prompt):
    assert recover_staffing_request(prompt) is None


def test_model_tool_response_with_optional_nulls_runs_real_draft_handler(monkeypatch):
    import httpx
    import json
    from modules.hiring_manager_agent import model_transport
    from modules.superadmin_agent import groq_manager
    monkeypatch.setattr(agent, 'model_available', lambda: True)
    monkeypatch.setattr(agent, '_get_tenant_company_context', lambda _: {'company_name':'Test Company', 'require_director_approval':False})
    monkeypatch.setattr(groq_manager, 'get_all_groq_keys', lambda: ['test-key'])
    body = {'choices': [{'message': {'tool_calls': [{'id':'call-1', 'type':'function', 'function': {
        'name':'draft_hiring_requisition', 'arguments':json.dumps({'title':'DevOps Engineer', 'department':None, 'skills':None, 'openings':None, 'experience_level':'2 years', 'target_start_date':'November 2026'})
    }}]}}]}
    post = Mock(return_value=httpx.Response(200, json=body))
    monkeypatch.setattr(model_transport.httpx, 'post', post)
    result = agent.run_model_hiring_chat('I need a DevOps engineer', [], {'id':'hm', 'tenant_id':'company'})
    assert result['executed_actions'][0]['result']['title'] == 'DevOps Engineer'
    assert result['executed_actions'][0]['result']['department'] == 'To be confirmed'
    assert result['executed_actions'][0]['result']['openings'] == 1
    assert model_transport.last_failure() is None
