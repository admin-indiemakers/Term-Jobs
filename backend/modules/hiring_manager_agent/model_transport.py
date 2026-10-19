"""Bounded model failover and tool-call validation for hiring chat."""
import json
import logging
import time

import httpx

logger = logging.getLogger(__name__)


def request_completion(url, keys, models, messages, tools, budget_seconds=22):
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
                return None, None, None
            attempts += 1
            headers = {'Content-Type': 'application/json', 'Authorization': f'Bearer {key}'}
            try:
                payload = {'model': model, 'messages': messages, 'temperature': 0.2, 'max_tokens': 1600}
                if tools:
                    payload.update(tools=tools, tool_choice='auto')
                response = httpx.post(url, headers=headers, json=payload,
                                      timeout=httpx.Timeout(min(6, remaining / 4)))
                if response.status_code in (401, 403):
                    logger.warning('Hiring model authentication failed (HTTP %s)', response.status_code)
                    break
                if response.status_code != 200:
                    logger.warning('Hiring model attempt failed (model=%s, HTTP=%s)', model, response.status_code)
                    continue
                message = response.json()['choices'][0]['message']
                calls = message.get('tool_calls') or []
                if not calls and not str(message.get('content') or '').strip():
                    raise ValueError('Empty completion')
                for call in calls:
                    function = call['function']
                    schema = schemas[function['name']]
                    arguments = json.loads(function.get('arguments') or function.get('body') or '{}')
                    if not isinstance(arguments, dict):
                        raise ValueError('Tool arguments must be an object')
                    if set(arguments) - set(schema.get('properties', {})):
                        raise ValueError('Unknown tool argument')
                    if any(field not in arguments for field in schema.get('required', [])):
                        raise ValueError('Missing required tool argument')
                    for field, value in arguments.items():
                        expected = schema['properties'][field].get('type')
                        types = {'string': str, 'integer': int, 'number': (int, float), 'boolean': bool, 'array': list, 'object': dict}
                        if expected in types and (not isinstance(value, types[expected]) or (expected in ('integer', 'number') and isinstance(value, bool))):
                            raise ValueError('Invalid tool argument type')
                    if function['name'] == 'draft_hiring_requisition':
                        if not str(arguments.get('title') or '').strip() or arguments.get('openings', 1) < 1:
                            raise ValueError('Invalid draft title or headcount')
                return response, model, headers
            except (httpx.HTTPError, ValueError, KeyError, TypeError, IndexError):
                # Never log credentials, conversation content, or generated tool arguments.
                logger.warning('Hiring model attempt failed or returned an invalid completion (model=%s)', model)
    return None, None, None
