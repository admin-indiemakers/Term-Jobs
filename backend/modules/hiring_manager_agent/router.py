"""Hiring Manager AI Agent API Router.

Exposes endpoints for the Hiring Manager AI Reasoning Assistant powered by Groq API.
"""
from fastapi import APIRouter, HTTPException, Header, Depends
from pydantic import BaseModel
from typing import Optional, Dict, Any

from modules.identity.domain.models import User
from .agent import run_hiring_manager_agent_chat

router = APIRouter(prefix="/api/hiring-manager/agent", tags=["Hiring Manager Agent"])


class HiringManagerChatRequest(BaseModel):
    prompt: str
    history: list[dict] | None = None
    user_name: str | None = "Hiring Manager"
    user_role: str | None = "Hiring Manager"
    # Accept current_user dict directly from the frontend (contains id, name, tenant_id)
    current_user: Optional[Dict[str, Any]] = None


@router.post("/chat")
def hiring_manager_agent_chat(
    data: HiringManagerChatRequest,
    authorization: str | None = Header(default=None)
):
    """Execute AI Agent for Hiring Manager with role-based workspace privileges."""
    # Start with defaults
    user_data = {
        "name": "Hiring Manager",
        "role": "Hiring Manager",
        "tenant_id": "local",
        "id": "hm-user"
    }

    # Priority 1: Use current_user from request body if provided
    if data.current_user:
        if data.current_user.get("id"):
            user_data["id"] = str(data.current_user["id"])
        if data.current_user.get("name"):
            user_data["name"] = data.current_user["name"]
        if data.current_user.get("tenant_id"):
            user_data["tenant_id"] = str(data.current_user["tenant_id"])
        if data.current_user.get("role"):
            user_data["role"] = data.current_user["role"]
        if data.current_user.get("tenant_name"):
            user_data["tenant_name"] = data.current_user["tenant_name"]
    elif data.user_name:
        user_data["name"] = data.user_name

    # Priority 2: JWT Bearer token overrides request body (most authoritative)
    if authorization and authorization.startswith("Bearer "):
        try:
            from modules.identity.services.auth_service import decode_access_token
            from modules.shared.db import get_session
            token = authorization.split(" ")[1]
            payload = decode_access_token(token)
            if payload:
                session = get_session()
                u = session.query(User).filter(User.id == payload.get("sub")).first()
                if u:
                    user_data["name"] = u.name or user_data["name"]
                    user_data["role"] = u.role or user_data["role"]
                    user_data["tenant_id"] = str(u.tenant_id or "local")
                    user_data["id"] = str(u.id)
                session.close()
        except Exception:
            pass

    if not data.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt is required.")

    result = run_hiring_manager_agent_chat(
        prompt=data.prompt.strip(),
        history=data.history or [],
        current_user=user_data
    )

    return {
        "reply": result.get("reply", ""),
        "executed_actions": result.get("executed_actions", []),
        "status": "success"
    }
