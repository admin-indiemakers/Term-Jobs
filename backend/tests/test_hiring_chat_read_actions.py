from unittest.mock import Mock

import pytest

from modules.hiring_manager_agent import agent
from modules.hiring_manager_agent.read_actions import candidate_reply


@pytest.fixture
def database():
    db = {'requisitions': Mock(), 'candidate_submissions': Mock()}
    db['requisitions'].find.return_value = [{'id': 'req-1', 'title': 'Fullstack Developer'}, {'id': 'req-2', 'title': 'Other'}]
    db['candidate_submissions'].find.return_value = [{'id': 'application-1', 'candidate_name': 'Sam', 'requisition_id': 'req-1', 'status': 'Applied'}]
    return db


def test_candidate_lookup_uses_requisition_id(database):
    result = candidate_reply('Show candidates for wrong title', database, 'req-1')
    database['candidate_submissions'].find.assert_called_once_with({'requisition_id': {'$in': ['req-1']}})
    assert result['executed_actions'][0]['result'][0]['candidate_name'] == 'Sam'


def test_unknown_id_does_not_fall_back_to_other_records(database):
    result = candidate_reply('Show candidates', database, 'unauthorized')
    database['candidate_submissions'].find.assert_not_called()
    assert not result['executed_actions']


def test_duplicate_title_requires_selection(database):
    database['requisitions'].find.return_value = [{'id': 'a', 'title': 'Developer'}, {'id': 'b', 'title': 'Developer'}]
    result = candidate_reply('Show candidates for Developer', database)
    assert 'More than one' in result['reply']
    database['candidate_submissions'].find.assert_not_called()


@pytest.mark.parametrize('prompt', ['Show candidates for Fullstack Developer', 'Summarize my hiring pipeline'])
def test_read_requests_do_not_call_unavailable_model(monkeypatch, database, prompt):
    monkeypatch.setattr(agent, 'db', database)
    model = Mock(side_effect=AssertionError('Model must not be called'))
    monkeypatch.setattr(agent, 'run_model_hiring_chat', model)
    monkeypatch.setattr(agent, 'model_available', lambda: True)
    pipeline = Mock(return_value={'reply': 'Your hiring pipeline', 'executed_actions': []})
    monkeypatch.setattr(agent, 'hiring_pipeline_reply', pipeline)
    result = agent.run_hiring_manager_agent_chat.__wrapped__(prompt, [], {'id': 'hm', 'tenant_id': 'company'})
    assert 'temporarily unavailable' not in result['reply']
    model.assert_not_called()


def test_database_failure_is_not_reported_as_ai_outage(monkeypatch, database):
    database['requisitions'].find.side_effect = RuntimeError('Database offline')
    monkeypatch.setattr(agent, 'db', database)
    result = agent.run_hiring_manager_agent_chat.__wrapped__('Show candidates for Developer', [], {'id': 'hm', 'tenant_id': 'company'})
    assert result['error_code'] == 'hiring_records_unavailable'


def test_mutation_is_not_handled_as_read(database):
    assert candidate_reply('Show candidates and reject them', database) is None
    database['requisitions'].find.assert_not_called()
