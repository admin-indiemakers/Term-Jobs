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


def test_optional_null_is_omitted_before_execution(monkeypatch):
    monkeypatch.setattr(model_transport.httpx, 'post', Mock(return_value=valid({'title': 'DevOps Engineer', 'openings': None})))
    response, _, _ = model_transport.request_completion('url', ['key'], ['model'], [], TOOLS)
    arguments = json.loads(response.json()['choices'][0]['message']['tool_calls'][0]['function']['arguments'])
    assert arguments == {'title': 'DevOps Engineer'}
    assert model_transport.last_failure() is None


def test_required_null_still_rejected(monkeypatch):
    monkeypatch.setattr(model_transport.httpx, 'post', Mock(return_value=valid({'title': None})))
    assert model_transport.request_completion('url', ['key'], ['model'], [], TOOLS)[0] is None
    assert model_transport.last_failure()['error_code'] == 'ai_invalid_response'


def test_failure_reason_and_reference_without_sensitive_logs(monkeypatch, caplog):
    monkeypatch.setattr(model_transport.httpx, 'post', Mock(return_value=Mock(status_code=429)))
    model_transport.request_completion('url', ['secret-key'], ['model'], [{'content': 'private-company-data'}], TOOLS)
    failure = model_transport.last_failure()
    assert failure['error_code'] == 'ai_rate_limited'
    assert failure['reference'] in caplog.text
    assert 'secret-key' not in caplog.text
    assert 'private-company-data' not in caplog.text


def test_timeout_is_classified_and_success_resets_failure(monkeypatch):
    import httpx
    post = Mock(side_effect=[httpx.ReadTimeout('timeout'), valid()])
    monkeypatch.setattr(model_transport.httpx, 'post', post)
    assert model_transport.request_completion('url', ['key'], ['model'], [], TOOLS)[0] is None
    assert model_transport.last_failure()['error_code'] == 'ai_timeout'
    assert model_transport.request_completion('url', ['key'], ['model'], [], TOOLS)[0] is not None
    assert model_transport.last_failure() is None


def test_truncated_completion_never_executes_tools(monkeypatch):
    payload = valid().json()
    payload['choices'][0]['finish_reason'] = 'length'
    monkeypatch.setattr(model_transport.httpx, 'post', Mock(return_value=Mock(status_code=200, json=lambda: payload)))
    assert model_transport.request_completion('url', ['key'], ['model'], [], TOOLS)[0] is None


def test_exhausted_deadline_stops_further_attempts(monkeypatch):
    clock = iter([0, 0, 23])
    monkeypatch.setattr(model_transport.time, 'monotonic', lambda: next(clock))
    post = Mock(return_value=Mock(status_code=503))
    monkeypatch.setattr(model_transport.httpx, 'post', post)
    assert model_transport.request_completion('url', ['key'], ['first', 'second'], [], TOOLS)[0] is None
    assert post.call_count == 1
