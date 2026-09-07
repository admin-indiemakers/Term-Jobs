"""Hiring Manager AI Agent API Router.

Exposes endpoints for the Hiring Manager AI Reasoning Assistant powered by Groq API.
"""
from fastapi import APIRouter, HTTPException, Header, Depends
from pydantic import BaseModel

from modules.identity.domain.models import User
from .agent import run_hiring_manager_agent_chat

router = APIRouter(prefix="/api/hiring-manager/agent", tags=["Hiring Manager Agent"])


class HiringManagerChatRequest(BaseModel):
    prompt: str
    history: list[dict] | None = None
    user_name: str | None = "Hiring Manager"
    user_role: str | None = "Hiring Manager"


@router.post("/chat")
def hiring_manager_agent_chat(
    data: HiringManagerChatRequest,
    authorization: str | None = Header(default=None)
):
    """Execute AI Agent for Hiring Manager with role-based workspace privileges."""
    user_data = {
        "name": data.user_name or "Hiring Manager",
        "role": data.user_role or "Hiring Manager",
        "tenant_id": "local",
        "id": "hm-user"
    }

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
