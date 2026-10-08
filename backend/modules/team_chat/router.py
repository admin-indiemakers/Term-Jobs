"""FastAPI router for real-time functional Team Chat between Company Admin and Hiring Managers."""
import logging
from datetime import datetime
from typing import Any, List, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, Query, status

from modules.identity.domain.models import User
from modules.identity.router import get_current_user
from modules.shared.db import db, _uuid, _utcnow

logger = logging.getLogger("team_chat")

router = APIRouter(prefix="/api/team-chat", tags=["Team Chat"])


# ─────────────────────────────────────────────────────────────────────────────
# Pydantic Schemas
# ─────────────────────────────────────────────────────────────────────────────

class SendMessageRequest(BaseModel):
    peer_id: str
    text: str = Field(..., min_length=1, max_length=4000)


class ChatPermissionsUpdateRequest(BaseModel):
    enabled: bool = True
    policy: str = "all"  # "all" or "restricted"
    restricted_user_ids: List[str] = []


def _format_message_time(created_at_str: Optional[str]) -> str:
    """Format ISO timestamp into user-friendly time string (e.g. '10:24 AM' or 'Oct 8')."""
    if not created_at_str:
        return ""
    try:
        dt = datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))
        now = datetime.now(dt.tzinfo)
        if dt.date() == now.date():
            return dt.strftime("%I:%M %p").lower()
        if (now.date() - dt.date()).days == 1:
            return "Yesterday"
        return dt.strftime("%b %d")
    except Exception:
        return created_at_str[:16]


def _get_tenant_chat_settings(tenant_id: str) -> dict:
    """Retrieve chat governance settings for a tenant, initializing defaults if missing."""
    settings = db["tenant_chat_settings"].find_one({"tenant_id": tenant_id})
    if not settings:
        settings = {
            "tenant_id": tenant_id,
            "enabled": True,
            "policy": "all",
            "restricted_user_ids": [],
            "created_at": _utcnow().isoformat(),
            "updated_at": _utcnow().isoformat(),
        }
        try:
            db["tenant_chat_settings"].insert_one(settings)
        except Exception:
            pass
    return settings


def _resolve_tenant_id(current_user: User) -> Optional[str]:
    """Resiliently resolve tenant ID from User model or database lookup."""
    tenant_id = getattr(current_user, "tenant_id", None)
    if tenant_id:
        return tenant_id
    user_doc = db["users"].find_one({"id": current_user.id})
    if user_doc and user_doc.get("tenant_id"):
        return user_doc.get("tenant_id")
    if current_user.role == "Super Admin":
        tenant_doc = db["tenants"].find_one({"is_active": {"$ne": False}})
        if tenant_doc:
            return tenant_doc.get("id") or str(tenant_doc.get("_id"))
    return None


# ─────────────────────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/permissions")
def get_chat_permissions(current_user: User = Depends(get_current_user)) -> dict:
    """Get chat settings and member access list for the tenant."""
    tenant_id = _resolve_tenant_id(current_user)
    if not tenant_id:
        raise HTTPException(status_code=400, detail="User is not associated with a company tenant")

    settings = _get_tenant_chat_settings(tenant_id)
    enabled = settings.get("enabled", True)
    policy = settings.get("policy", "all")
    restricted_user_ids = set(settings.get("restricted_user_ids", []))

    # Determine if current user can chat
    current_user_can_chat = enabled and (current_user.id not in restricted_user_ids)

    # Fetch all members of this tenant to populate permissions management table
    raw_users = list(db["users"].find({
        "tenant_id": tenant_id,
        "is_deleted": {"$ne": True},
        "role": {"$ne": "Candidate"}
    }))

    members = []
    for u in raw_users:
        u_id = u.get("id") or str(u.get("_id"))
        members.append({
            "id": u_id,
            "name": u.get("name") or u.get("email") or "User",
            "email": u.get("email", ""),
            "role": u.get("role", "Member"),
            "department": u.get("department", ""),
            "can_chat": u_id not in restricted_user_ids,
        })

    return {
        "enabled": enabled,
        "policy": policy,
        "restricted_user_ids": list(restricted_user_ids),
        "current_user_can_chat": current_user_can_chat,
        "members": members,
    }


@router.put("/permissions")
def update_chat_permissions(
    payload: ChatPermissionsUpdateRequest,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Update tenant chat settings. Admin and Super Admin only."""
    if current_user.role not in ("Admin", "Super Admin", "Company Admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only company administrators can modify chat settings"
        )

    tenant_id = _resolve_tenant_id(current_user)
    if not tenant_id:
        raise HTTPException(status_code=400, detail="Tenant ID missing")

    update_doc = {
        "tenant_id": tenant_id,
        "enabled": payload.enabled,
        "policy": payload.policy,
        "restricted_user_ids": payload.restricted_user_ids,
        "updated_at": _utcnow().isoformat(),
        "updated_by": current_user.id,
    }

    db["tenant_chat_settings"].update_one(
        {"tenant_id": tenant_id},
        {"$set": update_doc},
        upsert=True
    )

    return {
        "status": "success",
        "message": "Chat permissions updated successfully",
        "settings": {
            "enabled": payload.enabled,
            "policy": payload.policy,
            "restricted_user_ids": payload.restricted_user_ids,
        }
    }


@router.get("/unread-count")
def get_unread_count(current_user: User = Depends(get_current_user)) -> dict:
    """Return total count of unread messages for the current user."""
    tenant_id = _resolve_tenant_id(current_user)
    if not tenant_id:
        return {"unread_count": 0}

    unread = db["team_messages"].count_documents({
        "tenant_id": tenant_id,
        "recipient_id": current_user.id,
        "read": False
    })
    return {"unread_count": unread}


@router.get("/contacts")
def list_contacts(current_user: User = Depends(get_current_user)) -> list:
    """List all team contacts in the same tenant with live unread counts and latest messages."""
    tenant_id = _resolve_tenant_id(current_user)
    if not tenant_id:
        return []

    settings = _get_tenant_chat_settings(tenant_id)
    restricted_user_ids = set(settings.get("restricted_user_ids", []))
    chat_enabled_global = settings.get("enabled", True)

    raw_users = list(db["users"].find({
        "tenant_id": tenant_id,
        "is_deleted": {"$ne": True},
        "role": {"$ne": "Candidate"}
    }))

    contacts = []
    for u in raw_users:
        u_id = u.get("id") or str(u.get("_id"))
        if u_id == current_user.id:
            continue  # Don't chat with self

        # Unread messages from this specific contact to current user
        unread = db["team_messages"].count_documents({
            "tenant_id": tenant_id,
            "sender_id": u_id,
            "recipient_id": current_user.id,
            "read": False
        })

        # Most recent message between current_user and this contact
        last_msg_doc = db["team_messages"].find_one(
            {
                "tenant_id": tenant_id,
                "$or": [
                    {"sender_id": current_user.id, "recipient_id": u_id},
                    {"sender_id": u_id, "recipient_id": current_user.id}
                ]
            },
            sort=[("created_at", -1)]
        )

        last_message_text = last_msg_doc.get("text", "") if last_msg_doc else "No messages yet"
        last_time_str = _format_message_time(last_msg_doc.get("created_at")) if last_msg_doc else ""
        last_timestamp = last_msg_doc.get("created_at", "") if last_msg_doc else ""

        u_name = u.get("name") or u.get("email", "").split("@")[0] or "User"
        initials = "".join([p[0].upper() for p in u_name.strip().split() if p])[:2] or u_name[:1].upper()

        contacts.append({
            "id": u_id,
            "name": u_name,
            "email": u.get("email", ""),
            "role": u.get("role", "Member"),
            "department": u.get("department", ""),
            "avatar": u.get("avatar_url") or u.get("avatar") or "",
            "initials": initials,
            "is_online": True,
            "unread_count": unread,
            "last_message": last_message_text,
            "last_time": last_time_str,
            "last_timestamp": last_timestamp,
            "can_chat": chat_enabled_global and (u_id not in restricted_user_ids),
        })

    # Sort contacts: contacts with recent messages first, then alphabetical
    contacts.sort(key=lambda c: (c["last_timestamp"] or "1970-01-01"), reverse=True)
    return contacts


@router.get("/messages")
def get_messages(
    peer_id: str = Query(..., description="User ID of the chat partner"),
    current_user: User = Depends(get_current_user)
) -> list:
    """Retrieve message history with a peer and mark peer's incoming messages as read."""
    tenant_id = _resolve_tenant_id(current_user)
    if not tenant_id:
        return []

    # Mark peer's unread messages to current user as read
    db["team_messages"].update_many(
        {
            "tenant_id": tenant_id,
            "sender_id": peer_id,
            "recipient_id": current_user.id,
            "read": False
        },
        {
            "$set": {
                "read": True,
                "read_at": _utcnow().isoformat()
            }
        }
    )

    # Fetch messages exchanged between current user and peer
    cursor = db["team_messages"].find(
        {
            "tenant_id": tenant_id,
            "$or": [
                {"sender_id": current_user.id, "recipient_id": peer_id},
                {"sender_id": peer_id, "recipient_id": current_user.id}
            ]
        }
    ).sort("created_at", 1).limit(300)

    results = []
    for doc in cursor:
        sender_is_me = doc.get("sender_id") == current_user.id
        results.append({
            "id": doc.get("id") or str(doc.get("_id")),
            "sender_id": doc.get("sender_id"),
            "sender_name": doc.get("sender_name", ""),
            "sender": "me" if sender_is_me else "them",
            "text": doc.get("text", ""),
            "time": _format_message_time(doc.get("created_at")),
            "created_at": doc.get("created_at"),
            "status": "read" if doc.get("read") else "sent",
        })

    return results


@router.post("/messages")
def send_message(
    payload: SendMessageRequest,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Send a real message to a tenant peer after checking chat governance permissions."""
    tenant_id = _resolve_tenant_id(current_user)
    if not tenant_id:
        raise HTTPException(status_code=400, detail="Tenant context missing")

    peer_id = payload.peer_id
    if not peer_id or peer_id == current_user.id:
        raise HTTPException(status_code=400, detail="Invalid peer recipient")

    # Enforce chat permissions
    settings = _get_tenant_chat_settings(tenant_id)
    if not settings.get("enabled", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Team chat is currently disabled by company administration"
        )

    restricted_user_ids = set(settings.get("restricted_user_ids", []))
    if current_user.id in restricted_user_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your chat access has been restricted by your Company Administrator"
        )

    if peer_id in restricted_user_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The recipient's chat access is currently disabled"
        )

    # Check recipient exists in this tenant
    peer_user = db["users"].find_one({
        "tenant_id": tenant_id,
        "$or": [{"id": peer_id}, {"_id": peer_id}]
    })
    if not peer_user:
        # Check by id only if tenant matches
        peer_user = db["users"].find_one({"id": peer_id})
        if not peer_user:
            raise HTTPException(status_code=404, detail="Recipient user not found in company tenant")

    msg_id = _uuid()
    created_at = _utcnow().isoformat()

    msg_doc = {
        "id": msg_id,
        "tenant_id": tenant_id,
        "sender_id": current_user.id,
        "sender_name": current_user.name or current_user.email,
        "sender_role": current_user.role or "Member",
        "recipient_id": peer_id,
        "text": payload.text.strip(),
        "read": False,
        "read_at": None,
        "created_at": created_at,
    }

    db["team_messages"].insert_one(msg_doc)

    return {
        "id": msg_id,
        "sender_id": current_user.id,
        "sender_name": current_user.name or current_user.email,
        "sender": "me",
        "text": payload.text.strip(),
        "time": _format_message_time(created_at),
        "created_at": created_at,
        "status": "sent"
    }
