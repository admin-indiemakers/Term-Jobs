"""Pending Finance access requests must not receive an authenticated session."""
import ast
from pathlib import Path
from types import SimpleNamespace
from unittest import TestCase

from fastapi import HTTPException, status


class UserStub:
    id = "id"
    email = "email"


class QueryStub:
    def __init__(self, user):
        self.user = user

    def filter(self, *args):
        return self

    def first(self):
        return self.user


class SessionStub:
    def __init__(self, user):
        self.user = user

    def query(self, model):
        return QueryStub(self.user)


def login_endpoint():
    path = Path(__file__).parents[1] / "modules/identity/router.py"
    tree = ast.parse(path.read_text())
    node = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == "login_user")
    node.decorator_list = []
    node.returns = None
    node.args.defaults = []
    for arg in node.args.args:
        arg.annotation = None
    scope = {
        "User": UserStub,
        "HTTPException": HTTPException,
        "status": status,
        "verify_password": lambda supplied, stored: supplied == stored,
        "hash_password": lambda password: password,
        "create_access_token": lambda data: "test-token",
        "_get_company_profile": lambda *args: None,
        "_tenant_name": lambda *args: "Example Company",
        "_tenant_type": lambda *args: "client",
        "UserResponse": lambda **data: SimpleNamespace(**data),
        "TokenResponse": lambda **data: SimpleNamespace(**data),
    }
    exec(compile(ast.Module(body=[node], type_ignores=[]), str(path), "exec"), scope)
    return scope["login_user"]


def current_user_endpoint(cached_user):
    path = Path(__file__).parents[1] / "modules/identity/router.py"
    tree = ast.parse(path.read_text())
    node = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == "get_current_user")
    node.decorator_list = []
    node.returns = None
    node.args.defaults = []
    for arg in node.args.args:
        arg.annotation = None
    scope = {
        "User": UserStub,
        "HTTPException": HTTPException,
        "status": status,
        "decode_access_token": lambda token: {"sub": "finance-1"},
        "_cache": SimpleNamespace(get=lambda key: cached_user, set=lambda *args, **kwargs: None),
    }
    exec(compile(ast.Module(body=[node], type_ignores=[]), str(path), "exec"), scope)
    return scope["get_current_user"]


class FinanceApprovalLoginTests(TestCase):
    def setUp(self):
        self.user = SimpleNamespace(
            id="finance-1", email="finance@example.com", name="Finance User", role="Finance Team",
            password_hash="correct-password", is_active=False, is_deleted=False,
            tenant_id="tenant-1", department="Finance & Accounts", created_by="self_invite",
            workorder_id="", candidate_id="",
        )
        self.body = SimpleNamespace(username="finance@example.com", email="finance@example.com", password="correct-password")

    def test_pending_finance_account_cannot_sign_in(self):
        with self.assertRaises(HTTPException) as error:
            login_endpoint()(self.body, SessionStub(self.user))
        self.assertEqual(error.exception.status_code, 403)
        self.assertIn("pending approval", error.exception.detail)

    def test_approved_finance_account_can_sign_in(self):
        self.user.is_active = True
        result = login_endpoint()(self.body, SessionStub(self.user))
        self.assertEqual(result.access_token, "test-token")
        self.assertEqual(result.user.role, "Finance Team")

    def test_cached_finance_session_cannot_bypass_pending_state(self):
        cached_user = SimpleNamespace(id="finance-1", role="Finance Team", is_active=True)
        with self.assertRaises(HTTPException) as error:
            current_user_endpoint(cached_user)("Bearer old-token", SessionStub(self.user))
        self.assertEqual(error.exception.status_code, 401)
