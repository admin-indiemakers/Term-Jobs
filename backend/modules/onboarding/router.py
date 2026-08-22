"""Onboarding checklist API.

Each accepted candidate gets a checklist of items (equipment, software,
training, custom) that the hiring manager sets up and the candidate fills out.
Status is auto-computed based on completion percentage.
"""
import uuid

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from modules.identity.domain.models import User
from modules.identity.services.auth_service import decode_access_token
from modules.shared.db import db, get_session

router = APIRouter(prefix="/api/onboarding", tags=["Onboarding"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class SoftwareItem(BaseModel):
    id: str
    label: str
    enabled: bool = False
    note: str = ""

class TrainingItem(BaseModel):
    id: str
    label: str
    enabled: bool = False
    mandatory: bool = False
    note: str = ""

class CustomItem(BaseModel):
    id: str
    label: str
    section: str  # equipment | software | training
    enabled: bool = False
    note: str = ""

class OnboardingChecklist(BaseModel):
    candidate_id: str
    candidate_name: str = ""
    candidate_email: str = ""
    requisition_id: str = ""
    requisition_title: str = ""
    company_name: str = ""
    vendor_name: str = ""

    laptop_required: bool = False
    laptop_spec: str = "Standard build"
    badge_required: bool = False

    software: list[SoftwareItem] = []
    training: list[TrainingItem] = []
    custom_items: list[CustomItem] = []

    notes: str = ""

    # Candidate fills these
    completed_items: dict[str, bool] = {}  # item_id -> True/False
    status: str = "not_started"  # not_started | in_progress | completed

    created_at: str = ""
    updated_at: str = ""


class OnboardingUpdate(BaseModel):
    model_config = {"extra": "allow"}
    laptop_required: bool | None = None
    laptop_spec: str | None = None
    badge_required: bool | None = None
    software: list[SoftwareItem] | None = None
    training: list[TrainingItem] | None = None
    custom_items: list[CustomItem] | None = None
    notes: str | None = None
    completed_items: dict[str, bool] | None = None
    status: str | None = None


# ── Helpers ──────────────────────────────────────────────────────────────────

def _coll():
    return db["onboarding_checklists"]


def _get_current_user(authorization: str | None) -> dict | None:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split(" ")[1]
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        return None
    with get_session() as session:
        user = session.get(User, payload["sub"])
        if user:
            return {"id": user.id, "email": user.email, "role": user.role, "tenant_id": user.tenant_id}
    return None


def _auto_status(doc: dict) -> str:
    """Compute onboarding status based on completed items."""
    required = []
    # Equipment
    if doc.get("laptop_required"):
        required.append("laptop")
    if doc.get("badge_required"):
        required.append("badge")
    # Software
    for s in doc.get("software", []):
        if s.get("enabled"):
            required.append(s["id"])
    # Training
    for t in doc.get("training", []):
        if t.get("enabled"):
            required.append(t["id"])
    # Custom items
    for ci in doc.get("custom_items", []):
        if ci.get("enabled"):
            required.append(ci["id"])

    if not required:
        return "not_started"

    completed = doc.get("completed_items", {})
    done_count = sum(1 for r in required if completed.get(r))
    if done_count == 0:
        return "not_started"
    if done_count >= len(required):
        return "completed"
    return "in_progress"


# ── Routes ───────────────────────────────────────────────────────────────────

@router.get("/{candidate_id}")
def get_onboarding(candidate_id: str, authorization: str | None = None):
    doc = _coll().find_one({"candidate_id": candidate_id})
    if not doc:
        raise HTTPException(status_code=404, detail="No onboarding checklist found")
    doc.pop("_id", None)
    return doc


@router.post("/{candidate_id}")
def create_onboarding(candidate_id: str, authorization: str | None = None):
    """Create a blank onboarding checklist for a candidate."""
    existing = _coll().find_one({"candidate_id": candidate_id})
    if existing:
        existing.pop("_id", None)
        return existing

    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "candidate_id": candidate_id,
        "candidate_name": "",
        "candidate_email": "",
        "requisition_id": "",
        "requisition_title": "",
        "company_name": "",
        "vendor_name": "",
        "laptop_required": False,
        "laptop_spec": "Standard build",
        "badge_required": False,
        "software": [],
        "training": [],
        "custom_items": [],
        "notes": "",
        "completed_items": {},
        "status": "not_started",
        "created_at": now,
        "updated_at": now,
    }
    _coll().insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.put("/{candidate_id}")
def update_onboarding(candidate_id: str, body: OnboardingUpdate):
    """Update the onboarding checklist (hiring manager setup or candidate completion)."""
    existing = _coll().find_one({"candidate_id": candidate_id})
    if not existing:
        raise HTTPException(status_code=404, detail="No onboarding checklist found")

    from datetime import datetime, timezone
    updates = {k: v for k, v in body.model_dump().items() if v is not None and k != "candidate_id"}
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()

    # Merge completed_items (don't replace entirely)
    if body.completed_items is not None:
        existing_completed = existing.get("completed_items", {})
        existing_completed.update(body.completed_items)
        updates["completed_items"] = existing_completed

    _coll().update_one({"candidate_id": candidate_id}, {"$set": updates})

    # Auto-compute status
    doc = _coll().find_one({"candidate_id": candidate_id})
    doc.pop("_id", None)
    new_status = _auto_status(doc)
    if new_status != doc.get("status"):
        _coll().update_one({"candidate_id": candidate_id}, {"$set": {"status": new_status}})
        doc["status"] = new_status

    return doc


@router.post("/generate")
def generate_checklist(data: dict):
    """AI-generate an onboarding checklist using Groq."""
    role_title = data.get("role_title", "")
    company_name = data.get("company_name", "")
    tech_stack = data.get("tech_stack", [])

    prompt = f"""Generate an onboarding checklist for a new hire:
Role: {role_title}
Company: {company_name}
Tech stack: {', '.join(tech_stack) if tech_stack else 'Not specified'}

Return a JSON object with exactly these fields:
{{
  "laptop_required": true/false,
  "laptop_spec": "Standard build" or "Developer build" or "Design build (GPU)",
  "badge_required": true/false,
  "software": [
    {{"id": "vpn", "label": "VPN access", "enabled": true/false}},
    {{"id": "email", "label": "Company email", "enabled": true/false}},
    {{"id": "github", "label": "GitHub / repo access", "enabled": true/false}},
    {{"id": "slack", "label": "Slack / Teams", "enabled": true/false}},
    {{"id": "client", "label": "Client / dept system", "enabled": true/false}}
  ],
  "training": [
    {{"id": "posh", "label": "POSH training", "enabled": true, "mandatory": true}},
    {{"id": "codeofconduct", "label": "Code of conduct & data privacy", "enabled": true, "mandatory": true}},
    {{"id": "induction", "label": "Company induction", "enabled": true/false, "mandatory": false}},
    {{"id": "security", "label": "Security & data-handling awareness", "enabled": true/false, "mandatory": false}},
    {{"id": "nda", "label": "Client-specific NDA / compliance", "enabled": true/false, "mandatory": false}}
  ]
}}

Rules:
- Engineers/DevOps get GitHub=true, VPN=true, laptop=Developer build
- Sales/Finance get Client=true, GitHub=false
- Always enable POSH and code of conduct as mandatory
- Enable induction for everyone
- Enable security for technical roles
- Enable NDA if client-facing
- Return ONLY the JSON, no markdown fences."""

    try:
        from modules.requisition.llm.groq import GroqClient
        client = GroqClient()
        import json
        raw = client.generate_text(prompt, tier="small")
        # Clean markdown fences
        raw = raw.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[-1]
        if raw.endswith("```"):
            raw = raw.rsplit("```", 1)[0]
        raw = raw.strip()
        result = json.loads(raw)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)}")


@router.get("/")
def list_onboarding():
    """List all onboarding checklists."""
    docs = list(_coll().find())
    for d in docs:
        d.pop("_id", None)
    return docs
