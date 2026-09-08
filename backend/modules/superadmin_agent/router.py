"""Super Admin AI Agent API Router.

Exposes endpoints for the Super Admin Reasoning Console powered by Groq API.
"""
from fastapi import APIRouter, HTTPException, Header, Depends
from pydantic import BaseModel

from modules.identity.domain.models import User
from modules.identity.router import get_current_user
from .agent import SuperAdminAgent

router = APIRouter(prefix="/api/superadmin/agent", tags=["Super Admin Agent"])

agent_instance = SuperAdminAgent()


class ChatRequest(BaseModel):
    prompt: str
    history: list[dict] | None = None
    user_name: str | None = "Super Admin"
    user_role: str | None = "Super Admin"


@router.post("/chat")
def superadmin_agent_chat(
    data: ChatRequest,
    authorization: str | None = Header(default=None)
):
    """Execute Groq AI Agent for Super Admin with full platform rights."""
    user_name = data.user_name or "Super Admin"

    if authorization and authorization.startswith("Bearer "):
        try:
            from modules.identity.services.auth_service import decode_access_token
            from modules.shared.db import get_session
            token = authorization.split(" ")[1]
            payload = decode_access_token(token)
            if payload:
                session = get_session()
                u = session.query(User).filter(User.id == payload.get("sub")).first()
                if u and u.name:
                    user_name = u.name
        except Exception:
            pass

    if not data.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt is required.")

    agent = SuperAdminAgent()
    result = agent.run(
        user_prompt=data.prompt.strip(),
        history=data.history or [],
        user_name=user_name
    )

    return {
        "reply": result.get("reply", ""),
        "executed_actions": result.get("executed_actions", []),
        "status": "success"
    }
