import ast
from pathlib import Path
from unittest.mock import Mock
import pytest
from fastapi import HTTPException


@pytest.mark.parametrize('gates', [None, [], [{'type': 'blocking', 'status': 'pending'}], [{'type': 'blocking', 'status': 'cleared'}, {'type': 'blocking', 'status': 'pending'}]])
def test_credential_dispatch_blocked_before_password_or_email_changes(gates):
    tree = ast.parse((Path(__file__).parents[1] / 'modules/onboarding/router.py').read_text())
    node = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == 'send_candidate_credentials')
    node.decorator_list = []
    node.args.defaults = []
    for arg in node.args.args:
        arg.annotation = None
    db = Mock()
    scope = {'HTTPException': HTTPException, 'db': db, '_get_current_user': lambda _: {'role': 'Hiring Manager'}, '_get_or_create_onboarding_doc': lambda _: {'activation_gates': gates}}
    exec(compile(ast.Module(body=[node], type_ignores=[]), '<credentials>', 'exec'), scope)
    with pytest.raises(HTTPException) as error:
        scope[node.name]('candidate', {}, 'Bearer test')
    assert error.value.status_code == 409
    db.assert_not_called()
    assert not db.mock_calls
