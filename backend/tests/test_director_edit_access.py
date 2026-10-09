"""Exercise mutation authorization without initializing the application database."""
import ast
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from fastapi import HTTPException


@pytest.mark.parametrize('role', ['Director', 'director', 'DIRECTOR'])
@pytest.mark.parametrize('endpoint', ['start_requisition_flow', 'answer_intake_question', 'refine_requisition_jd', 'update_requisition_role', 'approve_requisition'])
def test_director_cannot_mutate_requisition(role, endpoint):
    tree = ast.parse((Path(__file__).parents[1] / 'main.py').read_text())
    functions = []
    for node in tree.body:
        if isinstance(node, ast.FunctionDef) and node.name in ('_require_writable', endpoint):
            node.decorator_list = []
            node.returns = None
            for arg in node.args.args:
                arg.annotation = None
            node.args.defaults = []
            functions.append(node)
    persistence = Mock(side_effect=AssertionError('Must reject before accessing requisition'))
    scope = {'HTTPException': HTTPException, '_get_requisition': persistence}
    exec(compile(ast.Module(body=functions, type_ignores=[]), '<requisition authorization>', 'exec'), scope)
    args = {'requisition_id': 'req-123', 'current_user': SimpleNamespace(role=role)}
    if endpoint in ('answer_intake_question', 'refine_requisition_jd', 'update_requisition_role', 'approve_requisition'):
        args['body'] = SimpleNamespace()
    with pytest.raises(HTTPException) as error:
        scope[endpoint](**args)
    assert error.value.status_code == 403
    persistence.assert_not_called()
