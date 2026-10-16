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
    from modules.shared.db import get_session
    from modules.identity.router import get_current_user
    with get_session() as session:
        actor = get_current_user(authorization, session)
        if actor.role not in ('Admin', 'HR', 'Director') or not actor.tenant_id:
            raise HTTPException(status_code=403, detail='Company administrator access required')
        tenant = session.get(Tenant, actor.tenant_id)
        user_data = {'id': actor.id, 'name': actor.name, 'role': actor.role,
                     'tenant_id': actor.tenant_id, 'tenant_name': tenant.name if tenant else ''}

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
    from modules.shared.db import get_session
    from modules.identity.router import get_current_user
    with get_session() as session:
        actor = get_current_user(authorization, session)
        if actor.role not in ('Admin', 'HR', 'Director') or not actor.tenant_id:
            raise HTTPException(status_code=403, detail='Company administrator access required')
        tenant_id = actor.tenant_id
        tenant = session.get(Tenant, tenant_id)
        company_name = tenant.name if tenant else ''

    stats = get_company_admin_stats(tenant_id, company_name)
    return {
        "status": "success",
        **stats
    }
