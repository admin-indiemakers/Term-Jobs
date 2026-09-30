"""Company Admin AI Agent API Router.

Exposes endpoints for the Company Admin AI Assistant powered by Groq API.
Scoped strictly to the authenticated Company Admin's tenant.
"""
from fastapi import APIRouter, HTTPException, Header, Depends
from pydantic import BaseModel
from typing import Optional, Dict, Any

from modules.identity.domain.models import User, Tenant
from .agent import run_company_admin_agent_chat, get_company_admin_stats

router = APIRouter(prefix="/api/company-admin/agent", tags=["Company Admin Agent"])


class CompanyAdminChatRequest(BaseModel):
    prompt: str
    history: list[dict] | None = None
    user_name: str | None = "Company Admin"
    user_role: str | None = "Admin"
    current_user: Optional[Dict[str, Any]] = None


@router.post("/chat")
def company_admin_agent_chat(
    data: CompanyAdminChatRequest,
    authorization: str | None = Header(default=None)
):
    """Execute AI Agent for Company Admin strictly scoped to their company."""
    user_data = {
        "name": "Company Admin",
        "role": "Admin",
        "tenant_id": "local",
        "tenant_name": "TCS",
        "id": "admin-user"
    }

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
                    if u.tenant_id:
                        t = session.query(Tenant).filter(Tenant.id == u.tenant_id).first()
                        if t and t.name:
                            user_data["tenant_name"] = t.name

        except Exception as e:
            print("Token decode error in company admin chat router:", e)

    if not data.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt is required.")

    result = run_company_admin_agent_chat(
        prompt=data.prompt.strip(),
        history=data.history or [],
        current_user=user_data
    )

    return {
        "reply": result.get("reply", ""),
        "executed_actions": result.get("executed_actions", []),
        "status": "success"
    }


@router.get("/stats")
def get_company_stats(
    authorization: str | None = Header(default=None)
):
    """Fetch live enterprise analytics strictly filtered for this company."""
    tenant_id = "local"
    company_name = "TCS"

    if authorization and authorization.startswith("Bearer "):
        try:
            from modules.identity.services.auth_service import decode_access_token
            from modules.shared.db import get_session
            token = authorization.split(" ")[1]
            payload = decode_access_token(token)
            if payload:
                session = get_session()
                u = session.query(User).filter(User.id == payload.get("sub")).first()
                if u and u.tenant_id:
                    tenant_id = str(u.tenant_id)
                    t = session.query(Tenant).filter(Tenant.id == u.tenant_id).first()
                    if t and t.name:
                        company_name = t.name

        except Exception:
            pass

    stats = get_company_admin_stats(tenant_id, company_name)
    return {
        "status": "success",
        **stats
    }
