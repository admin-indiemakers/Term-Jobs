"""Session and conversational memory management for Hiring Manager Telegram AI Bot."""
import time
from typing import Dict, Any, List, Optional
from modules.shared.db import db

# In-memory store: session_key -> session dict
_SESSIONS: Dict[str, Dict[str, Any]] = {}
MAX_HISTORY_TURNS = 20


def _build_session_key(chat_id: int, tenant_id: Optional[str] = None) -> str:
    """Build composite key for tenant-scoped session cache."""
    return f"{tenant_id}:{chat_id}" if tenant_id else str(chat_id)


def get_or_create_session(
    chat_id: int,
    tg_user: Optional[Dict[str, Any]] = None,
    tenant_id: Optional[str] = None
) -> Dict[str, Any]:
    """Retrieve existing session or initialize a fresh one for the given chat_id and tenant_id."""
    key = _build_session_key(chat_id, tenant_id)

    if key not in _SESSIONS:
        first_name = (tg_user.get("first_name") if tg_user else "") or "Hiring Manager"
        username = (tg_user.get("username") if tg_user else "") or ""

        # Attempt to find linked user in DB
        linked_user = None
        try:
            if tenant_id:
                linked_user = db["users"].find_one({"tenant_id": tenant_id, "telegram_chat_id": str(chat_id)})
            if not linked_user:
                linked_user = db["users"].find_one({"telegram_chat_id": str(chat_id)})
            if not linked_user and username:
                if tenant_id:
                    linked_user = db["users"].find_one({"tenant_id": tenant_id, "telegram_username": username})
                if not linked_user:
                    linked_user = db["users"].find_one({"telegram_username": username})
        except Exception as e:
            print(f"[HM TELEGRAM SESSION LOAD ERROR] {e}")

        # Resolve tenant company name
        effective_tenant_id = str(linked_user.get("tenant_id")) if (linked_user and linked_user.get("tenant_id")) else (tenant_id or "local")
        company_name = "TermJobs Workspace"
        try:
            t_doc = db["tenants"].find_one({"$or": [{"id": effective_tenant_id}, {"_id": effective_tenant_id}]})
            if t_doc and t_doc.get("name"):
                company_name = t_doc.get("name")
        except Exception:
            pass

        if linked_user:
            current_user = {
                "id": str(linked_user.get("_id") or linked_user.get("id")),
                "name": linked_user.get("name") or first_name,
                "email": linked_user.get("email") or "",
                "role": linked_user.get("role") or "Hiring Manager",
                "tenant_id": effective_tenant_id,
                "tenant_name": company_name,
                "company_name": company_name,
            }
        else:
            current_user = {
                "id": f"tg_hm_{chat_id}",
                "name": first_name,
                "email": "",
                "role": "Hiring Manager",
                "tenant_id": effective_tenant_id,
                "tenant_name": company_name,
                "company_name": company_name,
            }

        _SESSIONS[key] = {
            "key": key,
            "chat_id": chat_id,
            "tenant_id": effective_tenant_id,
            "created_at": time.time(),
            "last_active": time.time(),
            "current_user": current_user,
            "history": [],
            "last_draft": None,
            "pending_action": None,
        }

    session = _SESSIONS[key]
    session["last_active"] = time.time()
    return session


def add_history_message(chat_id: int, sender: str, content: str, tenant_id: Optional[str] = None) -> None:
    """Append a message to the conversational history, keeping turns within limits."""
    session = get_or_create_session(chat_id, tenant_id=tenant_id)
    session["history"].append({
        "sender": "user" if sender.lower() == "user" else "assistant",
        "content": content
    })
    # Trim history if exceeding max turns
    if len(session["history"]) > MAX_HISTORY_TURNS:
        session["history"] = session["history"][-MAX_HISTORY_TURNS:]


def get_chat_history(chat_id: int, tenant_id: Optional[str] = None) -> List[Dict[str, str]]:
    """Return conversational history for agent context."""
    session = get_or_create_session(chat_id, tenant_id=tenant_id)
    return session.get("history", [])


def set_last_draft(chat_id: int, draft: Dict[str, Any], tenant_id: Optional[str] = None) -> None:
    """Store the latest requisition draft for quick confirmation."""
    session = get_or_create_session(chat_id, tenant_id=tenant_id)
    session["last_draft"] = draft


def get_last_draft(chat_id: int, tenant_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Retrieve the latest requisition draft if available."""
    session = get_or_create_session(chat_id, tenant_id=tenant_id)
    return session.get("last_draft")


def clear_session(chat_id: int, tenant_id: Optional[str] = None) -> None:
    """Reset the conversational history and context for a chat."""
    key = _build_session_key(chat_id, tenant_id)
    if key in _SESSIONS:
        tg_user = {"first_name": _SESSIONS[key]["current_user"].get("name")}
        del _SESSIONS[key]
        get_or_create_session(chat_id, tg_user, tenant_id=tenant_id)


def invalidate_session(chat_id: int, tenant_id: Optional[str] = None) -> None:
    """Force remove cached session so new credentials or identity will be reloaded."""
    key = _build_session_key(chat_id, tenant_id)
    _SESSIONS.pop(key, None)
    _SESSIONS.pop(str(chat_id), None)
