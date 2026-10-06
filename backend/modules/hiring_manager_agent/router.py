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

