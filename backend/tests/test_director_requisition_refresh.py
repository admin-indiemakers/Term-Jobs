"""A Director refresh must read committed approval state despite a stale cache."""
import ast
from contextlib import nullcontext
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock


def test_fresh_requisition_list_bypasses_cached_pending_status(monkeypatch):
    tree = ast.parse((Path(__file__).parents[1] / 'main.py').read_text())
    node = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == 'list_requisitions')
    node.decorator_list = []
    node.returns = None
    for arg in node.args.args:
        arg.annotation = None
    node.args.defaults[-1] = ast.Constant(None)

    # Only the compact dashboard path is needed to exercise cache selection.
    cache = MagicMock()
    cache.get.return_value = [{'id': 'req-1', 'status': 'Pending Approval'}]
    session = MagicMock()
    query = session.query.return_value.order_by.return_value.filter.return_value
    query.only.return_value.all.return_value = [SimpleNamespace(
        id='req-1', status='Published', title='Engineer', created_at=None, updated_at=None,
    )]
    requisition_model = MagicMock()
    scope = {
        '_cache': cache, 'get_session': lambda: nullcontext(session),
        'models': SimpleNamespace(Requisition=requisition_model),
        '_auto_close_expired': lambda: None, '_format_datetime': lambda value: value,
    }
    exec(compile(ast.fix_missing_locations(ast.Module(body=[node], type_ignores=[])), '<list requisitions>', 'exec'), scope)
    user = SimpleNamespace(id='director', role='Director', tenant_id='client')
    assert scope['list_requisitions'](dashboard=True, current_user=user)[0]['status'] == 'Pending Approval'
    assert scope['list_requisitions'](dashboard=True, fresh=True, current_user=user)[0]['status'] == 'Published'
    session.query.assert_called_once()
