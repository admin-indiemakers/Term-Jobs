"""Session and user mapping management for Microsoft Teams Bot."""
import re
import time
from typing import Dict, Any, List, Optional
from modules.shared.db import db

# In-memory store: session_key -> session dict
_TEAMS_SESSIONS: Dict[str, Dict[str, Any]] = {}
MAX_HISTORY_TURNS = 20


def _build_teams_session_key(user_id: str, tenant_id: Optional[str] = None) -> str:
    """Build composite session key for Teams user."""
    return f"teams:{tenant_id}:{user_id}" if tenant_id else f"teams:{user_id}"


def get_or_create_teams_session(
    teams_from: Dict[str, Any],
    tenant_id: Optional[str] = None,
    aad_object_id: Optional[str] = None
) -> Dict[str, Any]:
    """Retrieve existing session or initialize a fresh one for the given Teams user."""
    user_id = str(teams_from.get("id") or aad_object_id or "teams_user")
    name = str(teams_from.get("name") or "Hiring Manager")
    key = _build_teams_session_key(user_id, tenant_id)

    if key not in _TEAMS_SESSIONS:
        # Search linked TermJobs user
        linked_user = None
        try:
            # 1. Match by teams_user_id or aad_object_id
            if aad_object_id:
                linked_user = db["users"].find_one({"$or": [
                    {"ms_teams_aad_id": aad_object_id},
                    {"ms_teams_user_id": user_id}
                ]})
            if not linked_user:
                linked_user = db["users"].find_one({"ms_teams_user_id": user_id})

            # 2. Match by email or principal name if provided
            email = teams_from.get("email") or teams_from.get("userPrincipalName") or ""
            if not linked_user and email:
                if tenant_id:
                    linked_user = db["users"].find_one({
                        "tenant_id": tenant_id,
                        "email": {"$regex": f"^{re.escape(email.strip())}$", "$options": "i"}
                    })
                if not linked_user:
                    linked_user = db["users"].find_one({
                        "email": {"$regex": f"^{re.escape(email.strip())}$", "$options": "i"}
                    })

            # 3. Match by name
            if not linked_user and name and name != "Hiring Manager":
                if tenant_id:
                    linked_user = db["users"].find_one({
                        "tenant_id": tenant_id,
                        "name": {"$regex": f"^{re.escape(name.strip())}$", "$options": "i"}
                    })
                if not linked_user:
                    linked_user = db["users"].find_one({
                        "name": {"$regex": f"^{re.escape(name.strip())}$", "$options": "i"}
                    })

            # 4. Fallback: single hiring manager in this tenant
            if not linked_user and tenant_id and tenant_id != "local":
                hms = list(db["users"].find({
                    "tenant_id": tenant_id,
                    "role": {"$in": ["HIRING_MANAGER", "Hiring Manager", "hiring_manager"]}
                }).limit(2))
                if len(hms) == 1:
                    linked_user = hms[0]
        except Exception as e:
            print(f"[MS TEAMS SESSION LOAD ERROR] {e}")

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
                "name": linked_user.get("name") or name,
                "email": linked_user.get("email") or "",
                "role": linked_user.get("role") or "Hiring Manager",
                "tenant_id": effective_tenant_id,
                "tenant_name": company_name,
                "company_name": company_name,
            }
        else:
            current_user = {
                "id": f"teams_{user_id}",
                "name": name,
                "email": teams_from.get("email", ""),
                "role": "Hiring Manager",
                "tenant_id": effective_tenant_id,
                "tenant_name": company_name,
                "company_name": company_name,
            }

        _TEAMS_SESSIONS[key] = {
            "key": key,
            "user_id": user_id,
            "tenant_id": effective_tenant_id,
            "created_at": time.time(),
            "last_active": time.time(),
            "current_user": current_user,
            "history": [],
            "last_draft": None,
        }

    session = _TEAMS_SESSIONS[key]
    session["last_active"] = time.time()
    return session


def add_teams_history_message(user_id: str, sender: str, content: str, tenant_id: Optional[str] = None) -> None:
    """Record a conversational turn for MS Teams user context."""
    key = _build_teams_session_key(user_id, tenant_id)
    if key in _TEAMS_SESSIONS:
        _TEAMS_SESSIONS[key]["history"].append({
            "sender": "user" if sender.lower() == "user" else "assistant",
            "content": content
        })
        if len(_TEAMS_SESSIONS[key]["history"]) > MAX_HISTORY_TURNS:
            _TEAMS_SESSIONS[key]["history"] = _TEAMS_SESSIONS[key]["history"][-MAX_HISTORY_TURNS:]


def get_teams_chat_history(user_id: str, tenant_id: Optional[str] = None) -> List[Dict[str, str]]:
    """Get conversation history."""
    key = _build_teams_session_key(user_id, tenant_id)
    return _TEAMS_SESSIONS.get(key, {}).get("history", [])


def invalidate_teams_session(user_id: str, tenant_id: Optional[str] = None) -> None:
    """Invalidate cached session."""
    key = _build_teams_session_key(user_id, tenant_id)
    _TEAMS_SESSIONS.pop(key, None)
