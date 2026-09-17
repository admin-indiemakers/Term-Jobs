"""Seed the platform Super Admin account (idempotent).

Usage:
    .venv/bin/python -m scripts.seed_super_admin

Creates the root Super Admin (username "ADMIN", password from
SUPER_ADMIN_PASSWORD or default "ADMIN") if it does not already exist.
Super Admin is the platform root who provisions company Admin accounts for
buyer (client) and vendor (consultancy) companies.
"""
import os

from modules.identity.domain.models import Tenant, User
from modules.identity.services.auth_service import hash_password
from modules.shared.db import get_session

SUPER_ADMIN_EMAIL = os.getenv("SUPER_ADMIN_EMAIL", "ADMIN")
SUPER_ADMIN_PASSWORD = os.getenv("SUPER_ADMIN_PASSWORD", "ADMIN")


def seed_super_admin(session=None) -> User | None:
    def _do_seed(s):
        platform_tenant = s.query(Tenant).filter(Tenant.name == "Term Jobs Platform").first()
        if platform_tenant is None:
            # Fallback to any active client tenant or create dedicated Platform tenant
            platform_tenant = s.query(Tenant).filter(Tenant.tenant_type == "client").first()
        if platform_tenant is None:
            platform_tenant = Tenant(name="Term Jobs Platform", tenant_type="client")
            s.add(platform_tenant)
            s.flush()

        existing = s.query(User).filter(User.email.in_(["ADMIN", "admin"])).first()
        if existing:
            # Enforce canonical state: role Super Admin, password ADMIN, active, valid tenant
            existing.email = SUPER_ADMIN_EMAIL
            existing.role = "Super Admin"
            existing.name = "Super Admin"
            existing.is_active = True
            existing.is_deleted = False
            existing.password_hash = hash_password(SUPER_ADMIN_PASSWORD)
            if platform_tenant and (not existing.tenant_id or existing.tenant_id != platform_tenant.id):
                # Verify existing tenant exists
                t_check = s.query(Tenant).filter(Tenant.id == existing.tenant_id).first()
                if not t_check:
                    existing.tenant_id = platform_tenant.id
            s.commit()
            s.refresh(existing)
            print(f"Super Admin '{SUPER_ADMIN_EMAIL}' verified/updated (id={existing.id}, tenant={existing.tenant_id})")
            return existing

        super_admin = User(
            tenant_id=platform_tenant.id,
            email=SUPER_ADMIN_EMAIL,
            name="Super Admin",
            password_hash=hash_password(SUPER_ADMIN_PASSWORD),
            role="Super Admin",
            is_active=True,
            is_deleted=False,
            created_by="",
        )
        s.add(super_admin)
        s.commit()
        s.refresh(super_admin)
        print(f"Seeded exclusive Super Admin '{SUPER_ADMIN_EMAIL}' (id={super_admin.id}, tenant={platform_tenant.id})")
        return super_admin

    if session is not None:
        return _do_seed(session)
    else:
        with get_session() as s:
            return _do_seed(s)


if __name__ == "__main__":
    seed_super_admin()
