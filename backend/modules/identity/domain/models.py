"""Identity models (MongoDB collections)."""
from typing import ClassVar

from ...shared.db import Column, Model, _utcnow, _uuid


class Tenant(Model):
    __tablename__ = "tenants"

    _fields: ClassVar[dict[str, object]] = {
        "id": _uuid,
        "name": "",
        "tenant_type": "client",  # client or consultancy
        "created_at": _utcnow,
    }

    id = Column("id")
    name = Column("name")
    tenant_type = Column("tenant_type")
    created_at = Column("created_at")


class User(Model):
    __tablename__ = "users"

    _fields: ClassVar[dict[str, object]] = {
        "id": _uuid,
        "tenant_id": "",
        "email": "",
        "name": "",
        "password_hash": "",
        "role": "",  # Hiring Manager, Recruiter, Admin
        "created_at": _utcnow,
    }

    id = Column("id")
    tenant_id = Column("tenant_id")
    email = Column("email")
    name = Column("name")
    password_hash = Column("password_hash")
    role = Column("role")
    created_at = Column("created_at")
