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
        "role": "",  # Admin, HR, Hiring Manager, Recruiter
        "department": "",  # optional department, e.g. Engineering, Sales
        "created_by": "",  # id of the user who provisioned this account ("" for Admin)
        "is_active": True,
        "candidate_limit": None,  # per-account cap on vendor submissions; None = platform default
        "created_at": _utcnow,
    }

    id = Column("id")
    tenant_id = Column("tenant_id")
    email = Column("email")
    name = Column("name")
    password_hash = Column("password_hash")
    role = Column("role")
    department = Column("department")
    created_by = Column("created_by")
    is_active = Column("is_active")
    candidate_limit = Column("candidate_limit")
    created_at = Column("created_at")


class VendorEngagement(Model):
    """Links a client company tenant to a consultancy vendor tenant.

    Only engaged vendors can see / submit against that company's published
    requisitions.
    """

    __tablename__ = "vendor_engagements"

    _fields: ClassVar[dict[str, object]] = {
        "id": _uuid,
        "tenant_id": "",  # client company tenant id
        "vendor_tenant_id": "",  # consultancy tenant id
        "candidate_limit": None,  # per-vendor candidate limit
        "created_at": _utcnow,
    }

    id = Column("id")
    tenant_id = Column("tenant_id")
    vendor_tenant_id = Column("vendor_tenant_id")
    candidate_limit = Column("candidate_limit")
    created_at = Column("created_at")
