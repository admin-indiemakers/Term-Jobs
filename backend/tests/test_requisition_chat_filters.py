import ast
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
from unittest.mock import Mock

import pytest

from modules.shared.requisition_chat import filtered_requisition_reply

NOW = datetime(2026, 10, 17, 8, tzinfo=timezone.utc)
ROWS = [
    {'id': 'start', 'title': 'Engineer', 'status': 'Published', 'created_at': '2026-10-15T18:30:00Z'},
    {'id': 'end', 'title': 'Engineer', 'status': 'Open', 'created_at': datetime(2026, 10, 16, 18, 29, 59)},
    {'id': 'old', 'status': 'Active', 'created_at': '2026-10-15T18:29:59Z'},
    {'id': 'today', 'status': 'Open', 'created_at': '2026-10-16T18:30:00Z'},
    {'id': 'closed', 'status': 'Closed', 'created_at': '2026-10-16T12:00:00+00:00'},
    {'id': 'inactive', 'status': 'Inactive', 'created_at': '2026-10-16T12:00:00Z'},
    {'id': 'draft', 'status': 'Draft', 'created_at': '2026-10-16T12:00:00Z'},
    {'id': 'missing', 'status': 'Active'},
    {'id': 'invalid', 'status': 'Active', 'created_at': 'unknown'},
]


@pytest.mark.parametrize('prompt, expected', [
    ('Show me the requisitions created yesterday.', ['start', 'end', 'closed', 'inactive', 'draft']),
    ('Show active requisitions created yesterday', ['start', 'end']),
    ('List inactive requisitions created yesterday', ['closed', 'inactive']),
    ('List non-active requisitions created yesterday', ['closed', 'inactive']),
    ('Show closed requisitions created yesterday', ['closed']),
    ('Show draft requisitions created yesterday', ['draft']),
    ('Show requisitions created today', ['today']),
    ('Show requisitions created on 2026-10-16', ['start', 'end', 'closed', 'inactive', 'draft']),
    ('Show requisitions created on 2020-01-01', []),
    ('Show active requisitions', ['start', 'end', 'old', 'today', 'missing', 'invalid']),
])
def test_filters(prompt, expected):
    result = filtered_requisition_reply(prompt, lambda: ROWS, 'list', now=NOW)
    assert [r['id'] for r in result['executed_actions'][0]['result']] == expected
    assert f'Found {len(expected)} ' in result['reply']


def test_calendar_day_uses_requested_timezone():
    result = filtered_requisition_reply('Show requisitions created yesterday', lambda: ROWS, 'list', 'UTC', NOW)
    assert [r['id'] for r in result['executed_actions'][0]['result']] == ['end', 'today', 'closed', 'inactive', 'draft']


@pytest.mark.parametrize('prompt', ['Create a new requisition today', 'Show candidates for active requisitions', 'Show all requisitions'])
def test_other_intents_continue_existing_routing(prompt):
    loader = Mock()
    assert filtered_requisition_reply(prompt, loader, 'list', now=NOW) is None
    loader.assert_not_called()


@pytest.mark.parametrize('agent, entry, tool', [
    ('hiring_manager_agent', 'run_hiring_manager_agent_chat', 'list_hiring_requisitions'),
    ('company_admin_agent', 'run_company_admin_agent_chat', 'list_company_requisitions'),
])
def test_chat_routes_filtered_results_before_model_or_general_directory(agent, entry, tool):
    # Run real entry functions with database/model dependencies replaced; no live services.
    path = Path(__file__).parents[1] / 'modules' / agent / 'agent.py'
    tree = ast.parse(path.read_text())
    function = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == entry)
    function.decorator_list = []
    loader = Mock(return_value=ROWS)
    namespace = {
        '__package__': f'modules.{agent}', 'Optional': Optional, 'List': List, 'Any': Any, 'Dict': Dict,
        'is_hiring_request_in_scope': lambda *args: True,
        'get_company_full_knowledge': Mock(return_value={'requisitions': ROWS}),
        'list_hiring_requisitions': loader,
        'run_model_hiring_chat': lambda *args: None, 'model_available': lambda: False,
    }
    exec(compile(ast.Module(body=[function], type_ignores=[]), str(path), 'exec'), namespace)
    result = namespace[entry]('Show active requisitions created on 2026-10-16', current_user={'id': 'u', 'tenant_id': 'tenant'})
    assert result['executed_actions'][0]['tool'] == tool
    assert [r['id'] for r in result['executed_actions'][0]['result']] == ['start', 'end']
    if agent == 'hiring_manager_agent':
        loader.assert_called_once_with('u', 'tenant', 'all')


def test_hiring_loader_preserves_same_title_records_and_missing_timestamps():
    path = Path(__file__).parents[1] / 'modules/hiring_manager_agent/agent.py'
    tree = ast.parse(path.read_text())
    function = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == 'list_hiring_requisitions')
    docs = [
        {'id': 'a', 'title': 'Engineer', 'status': 'Open', 'created_at': '2026-10-17T00:00:00Z'},
        {'id': 'b', 'title': 'Engineer', 'status': 'Open', 'created_at': '2026-10-16T00:00:00Z'},
        {'id': 'c', 'title': 'Engineer', 'status': 'Open'},
    ]
    collection = Mock()
    collection.find.return_value.sort.return_value = docs
    import re
    namespace = {'db': {'requisitions': collection}, 're': re}
    exec(compile(ast.Module(body=[function], type_ignores=[]), str(path), 'exec'), namespace)
    rows = namespace['list_hiring_requisitions']('u', 'tenant')
    assert [r['id'] for r in rows] == ['a', 'b', 'c']
    assert rows[-1]['created_at'] is None


@pytest.mark.parametrize('wording', ['October 14', 'October 14th', '14 October', '14th of October', 'Oct 14, 2026'])
def test_named_dates_filter_card_results(wording):
    rows = [
        {'id': 'wanted', 'status': 'Published', 'created_at': '2026-10-14T09:10:00Z'},
        {'id': 'unwanted', 'status': 'Pending Approval', 'created_at': '2026-10-17T09:10:00Z'},
    ]
    result = filtered_requisition_reply(f'can u show me the requisition i made on {wording}', lambda: rows, 'list', now=NOW)
    assert [r['id'] for r in result['executed_actions'][0]['result']] == ['wanted']


def test_model_resolved_date_filters_followup_without_requisition_keyword():
    result = filtered_requisition_reply('just the ones from that day', lambda: ROWS, 'list', now=NOW, created_on='2026-10-16')
    assert [r['id'] for r in result['executed_actions'][0]['result']] == ['start', 'end', 'closed', 'inactive', 'draft']
