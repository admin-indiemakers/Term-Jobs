"""Session and conversational memory management for Hiring Manager Telegram AI Bot."""
import time
from typing import Dict, Any, List, Optional
from modules.shared.db import db

# In-memory store: chat_id -> session dict
_SESSIONS: Dict[int, Dict[str, Any]] = {}
MAX_HISTORY_TURNS = 20


def get_or_create_session(chat_id: int, tg_user: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Retrieve existing session or initialize a fresh one for the given chat_id."""
    if chat_id not in _SESSIONS:
        first_name = (tg_user.get("first_name") if tg_user else "") or "Hiring Manager"
        username = (tg_user.get("username") if tg_user else "") or ""

        # Attempt to find linked user in DB
        linked_user = None
        try:
            if username:
                linked_user = db["users"].find_one({"telegram_username": username})
            if not linked_user:
                linked_user = db["users"].find_one({"telegram_chat_id": str(chat_id)})
        except Exception:
            pass

        if linked_user:
            current_user = {
                "id": str(linked_user.get("_id") or linked_user.get("id")),
                "name": linked_user.get("name") or first_name,
                "role": linked_user.get("role") or "Hiring Manager",
                "tenant_id": str(linked_user.get("tenant_id") or "local"),
                "tenant_name": linked_user.get("tenant_name") or "TermJobs Workspace",
            }
        else:
            current_user = {
                "id": f"tg_hm_{chat_id}",
                "name": first_name,
                "role": "Hiring Manager",
                "tenant_id": "local",
                "tenant_name": "TermJobs Workspace",
            }

        _SESSIONS[chat_id] = {
            "chat_id": chat_id,
            "created_at": time.time(),
            "last_active": time.time(),
            "current_user": current_user,
            "history": [],
            "last_draft": None,
            "pending_action": None,
        }

    session = _SESSIONS[chat_id]
    session["last_active"] = time.time()
    return session


def add_history_message(chat_id: int, sender: str, content: str) -> None:
    """Append a message to the conversational history, keeping turns within limits."""
    session = get_or_create_session(chat_id)
    session["history"].append({
        "sender": "user" if sender.lower() == "user" else "assistant",
        "content": content
    })
    # Trim history if exceeding max turns
    if len(session["history"]) > MAX_HISTORY_TURNS:
        session["history"] = session["history"][-MAX_HISTORY_TURNS:]


def get_chat_history(chat_id: int) -> List[Dict[str, str]]:
    """Return conversational history for agent context."""
    session = get_or_create_session(chat_id)
    return session.get("history", [])


def set_last_draft(chat_id: int, draft: Dict[str, Any]) -> None:
    """Store the latest requisition draft for quick confirmation."""
    session = get_or_create_session(chat_id)
    session["last_draft"] = draft


def get_last_draft(chat_id: int) -> Optional[Dict[str, Any]]:
    """Retrieve the latest requisition draft if available."""
    session = get_or_create_session(chat_id)
    return session.get("last_draft")


def clear_session(chat_id: int) -> None:
    """Reset the conversational history and context for a chat."""
    if chat_id in _SESSIONS:
        tg_user = {"first_name": _SESSIONS[chat_id]["current_user"].get("name")}
        del _SESSIONS[chat_id]
        get_or_create_session(chat_id, tg_user)
