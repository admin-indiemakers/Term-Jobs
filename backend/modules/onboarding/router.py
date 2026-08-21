"""Onboarding checklist endpoints.

Each accepted candidate gets an onboarding checklist generated (or manually
created) by the hiring manager.  The AI-assisted endpoint uses Groq to
suggest items based on the candidate's role and company context.
"""
import json
import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from modules.identity.domain.models import User
from modules.identity.router import get_current_user
from modules.shared.config import settings
from modules.shared.db import db, Session, get_session

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/onboarding", tags=["Onboarding"])

UTC = timezone.utc


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------
class EquipmentItem(BaseModel):
    required: bool = False
    spec: str = ""


class SoftwareItem(BaseModel):
    enabled: bool = False
    note: str = ""


class TrainingItem(BaseModel):
    enabled: bool = False


class CustomItem(BaseModel):
    id: str = ""
    label: str = ""
    section: str = ""  # equipment | software | training
    enabled: bool = False
    note: str = ""


class OnboardingChecklist(BaseModel):
    candidate_id: str = ""
    candidate_name: str = ""
    candidate_email: str = ""
    requisition_id: str = ""
    requisition_title: str = ""
    company_name: str = ""

    status: str = "not_started"  # not_started | in_progress | completed

    laptop: EquipmentItem = Field(default_factory=EquipmentItem)
    badge: bool = False

    software: dict[str, SoftwareItem] = Field(default_factory=dict)

    mandatory_training: dict[str, TrainingItem] = Field(default_factory=dict)
    optional_training: dict[str, TrainingItem] = Field(default_factory=dict)

    custom_items: list[CustomItem] = Field(default_factory=list)

    # Candidate fills these — tracks which items are done
    completed_items: list[str] = Field(default_factory=list)

    notes: str = ""
    created_at: str = ""
    updated_at: str = ""


class OnboardingUpdate(BaseModel):
    # Flexible — accept any subset of fields the client sends
    model_config = {"extra": "allow"}

    status: str | None = None
    laptop: EquipmentItem | None = None
    badge: bool | None = None
    software: dict[str, SoftwareItem] | None = None
    mandatory_training: dict[str, TrainingItem] | None = None
    optional_training: dict[str, TrainingItem] | None = None
    custom_items: list[CustomItem] | None = None
    completed_items: list[str] | None = None
    notes: str | None = None


class GenerateRequest(BaseModel):
    candidate_id: str
    role_title: str = ""
    company_name: str = ""
    tech_stack: list[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _coll():
    return db["onboarding_checklists"]


def _now() -> str:
    return datetime.now(UTC).isoformat()


def _ensure_software_defaults(sw: dict) -> dict:
    defaults = {
        "vpn": SoftwareItem(),
        "email": SoftwareItem(enabled=True),
        "github": SoftwareItem(),
        "slack": SoftwareItem(enabled=True),
        "client": SoftwareItem(),
    }
    for k, v in defaults.items():
        if k not in sw:
            sw[k] = v
    return sw


def _count_required_items(doc: dict) -> int:
    """Count how many items the candidate needs to complete."""
    count = 0
    # Equipment
    if doc.get("laptop", {}).get("required"):
        count += 1
    if doc.get("badge"):
        count += 1
    # Software
    for item in (doc.get("software") or {}).values():
        if isinstance(item, dict) and item.get("enabled"):
            count += 1
    # Optional training
    for item in (doc.get("optional_training") or {}).values():
        if isinstance(item, dict) and item.get("enabled"):
            count += 1
    # Custom items
    for item in (doc.get("custom_items") or []):
        if isinstance(item, dict) and item.get("enabled"):
            count += 1
    return count


def _ensure_training_defaults(mt: dict, ot: dict) -> tuple[dict, dict]:
    mandatory_defaults = {"posh": TrainingItem(enabled=True), "code_of_conduct": TrainingItem(enabled=True)}
    optional_defaults = {
        "induction": TrainingItem(),
        "security": TrainingItem(),
        "nda": TrainingItem(),
    }
    for k, v in mandatory_defaults.items():
        if k not in mt:
            mt[k] = v
    for k, v in optional_defaults.items():
        if k not in ot:
            ot[k] = v
    return mt, ot


# ---------------------------------------------------------------------------
# GET – fetch onboarding checklist for a candidate
# ---------------------------------------------------------------------------
@router.get("/{candidate_id}")
def get_onboarding(
    candidate_id: str,
    current_user: User = Depends(get_current_user),
) -> dict:
    doc = _coll().find_one({"candidate_id": candidate_id})
    if not doc:
        raise HTTPException(status_code=404, detail="No onboarding checklist found for this candidate")
    doc.pop("_id", None)
    return doc


# ---------------------------------------------------------------------------
# PUT – update onboarding checklist
# ---------------------------------------------------------------------------
@router.put("/{candidate_id}")
def update_onboarding(
    candidate_id: str,
    body: OnboardingUpdate,
    current_user: User = Depends(get_current_user),
) -> dict:
    update_fields: dict = {k: v for k, v in body.model_dump().items() if v is not None and k != "candidate_id"}
    update_fields["updated_at"] = _now()

    result = _coll().update_one(
        {"candidate_id": candidate_id},
        {"$set": update_fields},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="No onboarding checklist found for this candidate")

    doc = _coll().find_one({"candidate_id": candidate_id})
    doc.pop("_id", None)

    # Auto-compute status from completed_items
    completed = set(doc.get("completed_items", []))
    total_items = _count_required_items(doc)
    if total_items > 0 and len(completed) == total_items:
        new_status = "completed"
    elif completed:
        new_status = "in_progress"
    else:
        new_status = "not_started"
    if doc.get("status") != new_status:
        _coll().update_one(
            {"candidate_id": candidate_id},
            {"$set": {"status": new_status}},
        )
        doc["status"] = new_status

    return doc


# ---------------------------------------------------------------------------
# POST – create a new onboarding checklist (blank or pre-filled)
# ---------------------------------------------------------------------------
@router.post("/{candidate_id}")
def create_onboarding(
    candidate_id: str,
    current_user: User = Depends(get_current_user),
) -> dict:
    existing = _coll().find_one({"candidate_id": candidate_id})
    if existing:
        existing.pop("_id", None)
        return existing

    now = _now()
    software = _ensure_software_defaults({})
    mt, ot = _ensure_training_defaults({}, {})

    doc = {
        "candidate_id": candidate_id,
        "candidate_name": "",
        "candidate_email": "",
        "requisition_id": "",
        "requisition_title": "",
        "company_name": "",
        "status": "not_started",
        "laptop": {"required": True, "spec": "Standard build"},
        "badge": True,
        "software": {k: v.model_dump() for k, v in software.items()},
        "mandatory_training": {k: v.model_dump() for k, v in mt.items()},
        "optional_training": {k: v.model_dump() for k, v in ot.items()},
        "custom_items": [],
        "notes": "",
        "created_at": now,
        "updated_at": now,
    }
    _coll().insert_one(doc)
    doc.pop("_id", None)
    return doc


# ---------------------------------------------------------------------------
# POST – AI-generate onboarding checklist using Groq
# ---------------------------------------------------------------------------
@router.post("/generate")
def generate_onboarding(
    body: GenerateRequest,
    current_user: User = Depends(get_current_user),
) -> dict:
    """Use Groq LLM to generate an intelligent onboarding checklist based on
    the candidate's role, company, and tech stack."""
    # Check if Groq is configured
    if not settings.groq_api_key:
        raise HTTPException(
            status_code=503,
            detail="AI generation unavailable — GROQ_API_KEY not configured",
        )

    import httpx

    # Build the prompt
    role_context = body.role_title or "Software Engineer"
    company_context = body.company_name or "the company"
    tech_str = ", ".join(body.tech_stack[:10]) if body.tech_stack else "general tech"

    prompt = f"""You are an HR onboarding expert. Generate an onboarding checklist for a new hire.

Role: {role_context}
Company: {company_context}
Tech stack: {tech_str}

Return a JSON object with EXACTLY this structure (no markdown, no commentary):

{{
  "laptop": {{"required": true, "spec": "Developer build"}},
  "badge": true,
  "software": {{
    "vpn": {{"enabled": true, "note": ""}},
    "email": {{"enabled": true, "note": ""}},
    "github": {{"enabled": true/false, "note": ""}},
    "slack": {{"enabled": true/false, "note": ""}},
    "client": {{"enabled": true/false, "note": "specific system name if any"}}
  }},
  "mandatory_training": {{
    "posh": {{"enabled": true}},
    "code_of_conduct": {{"enabled": true}}
  }},
  "optional_training": {{
    "induction": {{"enabled": true/false}},
    "security": {{"enabled": true/false}},
    "nda": {{"enabled": true/false}}
  }},
  "notes": "Brief reasoning for the choices made"
}}

Rules:
- Engineers always need VPN, GitHub, email, Slack
- Non-engineers typically skip GitHub
- Everyone gets POSH + code of conduct training
- Security training for roles handling sensitive data
- NDA if client-facing role
- Badge for office access
- Keep laptop spec appropriate to the role
- Return ONLY the JSON object"""

    try:
        resp = httpx.post(
            f"{settings.groq_base_url}/chat/completions",
            json={
                "model": settings.groq_default_model,
                "messages": [
                    {"role": "system", "content": "You are a precise HR onboarding assistant. Return only valid JSON."},
                    {"role": "user", "content": prompt},
                ],
                "stream": False,
                "response_format": {"type": "json_object"},
            },
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {settings.groq_api_key}",
            },
            timeout=60.0,
        )
        resp.raise_for_status()
        data = resp.json()
        raw = data["choices"][0]["message"]["content"].strip()
        raw = raw.strip("`")
        if raw.startswith("json"):
            raw = raw[4:].strip()
        generated = json.loads(raw)
    except Exception as exc:
        logger.warning("Groq onboarding generation failed: %s", exc)
        raise HTTPException(status_code=502, detail=f"AI generation failed: {exc}")

    now = _now()
    software = _ensure_software_defaults(generated.get("software", {}))
    mt, ot = _ensure_training_defaults(
        generated.get("mandatory_training", {}),
        generated.get("optional_training", {}),
    )

    doc = {
        "candidate_id": body.candidate_id,
        "candidate_name": "",
        "candidate_email": "",
        "requisition_id": "",
        "requisition_title": body.role_title,
        "company_name": body.company_name,
        "status": "not_started",
        "laptop": generated.get("laptop", {"required": True, "spec": "Standard build"}),
        "badge": generated.get("badge", True),
        "software": {k: v.model_dump() if hasattr(v, "model_dump") else v for k, v in software.items()},
        "mandatory_training": {k: v.model_dump() if hasattr(v, "model_dump") else v for k, v in mt.items()},
        "optional_training": {k: v.model_dump() if hasattr(v, "model_dump") else v for k, v in ot.items()},
        "custom_items": [],
        "notes": generated.get("notes", ""),
        "created_at": now,
        "updated_at": now,
    }

    # Upsert
    _coll().update_one(
        {"candidate_id": body.candidate_id},
        {"$set": doc},
        upsert=True,
    )

    return doc


# ---------------------------------------------------------------------------
# GET – list all onboarding checklists for the current tenant
# ---------------------------------------------------------------------------
@router.get("/")
def list_onboarding(
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    cursor = _coll().find({})
    results = []
    for doc in cursor:
        doc.pop("_id", None)
        results.append(doc)
    return results
