"""Session and conversational memory management for Hiring Manager Telegram AI Bot."""
import re
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
        last_name = (tg_user.get("last_name") if tg_user else "") or ""
        full_tg_name = f"{first_name} {last_name}".strip() if last_name else first_name
        username = (tg_user.get("username") if tg_user else "") or ""
        username_clean = username.lstrip("@").strip()

        # Attempt to find linked user in DB
        linked_user = None
        try:
            if tenant_id:
                linked_user = db["users"].find_one({"tenant_id": tenant_id, "telegram_chat_id": str(chat_id)})
            if not linked_user:
                linked_user = db["users"].find_one({"telegram_chat_id": str(chat_id)})
            if not linked_user and username_clean:
                if tenant_id:
                    linked_user = db["users"].find_one({
                        "tenant_id": tenant_id,
                        "telegram_username": {"$regex": f"^{re.escape(username_clean)}$", "$options": "i"}
                    })
                if not linked_user:
                    linked_user = db["users"].find_one({
                        "telegram_username": {"$regex": f"^{re.escape(username_clean)}$", "$options": "i"}
                    })
            if not linked_user and full_tg_name and full_tg_name != "Hiring Manager":
                if tenant_id:
                    linked_user = db["users"].find_one({
                        "tenant_id": tenant_id,
                        "name": {"$regex": f"^{re.escape(full_tg_name)}$", "$options": "i"}
                    })
                if not linked_user:
                    linked_user = db["users"].find_one({
                        "name": {"$regex": f"^{re.escape(full_tg_name)}$", "$options": "i"}
                    })
            # Fallback to single hiring manager in this tenant if unique
            if not linked_user and tenant_id and tenant_id != "local":
                hms = list(db["users"].find({"tenant_id": tenant_id, "role": {"$in": ["HIRING_MANAGER", "Hiring Manager", "hiring_manager"]}}).limit(2))
                if len(hms) == 1:
                    linked_user = hms[0]
        except Exception as e:
            print(f"[HM TELEGRAM SESSION LOAD ERROR] {e}")

        # Resolve tenant company context & profile
        effective_tenant_id = str(linked_user.get("tenant_id")) if (linked_user and linked_user.get("tenant_id")) else (tenant_id or "local")
        from modules.hiring_manager_agent.agent import _get_tenant_company_context
        comp_ctx = _get_tenant_company_context(effective_tenant_id)
        company_name = comp_ctx.get("company_name") or "TermJobs Workspace"

        if linked_user:
            current_user = {
                "id": str(linked_user.get("_id") or linked_user.get("id")),
                "name": linked_user.get("name") or full_tg_name,
                "email": linked_user.get("email") or "",
                "role": linked_user.get("role") or "Hiring Manager",
                "tenant_id": effective_tenant_id,
                "tenant_name": company_name,
                "company_name": company_name,
                "company_context": comp_ctx,
                "tech_stack": comp_ctx.get("tech_stack", []),
                "location": comp_ctx.get("location", "Remote"),
                "industry": comp_ctx.get("industry", "Technology"),
                "director_name": comp_ctx.get("director_name", "Director"),
                "director_email": comp_ctx.get("director_email", "")
            }
        else:
            current_user = {
                "id": f"tg_hm_{chat_id}",
                "name": full_tg_name,
                "email": "",
                "role": "Hiring Manager",
                "tenant_id": effective_tenant_id,
                "tenant_name": company_name,
                "company_name": company_name,
                "company_context": comp_ctx,
                "tech_stack": comp_ctx.get("tech_stack", []),
                "location": comp_ctx.get("location", "Remote"),
                "industry": comp_ctx.get("industry", "Technology"),
                "director_name": comp_ctx.get("director_name", "Director"),
                "director_email": comp_ctx.get("director_email", "")
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
    # Check if newly linked user should be synced into active session
    if session.get("current_user", {}).get("name") in ("", "Hiring Manager") or not session.get("current_user", {}).get("email"):
        try:
            lu = db["users"].find_one({"telegram_chat_id": str(chat_id)})
            if lu and lu.get("name"):
                session["current_user"]["name"] = lu.get("name")
                session["current_user"]["id"] = str(lu.get("_id") or lu.get("id"))
                if lu.get("email"):
                    session["current_user"]["email"] = lu.get("email")
                if lu.get("tenant_id"):
                    t_id = str(lu.get("tenant_id"))
                    session["current_user"]["tenant_id"] = t_id
                    from modules.hiring_manager_agent.agent import _get_tenant_company_context
                    synced_ctx = _get_tenant_company_context(t_id)
                    session["current_user"]["company_name"] = synced_ctx.get("company_name") or session["current_user"].get("company_name")
                    session["current_user"]["company_context"] = synced_ctx
                    session["current_user"]["tech_stack"] = synced_ctx.get("tech_stack", [])
                    session["current_user"]["location"] = synced_ctx.get("location", "Remote")
                    session["current_user"]["director_name"] = synced_ctx.get("director_name", "Director")
                    session["current_user"]["director_email"] = synced_ctx.get("director_email", "")
        except Exception:
            pass
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
