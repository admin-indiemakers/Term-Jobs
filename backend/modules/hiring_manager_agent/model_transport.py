"""Bounded model failover and tool-call validation for hiring chat."""
import json
import logging
import time
import uuid
from contextvars import ContextVar

import httpx

logger = logging.getLogger(__name__)
_last_failure = ContextVar('hiring_model_failure', default=None)


def last_failure():
    return _last_failure.get()


def _record_failure(reference, code, model=None, status=None):
    # Deliberately omit prompts, arguments, credentials and provider response bodies.
    _last_failure.set({'error_code': code, 'reference': reference})
    logger.warning('Hiring completion failed reference=%s code=%s model=%s status=%s', reference, code, model, status)


def request_completion(url, keys, models, messages, tools, budget_seconds=22):
    _last_failure.set(None)
    reference = uuid.uuid4().hex[:12]
    deadline = time.monotonic() + budget_seconds
    schemas = {tool['function']['name']: tool['function']['parameters'] for tool in tools}
    # Exhaust models on a key's model-specific rate limit before rotating keys.
    attempts = 0
    for key in keys:
        if not key:
            continue
        for model in dict.fromkeys(models):
            remaining = deadline - time.monotonic()
            if remaining < 1 or attempts >= 6:
                if last_failure() is None:
                    _record_failure(reference, "ai_timeout")
                return None, None, None
            attempts += 1
            headers = {'Content-Type': 'application/json', 'Authorization': f'Bearer {key}'}
            try:
                payload = {'model': model, 'messages': messages, 'temperature': 0.2, 'max_tokens': 1600}
                if tools:
                    payload.update(tools=tools, tool_choice='auto')
                response = httpx.post(url, headers=headers, json=payload,
                                      timeout=httpx.Timeout(min(12, remaining), connect=min(3, remaining)))
                if response.status_code in (401, 403):
                    _record_failure(reference, 'ai_configuration_error', model, response.status_code)
                    break
                if response.status_code != 200:
                    code = 'ai_rate_limited' if response.status_code == 429 else ('ai_provider_error' if response.status_code >= 500 else 'ai_request_rejected')
                    _record_failure(reference, code, model, response.status_code)
                    continue
                body = response.json()
                choice = body['choices'][0]
                if choice.get('finish_reason') == 'length':
                    raise ValueError('Truncated completion')
                message = choice['message']
                calls = message.get('tool_calls') or []
                if not calls and not str(message.get('content') or '').strip():
                    raise ValueError('Empty completion')
                for call in calls:
                    function = call['function']
                    schema = schemas[function['name']]
                    arguments = json.loads(function.get('arguments') or function.get('body') or '{}')
                    if not isinstance(arguments, dict):
                        raise ValueError('Tool arguments must be an object')
                    # Optional unset values may be omitted; required values still fail validation.
                    arguments = {k: v for k, v in arguments.items() if v is not None or k in schema.get('required', [])}
                    if set(arguments) - set(schema.get('properties', {})):
                        raise ValueError('Unknown tool argument')
                    if any(field not in arguments for field in schema.get('required', [])):
                        raise ValueError('Missing required tool argument')
                    for field, value in arguments.items():
                        definition = schema['properties'][field]
                        if 'enum' in definition and value not in definition['enum']:
                            raise ValueError('Invalid tool argument choice')
                        expected = definition.get('type')
                        types = {'string': str, 'integer': int, 'number': (int, float), 'boolean': bool, 'array': list, 'object': dict}
                        if expected in types and (not isinstance(value, types[expected]) or (expected in ('integer', 'number') and isinstance(value, bool))):
                            raise ValueError('Invalid tool argument type')
                    if function['name'] == 'draft_hiring_requisition':
                        if not str(arguments.get('title') or '').strip() or arguments.get('openings', 1) < 1:
                            raise ValueError('Invalid draft title or headcount')
                    function['arguments'] = json.dumps(arguments)
                    function.pop('body', None)
                _last_failure.set(None)
                return httpx.Response(200, json=body), model, headers
            except httpx.TimeoutException:
                _record_failure(reference, 'ai_timeout', model)
            except httpx.HTTPError:
                _record_failure(reference, 'ai_connection_error', model)
            except (ValueError, KeyError, TypeError, IndexError):
                _record_failure(reference, 'ai_invalid_response', model)
    if last_failure() is None:
        _record_failure(reference, 'ai_not_configured')
    return None, None, None
