import json
from unittest.mock import Mock

from modules.hiring_manager_agent import model_transport

TOOLS = [{'function': {'name': 'draft_hiring_requisition', 'parameters': {
    'type': 'object', 'properties': {'title': {'type': 'string'}, 'openings': {'type': 'integer'}}, 'required': ['title'],
}}}]


def valid(arguments=None):
    return Mock(status_code=200, json=lambda: {'choices': [{'message': {'tool_calls': [{
        'function': {'name': 'draft_hiring_requisition', 'arguments': json.dumps(arguments or {'title': 'DevOps Engineer', 'openings': 1})},
    }]}}]})


def test_rate_limit_tries_next_model_on_same_key(monkeypatch):
    post = Mock(side_effect=[Mock(status_code=429), valid()])
    monkeypatch.setattr(model_transport.httpx, 'post', post)
    response, model, _ = model_transport.request_completion('url', ['key'], ['preferred', 'fallback'], [], TOOLS)
    assert response.status_code == 200
    assert model == 'fallback'
    assert [call.kwargs['json']['model'] for call in post.call_args_list] == ['preferred', 'fallback']


def test_bad_credentials_rotate_key(monkeypatch):
    post = Mock(side_effect=[Mock(status_code=401), valid()])
    monkeypatch.setattr(model_transport.httpx, 'post', post)
    _, _, headers = model_transport.request_completion('url', ['invalid', 'valid'], ['preferred', 'fallback'], [], TOOLS)
    assert headers['Authorization'] == 'Bearer valid'
    assert post.call_count == 2


def test_invalid_tool_arguments_are_not_executed(monkeypatch):
    post = Mock(side_effect=[valid({'title': 'DevOps Engineer', 'openings': 'one'}), valid()])
    monkeypatch.setattr(model_transport.httpx, 'post', post)
    _, model, _ = model_transport.request_completion('url', ['key'], ['preferred', 'fallback'], [], TOOLS)
    assert model == 'fallback'


def test_tool_validation_error_from_provider_falls_back(monkeypatch):
    post = Mock(side_effect=[Mock(status_code=400), valid()])
    monkeypatch.setattr(model_transport.httpx, 'post', post)
    response, model, _ = model_transport.request_completion('url', ['key'], ['preferred', 'fallback'], [], TOOLS)
    assert response.status_code == 200 and model == 'fallback'


def test_exhausted_time_budget_makes_no_network_call(monkeypatch):
    post = Mock()
    monkeypatch.setattr(model_transport.httpx, 'post', post)
    assert model_transport.request_completion('url', ['key'], ['model'], [], TOOLS, budget_seconds=0) == (None, None, None)
    post.assert_not_called()
