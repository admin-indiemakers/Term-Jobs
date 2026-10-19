"""Exercise the app's actual 404 handler without importing startup integrations."""
import ast
import asyncio
import json
from pathlib import Path
from types import SimpleNamespace

from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse


def handler():
    path = Path(__file__).parents[1] / 'main.py'
    tree = ast.parse(path.read_text(encoding='utf-8'))
    function = next(node for node in tree.body if isinstance(node, ast.AsyncFunctionDef) and node.name == 'custom_404_handler')
    function.decorator_list = []
    namespace = {'Request': Request, 'JSONResponse': JSONResponse}
    exec(compile(ast.Module(body=[function], type_ignores=[]), str(path), 'exec'), namespace)
    return namespace['custom_404_handler']


def test_missing_resource_keeps_its_reason_and_does_not_expose_credentials():
    response = asyncio.run(handler()(SimpleNamespace(), HTTPException(404, 'Interview round not found')))
    assert json.loads(response.body) == {'detail': 'Interview round not found'}


def test_unknown_route_does_not_echo_request_headers_or_invitation_query():
    request = SimpleNamespace(url='https://example.com/unknown?token=private-invite', headers={'Authorization': 'Bearer secret'})
    response = asyncio.run(handler()(request, HTTPException(404)))
    assert response.status_code == 404
    assert json.loads(response.body) == {'error': 'Route Not Found'}
