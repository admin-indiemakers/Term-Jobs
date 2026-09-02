"""Onboarding checklist API.

Each accepted candidate gets a checklist of items (equipment, software,
training, custom) that the hiring manager sets up and the candidate fills out.
Status is auto-computed based on completion percentage.
"""
import uuid

from fastapi import APIRouter, HTTPException, Header
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


class ActivationGate(BaseModel):
    id: str
    label: str
    responsible: str  # Worker | TalentBridge | Buyer IT | Buyer EHS | Manager
    type: str = "blocking"  # blocking | warn_only
    status: str = "pending"  # pending | cleared
    cleared_at: str | None = None
    cleared_by: str | None = None


class OnboardingUpdate(BaseModel):
    model_config = {"extra": "allow"}
    candidate_name: str | None = None
    candidate_email: str | None = None
    requisition_id: str | None = None
    requisition_ref: str | None = None
    requisition_title: str | None = None
    company_name: str | None = None
    vendor_name: str | None = None
    laptop_required: bool | None = None
    laptop_spec: str | None = None
    badge_required: bool | None = None
    software: list[SoftwareItem] | None = None
    training: list[TrainingItem] | None = None
    custom_items: list[CustomItem] | None = None
    activation_gates: list[ActivationGate] | None = None
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

# ── Onboarding Issues Management (must be before /{candidate_id}) ──────────

def _issues_coll():
    return db["onboarding_issues"]


@router.post("/issues")
def raise_onboarding_issue(data: dict, authorization: str | None = Header(None)):
    """Candidate raises an issue regarding onboarding."""
    from datetime import datetime, timezone
    current_user = _get_current_user(authorization)
    tenant_id = ""
    if current_user:
        tenant_id = current_user.get("tenant_id", "")
    elif data.get("tenant_id"):
        tenant_id = data["tenant_id"]
    issue = {
        "id": f"issue_{uuid.uuid4().hex[:8]}",
        "candidate_id": data.get("candidate_id", ""),
        "candidate_name": data.get("candidate_name", ""),
        "company_name": data.get("company_name", ""),
        "category": data.get("category", "other"),
        "category_label": data.get("category_label", "Onboarding Issue"),
        "description": data.get("description", ""),
        "tenant_id": tenant_id,
        "vendor_name": data.get("vendor_name", ""),
        "status": "open",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "resolved_at": None,
    }
    _issues_coll().insert_one(issue)
    issue.pop("_id", None)
    return issue


@router.get("/issues")
def list_onboarding_issues(authorization: str | None = Header(None)):
    """List raised onboarding issues. Scoped by tenant and hiring manager."""
    user = _get_current_user(authorization)
    if user and user["role"] not in ("Super Admin", "Admin", "HR", "Director"):
        # Hiring Manager: only see issues for candidates in their requisitions
        from modules.requisition.domain.models import Requisition
        from modules.shared.db import get_session as _gs
        with _gs() as session:
            filters = [Requisition.tenant_id == user["tenant_id"]]
            if user["role"] == "Hiring Manager":
                filters.append(Requisition.created_by == user["id"])
            req_ids = {r.id for r in session.query(Requisition).filter(*filters).all()}
        # Get candidate_ids from those requisitions
        from modules.shared.db import db as _db
        cand_ids = set()
        for sd in _db["candidate_submissions"].find({"requisition_id": {"$in": list(req_ids)} if req_ids else {"$in": []}}, {"id": 1}):
            cand_ids.add(sd.get("id"))
        if cand_ids:
            docs = list(_issues_coll().find({"candidate_id": {"$in": list(cand_ids)}}))
        else:
            docs = []
    else:
        docs = list(_issues_coll().find())
    for d in docs:
        d.pop("_id", None)
    return docs


@router.post("/issues/{issue_id}/resolve")
def resolve_onboarding_issue(issue_id: str):
    """Mark an onboarding issue as fixed/resolved and notify the candidate."""
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()
    result = _issues_coll().update_one(
        {"id": issue_id}, {"$set": {"status": "fixed", "resolved_at": now}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Issue not found")
    doc = _issues_coll().find_one({"id": issue_id})
    doc.pop("_id", None)

    # Create notification for the candidate in both collections
    candidate_id = doc.get("candidate_id", "")
    try:
        candidate_user_doc = db["users"].find_one({"candidate_id": candidate_id, "role": "Candidate"})
        user_id = candidate_user_doc.get("id", "") if candidate_user_doc else ""
        tenant_id = candidate_user_doc.get("tenant_id", "") if candidate_user_doc else ""
        notif_id = f"notif_{uuid.uuid4().hex[:8]}"
        notif_body = f"Your onboarding issue '{doc.get('category_label', 'Issue')}' — {doc.get('description', '')} — has been resolved by your hiring manager."
        notif_data = {
            "issue_id": doc.get("id"),
            "category": doc.get("category"),
            "category_label": doc.get("category_label"),
            "candidate_id": candidate_id,
        }
        # Save to 'notifications' collection (onboarding module)
        db["notifications"].insert_one({
            "id": notif_id,
            "user_id": user_id,
            "tenant_id": tenant_id,
            "type": "issue.resolved",
            "title": "Issue Resolved",
            "body": notif_body,
            "data": notif_data,
            "read": False,
            "created_at": now,
        })
        # Also save to 'candidate_notifications' collection (candidate portal)
        db["candidate_notifications"].insert_one({
            "id": f"notif_{uuid.uuid4().hex[:8]}",
            "candidate_id": candidate_id,
            "title": "Issue Resolved",
            "message": notif_body,
            "category": "onboarding",
            "timestamp_label": "Just now",
            "is_read": False,
            "target_tab": "onboarding",
            "data": notif_data,
            "created_at": now,
        })
    except Exception as e:
        import logging
        logging.getLogger("onboarding").warning(f"Failed to create issue resolved notification: {e}")

    return doc



# ── Candidate Notifications ──────────────────────────────────────────────

@router.get("/notifications/{candidate_id}")
def get_candidate_notifications(candidate_id: str):
    """Get issue-related notifications for a candidate."""
    candidate_user = db["users"].find_one({"candidate_id": candidate_id, "role": "Candidate"})
    if not candidate_user:
        return []
    user_id = candidate_user.get("id", "")
    docs = list(db["notifications"].find({"user_id": user_id}).sort("created_at", -1).limit(20))
    for d in docs:
        d.pop("_id", None)
    return docs


@router.post("/notifications/{notification_id}/read")
def mark_notification_read(notification_id: str):
    """Mark a candidate notification as read."""
    db["notifications"].update_one(
        {"id": notification_id}, {"$set": {"read": True}}
    )
    return {"status": "success"}


# ── Onboarding Checklists ──────────────────────────────────────────────────

@router.get("/{candidate_id}")
def get_onboarding(candidate_id: str, authorization: str | None = Header(None)):
    doc = _coll().find_one({"candidate_id": candidate_id})
    if not doc:
        raise HTTPException(status_code=404, detail="No onboarding checklist found")
    doc.pop("_id", None)
    return doc


@router.post("/{candidate_id}")
def create_onboarding(candidate_id: str, authorization: str | None = Header(None)):
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
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()
    if not existing:
        doc = {
            "candidate_id": candidate_id,
            "candidate_name": getattr(body, "candidate_name", ""),
            "candidate_email": getattr(body, "candidate_email", ""),
            "requisition_id": getattr(body, "requisition_id", ""),
            "requisition_title": getattr(body, "requisition_title", ""),
            "company_name": getattr(body, "company_name", ""),
            "vendor_name": getattr(body, "vendor_name", ""),
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
        existing = _coll().find_one({"candidate_id": candidate_id})
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

    # --- Sync enriched data to work order so the candidate portal shows it ---
    try:
        from modules.shared.db import db as _db
        wo_update = {}
        if updates.get("requisition_title"):
            wo_update["requisition_title"] = updates["requisition_title"]
        if updates.get("company_name"):
            wo_update["company_name"] = updates["company_name"]
        if updates.get("vendor_name"):
            wo_update["vendor_name"] = updates["vendor_name"]
        if updates.get("requisition_id"):
            wo_update["requisition_id"] = updates["requisition_id"]
        if wo_update:
            _db["work_orders"].update_one(
                {"candidate_id": candidate_id, "status": "ACTIVE"},
                {"$set": wo_update},
            )
    except Exception:
        pass

    return doc


# ---------------------------------------------------------------------------
# POST /onboarding/{candidate_id}/activate-gates
# ---------------------------------------------------------------------------

@router.post("/{candidate_id}/activate-gates")
def activate_work_order(candidate_id: str, authorization: str | None = Header(None)):
    """Check activation gates. If all blocking gates are cleared, activate the work order."""
    user = _get_current_user(authorization)
    if not user or user["role"] not in ("Hiring Manager", "Admin", "Super Admin", "HR"):
        raise HTTPException(status_code=403, detail="Hiring Manager role required")

    doc = _coll().find_one({"candidate_id": candidate_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Onboarding not found")

    gates = doc.get("activation_gates", [])
    blocking = [g for g in gates if g.get("type") == "blocking"]
    blocking_cleared = [g for g in blocking if g.get("status") == "cleared"]
    blocking_pending = [g for g in blocking if g.get("status") != "cleared"]

    if blocking_pending:
        raise HTTPException(
            status_code=400,
            detail=f"{len(blocking_pending)} blocking gate(s) still open: {', '.join(g.get('label', '') for g in blocking_pending)}"
        )

    # All blocking gates cleared — activate the work order
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()

    try:
        db["work_orders"].update_one(
            {"candidate_id": candidate_id, "status": {"$ne": "CLOSED"}},
            {"$set": {
                "status": "ACTIVE",
                "activated_at": now,
                "activation_gates_cleared": True,
            }},
        )
    except Exception:
        pass

    # Update onboarding status
    _coll().update_one(
        {"candidate_id": candidate_id},
        {"$set": {"activation_status": "activated", "activated_at": now, "updated_at": now}},
    )

    # Notify candidate
    try:
        notif_id = f"notif_{uuid.uuid4().hex[:10]}"
        db["candidate_notifications"].insert_one({
            "id": notif_id,
            "candidate_id": candidate_id,
            "type": "work_order_activated",
            "title": "Work Order Activated",
            "message": "Your work order has been activated. You can now log hours and submit timesheets.",
            "is_read": False,
            "created_at": now,
        })
    except Exception:
        pass

    return {"status": "success", "message": "Work order activated successfully"}


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
def list_onboarding(authorization: str | None = Header(None)):
    """List onboarding checklists. Scoped by tenant and hiring manager."""
    user = _get_current_user(authorization)
    if user and user["role"] == "Hiring Manager":
        from modules.requisition.domain.models import Requisition
        from modules.shared.db import get_session as _gs
        with _gs() as session:
            req_ids = {r.id for r in session.query(Requisition).filter(
                Requisition.tenant_id == user["tenant_id"],
                Requisition.created_by == user["id"],
            ).all()}
        if req_ids:
            # Get candidate_ids from those requisitions
            from modules.shared.db import db as _db
            cand_ids = set()
            for sd in _db["candidate_submissions"].find({"requisition_id": {"$in": list(req_ids)}}, {"id": 1}):
                cand_ids.add(sd.get("id"))
            if cand_ids:
                docs = list(_coll().find({"candidate_id": {"$in": list(cand_ids)}}))
            else:
                docs = []
        else:
            docs = []
    else:
        docs = list(_coll().find())
    for d in docs:
        d.pop("_id", None)
    return docs


@router.post("/assistant")
def ai_assistant_chat(data: dict):
    """AI Assistant for Hiring Managers powered by Groq API.
    Can summarize candidate onboarding issues and auto-resolve issues mentioned in the chat.
    """
    user_message = data.get("message", "").strip()
    if not user_message:
        raise HTTPException(status_code=400, detail="Message is required")

    from datetime import datetime, timezone
    # Fetch current onboarding issues & candidate checklists
    issues_list = list(_issues_coll().find())
    for i in issues_list:
        i.pop("_id", None)
    
    checklists = list(_coll().find())
    for c in checklists:
        c.pop("_id", None)

    open_issues = [i for i in issues_list if i.get("status") == "open"]

    # Check if user message indicates resolving/rectifying an issue for a candidate or issue ID
    resolved_issue_ids = []
    user_lower = user_message.lower()
    if any(k in user_lower for k in ("resolve", "fix", "fixed", "rectify", "rectified", "solved", "done", "close")):
        for issue in open_issues:
            cid = issue.get("candidate_id", "").lower()
            cname = issue.get("candidate_name", "").lower()
            iid = issue.get("id", "").lower()
            if (cid and cid in user_lower) or (cname and cname in user_lower) or (iid and iid in user_lower) or ("issue" in user_lower and len(open_issues) == 1):
                # Auto fix this issue
                _issues_coll().update_one(
                    {"id": issue["id"]},
                    {"$set": {"status": "fixed", "resolved_at": datetime.now(timezone.utc).isoformat()}}
                )
                issue["status"] = "fixed"
                resolved_issue_ids.append(issue["id"])

    # Prompt Groq API
    try:
        from modules.requisition.llm.groq import GroqClient
        client = GroqClient()
        
        context_str = f"Current Open Onboarding Issues ({len(open_issues)}):\n"
        for idx, iss in enumerate(open_issues, 1):
            context_str += f"{idx}. [ID: {iss.get('id')}] Candidate: {iss.get('candidate_name')} ({iss.get('candidate_id')}) - Category: {iss.get('category_label')} - Details: {iss.get('description')}\n"
        
        if not open_issues:
            context_str += "None. All candidate onboarding issues are currently resolved.\n"

        if resolved_issue_ids:
            context_str += f"\nACTION TAKEN: Automatically marked issue(s) {', '.join(resolved_issue_ids)} as FIXED based on user input.\n"

        prompt = f"""You are the TermJobs AI Hiring Assistant. You help Hiring Managers monitor candidate onboarding, review reported candidate issues, and manage task rectifications.

System Context:
{context_str}

Hiring Manager Message: "{user_message}"

Instructions:
- Provide a helpful, concise, professional response to the Hiring Manager.
- If an issue was just marked as fixed/rectified, confirm it clearly to the user.
- If there are open candidate issues, remind them politely or answer their query.
- Be direct, friendly, and structured.
"""
        reply = client.generate_text(prompt, tier="small").strip()
    except Exception as e:
        reply = f"I noted your message. (Note: Groq LLM API response error: {str(e)})"

    return {
        "reply": reply,
        "resolved_issues": resolved_issue_ids,
        "open_issues_count": len([i for i in issues_list if i.get("status") == "open"]),
        "issues": issues_list,
    }


