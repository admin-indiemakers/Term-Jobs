"""Offboarding checklist and clearance API."""
import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Header, status
from pydantic import BaseModel, Field

from modules.identity.domain.models import User
from modules.identity.router import get_current_user
from modules.shared.db import db, get_session

logger = logging.getLogger("offboarding")

router = APIRouter(prefix="/api/offboarding", tags=["Offboarding"])


class ChecklistItem(BaseModel):
    id: str
    label: str
    category: str = "custom"  # equipment | software | training | custom
    mandatory: bool = True
    completed: bool = False
    notes: str = ""


class OffboardingInitiateRequest(BaseModel):
    laptop_return_required: bool = False
    laptop_spec: str = "Standard build"
    badge_return_required: bool = False
    software_items: list[dict] = []
    handover_items: list[dict] = []
    custom_items: list[dict] = []
    notes: str = ""


class CandidateProgressUpdate(BaseModel):
    completed_items: dict[str, bool] = {}  # item_id -> True/False
    notes: str = ""


def _coll():
    return db["offboarding_checklists"]


def _onboarding_coll():
    return db["onboarding_checklists"]


def _clean_id(val: str) -> str:
    if not val:
        return ""
    return str(val).replace("SDC-", "").replace("SDC -", "").replace("BEAR-", "").replace("BEAR -", "").strip()


def _find_offboarding_doc(candidate_id: str) -> dict | None:
    coll = _coll()
    cid = str(candidate_id).strip()
    clean = _clean_id(cid)

    doc = coll.find_one({
        "$or": [
            {"candidate_id": cid},
            {"workorder_id": cid},
            {"candidate_id": clean},
            {"workorder_id": clean},
            {"candidate_id": f"BEAR-{clean}"},
            {"workorder_id": f"BEAR-{clean}"},
        ]
    })
    return doc


def _find_onboarding_doc(candidate_id: str) -> dict | None:
    coll = _onboarding_coll()
    cid = str(candidate_id).strip()
    clean = _clean_id(cid)

    doc = coll.find_one({
        "$or": [
            {"candidate_id": cid},
            {"workorder_id": cid},
            {"candidate_id": clean},
            {"workorder_id": clean},
            {"candidate_id": f"BEAR-{clean}"},
            {"workorder_id": f"BEAR-{clean}"},
        ]
    })
    return doc


@router.get("/{candidate_id}")
def get_offboarding(candidate_id: str, current_user: User = Depends(get_current_user)):
    """Fetch offboarding checklist for a candidate.
    If offboarding document does not exist yet, pre-populate with the candidate's onboarding fields.
    """
    doc = _find_offboarding_doc(candidate_id)
    if doc:
        doc.pop("_id", None)
        return doc

    # Pre-populate from onboarding checklist
    onb_doc = _find_onboarding_doc(candidate_id) or {}
    cid = str(candidate_id).strip()

    # Build mirrored checklist items from onboarding
    software_items = []
    for s in onb_doc.get("software", []):
        if s.get("enabled"):
            software_items.append({
                "id": f"sw_{s.get('id', uuid.uuid4().hex[:6])}",
                "label": f"Revoke / Handover: {s.get('label') or s.get('name')}",
                "category": "software",
                "enabled": True,
            })

    handover_items = []
    for t in onb_doc.get("training", []):
        if t.get("enabled"):
            handover_items.append({
                "id": f"ho_{t.get('id', uuid.uuid4().hex[:6])}",
                "label": f"Knowledge Transfer: {t.get('label') or t.get('name')}",
                "category": "training",
                "enabled": True,
            })

    custom_items = []
    for c in onb_doc.get("custom_items", []):
        if c.get("enabled"):
            custom_items.append({
                "id": f"ci_{c.get('id', uuid.uuid4().hex[:6])}",
                "label": f"Exit Clearance: {c.get('label') or c.get('name')}",
                "category": "custom",
                "enabled": True,
            })

    # Default clearance items if none were present
    if not custom_items:
        custom_items = [
            {"id": "ci_nda", "label": "Sign Final NDA & Exit Clearance Agreement", "category": "custom", "enabled": True},
            {"id": "ci_files", "label": "Handover all code, documents, & credentials to team", "category": "custom", "enabled": True},
        ]

    prepopulated = {
        "candidate_id": cid,
        "workorder_id": onb_doc.get("workorder_id") or cid,
        "candidate_name": onb_doc.get("candidate_name", ""),
        "candidate_email": onb_doc.get("candidate_email", ""),
        "requisition_id": onb_doc.get("requisition_id", ""),
        "requisition_title": onb_doc.get("requisition_title", ""),
        "company_name": onb_doc.get("company_name", ""),
        "vendor_name": onb_doc.get("vendor_name", ""),
        "laptop_return_required": bool(onb_doc.get("laptop_required")),
        "laptop_spec": onb_doc.get("laptop_spec", "Standard build"),
        "badge_return_required": bool(onb_doc.get("badge_required")),
        "software_items": software_items,
        "handover_items": handover_items,
        "custom_items": custom_items,
        "notes": "",
        "status": "not_started",  # not_started | in_progress | completed
        "completed_items": {},
        "timesheet_frozen": False,
        "offboarding_completed_at": None,
        "access_expires_at": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    return prepopulated


@router.post("/{candidate_id}/initiate")
def initiate_offboarding(
    candidate_id: str,
    body: OffboardingInitiateRequest,
    current_user: User = Depends(get_current_user)
):
    """Hiring Manager / Admin initiates offboarding for a candidate."""
    if current_user.role not in ("Hiring Manager", "Admin", "Super Admin", "HR"):
        raise HTTPException(status_code=403, detail="Only hiring managers, HR, and admins can initiate offboarding.")

    cid = str(candidate_id).strip()
    coll = _coll()
    existing = _find_offboarding_doc(cid)
    onb_doc = _find_onboarding_doc(cid) or {}

    now_iso = datetime.now(timezone.utc).isoformat()
    doc_id = existing.get("id") if existing else f"off_{uuid.uuid4().hex[:12]}"

    doc_data = {
        "id": doc_id,
        "candidate_id": cid,
        "workorder_id": onb_doc.get("workorder_id") or cid,
        "candidate_name": onb_doc.get("candidate_name", ""),
        "candidate_email": onb_doc.get("candidate_email", ""),
        "requisition_id": onb_doc.get("requisition_id", ""),
        "requisition_title": onb_doc.get("requisition_title", ""),
        "company_name": onb_doc.get("company_name", ""),
        "vendor_name": onb_doc.get("vendor_name", ""),
        "laptop_return_required": body.laptop_return_required,
        "laptop_spec": body.laptop_spec,
        "badge_return_required": body.badge_return_required,
        "software_items": body.software_items,
        "handover_items": body.handover_items,
        "custom_items": body.custom_items,
        "notes": body.notes,
        "status": "in_progress",
        "completed_items": existing.get("completed_items", {}) if existing else {},
        "timesheet_frozen": existing.get("timesheet_frozen", False) if existing else False,
        "offboarding_completed_at": existing.get("offboarding_completed_at") if existing else None,
        "access_expires_at": existing.get("access_expires_at") if existing else None,
        "initiated_by_user_id": current_user.id,
        "initiated_by_name": current_user.name,
        "initiated_at": now_iso,
        "updated_at": now_iso,
    }

    if existing:
        coll.update_one({"id": existing.get("id", doc_id)}, {"$set": doc_data})
    else:
        doc_data["created_at"] = now_iso
        coll.insert_one(doc_data)

    # Also record offboarding initiated on user account in MongoDB and SQL
    clean = _clean_id(cid)
    user_filter = {
        "$or": [
            {"candidate_id": cid},
            {"workorder_id": cid},
            {"candidate_id": clean},
            {"workorder_id": clean},
            {"candidate_id": f"BEAR-{clean}"},
            {"workorder_id": f"BEAR-{clean}"},
        ]
    }
    db["users"].update_many(user_filter, {
        "$set": {
            "offboarding_status": "in_progress",
            "offboarding_initiated_at": now_iso,
        }
    })

    # Send in-app notification to candidate
    try:
        notif = {
            "id": f"notif_{uuid.uuid4().hex[:8]}",
            "candidate_id": cid,
            "title": "Offboarding Initiated",
            "message": f"Your offboarding checklist has been initiated by {current_user.name}. Please complete your clearance items.",
            "target_tab": "offboarding",
            "is_read": False,
            "created_at": now_iso,
        }
        db["candidate_notifications"].insert_one(notif)
    except Exception as e:
        logger.warning(f"Failed to create offboarding notification: {e}")

    doc_data.pop("_id", None)
    return {"status": "success", "message": "Offboarding initiated successfully", "offboarding": doc_data}


@router.put("/{candidate_id}/candidate-progress")
def update_candidate_progress(
    candidate_id: str,
    body: CandidateProgressUpdate,
    current_user: User = Depends(get_current_user)
):
    """Candidate updates their ticked offboarding clearance items."""
    cid = str(candidate_id).strip()
    doc = _find_offboarding_doc(cid)
    if not doc:
        raise HTTPException(status_code=404, detail="Offboarding document not found.")

    now_iso = datetime.now(timezone.utc).isoformat()
    _coll().update_one(
        {"id": doc["id"]},
        {
            "$set": {
                "completed_items": body.completed_items,
                "notes": body.notes or doc.get("notes", ""),
                "updated_at": now_iso,
            }
        }
    )
    doc["completed_items"] = body.completed_items
    doc.pop("_id", None)
    return {"status": "success", "completed_items": body.completed_items}


@router.post("/{candidate_id}/complete")
def complete_offboarding(
    candidate_id: str,
    current_user: User = Depends(get_current_user)
):
    """Candidate finishes ticking all items and completes offboarding:
    1. Sets offboarding status to 'completed'.
    2. Immediately freezes timesheet submissions.
    3. Sets access_expires_at = now + 48 hours.
    4. Marks user account in deactivation grace period.
    """
    cid = str(candidate_id).strip()
    doc = _find_offboarding_doc(cid)
    if not doc:
        raise HTTPException(status_code=404, detail="Offboarding document not found.")

    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    expires_at = (now + timedelta(hours=48)).isoformat()

    # Mark offboarding completed & timesheet frozen
    _coll().update_one(
        {"id": doc["id"]},
        {
            "$set": {
                "status": "completed",
                "offboarding_completed_at": now_iso,
                "access_expires_at": expires_at,
                "timesheet_frozen": True,
                "updated_at": now_iso,
            }
        }
    )

    # Update candidate work order status & user record
    clean = _clean_id(cid)
    user_match = {
        "$or": [
            {"candidate_id": cid},
            {"workorder_id": cid},
            {"candidate_id": clean},
            {"workorder_id": clean},
            {"candidate_id": f"BEAR-{clean}"},
            {"workorder_id": f"BEAR-{clean}"},
        ]
    }
    db["users"].update_many(user_match, {
        "$set": {
            "offboarding_status": "completed",
            "offboarding_completed_at": now_iso,
            "access_expires_at": expires_at,
            "timesheet_frozen": True,
            "account_deactivated": True,
        }
    })

    # Also freeze candidate's work orders
    db["work_orders"].update_many(
        {"$or": [{"candidate_id": cid}, {"workorder_id": cid}, {"candidate_id": clean}, {"workorder_id": clean}]},
        {"$set": {"timesheet_frozen": True, "offboarding_status": "completed"}}
    )

    # Send confirmation notification
    try:
        notif = {
            "id": f"notif_{uuid.uuid4().hex[:8]}",
            "candidate_id": cid,
            "title": "Offboarding Completed - 48h Access Window",
            "message": "All clearance items checked! Your timesheet is now frozen. You have 48 hours to view past documents before your account is permanently deactivated.",
            "target_tab": "dashboard",
            "is_read": False,
            "created_at": now_iso,
        }
        db["candidate_notifications"].insert_one(notif)
    except Exception as e:
        logger.warning(f"Failed to create offboarding notification: {e}")

    return {
        "status": "success",
        "message": "Offboarding completed successfully. Timesheets are frozen, and account access expires in 48 hours.",
        "offboarding_completed_at": now_iso,
        "access_expires_at": expires_at,
        "timesheet_frozen": True,
    }


@router.get("/status/{candidate_id}")
def get_offboarding_status(candidate_id: str):
    """Public/authorized status check for a candidate's offboarding state."""
    doc = _find_offboarding_doc(candidate_id)
    if not doc:
        return {
            "status": "not_started",
            "timesheet_frozen": False,
            "access_expires_at": None,
            "hours_remaining": None,
            "is_expired": False,
        }

    now = datetime.now(timezone.utc)
    expires_at_str = doc.get("access_expires_at")
    hours_remaining = None
    is_expired = False

    if expires_at_str:
        try:
            exp = datetime.fromisoformat(expires_at_str)
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            delta = exp - now
            hours_remaining = max(0.0, round(delta.total_seconds() / 3600.0, 1))
            is_expired = now >= exp
        except Exception:
            pass

    return {
        "status": doc.get("status", "not_started"),
        "timesheet_frozen": bool(doc.get("timesheet_frozen", False)),
        "offboarding_completed_at": doc.get("offboarding_completed_at"),
        "access_expires_at": expires_at_str,
        "hours_remaining": hours_remaining,
        "is_expired": is_expired,
    }
