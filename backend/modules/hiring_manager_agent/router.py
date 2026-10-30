"""Hiring Manager AI Agent API Router.

Exposes endpoints for the Hiring Manager AI Reasoning Assistant powered by Groq API.
"""
from fastapi import APIRouter, HTTPException, Header, Depends
from pydantic import BaseModel
from typing import Optional, Dict, Any
from html.parser import HTMLParser
import ipaddress
import socket
from urllib.parse import urljoin, urlsplit

from modules.identity.domain.models import User, Tenant
from modules.identity.router import get_current_user
from .agent import run_hiring_manager_agent_chat, model_available
from .chat_scope import is_hiring_request_in_scope, scope_response

router = APIRouter(prefix="/api/hiring-manager/agent", tags=["Hiring Manager Agent"])


class _CompanyWebsiteText(HTMLParser):
    """Extract concise public company context from a website's HTML."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self._capture = None
        self._skip_depth = 0

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag in ("script", "style", "noscript", "svg"):
            self._skip_depth += 1
            return
        if self._skip_depth:
            return
        if tag == "meta":
            name = (attrs.get("name") or attrs.get("property") or "").lower()
            if name in ("description", "og:description", "og:site_name"):
                content = (attrs.get("content") or "").strip()
                if content:
                    self.parts.append(content)
        elif tag in ("title", "h1", "h2", "p"):
            self._capture = tag

    def handle_endtag(self, tag):
        if tag in ("script", "style", "noscript", "svg") and self._skip_depth:
            self._skip_depth -= 1
        if tag == self._capture:
            self._capture = None

    def handle_data(self, data):
        if self._skip_depth:
            return
        if self._capture:
            text = " ".join(data.split())
            if text:
                self.parts.append(text)


def _is_public_website_url(url: str) -> bool:
    """Reject local/private destinations before making an outbound request."""
    parsed = urlsplit(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname or parsed.username or parsed.password:
        return False
    try:
        port = parsed.port
    except ValueError:
        return False
    if port not in (None, 80, 443):
        return False
    host = parsed.hostname.rstrip(".").lower()
    if host == "localhost" or host.endswith((".localhost", ".local", ".internal")):
        return False
    try:
        addresses = {ipaddress.ip_address(host)}
    except ValueError:
        try:
            addresses = {
                ipaddress.ip_address(item[4][0])
                for item in socket.getaddrinfo(host, port or (443 if parsed.scheme == "https" else 80), type=socket.SOCK_STREAM)
            }
        except (OSError, ValueError):
            return False
    return bool(addresses) and all(address.is_global for address in addresses)


def _fetch_company_website_context(website: str) -> str:
    """Fetch up to 512 KB of public HTML and return a short text excerpt."""
    import httpx

    candidate = (website or "").strip()
    if not candidate:
        return ""
    if "://" not in candidate:
        candidate = f"https://{candidate}"
    try:
        with httpx.Client(
            timeout=httpx.Timeout(4.0, connect=2.0),
            follow_redirects=False,
            headers={"User-Agent": "TermJobsCompanyContext/1.0", "Accept": "text/html"},
        ) as client:
            for _ in range(3):
                if not _is_public_website_url(candidate):
                    return ""
                with client.stream("GET", candidate) as response:
                    if response.status_code in (301, 302, 303, 307, 308):
                        location = response.headers.get("location")
                        if not location:
                            return ""
                        candidate = urljoin(candidate, location)
                        continue
                    if response.status_code != 200 or "text/html" not in response.headers.get("content-type", "").lower():
                        return ""
                    body = bytearray()
                    for chunk in response.iter_bytes():
                        remaining = 512_000 - len(body)
                        if remaining <= 0:
                            break
                        body.extend(chunk[:remaining])
                    parser = _CompanyWebsiteText()
                    parser.feed(bytes(body).decode(response.encoding or "utf-8", errors="ignore"))
                    return " ".join(parser.parts)[:3_000]
    except Exception:
        return ""
    return ""


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
    from modules.shared.db import db as raw_db
    from .scope import hiring_scope, ScopedDatabase
    from .applications import application_reply
    with hiring_scope(raw_db, {'id': str(current_user.id), 'tenant_id': current_user.tenant_id}):
        applications = application_reply(data.prompt, ScopedDatabase(raw_db))
    if applications is not None:
        return {**applications, 'status': 'success'}
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

    from modules.requisition.domain.models import CompanyProfile
    from modules.shared.db import get_session
    with get_session() as session:
        company_profile = (
            session.query(CompanyProfile)
            .filter(CompanyProfile.tenant_id == str(current_user.tenant_id or ""))
            .order_by(CompanyProfile.created_at.desc())
            .first()
        )
        approval_required = getattr(company_profile, "require_director_approval", True) is not False
    executed_actions = result.get("executed_actions", [])
    has_requisition_draft = False
    missing_requisition_fields = []
    for action in executed_actions:
        if action.get("tool") == "draft_hiring_requisition" and isinstance(action.get("result"), dict):
            action["result"]["require_director_approval"] = approval_required
            from modules.hiring_manager_agent.agent import normalize_requisition_hiring_model
            draft_result = action["result"]
            draft_result["hiring_model"] = normalize_requisition_hiring_model(
                draft_result.get("hiring_model", ""),
                draft_result.get("job_description") or draft_result.get("summary") or draft_result.get("role_summary", ""),
                draft_result.get("location", ""),
            ) or draft_result.get("hiring_model") or "To be confirmed"
            from modules.requisition.domain.required_details import missing_requisition_details
            missing_requisition_fields = missing_requisition_details(draft_result)
            draft_result["missing_required_fields"] = missing_requisition_fields
            draft_result["is_complete"] = not missing_requisition_fields
            has_requisition_draft = True
    reply = result.get("reply", "")
    if has_requisition_draft and missing_requisition_fields:
        flow_note = (
            "Director approval is disabled, but this requisition still needs these details before it can be published: "
            if not approval_required else
            "This requisition needs these details before it can be submitted for Director approval: "
        )
        reply = (
            f"{flow_note}**{', '.join(missing_requisition_fields)}**. "
            "For example, what key skills do you need, and when should the person start? "
            "You can reply with the missing details together, or edit the draft card."
        )
    elif has_requisition_draft and not approval_required:
        reply = "Review the requisition draft below. Director approval is disabled for your company; choose **Publish Requisition** when it is ready."

    return {
        "reply": reply,
        "executed_actions": executed_actions,
        "status": "success",
        **{key: result[key] for key in ("out_of_scope", "ai_unavailable") if key in result}
    }


@router.get("/flow-settings")
def get_hiring_manager_flow_settings(current_user: User = Depends(get_current_user)):
    """Return the authenticated tenant's requisition approval policy."""
    if current_user.role not in ("Hiring Manager", "Admin", "HR", "Director"):
        raise HTTPException(status_code=403, detail="Company hiring staff access required")
    from modules.requisition.domain.models import CompanyProfile
    from modules.shared.db import get_session

    with get_session() as session:
        profile = (
            session.query(CompanyProfile)
            .filter(CompanyProfile.tenant_id == str(current_user.tenant_id or ""))
            .order_by(CompanyProfile.created_at.desc())
            .first()
        ) if current_user.tenant_id else None
    return {"require_director_approval": getattr(profile, "require_director_approval", True) is not False}


class GenerateJDRequest(BaseModel):
    title: str
    department: Optional[str] = "Engineering"
    skills: Optional[Any] = None
    experience_level: Optional[str] = "Mid (2-4 yrs)"
    location: Optional[str] = None
    employment_type: Optional[str] = None
    company_name: Optional[str] = "Company"


@router.post("/generate-jd")
def generate_job_description(
    data: GenerateJDRequest,
    current_user: User = Depends(get_current_user),
):
    """Generate an enhanced, enterprise job description summary via Groq AI or smart template."""
    import httpx
    from modules.shared.config import settings
    from modules.superadmin_agent.groq_manager import get_all_groq_keys
    from modules.requisition.domain.models import CompanyProfile
    from modules.shared.db import get_session

    if current_user.role not in ("Hiring Manager", "Admin", "HR", "Director"):
        raise HTTPException(status_code=403, detail="Company hiring staff access required")

    title = data.title.strip() or "Software Engineer"
    dept = data.department or "Engineering"
    exp = data.experience_level or "Mid-Level"
    comp = data.company_name or "Company"
    company_facts = []
    website = ""
    with get_session() as session:
        tenant = session.get(Tenant, current_user.tenant_id) if current_user.tenant_id else None
        profile = (
            session.query(CompanyProfile)
            .filter(CompanyProfile.tenant_id == str(current_user.tenant_id or ""))
            .order_by(CompanyProfile.created_at.desc())
            .first()
        ) if current_user.tenant_id else None
        comp = (getattr(profile, "name", "") or getattr(tenant, "name", "") or comp).strip()
        website = getattr(profile, "website", "") or ""
        if getattr(profile, "industry", ""):
            company_facts.append(f"Industry: {profile.industry}")
        if getattr(profile, "location", ""):
            company_facts.append(f"Company location: {profile.location}")
        if getattr(profile, "tech_stack", None):
            company_facts.append(f"Company technology stack: {', '.join(profile.tech_stack)}")
        if getattr(profile, "notes", ""):
            company_facts.append(f"Company overview: {profile.notes[:1500]}")

    website_context = _fetch_company_website_context(website)
    if company_facts:
        company_facts_context = "\n".join(company_facts)
    else:
        company_facts_context = "No additional company profile details are available."
    website_context_prompt = (
        f"Public company website excerpt ({website}): {website_context}"
        if website_context else "The company website is unavailable or contains no readable public company details."
    )
    
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
        f"Work location: {data.location or 'as agreed with the company'}. Employment type: {data.employment_type or 'as specified for the role'}. "
        f"Company profile context:\n{company_facts_context}\n{website_context_prompt}\n"
        "Use the company context only for relevant, supported details. Do not invent company products, customers, values, or claims; omit anything not supported by the supplied context. "
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
        "company_name": comp,
        "company_website_used": bool(website_context),
        "status": "success"
    }

