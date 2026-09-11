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


@router.get("/stats")
def get_superadmin_stats():
    """Fetch live Super Admin platform console analytics directly from system database."""
    try:
        from modules.shared.db import get_session
        from modules.identity.domain.models import Tenant, User

        session = get_session()
        tenants = session.query(Tenant).all()
        clients = [t for t in tenants if t.tenant_type == 'client']
        consultancies = [t for t in tenants if t.tenant_type == 'consultancy']

        users = session.query(User).all()
        company_admins = [u for u in users if u.role == 'Admin']
        vendor_admins = [u for u in users if u.role == 'Recruiter']
        super_admins = [u for u in users if u.role == 'Super Admin']
        all_admins = [u for u in users if u.role in ('Admin', 'Recruiter', 'Super Admin')]

        # Client buyer companies with admins
        client_list = []
        for c in clients:
            c_admins = [u for u in users if u.tenant_id == c.id and u.role == 'Admin']
            client_list.append({
                "id": str(c.id),
                "name": c.name,
                "type": "Buyer Company",
                "admin": c_admins[0].name if c_admins else "Admin configured",
                "admin_email": c_admins[0].email if c_admins else None,
                "status": "Active"
            })

        # Vendor consultancies with recruiters
        consultancy_list = []
        for v in consultancies:
            v_admins = [u for u in users if u.tenant_id == v.id and u.role == 'Recruiter']
            consultancy_list.append({
                "id": str(v.id),
                "name": v.name,
                "type": "Vendor Consultancy",
                "recruiter": v_admins[0].name if v_admins else "Recruiter configured",
                "recruiter_email": v_admins[0].email if v_admins else None,
                "status": "Active"
            })

        # Platform activity events directly matching SuperAdminDashboard
        activities = []
        for c in clients:
            activities.append({
                "id": f"tenant-{c.id}",
                "type": "buyer",
                "title": "Buyer company onboarded",
                "desc": f"{c.name} • Tenant & admin created",
                "badge": "Active",
                "tone": "green"
            })
        for v in consultancies:
            activities.append({
                "id": f"tenant-{v.id}",
                "type": "vendor",
                "title": "Vendor consultancy onboarded",
                "desc": f"{v.name} • Recruiter access provisioned",
                "badge": "Active",
                "tone": "green"
            })
        for a in company_admins:
            t_name = next((t.name for t in tenants if t.id == a.tenant_id), "Buyer Company")
            activities.append({
                "id": f"admin-{a.id}",
                "type": "admin",
                "title": "Company admin verified",
                "desc": f"{a.name} ({t_name}) • Administrator",
                "badge": "Verified",
                "tone": "blue"
            })
        for r in vendor_admins:
            t_name = next((t.name for t in tenants if t.id == r.tenant_id), "Consultancy")
            activities.append({
                "id": f"recruiter-{r.id}",
                "type": "recruiter",
                "title": "Vendor recruiter active",
                "desc": f"{r.name} ({t_name}) • Recruiter",
                "badge": "Active",
                "tone": "purple"
            })

        return {
            "status": "success",
            "total_companies": len(tenants),
            "buyer_companies": len(clients),
            "vendor_consultancies": len(consultancies),
            "company_admins": len(company_admins),
            "vendor_admins": len(vendor_admins),
            "total_users": len(users),
            "super_admins": len(super_admins),
            "clients": client_list,
            "consultancies": consultancy_list,
            "platform_activities": activities[:6]
        }
    except Exception as e:
        return {
            "status": "error",
            "detail": str(e),
            "total_companies": 0,
            "buyer_companies": 0,
            "vendor_consultancies": 0,
            "company_admins": 0,
            "vendor_admins": 0,
            "total_users": 0,
            "super_admins": 0,
            "clients": [],
            "consultancies": [],
            "platform_activities": []
        }
    except Exception as e:
        return {
            "status": "error",
            "detail": str(e),
            "total_tenants": 0,
            "client_companies": 0,
            "vendor_consultancies": 0,
            "total_requisitions": 0,
            "active_requisitions": 0,
            "total_submissions": 0,
            "total_users": 0,
            "admin_accounts": 0,
            "positions_per_vendor": 0,
            "average_match_score": None,
            "requisition_stages": [],
            "submission_statuses": [],
            "vendor_distribution": [],
            "recent_candidates": [],
            "recent_requisitions": [],
            "clients": [],
            "consultancies": []
        }

