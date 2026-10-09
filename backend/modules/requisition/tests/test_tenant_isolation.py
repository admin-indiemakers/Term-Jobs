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
    monkeypatch.setattr("modules.shared.db.get_session", factory)
    monkeypatch.setattr("modules.shared.db.db", database)
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


def _make_requisition(session, tenant_id, profile_id, title="Backend Engineer", **kwargs):
    req = Requisition(tenant_id=tenant_id, company_profile_id=profile_id, title=title, **kwargs)
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

    def create(self, company_profile_id, intent, created_by, tenant_id="local", intake_meta=None):
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


def test_role_template_strict_tenant_isolation(db_session_factory):
    """Verify role templates assigned to Buyer Company A are NOT leaked to Buyer Company B."""
    from modules.requisition.domain.models import RoleTemplate

    with db_session_factory() as session:
        tenant_a = _make_tenant(session, name="Buyer A")
        tenant_b = _make_tenant(session, name="Buyer B")
        director_a = _make_user(session, "Director", tenant_a.id, "director@buyera.test")
        director_b = _make_user(session, "Director", tenant_b.id, "director@buyera.b.test")
        hm_b = _make_user(session, "Hiring Manager", tenant_b.id, "hm@buyerb.test")

        # Create role template for Buyer Company A
        tpl_a = RoleTemplate(
            tenant_id=tenant_a.id,
            created_by=director_a.id,
            name="Confidential Senior Python Architect",
            structured_role={
                "title": "Senior Python Architect",
                "ceiling_internal": 2500000,
                "must_have_skills": ["Python", "FastAPI"]
            }
        )
        session.add(tpl_a)
        session.commit()

        # Buyer Company A sees its own template
        seen_a = app_main.list_templates(current_user=director_a)
        assert len(seen_a) == 1
        assert seen_a[0]["name"] == "Confidential Senior Python Architect"

        # Buyer Company B Director and Hiring Manager CANNOT see Buyer Company A's template
        seen_b_director = app_main.list_templates(current_user=director_b)
        assert len(seen_b_director) == 0

        seen_b_hm = app_main.list_templates(current_user=hm_b)
        assert len(seen_b_hm) == 0

        # Cross-tenant delete is blocked with 403
        with pytest.raises(HTTPException) as exc:
            app_main.delete_template(tpl_a.id, current_user=director_b)
        assert exc.value.status_code == 403

        # Super Admin can filter by tenant or see all
        super_admin = _make_user(session, "Super Admin", tenant_a.id, "super@platform.test")
        seen_super_a = app_main.list_templates(tenant_id=tenant_a.id, current_user=super_admin)
        assert len(seen_super_a) == 1

        seen_super_b = app_main.list_templates(tenant_id=tenant_b.id, current_user=super_admin)
        assert len(seen_super_b) == 0


@pytest.mark.anyio
async def test_upload_template_tenant_isolation(db_session_factory):
    """Verify that uploading templates enforces tenant boundaries and rejects cross-tenant assignment."""
    import io
    from fastapi import UploadFile

    with db_session_factory() as session:
        tenant_a = _make_tenant(session, name="Company Alpha")
        tenant_b = _make_tenant(session, name="Company Beta")
        director_a = _make_user(session, "Director", tenant_a.id, "dir@alpha.test")
        director_b = _make_user(session, "Director", tenant_b.id, "dir@beta.test")

        json_bytes = b'{"title": "Confidential Alpha Lead", "role": {"job_title": "Alpha Lead"}}'

        # Upload by Director A without tenant_id explicitly passes -> assigned to Company Alpha
        upload_file_a = UploadFile(filename="alpha_role.json", file=io.BytesIO(json_bytes))
        await app_main.upload_template(file=upload_file_a, current_user=director_a)

        # Company Alpha sees it
        assert len(app_main.list_templates(current_user=director_a)) == 1

        # Company Beta DOES NOT see Company Alpha's template
        assert len(app_main.list_templates(current_user=director_b)) == 0

        # Director B attempts to upload into Company Alpha's tenant -> 403 Forbidden
        upload_file_b = UploadFile(filename="beta_exploit.json", file=io.BytesIO(json_bytes))
        with pytest.raises(HTTPException) as exc:
            await app_main.upload_template(
                file=upload_file_b,
                tenant_id=tenant_a.id,
                current_user=director_b
            )
        assert exc.value.status_code == 403


def test_hiring_manager_delete_published_requisition_notifies_director(db_session_factory, monkeypatch):
    """Verify that when a Hiring Manager deletes an approved/published requisition:
    1. Director receives an in-app notification.
    2. Requisition deletion is logged in deleted_requisitions with 'Deleted by HM' status.
    3. Director Dashboard listing (list_requisitions) shows the deleted requisition.
    4. Hiring Manager listing does not include it.
    """
    from modules.notifications.domain.models import Notification

    with db_session_factory() as session:
        monkeypatch.setattr(app_main, "service", _FakeService())
        tenant = _make_tenant(session, name="Acme Corp")
        director = _make_user(session, "Director", tenant.id, "director@acme.test")
        hm = _make_user(session, "Hiring Manager", tenant.id, "hm@acme.test")
        prof = _make_profile(session, tenant.id, name="Acme Corp")

        # Create requisition that was published and approved by Director
        req = _make_requisition(
            session,
            tenant.id,
            prof.id,
            title="Lead Security Architect",
            status="Published",
            director_approved=True,
            director_approved_by="Jane Director",
            created_by=hm.id,
        )

        # HM deletes the published requisition
        app_main.delete_requisition(req.id, current_user=hm)

        # 1. SQL row is deleted
        assert session.get(Requisition, req.id) is None

        # 2. Director notification was created
        notifs = session.query(Notification).filter(Notification.user_id == director.id).all()
        assert any(n.type == "requisition.deleted_by_hm" and "Lead Security Architect" in (n.title + n.body) for n in notifs)

        # 3. Director listing includes the deleted requisition with 'Deleted by HM' status
        director_reqs = app_main.list_requisitions(current_user=director)
        deleted_match = next((r for r in director_reqs if r["id"] == str(req.id)), None)
        assert deleted_match is not None
        assert deleted_match["status"] == "Deleted by HM"
        assert deleted_match["is_deleted"] is True

        # 4. Hiring manager listing does NOT show the deleted requisition
        hm_reqs = app_main.list_requisitions(current_user=hm)
        assert not any(r["id"] == str(req.id) for r in hm_reqs)



