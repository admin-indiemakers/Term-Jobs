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
    body = n.body or getattr(n, "message", "") or ""
    data = n.data or {}
    if not isinstance(data, dict):
        data = {}
    if not data.get("requisition_id") and getattr(n, "requisition_id", None):
        data["requisition_id"] = getattr(n, "requisition_id")
    if not data.get("candidate_id") and getattr(n, "candidate_id", None):
        data["candidate_id"] = getattr(n, "candidate_id")
    if not data.get("candidate_email") and getattr(n, "candidate_email", None):
        data["candidate_email"] = getattr(n, "candidate_email")

    is_read = bool(getattr(n, "read", False)) or getattr(n, "status", "") == "read"
    created_at = n.created_at.isoformat() if hasattr(n.created_at, "isoformat") else (n.created_at or "")

    return {
        "id": str(n.id or getattr(n, "_id", "")),
        "user_id": n.user_id or "",
        "tenant_id": n.tenant_id or "",
        "type": n.type or "notification",
        "title": n.title or "Notification",
        "body": str(body),
        "data": data,
        "read": is_read,
        "created_at": str(created_at),
    }