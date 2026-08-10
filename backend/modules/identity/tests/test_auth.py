import mongomock
import pytest
from fastapi import HTTPException

from modules.identity.domain.models import Tenant, User
from modules.identity.domain.schemas import TenantCreate, UserCreate, UserLogin
from modules.identity.router import create_tenant, create_user, list_tenants, list_users, login_user, delete_tenant, delete_user, update_user
from modules.identity.services.auth_service import (
    decode_access_token,
    hash_password,
    verify_password,
)
from modules.shared.db import Session


@pytest.fixture
def session_factory():
    database = mongomock.MongoClient()["test"]
    return lambda: Session(database)


def _make_user(session, role, tenant_id, email, name="Test User", password="securepass123", created_by=""):
    user = User(
        tenant_id=tenant_id,
        email=email,
        name=name,
        password_hash=hash_password(password),
        role=role,
        created_by=created_by,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def _make_tenant(session, tenant_type="client", name="Acme Corp"):
    tenant = Tenant(name=name, tenant_type=tenant_type)
    session.add(tenant)
    session.commit()
    session.refresh(tenant)
    return tenant


def test_password_hashing():
    pwd = "my-secure-password"
    hashed = hash_password(pwd)
    assert hashed != pwd
    assert verify_password(pwd, hashed) is True
    assert verify_password("wrong-password", hashed) is False


def test_login_valid_and_invalid(session_factory):
    with session_factory() as session:
        tenant = _make_tenant(session)
        _make_user(session, "Hiring Manager", tenant.id, "login@example.com")

        login = UserLogin(email="login@example.com", password="securepass123")
        res = login_user(login, db=session)
        assert res.access_token is not None
        assert res.user.role == "Hiring Manager"
        assert res.user.tenant_name == "Acme Corp"
        assert res.user.tenant_type == "client"
        assert res.user.created_by == ""

        payload = decode_access_token(res.access_token)
        assert payload is not None
        assert payload["email"] == "login@example.com"
        assert payload["role"] == "Hiring Manager"

        with pytest.raises(HTTPException):
            login_user(UserLogin(email="login@example.com", password="wrongpassword"), db=session)


def test_login_rejects_deactivated_account(session_factory):
    with session_factory() as session:
        tenant = _make_tenant(session)
        _make_user(session, "HR", tenant.id, "hr@example.com")
        user = session.query(User).filter(User.email == "hr@example.com").first()
        user.is_active = False
        session.commit()

        with pytest.raises(HTTPException):
            login_user(UserLogin(email="hr@example.com", password="securepass123"), db=session)


def test_super_admin_creates_company_admin(session_factory):
    with session_factory() as session:
        platform_tenant = _make_tenant(session, "client", "Term Jobs Platform")
        super_admin = _make_user(session, "Super Admin", platform_tenant.id, "super@example.com")
        client_tenant = _make_tenant(session, "client", "Client Inc")
        consultancy_tenant = _make_tenant(session, "consultancy", "Vendor Agency")

        admin_res = create_user(
            UserCreate(
                email="admin@example.com",
                name="Admin Person",
                password="pass1234",
                role="Admin",
                tenant_id=client_tenant.id,
            ),
            current_user=super_admin,
            db=session,
        )
        assert admin_res.role == "Admin"
        assert admin_res.tenant_id == client_tenant.id
        assert admin_res.created_by == super_admin.id

        consultancy_admin_res = create_user(
            UserCreate(
                email="vendoradmin@example.com",
                name="Vendor Admin",
                password="pass1234",
                role="Admin",
                tenant_id=consultancy_tenant.id,
            ),
            current_user=super_admin,
            db=session,
        )
        assert consultancy_admin_res.role == "Admin"
        assert consultancy_admin_res.tenant_id == consultancy_tenant.id


def test_super_admin_cannot_create_non_admin(session_factory):
    with session_factory() as session:
        platform_tenant = _make_tenant(session, "client", "Term Jobs Platform")
        super_admin = _make_user(session, "Super Admin", platform_tenant.id, "super@example.com")
        client_tenant = _make_tenant(session, "client", "Client Inc")

        with pytest.raises(HTTPException):
            create_user(
                UserCreate(
                    email="hr@example.com",
                    name="HR Person",
                    password="pass1234",
                    role="HR",
                    tenant_id=client_tenant.id,
                ),
                current_user=super_admin,
                db=session,
            )

        with pytest.raises(HTTPException):
            create_user(
                UserCreate(
                    email="rec@example.com",
                    name="Recruiter",
                    password="pass1234",
                    role="Recruiter",
                    tenant_id=client_tenant.id,
                ),
                current_user=super_admin,
                db=session,
            )


def test_admin_creates_hiring_manager(session_factory):
    with session_factory() as session:
        client_tenant = _make_tenant(session, "client", "Client Inc")
        admin = _make_user(session, "Admin", client_tenant.id, "admin@example.com")

        hm_res = create_user(
            UserCreate(email="hm@example.com", name="Hiring Manager", password="pass1234", role="Hiring Manager"),
            current_user=admin,
            db=session,
        )
        assert hm_res.role == "Hiring Manager"
        # Hiring Manager inherits the Admin's tenant.
        assert hm_res.tenant_id == client_tenant.id
        assert hm_res.created_by == admin.id


def test_admin_creates_hr(session_factory):
    from modules.identity.router import list_users

    with session_factory() as session:
        client_tenant = _make_tenant(session, "client", "Client Inc")
        admin = _make_user(session, "Admin", client_tenant.id, "admin@example.com")

        hr_res = create_user(
            UserCreate(email="hr@example.com", name="HR Lead", password="pass1234", role="HR"),
            current_user=admin,
            db=session,
        )
        assert hr_res.role == "HR"
        assert hr_res.tenant_id == client_tenant.id
        assert hr_res.created_by == admin.id

        # Admin sees the HR account in their tenant user list.
        emails = {u.email for u in list_users(current_user=admin, db=session)}
        assert "hr@example.com" in emails


def test_change_password(session_factory):
    from modules.identity.domain.schemas import PasswordChange
    from modules.identity.router import change_password

    with session_factory() as session:
        client_tenant = _make_tenant(session, "client", "Client Inc")
        admin = _make_user(session, "Admin", client_tenant.id, "admin@example.com")

        # Wrong current password -> rejected.
        with pytest.raises(HTTPException):
            change_password(
                PasswordChange(current_password="wrongpass", new_password="newpass123"),
                current_user=admin,
                db=session,
            )

        # Correct current password -> updated, new password works, old does not.
        change_password(
            PasswordChange(current_password="securepass123", new_password="newpass123"),
            current_user=admin,
            db=session,
        )
        session.refresh(admin)
        assert verify_password("newpass123", admin.password_hash)
        assert not verify_password("securepass123", admin.password_hash)

        login = login_user(UserLogin(email="admin@example.com", password="newpass123"), db=session)
        assert login.user.email == "admin@example.com"


def test_hr_creates_hiring_manager(session_factory):
    with session_factory() as session:
        client_tenant = _make_tenant(session, "client", "Client Inc")
        hr = _make_user(session, "HR", client_tenant.id, "hr@example.com")

        hm_res = create_user(
            UserCreate(email="hm@example.com", name="Hiring Manager", password="pass1234", role="Hiring Manager"),
            current_user=hr,
            db=session,
        )
        assert hm_res.role == "Hiring Manager"
        assert hm_res.tenant_id == client_tenant.id
        assert hm_res.created_by == hr.id


def test_provisioning_role_denied(session_factory):
    with session_factory() as session:
        client_tenant = _make_tenant(session, "client", "Client Inc")
        consultancy_tenant = _make_tenant(session, "consultancy", "Vendor Agency")

        # Admin trying to create another Admin (not allowed).
        admin = _make_user(session, "Admin", client_tenant.id, "admin@example.com")
        with pytest.raises(HTTPException):
            create_user(
                UserCreate(email="admin2@example.com", name="Admin2", password="pass1234", role="Admin"),
                current_user=admin,
                db=session,
            )

        # Admin trying to create a Recruiter (not allowed; Recruiters need a consultancy tenant).
        with pytest.raises(HTTPException):
            create_user(
                UserCreate(
                    email="rec@example.com",
                    name="Recruiter",
                    password="pass1234",
                    role="Recruiter",
                    tenant_id=consultancy_tenant.id,
                ),
                current_user=admin,
                db=session,
            )

        # Admin cannot provision another Admin.
        with pytest.raises(HTTPException):
            create_user(
                UserCreate(email="super2@example.com", name="SA2", password="pass1234", role="Super Admin"),
                current_user=admin,
                db=session,
            )

        # HR trying to create another HR (not allowed).
        hr = _make_user(session, "HR", client_tenant.id, "hr@example.com")
        with pytest.raises(HTTPException):
            create_user(
                UserCreate(email="hr2@example.com", name="HR2", password="pass1234", role="HR"),
                current_user=hr,
                db=session,
            )

        # Hiring Manager trying to create anything (not allowed at all).
        hm = _make_user(session, "Hiring Manager", client_tenant.id, "hm@example.com")
        with pytest.raises(HTTPException):
            create_user(
                UserCreate(email="hm2@example.com", name="HM2", password="pass1234", role="Hiring Manager"),
                current_user=hm,
                db=session,
            )

        # Invalid role string.
        super_admin = _make_user(session, "Super Admin", client_tenant.id, "super@example.com")
        with pytest.raises(HTTPException):
            create_user(
                UserCreate(email="x@example.com", name="X", password="pass1234", role="CEO"),
                current_user=super_admin,
                db=session,
            )


def test_admin_requires_tenant(session_factory):
    with session_factory() as session:
        platform_tenant = _make_tenant(session, "client", "Term Jobs Platform")
        super_admin = _make_user(session, "Super Admin", platform_tenant.id, "super@example.com")

        # Admin without a tenant_id is rejected.
        with pytest.raises(HTTPException):
            create_user(
                UserCreate(email="admin@example.com", name="Admin", password="pass1234", role="Admin"),
                current_user=super_admin,
                db=session,
            )

        # Admin pointing at a nonexistent tenant is rejected.
        with pytest.raises(HTTPException):
            create_user(
                UserCreate(email="admin@example.com", name="Admin", password="pass1234", role="Admin", tenant_id="nope"),
                current_user=super_admin,
                db=session,
            )


def test_duplicate_email_rejected(session_factory):
    with session_factory() as session:
        client_tenant = _make_tenant(session, "client", "Client Inc")
        admin = _make_user(session, "Admin", client_tenant.id, "admin@example.com")
        _make_user(session, "Hiring Manager", client_tenant.id, "dup@example.com")

        with pytest.raises(HTTPException):
            create_user(
                UserCreate(email="dup@example.com", name="Duplicate", password="pass1234", role="Hiring Manager"),
                current_user=admin,
                db=session,
            )


def test_super_admin_tenant_management(session_factory):
    with session_factory() as session:
        platform_tenant = _make_tenant(session, "client", "Term Jobs Platform")
        super_admin = _make_user(session, "Super Admin", platform_tenant.id, "super@example.com")

        created = create_tenant(
            TenantCreate(name="Vendor Agency", tenant_type="consultancy"),
            current_user=super_admin,
            db=session,
        )
        assert created.name == "Vendor Agency"
        assert created.tenant_type == "consultancy"
        assert created.id

        create_tenant(
            TenantCreate(name="Client Inc", tenant_type="client"),
            current_user=super_admin,
            db=session,
        )

        result = list_tenants(current_user=super_admin, db=session)
        names = [t.name for t in result]
        assert "Vendor Agency" in names
        assert "Client Inc" in names
        assert "Term Jobs Platform" in names

    # Non-super-admin cannot create tenants.
    with session_factory() as session:
        client_tenant = _make_tenant(session, "client", "Client Inc")
        admin = _make_user(session, "Admin", client_tenant.id, "admin@example.com")
        with pytest.raises(HTTPException):
            create_tenant(
                TenantCreate(name="Extra Co", tenant_type="client"),
                current_user=admin,
                db=session,
            )
        with pytest.raises(HTTPException):
            create_tenant(
                TenantCreate(name="Extra Co", tenant_type="client"),
                current_user=admin,
                db=session,
            )


def test_admin_lists_own_tenant_only(session_factory):
    from modules.identity.router import list_tenants

    with session_factory() as session:
        client_tenant = _make_tenant(session, "client", "Client Inc")
        admin = _make_user(session, "Admin", client_tenant.id, "admin@example.com")

        result = list_tenants(current_user=admin, db=session)
        assert [t.name for t in result] == ["Client Inc"]


def test_list_users_scoping(session_factory):
    with session_factory() as session:
        client_tenant = _make_tenant(session, "client", "Client Inc")
        other_tenant = _make_tenant(session, "consultancy", "Vendor Agency")

        super_admin = _make_user(session, "Super Admin", other_tenant.id, "super@example.com")
        admin = _make_user(session, "Admin", client_tenant.id, "admin@example.com")
        hm = _make_user(session, "Hiring Manager", client_tenant.id, "hm@example.com", created_by=admin.id)
        hr = _make_user(session, "HR", client_tenant.id, "hr@example.com")
        _make_user(session, "Hiring Manager", client_tenant.id, "hm2@example.com", created_by=hr.id)
        _make_user(session, "Admin", other_tenant.id, "otheradmin@example.com")

        # Super Admin sees everyone.
        all_emails = {u.email for u in list_users(current_user=super_admin, db=session)}
        assert all_emails == {
            "super@example.com",
            "admin@example.com",
            "hm@example.com",
            "hr@example.com",
            "hm2@example.com",
            "otheradmin@example.com",
        }

        # Admin sees only their tenant.
        admin_emails = {u.email for u in list_users(current_user=admin, db=session)}
        assert admin_emails == {"admin@example.com", "hm@example.com", "hr@example.com", "hm2@example.com"}

        # HR sees only the accounts they created.
        hr_emails = {u.email for u in list_users(current_user=hr, db=session)}
        assert hr_emails == {"hm2@example.com"}

        # Hiring Manager cannot list users.
        with pytest.raises(HTTPException):
            list_users(current_user=hm, db=session)


def test_update_user_email_and_password(session_factory):
    from modules.identity.domain.schemas import UserUpdate

    with session_factory() as session:
        client_tenant = _make_tenant(session, "client", "Client Inc")
        admin = _make_user(session, "Admin", client_tenant.id, "admin@example.com")
        hm = _make_user(session, "Hiring Manager", client_tenant.id, "hm@example.com", created_by=admin.id)

        # Super Admin updates email + password.
        super_admin = _make_user(session, "Super Admin", client_tenant.id, "super@example.com")
        res = update_user(
            hm.id,
            UserUpdate(email="hm-new@example.com", password="newpass123"),
            current_user=super_admin,
            db=session,
        )
        assert res.email == "hm-new@example.com"

        # New password works.
        login = login_user(UserLogin(email="hm-new@example.com", password="newpass123"), db=session)
        assert login.user.email == "hm-new@example.com"

        # Duplicate email rejected.
        with pytest.raises(HTTPException):
            update_user(
                hm.id,
                UserUpdate(email="admin@example.com"),
                current_user=super_admin,
                db=session,
            )


def test_update_user_scoping(session_factory):
    from modules.identity.domain.schemas import UserUpdate

    with session_factory() as session:
        client_tenant = _make_tenant(session, "client", "Client Inc")
        other_tenant = _make_tenant(session, "consultancy", "Vendor Agency")
        admin = _make_user(session, "Admin", client_tenant.id, "admin@example.com")
        other_admin = _make_user(session, "Admin", other_tenant.id, "otheradmin@example.com")
        hr = _make_user(session, "HR", client_tenant.id, "hr@example.com")
        hm = _make_user(session, "Hiring Manager", client_tenant.id, "hm@example.com", created_by=hr.id)

        # Admin cannot update an account in another tenant.
        with pytest.raises(HTTPException):
            update_user(
                other_admin.id,
                UserUpdate(name="Nope"),
                current_user=admin,
                db=session,
            )

        # Admin can update an HM in their own tenant.
        res = update_user(hm.id, UserUpdate(name="Updated HM"), current_user=admin, db=session)
        assert res.name == "Updated HM"

        # HR can update an HM they created, but not one they didn't.
        other_hm = _make_user(session, "Hiring Manager", client_tenant.id, "otherhm@example.com", created_by=admin.id)
        with pytest.raises(HTTPException):
            update_user(other_hm.id, UserUpdate(name="Nope"), current_user=hr, db=session)

        # Hiring Manager cannot update anyone.
        with pytest.raises(HTTPException):
            update_user(hm.id, UserUpdate(name="Nope"), current_user=hm, db=session)


def test_delete_tenant_cascades_users(session_factory):
    with session_factory() as session:
        client_tenant = _make_tenant(session, "client", "Client Inc")
        super_admin = _make_user(session, "Super Admin", client_tenant.id, "super@example.com")
        _make_user(session, "Admin", client_tenant.id, "admin@example.com")
        _make_user(session, "Hiring Manager", client_tenant.id, "hm@example.com")

        delete_tenant(client_tenant.id, current_user=super_admin, db=session)

        assert session.query(Tenant).filter(Tenant.id == client_tenant.id).first() is None
        assert session.query(User).filter(User.tenant_id == client_tenant.id).all() == []

        # Other tenants are untouched.
        other = _make_tenant(session, "client", "Other Co")
        assert session.query(Tenant).filter(Tenant.id == other.id).first() is not None

    # Only Super Admin can delete tenants.
    with session_factory() as session:
        client_tenant = _make_tenant(session, "client", "Client Inc")
        admin = _make_user(session, "Admin", client_tenant.id, "admin@example.com")
        with pytest.raises(HTTPException):
            delete_tenant(client_tenant.id, current_user=admin, db=session)


def test_delete_user_scoping(session_factory):
    with session_factory() as session:
        client_tenant = _make_tenant(session, "client", "Client Inc")
        other_tenant = _make_tenant(session, "consultancy", "Vendor Agency")
        admin = _make_user(session, "Admin", client_tenant.id, "admin@example.com")
        other_admin = _make_user(session, "Admin", other_tenant.id, "otheradmin@example.com")
        hr = _make_user(session, "HR", client_tenant.id, "hr@example.com")
        hm = _make_user(session, "Hiring Manager", client_tenant.id, "hm@example.com", created_by=hr.id)

        # Admin cannot delete accounts outside their tenant.
        with pytest.raises(HTTPException):
            delete_user(other_admin.id, current_user=admin, db=session)

        # HR can delete the HMs they created.
        delete_user(hm.id, current_user=hr, db=session)
        assert session.query(User).filter(User.id == hm.id).first() is None

        # Admin can delete accounts within their tenant.
        delete_user(hr.id, current_user=admin, db=session)
        assert session.query(User).filter(User.id == hr.id).first() is None

        # Super Admin can delete anyone.
        super_admin = _make_user(session, "Super Admin", client_tenant.id, "super@example.com")
        delete_user(admin.id, current_user=super_admin, db=session)
        assert session.query(User).filter(User.id == admin.id).first() is None

        # NotFound.
        with pytest.raises(HTTPException):
            delete_user("missing-id", current_user=super_admin, db=session)


def test_admin_lists_and_engages_vendors(session_factory):
    from modules.identity.domain.models import VendorEngagement
    from modules.identity.domain.schemas import VendorEngagementsIn
    from modules.identity.router import list_vendors, set_vendor_engagements

    with session_factory() as session:
        client_tenant = _make_tenant(session, "client", "Client Inc")
        vendor_a = _make_tenant(session, "consultancy", "Vendor A")
        vendor_b = _make_tenant(session, "consultancy", "Vendor B")
        admin = _make_user(session, "Admin", client_tenant.id, "admin@example.com")

        # Admin lists vendors; none engaged initially.
        vendors = list_vendors(current_user=admin, db=session)
        assert {v.id for v in vendors} == {vendor_a.id, vendor_b.id}
        assert all(not v.engaged for v in vendors)

        # Admin engages Vendor A only.
        updated = set_vendor_engagements(
            VendorEngagementsIn(vendor_tenant_ids=[vendor_a.id]),
            current_user=admin,
            db=session,
        )
        engaged = [v for v in updated if v.engaged]
        assert [v.id for v in engaged] == [vendor_a.id]

        # Engagement persisted.
        rows = session.query(VendorEngagement).filter(
            VendorEngagement.tenant_id == client_tenant.id
        ).all()
        assert {r.vendor_tenant_id for r in rows} == {vendor_a.id}

        # Replace with Vendor B.
        updated2 = set_vendor_engagements(
            VendorEngagementsIn(vendor_tenant_ids=[vendor_b.id]),
            current_user=admin,
            db=session,
        )
        engaged2 = [v for v in updated2 if v.engaged]
        assert [v.id for v in engaged2] == [vendor_b.id]

        # Invalid vendor id rejected.
        with pytest.raises(HTTPException):
            set_vendor_engagements(
                VendorEngagementsIn(vendor_tenant_ids=["missing-vendor"]),
                current_user=admin,
                db=session,
            )


def test_non_admin_cannot_manage_vendors(session_factory):
    from modules.identity.domain.schemas import VendorEngagementsIn
    from modules.identity.router import list_vendors, set_vendor_engagements

    with session_factory() as session:
        client_tenant = _make_tenant(session, "client", "Client Inc")
        vendor_a = _make_tenant(session, "consultancy", "Vendor A")
        recruiter = _make_user(session, "Recruiter", vendor_a.id, "rec@example.com")

        with pytest.raises(HTTPException):
            list_vendors(current_user=recruiter, db=session)
        with pytest.raises(HTTPException):
            set_vendor_engagements(
                VendorEngagementsIn(vendor_tenant_ids=[client_tenant.id]),
                current_user=recruiter,
                db=session,
            )


# --- Director accounts ------------------------------------------------------

def test_admin_creates_director(session_factory):
    with session_factory() as session:
        client_tenant = _make_tenant(session, "client", "Client Inc")
        admin = _make_user(session, "Admin", client_tenant.id, "admin@example.com")

        res = create_user(
            UserCreate(
                email="director@example.com",
                name="Board Director",
                password="pass1234",
                role="Director",
            ),
            current_user=admin,
            db=session,
        )
        assert res.role == "Director"
        # Director inherits the Admin's client tenant.
        assert res.tenant_id == client_tenant.id
        assert res.created_by == admin.id

        # Director can log in with the provisioned credentials.
        login = login_user(UserLogin(email="director@example.com", password="pass1234"), db=session)
        assert login.user.role == "Director"
        payload = decode_access_token(login.access_token)
        assert payload["role"] == "Director"


def test_director_invalid_tenant_type_rejected(session_factory):
    with session_factory() as session:
        consultancy_tenant = _make_tenant(session, "consultancy", "Vendor Agency")
        admin = _make_user(session, "Admin", consultancy_tenant.id, "admin@vendor.com")

        # Directors must belong to a client company tenant.
        with pytest.raises(HTTPException):
            create_user(
                UserCreate(
                    email="director@example.com",
                    name="Director",
                    password="pass1234",
                    role="Director",
                    tenant_id=consultancy_tenant.id,
                ),
                current_user=admin,
                db=session,
            )


def test_non_admin_cannot_create_director(session_factory):
    with session_factory() as session:
        client_tenant = _make_tenant(session, "client", "Client Inc")
        hr = _make_user(session, "HR", client_tenant.id, "hr@example.com")
        hm = _make_user(session, "Hiring Manager", client_tenant.id, "hm@example.com")

        with pytest.raises(HTTPException):
            create_user(
                UserCreate(
                    email="director@example.com",
                    name="Director",
                    password="pass1234",
                    role="Director",
                ),
                current_user=hr,
                db=session,
            )
        with pytest.raises(HTTPException):
            create_user(
                UserCreate(
                    email="director@example.com",
                    name="Director",
                    password="pass1234",
                    role="Director",
                ),
                current_user=hm,
                db=session,
            )


def test_director_read_only_vendor_access(session_factory):
    from modules.identity.router import list_vendors, set_vendor_engagements

    with session_factory() as session:
        client_tenant = _make_tenant(session, "client", "Client Inc")
        vendor_a = _make_tenant(session, "consultancy", "Vendor A")
        director = _make_user(session, "Director", client_tenant.id, "director@example.com")

        # Director can READ the vendor list (read-only executive view).
        vendors = list_vendors(current_user=director, db=session)
        assert {v.id for v in vendors} == {vendor_a.id}

        # Director cannot modify vendor partnerships.
        from modules.identity.domain.schemas import VendorEngagementsIn
        with pytest.raises(HTTPException):
            set_vendor_engagements(
                VendorEngagementsIn(vendor_tenant_ids=[vendor_a.id]),
                current_user=director,
                db=session,
            )


def test_director_cannot_create_users(session_factory):
    with session_factory() as session:
        client_tenant = _make_tenant(session, "client", "Client Inc")
        director = _make_user(session, "Director", client_tenant.id, "director@example.com")

        with pytest.raises(HTTPException):
            create_user(
                UserCreate(
                    email="hm@example.com",
                    name="HM",
                    password="pass1234",
                    role="Hiring Manager",
                ),
                current_user=director,
                db=session,
            )

