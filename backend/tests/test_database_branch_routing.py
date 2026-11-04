import importlib

import pytest
from modules.shared import config


@pytest.mark.parametrize('branch', ['dev', 'qa', 'feature/new', 'staging', 'master', 'production', '', 'detached-sha'])
def test_every_non_main_branch_ignores_production_overrides(monkeypatch, branch):
    monkeypatch.setattr(config, 'detect_branch_name', lambda: branch)
    monkeypatch.setenv('MONGODB_URL', 'mongodb://production')
    monkeypatch.setenv('MONGODB_URL_MAIN', 'mongodb://production')
    monkeypatch.setenv('MONGODB_URL_DEV_QA', 'mongodb://testing')
    token = config.current_cluster_var.set('main')
    try:
        assert config.get_active_cluster() == 'dev_qa'
        assert config.resolve_mongodb_url() == 'mongodb://testing'
        assert config.get_mongodb_url_for_cluster('main') == 'mongodb://testing'
    finally:
        config.current_cluster_var.reset(token)


def test_main_uses_production_and_can_handle_preview_calendar_callback(monkeypatch):
    monkeypatch.setattr(config, 'detect_branch_name', lambda: 'main')
    monkeypatch.setenv('MONGODB_URL_MAIN', 'mongodb://production')
    token = config.current_cluster_var.set(None)
    try:
        assert config.get_active_cluster() == 'main'
        assert config.resolve_mongodb_url() == 'mongodb://production'
        config.current_cluster_var.set('dev_qa')
        assert config.get_active_cluster() == 'dev_qa'
    finally:
        config.current_cluster_var.reset(token)


def test_explicit_client_cannot_reuse_production_pool_on_feature_branch(monkeypatch):
    shared = importlib.import_module('modules.shared.db')
    monkeypatch.setattr(config, 'detect_branch_name', lambda: 'feature/test')
    production, testing = object(), object()
    monkeypatch.setattr(shared, '_clients', {'main': production, 'dev_qa': testing})
    assert shared._get_client('main') is testing


def test_screening_uses_shared_database(monkeypatch):
    from modules.candidate_screening_agent.services import db_service
    shared = importlib.import_module('modules.shared.db')
    monkeypatch.setenv('MONGODB_URL', 'mongodb://production')
    assert db_service.get_db() is shared.db


@pytest.mark.parametrize('branch,expected', [('feature/test', 'dev_qa'), ('main', 'main')])
def test_request_headers_cannot_override_branch(monkeypatch, branch, expected):
    import asyncio
    from starlette.requests import Request
    from starlette.responses import Response
    import main
    monkeypatch.setattr(config, 'detect_branch_name', lambda: branch)
    request = Request({'type': 'http', 'method': 'GET', 'path': '/', 'query_string': b'',
                       'headers': [(b'host', b'termjobs.in'), (b'origin', b'https://term-jobs-git-qa-test.vercel.app')]})
    async def next_handler(request):
        assert config.get_active_cluster() == expected
        return Response('ok')
    response = asyncio.run(main.vercel_routing_middleware(request, next_handler))
    assert response.status_code == 200
