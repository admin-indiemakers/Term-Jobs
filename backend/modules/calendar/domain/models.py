"""Company calendar configuration model (MongoDB collection).

Each tenant stores its company calendar provider preference here. For now
this only holds the provider selection (Google / Microsoft / Zoho); real
OAuth token sync will extend this later.
"""
from typing import ClassVar

from ...shared.db import Column, Model, _utcnow, _uuid


class CalendarConfig(Model):
    __tablename__ = "calendar_configs"

    _fields: ClassVar[dict[str, object]] = {
        "id": _uuid,
        "tenant_id": None,
        "provider": None,          # "google" | "microsoft" | "zoho" | None
        "status": "disconnected",  # "connected" | "disconnected"
        "connected_email": None,
        "access_token": None,
        "refresh_token": None,
        "token_expiry": None,      # epoch seconds when access_token expires
        "created_at": _utcnow,
        "updated_at": _utcnow,
    }

    id = Column("id")
    tenant_id = Column("tenant_id")
    provider = Column("provider")
    status = Column("status")
    connected_email = Column("connected_email")
    access_token = Column("access_token")
    refresh_token = Column("refresh_token")
    token_expiry = Column("token_expiry")
    created_at = Column("created_at")
    updated_at = Column("updated_at")
