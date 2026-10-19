"""Hiring Manager AI Agent API Router.

Exposes endpoints for the Hiring Manager AI Reasoning Assistant powered by Groq API.
"""
from fastapi import APIRouter, HTTPException, Header, Depends
from pydantic import BaseModel
from typing import Optional, Dict, Any

from modules.identity.domain.models import User, Tenant
from modules.identity.router import get_current_user
from .agent import run_hiring_manager_agent_chat, model_available
from .chat_scope import is_hiring_request_in_scope, scope_response

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
    current_user: User = Depends(get_current_user),
):
    """Use authenticated identity for all calendar and hiring operations."""
    if current_user.role not in ('Hiring Manager', 'Admin', 'HR', 'Director'):
        raise HTTPException(status_code=403, detail='Company hiring staff access required')
    if not data.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt is required.")
    if not model_available() and not is_hiring_request_in_scope(data.prompt, data.history):
        return {**scope_response(), 'status': 'success'}
    from modules.calendar.services.google_calendar import connection_status
    user_data = {'id': str(current_user.id), 'tenant_id': current_user.tenant_id, 'role': current_user.role,
                 'name': current_user.name, 'email': current_user.email,
                 'google_calendar': connection_status(current_user)}
    from modules.shared.db import get_session
    with get_session() as session:
        tenant = session.get(Tenant, current_user.tenant_id)
        if tenant: user_data['tenant_name'] = tenant.name
    if not data.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt is required.")
    from modules.calendar.services.assistant import handle_calendar_query
    calendar_result = None if model_available() else handle_calendar_query(data.prompt, current_user, data.history)
    if not model_available() and calendar_result is not None:
        return {**calendar_result, 'status': 'success'}

    result = run_hiring_manager_agent_chat(
        prompt=data.prompt.strip(),
        history=data.history or [],
        current_user=user_data
    )

    return {
        "reply": result.get("reply", ""),
        "executed_actions": result.get("executed_actions", []),
        "status": "success",
        **{key: result[key] for key in ("out_of_scope", "ai_unavailable") if key in result}
    }


class GenerateJDRequest(BaseModel):
    title: str
    department: Optional[str] = "Engineering"
    skills: Optional[Any] = None
    experience_level: Optional[str] = "Mid (2-4 yrs)"
    company_name: Optional[str] = "Company"


@router.post("/generate-jd")
def generate_job_description(data: GenerateJDRequest):
    """Generate an enhanced, enterprise job description summary via Groq AI or smart template."""
    import os
    import httpx
    from modules.shared.config import settings
    from modules.superadmin_agent.groq_manager import get_all_groq_keys

    title = data.title.strip() or "Software Engineer"
    dept = data.department or "Engineering"
    exp = data.experience_level or "Mid-Level"
    comp = data.company_name or "Company"
    
    if isinstance(data.skills, list):
        skills_str = ", ".join(data.skills)
    elif isinstance(data.skills, str):
        skills_str = data.skills
    else:
        skills_str = "Core modern technology stack"

    # Try Groq first
    prompt = (
        f"Generate a professional, compelling, enterprise-grade job description summary for a {title} position in the {dept} department at {comp}. "
        f"Seniority: {exp}. Key Skills: {skills_str}. "
        f"Write 2-3 concise paragraphs covering: role mission, core day-to-day engineering impact, and key technical expectations. "
        f"Do not include generic boilerplate markdown headers. Provide only the polished job description text."
    )

    jd_text = ""
    if getattr(settings, "groq_api_key", None):
        try:
            available_keys = get_all_groq_keys() or [settings.groq_api_key]
            url = f"{settings.groq_base_url.rstrip('/')}/chat/completions"
            for active_key in available_keys:
                if not active_key:
                    continue
                k_headers = {
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {active_key}"
                }
                for model_candidate in ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"]:
                    payload = {
                        "model": model_candidate,
                        "messages": [
                            {"role": "system", "content": "You are an expert technical recruiter and enterprise hiring consultant."},
                            {"role": "user", "content": prompt}
                        ],
                        "temperature": 0.4,
                        "max_tokens": 400
                    }
                    try:
                        r = httpx.post(url, headers=k_headers, json=payload, timeout=8.0)
                        if r.status_code == 200:
                            choice = r.json()["choices"][0]["message"].get("content")
                            if choice and len(choice.strip()) > 40:
                                jd_text = choice.strip()
                                break
                    except Exception:
                        continue
                if jd_text:
                    break
        except Exception:
            pass

    # High-quality fallback if Groq offline
    if not jd_text:
        jd_text = (
            f"We are seeking an experienced {title} ({exp}) to join our {dept} team at {comp}. "
            f"In this role, you will be responsible for architecting, building, and maintaining high-throughput, mission-critical services using {skills_str}. "
            f"You will partner closely with engineering leads, product managers, and cross-functional stakeholders to deliver resilient, scalable solutions with high reliability and automated testing."
        )

    return {
        "title": title,
        "department": dept,
        "job_description": jd_text,
        "status": "success"
    }

