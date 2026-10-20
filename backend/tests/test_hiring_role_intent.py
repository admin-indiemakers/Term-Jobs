import ast
import re
from pathlib import Path
from unittest.mock import Mock

import pytest

from modules.hiring_manager_agent.role_intent import requested_hiring_role
from modules.hiring_manager_agent.chat_scope import is_hiring_request_in_scope


@pytest.mark.parametrize('prompt,title,count', [
    ('I NEED A DEVOPS ENGINEER', 'DevOps Engineer', 1),
    ('HII , I NEED 2 DEVOPS ENGINNERS FOR A PORJCT STARTING NEXT MONTH', 'DevOps Engineer', 2),
    ('HEY I NEED 2 DEVOPS ENGINEER FOR A PROJECT STARTING NEXT MONTH', 'DevOps Engineer', 2),
    ('hey i need 2 devops engineers', 'DevOps Engineer', 2),
    ('HEY CREATE A REQUSITION FOR A DEVOPS ENGINEER', 'DevOps Engineer', 1),
    ('can u create requisition for devops engineers', 'DevOps Engineer', 1),
    ('I want to hire 3 backend developers', 'Backend Developer', 3),
])
def test_hiring_requests_are_in_scope_and_keep_role_and_count(prompt, title, count):
    assert is_hiring_request_in_scope(prompt)
    assert requested_hiring_role(prompt) == {'title': title, 'openings': count}


@pytest.mark.parametrize('prompt', ['I need a joke', 'What is a DevOps engineer?', 'Show DevOps candidates', 'I need a recipe'])
def test_other_requests_do_not_create_drafts(prompt):
    assert requested_hiring_role(prompt) is None


def test_custom_role_does_not_select_unrelated_company_template():
    path = Path(__file__).parents[1] / 'modules/hiring_manager_agent/agent.py'
    tree = ast.parse(path.read_text(encoding='utf-8'))
    entry = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == 'run_hiring_manager_agent_chat')
    branch = next(n for n in entry.body if isinstance(n, ast.If) and 're.search(create_req_pattern' in ast.unparse(n.test))
    wrapper = ast.FunctionDef(name='run', args=ast.arguments(posonlyargs=[], args=[], kwonlyargs=[], kw_defaults=[], defaults=[]), body=[branch], decorator_list=[])
    module = ast.fix_missing_locations(ast.Module(body=[wrapper], type_ignores=[]))
    prompt = 'HEY I NEED 2 DEVOPS ENGINEER FOR A PROJECT STARTING NEXT MONTH'
    draft = Mock(side_effect=lambda **kw: kw)
    namespace = dict(re=re, requested_role=requested_hiring_role(prompt), prompt_clean=prompt,
                     prompt_lower=prompt, create_req_pattern='unused', tenant_id='tenant', company_name='Company',
                     get_unique_predefined_roles=lambda _: [{'title': 'Senior React Developer'}],
                     generate_role_skills=lambda **kw: ['AWS', 'Terraform'], draft_requisition_preview=draft)
    exec(compile(module, str(path), 'exec'), namespace)
    result = namespace['run']()
    card = result['executed_actions'][0]['result']
    assert card['title'] == 'DevOps Engineer'
    assert card['openings'] == 2
    assert card['salary_range'] == 'To be confirmed'
    assert card['location'] == 'To be confirmed'
    assert 'React' not in result['reply']


def test_exact_mobile_request_through_http_router_and_real_agent(monkeypatch):
    from contextlib import contextmanager
    import mongomock
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from modules.hiring_manager_agent import agent, router
    from modules.hiring_manager_agent.scope import authorized_chat, ScopedDatabase
    from modules.identity.domain.models import User
    from modules.calendar.services import assistant, google_calendar
    import importlib
    database_module = importlib.import_module('modules.shared.db')

    monkeypatch.setattr(agent, 'model_available', lambda: False)
    monkeypatch.setattr(router, 'model_available', lambda: False)
    database = mongomock.MongoClient().db
    monkeypatch.setattr(agent, 'db', ScopedDatabase(database))
    monkeypatch.setattr(agent, '_get_tenant_company_context', lambda _: {'company_name': 'Test Company'})
    monkeypatch.setattr(agent, 'get_unique_predefined_roles', lambda _: [{'title': 'Senior React Developer'}])
    monkeypatch.setattr(assistant, 'handle_calendar_query', lambda *args: None)
    monkeypatch.setattr(google_calendar, 'connection_status', lambda _: {'connected': False})

    @contextmanager
    def session():
        yield Mock(get=Mock(return_value=None))

    monkeypatch.setattr(database_module, 'get_session', session)
    monkeypatch.setattr(router, 'run_hiring_manager_agent_chat', authorized_chat(database)(agent.run_hiring_manager_agent_chat.__wrapped__))
    app = FastAPI()
    app.include_router(router.router)
    app.dependency_overrides[router.get_current_user] = lambda: User(id='hm', tenant_id='company', role='Hiring Manager', name='Test Manager')
    with TestClient(app) as client:
        response = client.post('/api/hiring-manager/agent/chat', json={
            'prompt': 'HII , I NEED 2 DEVOPS ENGINNERS FOR A PORJCT STARTING NEXT MONTH', 'history': [],
        })
    assert response.status_code == 200
    payload = response.json()
    assert payload['executed_actions'][0]['tool'] == 'draft_hiring_requisition'
    card = payload['executed_actions'][0]['result']
    assert card['title'] == 'DevOps Engineer'
    assert card['openings'] == 2
    assert not payload.get('out_of_scope')
