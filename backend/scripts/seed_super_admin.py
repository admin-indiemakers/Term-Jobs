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


def seed_super_admin() -> User | None:
    with get_session() as session:
        existing = session.query(User).filter(User.email == SUPER_ADMIN_EMAIL).first()
        if existing:
            print(f"Super Admin '{SUPER_ADMIN_EMAIL}' already exists (id={existing.id})")
            return existing

        platform_tenant = session.query(Tenant).filter(Tenant.tenant_type == "client").first()
        if platform_tenant is None:
            platform_tenant = Tenant(name="Term Jobs Platform", tenant_type="client")
            session.add(platform_tenant)
            session.flush()

        super_admin = User(
            tenant_id=platform_tenant.id,
            email=SUPER_ADMIN_EMAIL,
            name="Super Admin",
            password_hash=hash_password(SUPER_ADMIN_PASSWORD),
            role="Super Admin",
            created_by="",
        )
        session.add(super_admin)
        session.commit()
        session.refresh(super_admin)
        print(f"Seeded Super Admin '{SUPER_ADMIN_EMAIL}' (id={super_admin.id}, tenant={platform_tenant.id})")
        return super_admin


if __name__ == "__main__":
    seed_super_admin()
