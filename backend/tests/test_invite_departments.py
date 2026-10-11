"""Invitees cannot choose their own Procurement or Finance department."""
import ast
from pathlib import Path
from types import SimpleNamespace
from unittest import TestCase

from fastapi import HTTPException, status


class UserStub:
    email = "email"

    def __init__(self, **values):
        self.__dict__.update(values)
        self.id = "new-user"


class QueryStub:
    def __init__(self, values):
        self.values = values

    def filter(self, *args):
        return self

    def first(self):
        return None

    def all(self):
        return self.values


class SessionStub:
    def __init__(self):
        self.created = None

    def query(self, model):
        return QueryStub([] if model is UserStub else [SimpleNamespace(id="tenant-1", name="Example", tenant_type="client")])

    def add(self, user):
        self.created = user

    def commit(self):
        pass

    def refresh(self, user):
        pass


def registration_endpoint(name):
    path = Path(__file__).parents[1] / "modules/identity/router.py"
    tree = ast.parse(path.read_text())
    node = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == name)
    node.decorator_list = []
    node.returns = None
    node.args.defaults = []
    for arg in node.args.args:
        arg.annotation = None
    scope = {
        "User": UserStub,
        "Tenant": object,
        "HTTPException": HTTPException,
        "status": status,
        "hash_password": lambda password: "hashed-password",
        "_cache": SimpleNamespace(invalidate_prefix=lambda prefix: None),
    }
    exec(compile(ast.Module(body=[node], type_ignores=[]), str(path), "exec"), scope)
    return scope[name]


class InviteDepartmentTests(TestCase):
    def test_procurement_department_is_server_assigned(self):
        session = SessionStub()
        body = SimpleNamespace(email="person@example.com", name="Person", password="securepass",
                               department="Unauthorised", tenant_id="tenant-1", company_name="Example")
        response = registration_endpoint("register_procurement")(body, session)
        self.assertEqual(session.created.department, "Procurement & Commercials")
        self.assertEqual(response["user"]["department"], "Procurement & Commercials")

    def test_finance_department_is_server_assigned(self):
        session = SessionStub()
        body = SimpleNamespace(email="person@example.com", name="Person", password="securepass",
                               department="Unauthorised", tenant_id="tenant-1", company_name="Example")
        response = registration_endpoint("register_finance")(body, session)
        self.assertEqual(session.created.department, "Finance & Accounts")
        self.assertEqual(response["user"]["department"], "Finance & Accounts")
