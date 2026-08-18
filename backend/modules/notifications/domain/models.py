"""Notification model (MongoDB collection).

A notification is targeted at a specific user. It records what happened
(new requisition published, candidate shortlisted/rejected) plus a payload
that lets the frontend deep-link back to the relevant page.
"""
from typing import ClassVar

from ...shared.db import Column, Model, _utcnow, _uuid


class Notification(Model):
    __tablename__ = "notifications"

    _fields: ClassVar[dict[str, object]] = {
        "id": _uuid,
        "user_id": "",  # recipient user id
        "tenant_id": "",  # recipient tenant id (for context)
        "type": "",  # requisition.published | candidate.shortlisted | candidate.rejected
        "title": "",
        "body": "",
        "data": dict,  # {requisition_id, requisition_ref, requisition_title, candidate_id, candidate_name, ...}
        "read": False,
        "created_at": _utcnow,
    }

    id = Column("id")
    user_id = Column("user_id")
    tenant_id = Column("tenant_id")
    type = Column("type")
    title = Column("title")
    body = Column("body")
    data = Column("data")
    read = Column("read")
    created_at = Column("created_at")


def notification_dict(n: Notification) -> dict:
    return {
        "id": n.id,
        "user_id": n.user_id,
        "tenant_id": n.tenant_id,
        "type": n.type,
        "title": n.title,
        "body": n.body,
        "data": n.data or {},
        "read": bool(getattr(n, "read", False)),
        "created_at": n.created_at.isoformat() if hasattr(n.created_at, "isoformat") else n.created_at,
    }