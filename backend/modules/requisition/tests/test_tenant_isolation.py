"""Tenant isolation tests: a requisition created by one company is visible only
to users of that company (Super Admin sees all).
"""
import mongomock
import pytest
from fastapi import HTTPException

import main as app_main
from modules.identity.domain.models import Tenant, User
from modules.identity.services.auth_service import hash_password
from modules.requisition.domain.models import CompanyProfile, Requisition
from modules.shared.db import Session


@pytest.fixture
def db_session_factory(monkeypatch):
    database = mongomock.MongoClient()["test"]

    def factory():
        return Session(database)

    monkeypatch.setattr(app_main, "get_session", factory)
    return factory


def _make_tenant(session, tenant_type="client", name="Acme Corp"):
    tenant = Tenant(name=name, tenant_type=tenant_type)
    session.add(tenant)
    session.commit()
    session.refresh(tenant)
    return tenant


def _make_user(session, role, tenant_id, email, name="Test User", password="securepass123"):
    user = User(
        tenant_id=tenant_id,
        email=email,
        name=name,
        password_hash=hash_password(password),
        role=role,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def _make_profile(session, tenant_id, name="Acme Corp"):
    prof = CompanyProfile(tenant_id=tenant_id, name=name)
    session.add(prof)
    session.commit()
    session.refresh(prof)
    return prof


def _make_requisition(session, tenant_id, profile_id, title="Backend Engineer"):
    req = Requisition(tenant_id=tenant_id, company_profile_id=profile_id, title=title)
    session.add(req)
    session.commit()
    session.refresh(req)
    return req


def test_require_tenant_gates_cross_tenant_access():
    user_a = User(id="u-a", tenant_id="tenant-a", role="Hiring Manager")
    user_b = User(id="u-b", tenant_id="tenant-b", role="Hiring Manager")

    req = Requisition(id="r-1", tenant_id="tenant-a")

    # Same tenant -> allowed.
    assert app_main._require_tenant(req, user_a) is req

    # Cross tenant -> 403.
    with pytest.raises(HTTPException) as exc:
        app_main._require_tenant(req, user_b)
    assert exc.value.status_code == 403

    # Super Admin sees everything.
    super_admin = User(id="u-s", tenant_id="platform", role="Super Admin")
    assert app_main._require_tenant(req, super_admin) is req


def test_director_read_only_enforcement():
    director = User(id="u-d", tenant_id="tenant-a", role="Director")
    req = Requisition(id="r-1", tenant_id="tenant-a")

    # Directors can read requisitions in their own tenant.
    assert app_main._require_tenant(req, director) is req

    # Directors are blocked from any mutation endpoint.
    with pytest.raises(HTTPException) as exc:
        app_main._require_writable(director)
    assert exc.value.status_code == 403

    # Other roles (e.g. Admin, Hiring Manager) are allowed to write.
    app_main._require_writable(User(id="u-hm", tenant_id="tenant-a", role="Hiring Manager"))


def test_create_company_profile_assigns_tenant(db_session_factory):
    with db_session_factory() as session:
        tenant = _make_tenant(session, name="Bearitt")
        admin = _make_user(session, "Admin", tenant.id, "admin@bearitt.test")

        body = app_main.CompanyProfileIn(name="Bearitt", location="Mumbai")
        result = app_main.create_company_profile(body, current_user=admin)
        assert result["tenant_id"] == tenant.id

        prof = session.get(CompanyProfile, result["id"])
        assert prof.tenant_id == tenant.id


def test_list_company_profiles_scoped_to_tenant(db_session_factory):
    with db_session_factory() as session:
        tenant_a = _make_tenant(session, name="Bearitt")
        tenant_b = _make_tenant(session, name="Eternanumbers")
        admin_a = _make_user(session, "Admin", tenant_a.id, "admin@bearitt.test")
        admin_b = _make_user(session, "Admin", tenant_b.id, "admin@eterna.test")

        _make_profile(session, tenant_a.id, name="Bearitt")
        _make_profile(session, tenant_b.id, name="Eternanumbers")

        seen_a = app_main.list_company_profiles(current_user=admin_a)
        assert [p["name"] for p in seen_a] == ["Bearitt"]

        seen_b = app_main.list_company_profiles(current_user=admin_b)
        assert [p["name"] for p in seen_b] == ["Eternanumbers"]

        super_admin = _make_user(session, "Super Admin", tenant_a.id, "super@platform.test")
        seen_all = app_main.list_company_profiles(current_user=super_admin)
        assert {p["name"] for p in seen_all} == {"Bearitt", "Eternanumbers"}


def test_list_requisitions_scoped_to_tenant(db_session_factory):
    with db_session_factory() as session:
        tenant_a = _make_tenant(session, name="Bearitt")
        tenant_b = _make_tenant(session, name="Eternanumbers")
        admin_a = _make_user(session, "Admin", tenant_a.id, "admin@bearitt.test")
        admin_b = _make_user(session, "Admin", tenant_b.id, "admin@eterna.test")

        prof_a = _make_profile(session, tenant_a.id, name="Bearitt")
        prof_b = _make_profile(session, tenant_b.id, name="Eternanumbers")
        _make_requisition(session, tenant_a.id, prof_a.id, title="Backend Engineer")
        _make_requisition(session, tenant_b.id, prof_b.id, title="Frontend Engineer")

        titles_a = [r["title"] for r in app_main.list_requisitions(current_user=admin_a)]
        assert titles_a == ["Backend Engineer"]

        titles_b = [r["title"] for r in app_main.list_requisitions(current_user=admin_b)]
        assert titles_b == ["Frontend Engineer"]

        super_admin = _make_user(session, "Super Admin", tenant_a.id, "super@platform.test")
        titles_all = [r["title"] for r in app_main.list_requisitions(current_user=super_admin)]
        assert set(titles_all) == {"Backend Engineer", "Frontend Engineer"}


def test_get_requisition_cross_tenant_403(db_session_factory):
    with db_session_factory() as session:
        tenant_a = _make_tenant(session, name="Bearitt")
        tenant_b = _make_tenant(session, name="Eternanumbers")
        admin_a = _make_user(session, "Admin", tenant_a.id, "admin@bearitt.test")
        admin_b = _make_user(session, "Admin", tenant_b.id, "admin@eterna.test")

        prof_a = _make_profile(session, tenant_a.id, name="Bearitt")
        req_a = _make_requisition(session, tenant_a.id, prof_a.id, title="Backend Engineer")

        # Owner can read.
        assert app_main.get_requisition(req_a.id, current_user=admin_a)["id"] == req_a.id

        # Other company gets 403.
        with pytest.raises(HTTPException) as exc:
            app_main.get_requisition(req_a.id, current_user=admin_b)
        assert exc.value.status_code == 403

        # Super Admin can read.
        super_admin = _make_user(session, "Super Admin", tenant_a.id, "super@platform.test")
        assert app_main.get_requisition(req_a.id, current_user=super_admin)["id"] == req_a.id


def test_create_requisition_rejects_cross_tenant_profile(db_session_factory, monkeypatch):
    with db_session_factory() as session:
        tenant_a = _make_tenant(session, name="Bearitt")
        tenant_b = _make_tenant(session, name="Eternanumbers")
        admin_a = _make_user(session, "Admin", tenant_a.id, "admin@bearitt.test")

        prof_b = _make_profile(session, tenant_b.id, name="Eternanumbers")

        # Company B user creating against their own profile is fine (service stub).
        monkeypatch.setattr(app_main, "service", _FakeService())

        # Company A user cannot create a requisition against company B's profile.
        with pytest.raises(HTTPException) as exc:
            app_main.create_requisition(
                app_main.RequisitionIn(company_profile_id=prof_b.id, title="Poached"),
                current_user=admin_a,
            )
        assert exc.value.status_code == 403


def test_create_requisition_assigns_owner_tenant(db_session_factory, monkeypatch):
    with db_session_factory() as session:
        tenant = _make_tenant(session, name="Bearitt")
        admin = _make_user(session, "Admin", tenant.id, "admin@bearitt.test")
        prof = _make_profile(session, tenant.id, name="Bearitt")

        fake = _FakeService()
        monkeypatch.setattr(app_main, "service", fake)

        app_main.create_requisition(
            app_main.RequisitionIn(company_profile_id=prof.id, title="Backend Engineer"),
            current_user=admin,
        )
        assert fake.last_tenant_id == tenant.id

        # Requisition stored under the user's tenant.
        req = session.get(Requisition, fake.created_req.id)
        assert req.tenant_id == tenant.id


def test_cross_tenant_delete_403(db_session_factory, monkeypatch):
    with db_session_factory() as session:
        tenant_a = _make_tenant(session, name="Bearitt")
        tenant_b = _make_tenant(session, name="Eternanumbers")
        admin_a = _make_user(session, "Admin", tenant_a.id, "admin@bearitt.test")
        admin_b = _make_user(session, "Admin", tenant_b.id, "admin@eterna.test")

        prof_a = _make_profile(session, tenant_a.id, name="Bearitt")
        req_a = _make_requisition(session, tenant_a.id, prof_a.id, title="Backend Engineer")

        monkeypatch.setattr(app_main, "service", _FakeService())

        with pytest.raises(HTTPException) as exc:
            app_main.delete_requisition(req_a.id, current_user=admin_b)
        assert exc.value.status_code == 403

        # Owner can delete.
        app_main.delete_requisition(req_a.id, current_user=admin_a)
        assert session.get(Requisition, req_a.id) is None


class _FakeService:
    """Minimal stand-in for the real RequisitionService used by create_requisition."""

    def __init__(self):
        self.last_tenant_id = None
        self.created_req = None

    def create(self, company_profile_id, intent, created_by, tenant_id="local"):
        self.last_tenant_id = tenant_id
        self.created_req = Requisition(
            tenant_id=tenant_id,
            company_profile_id=company_profile_id,
            created_by=created_by,
            title=intent.title,
        )
        with app_main.get_session() as session:
            session.add(self.created_req)
            session.commit()
            session.refresh(self.created_req)
        return self.created_req

    def delete(self, requisition_id):
        with app_main.get_session() as session:
            req = session.get(Requisition, requisition_id)
            if req is None:
                raise ValueError(f"requisition {requisition_id} not found")
            session.delete(req)
            session.commit()
