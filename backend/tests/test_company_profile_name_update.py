"""Regression coverage for edits to an existing company profile."""
import ast
from pathlib import Path
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import Mock

from fastapi import HTTPException, status


class TenantStub:
    id = "id"
    name = "name"
    is_deleted = "is_deleted"


class UserStub:
    id = "id"
    email = "email"
    is_deleted = "is_deleted"


class QueryStub:
    def __init__(self, value):
        self.value = value

    def filter(self, *args):
        return self

    def first(self):
        return self.value


def profile_endpoint(other_tenant_exists=True):
    path = Path(__file__).parents[1] / "modules/identity/router.py"
    tree = ast.parse(path.read_text())
    node = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == "update_company_profile")
    node.decorator_list = []
    node.returns = None
    node.args.defaults = []
    for arg in node.args.args:
        arg.annotation = None

    tenant = SimpleNamespace(id="tenant-1", name="APPLE", tenant_type="client", logo_url="")
    other_tenant = SimpleNamespace(id="tenant-2", name="APPLE")
    admin = SimpleNamespace(id="user-1", name="Admin", email="admin@example.com", phone="", role="Admin")
    company = SimpleNamespace(
        name="APPLE", industry="Technology", size="100", location="Old HQ",
        tech_stack=[], notes="", logo_url="",
    )
    queries = []

    class SessionStub:
        commit = Mock()

        def query(self, model):
            queries.append(model)
            if model is TenantStub:
                return QueryStub(tenant if queries.count(TenantStub) == 1 else (other_tenant if other_tenant_exists else None))
            return QueryStub(admin)

    session = SessionStub()
    scope = {
        "Tenant": TenantStub,
        "User": UserStub,
        "CompanyProfile": object,
        "CompanyProfileDetailResponse": lambda **values: values,
        "HTTPException": HTTPException,
        "status": status,
        "func": SimpleNamespace(lower=lambda value: value),
        "_get_company_profile": lambda *_: company,
        "_cache": SimpleNamespace(invalidate_prefix=Mock()),
        "_log_admin_action": Mock(),
    }
    exec(compile(ast.Module(body=[node], type_ignores=[]), str(path), "exec"), scope)
    return scope["update_company_profile"], session, tenant, company, queries


def body(name):
    return SimpleNamespace(
        name=name, industry=None, size=None, location="New HQ", tech_stack=None,
        notes=None, logo_url=None, admin_name=None, admin_email=None, admin_phone=None,
    )


class CompanyProfileNameUpdateTests(TestCase):
    def test_headquarters_update_does_not_recheck_existing_company_name(self):
        endpoint, session, tenant, company, queries = profile_endpoint()
        result = endpoint(body("APPLE"), SimpleNamespace(role="Admin", tenant_id=tenant.id, id="user-1"), session)

        self.assertEqual(result["location"], "New HQ")
        self.assertEqual(company.location, "New HQ")
        self.assertEqual(queries.count(TenantStub), 1)
        session.commit.assert_called_once()

    def test_renaming_to_another_company_still_rejects_duplicate(self):
        endpoint, session, tenant, company, queries = profile_endpoint()
        with self.assertRaises(HTTPException) as error:
            endpoint(body("OTHER"), SimpleNamespace(role="Admin", tenant_id=tenant.id, id="user-1"), session)

        self.assertEqual(error.exception.status_code, 400)
        self.assertEqual(queries.count(TenantStub), 2)
        self.assertEqual(company.location, "Old HQ")
        session.commit.assert_not_called()

    def test_unique_rename_still_saves(self):
        endpoint, session, tenant, company, queries = profile_endpoint(other_tenant_exists=False)
        result = endpoint(body("NEW NAME"), SimpleNamespace(role="Admin", tenant_id=tenant.id, id="user-1"), session)

        self.assertEqual(result["name"], "NEW NAME")
        self.assertEqual(company.name, "NEW NAME")
        self.assertEqual(queries.count(TenantStub), 2)
        session.commit.assert_called_once()
