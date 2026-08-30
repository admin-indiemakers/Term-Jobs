"""
Workforce Management — Hiring Manager endpoints.

Provides:
  GET  /api/workforce/team          — active team members with status
  GET  /api/workforce/timesheets    — timesheets for HM's team (filterable)
  POST /api/workforce/timesheets/{id}/approve  — approve a submitted timesheet
  POST /api/workforce/timesheets/{id}/reject   — reject a submitted timesheet
  GET  /api/workforce/stats         — quick KPI counts for the HM dashboard
"""

from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from modules.identity.domain.models import User
from modules.identity.router import get_current_user
from modules.shared.db import db

router = APIRouter(prefix="/workforce", tags=["Workforce"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_hm_team_candidate_ids(user: User) -> list[str]:
    """Return candidate_ids for this HM's team."""
    sub_coll = db["candidate_submissions"]
    wo_coll = db["work_orders"]

    candidate_ids: set[str] = set()

    # ALL accepted / hired candidates from submissions
    for status_val in ["Accepted", "Hired"]:
        for doc in sub_coll.find({"status": status_val}, {"id": 1}):
            cid = doc.get("id")
            if cid:
                candidate_ids.add(cid)

    # Any candidate with an active work order
    for doc in wo_coll.find({"status": "ACTIVE"}, {"candidate_id": 1}):
        cid = doc.get("candidate_id")
        if cid:
            candidate_ids.add(cid)

    return list(candidate_ids)


def _build_team_batch(cand_ids: list[str]) -> dict:
    """Batch-fetch all related data for a list of candidate IDs.
    Returns dict with keys: work_orders, submissions, onboardings, timesheets, users
    Each value is a dict keyed by candidate_id for O(1) lookup.
    """
    if not cand_ids:
        return {"work_orders": {}, "submissions": {}, "onboardings": {}, "timesheets": {}, "users": {}}

    wo_coll = db["work_orders"]
    ts_coll = db["timesheets"]
    ob_coll = db["onboarding_checklists"]
    sub_coll = db["candidate_submissions"]
    users_coll = db["users"]

    # Batch: all work orders for these candidates
    wo_map = {}
    for doc in wo_coll.find({"candidate_id": {"$in": cand_ids}, "status": "ACTIVE"}):
        cid = doc.get("candidate_id")
        doc.pop("_id", None)
        wo_map[cid] = doc

    # Batch: all submissions (try id field)
    sub_map = {}
    for doc in sub_coll.find({"id": {"$in": cand_ids}}):
        doc.pop("_id", None)
        sub_map[doc.get("id")] = doc
    # Also try candidate_id field for any not found
    found_ids = set(sub_map.keys())
    missing = [cid for cid in cand_ids if cid not in found_ids]
    if missing:
        for doc in sub_coll.find({"candidate_id": {"$in": missing}}):
            doc.pop("_id", None)
            cid = doc.get("candidate_id")
            if cid:
                sub_map[cid] = doc

    # Batch: all onboarding checklists
    ob_map = {}
    for doc in ob_coll.find({"candidate_id": {"$in": cand_ids}}):
        doc.pop("_id", None)
        ob_map[doc.get("candidate_id")] = doc

    # Batch: latest timesheet per candidate (use aggregation pipeline)
    ts_map = {}
    pipeline = [
        {"$match": {"candidate_id": {"$in": cand_ids}}},
        {"$sort": {"created_at": -1}},
        {"$group": {
            "_id": "$candidate_id",
            "ts": {"$first": "$$ROOT"},
        }},
    ]
    for doc in ts_coll.aggregate(pipeline):
        cid = doc["_id"]
        ts = doc["ts"]
        ts.pop("_id", None)
        ts_map[cid] = ts

    # Batch: user records
    user_map = {}
    for doc in users_coll.find({"candidate_id": {"$in": cand_ids}}):
        doc.pop("_id", None)
        user_map[doc.get("candidate_id")] = doc

    return {
        "work_orders": wo_map,
        "submissions": sub_map,
        "onboardings": ob_map,
        "timesheets": ts_map,
        "users": user_map,
    }


# ---------------------------------------------------------------------------
# GET /api/workforce/team
# ---------------------------------------------------------------------------

@router.get("/team")
def get_team_overview(current_user: User = Depends(get_current_user)):
    if current_user.role not in ("Hiring Manager", "Admin", "Super Admin", "HR"):
        raise HTTPException(status_code=403, detail="Hiring Manager role required")

    cand_ids = _get_hm_team_candidate_ids(current_user)
    if not cand_ids:
        return {"status": "success", "team": [], "count": 0}

    # Single batch fetch — no N+1
    batch = _build_team_batch(cand_ids)
    wo_map = batch["work_orders"]
    sub_map = batch["submissions"]
    ob_map = batch["onboardings"]
    ts_map = batch["timesheets"]
    user_map = batch["users"]

    team = []
    for cid in cand_ids:
        wo = wo_map.get(cid, {})
        sub = sub_map.get(cid, {})
        ob = ob_map.get(cid, {})

        # Onboarding progress
        ob_items = ob.get("items", [])
        ob_enabled = [i for i in ob_items if i.get("enabled", True)]
        ob_completed = [i for i in ob_enabled if i.get("completed", False)]
        ob_pct = round((len(ob_completed) / len(ob_enabled)) * 100) if ob_enabled else 0
        ob_status = ob.get("status") or ("completed" if ob_pct == 100 else "in_progress" if ob_pct > 0 else "not_started")

        overall_status = "ACTIVE" if ob_status == "completed" else "ONBOARDING"

        # Name from best available source
        cand_user = user_map.get(cid, {})
        cand_name = sub.get("candidate_name") or wo.get("candidate_name") or cand_user.get("name") or ""
        cand_email = sub.get("candidate_email") or wo.get("candidate_email") or cand_user.get("email") or ""

        # Latest timesheet
        latest_ts = ts_map.get(cid, {})

        team.append({
            "candidate_id": cid,
            "candidate_name": cand_name,
            "candidate_email": cand_email,
            "requisition_title": wo.get("requisition_title") or sub.get("requisition_title") or "",
            "vendor_name": wo.get("vendor_name") or sub.get("vendor_name") or "",
            "company_name": wo.get("company_name") or "",
            "work_order_number": wo.get("work_order_number", ""),
            "start_date": wo.get("start_date", ""),
            "end_date": wo.get("end_date", ""),
            "location": wo.get("location", ""),
            "work_arrangement": wo.get("work_arrangement", ""),
            "engagement_type": wo.get("engagement_type", ""),
            "status": overall_status,
            "onboarding_status": ob_status,
            "onboarding_pct": ob_pct,
            "onboarding_items_total": len(ob_enabled),
            "onboarding_items_completed": len(ob_completed),
            "latest_timesheet_status": latest_ts.get("status", ""),
            "latest_timesheet_id": latest_ts.get("id", ""),
            "latest_timesheet_week": latest_ts.get("week_start_date", ""),
            "latest_timesheet_hours": latest_ts.get("total_hours", 0),
            "reporting_manager": wo.get("reporting_manager", ""),
        })

    team.sort(key=lambda t: (0 if t["status"] == "ONBOARDING" else 1, t["candidate_name"]))

    return {"status": "success", "team": team, "count": len(team)}


# ---------------------------------------------------------------------------
# GET /api/workforce/timesheets
# ---------------------------------------------------------------------------

@router.get("/timesheets")
def list_team_timesheets(
    status: Optional[str] = Query(None),
    week: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ("Hiring Manager", "Admin", "Super Admin", "HR"):
        raise HTTPException(status_code=403, detail="Hiring Manager role required")

    cand_ids = _get_hm_team_candidate_ids(current_user)
    if not cand_ids:
        return {"status": "success", "timesheets": [], "count": 0, "pending_count": 0}

    ts_coll = db["timesheets"]

    query: dict = {"candidate_id": {"$in": cand_ids}}
    if status:
        query["status"] = status.upper()
    if week:
        query["week_start_date"] = week

    timesheets = list(ts_coll.find(query).sort("created_at", -1))
    pending_count = ts_coll.count_documents({"candidate_id": {"$in": cand_ids}, "status": "SUBMITTED"})

    # Batch enrich with names
    sub_coll = db["candidate_submissions"]
    wo_coll = db["work_orders"]

    sub_map = {}
    for doc in sub_coll.find({"id": {"$in": cand_ids}}):
        sub_map[doc.get("id")] = doc
    wo_map = {}
    for doc in wo_coll.find({"candidate_id": {"$in": cand_ids}, "status": "ACTIVE"}):
        wo_map[doc.get("candidate_id")] = doc

    result = []
    for ts in timesheets:
        ts.pop("_id", None)
        cid = ts.get("candidate_id", "")
        sub = sub_map.get(cid, {})
        wo = wo_map.get(cid, {})

        result.append({
            **ts,
            "candidate_name": ts.get("worker_name") or sub.get("candidate_name") or "",
            "candidate_id": cid,
            "vendor_name": ts.get("vendor_name") or wo.get("vendor_name") or sub.get("vendor_name") or "",
            "requisition_title": wo.get("requisition_title") or sub.get("requisition_title") or "",
            "work_order_number": ts.get("work_order_number") or wo.get("work_order_number", ""),
        })

    return {
        "status": "success",
        "timesheets": result,
        "count": len(result),
        "pending_count": pending_count,
    }


# ---------------------------------------------------------------------------
# POST /api/workforce/timesheets/{id}/approve
# ---------------------------------------------------------------------------

class ApproveTimesheetRequest(BaseModel):
    notes: str | None = ""


@router.post("/timesheets/{timesheet_id}/approve")
def approve_timesheet(
    timesheet_id: str,
    payload: ApproveTimesheetRequest | None = None,
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ("Hiring Manager", "Admin", "Super Admin", "HR"):
        raise HTTPException(status_code=403, detail="Hiring Manager role required")

    ts_coll = db["timesheets"]
    ts = ts_coll.find_one({"id": timesheet_id})
    if not ts:
        raise HTTPException(status_code=404, detail="Timesheet not found")

    cand_ids = _get_hm_team_candidate_ids(current_user)
    if ts.get("candidate_id") not in cand_ids:
        raise HTTPException(status_code=403, detail="This timesheet does not belong to your team")

    if ts.get("status") != "SUBMITTED":
        raise HTTPException(status_code=400, detail=f"Cannot approve timesheet with status '{ts.get('status')}'")

    now_str = datetime.now(timezone.utc).isoformat()
    now_human = datetime.now(timezone.utc).strftime("%d %b %Y")
    notes = payload.notes if payload else ""

    update_fields = {
        "status": "APPROVED",
        "approved_by": current_user.name or current_user.email or "",
        "approved_at": now_str,
        "approved_at_human": now_human,
        "approval_notes": notes,
        "updated_at": now_str,
    }
    ts_coll.update_one({"id": timesheet_id}, {"$set": update_fields})

    cand_id = ts.get("candidate_id", "")
    if cand_id:
        db["candidate_notifications"].insert_one({
            "id": f"notif_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
            "candidate_id": cand_id,
            "type": "timesheet_approved",
            "title": "Timesheet Approved",
            "message": f"Your timesheet for week {ts.get('week_start_date', '')} – {ts.get('week_end_date', '')} has been approved by {current_user.name}.",
            "read": False,
            "created_at": now_str,
        })

    return {"status": "success", "message": "Timesheet approved successfully"}


# ---------------------------------------------------------------------------
# POST /api/workforce/timesheets/{id}/reject
# ---------------------------------------------------------------------------

class RejectTimesheetRequest(BaseModel):
    reason: str = ""


@router.post("/timesheets/{timesheet_id}/reject")
def reject_timesheet(
    timesheet_id: str,
    payload: RejectTimesheetRequest,
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ("Hiring Manager", "Admin", "Super Admin", "HR"):
        raise HTTPException(status_code=403, detail="Hiring Manager role required")

    ts_coll = db["timesheets"]
    ts = ts_coll.find_one({"id": timesheet_id})
    if not ts:
        raise HTTPException(status_code=404, detail="Timesheet not found")

    cand_ids = _get_hm_team_candidate_ids(current_user)
    if ts.get("candidate_id") not in cand_ids:
        raise HTTPException(status_code=403, detail="This timesheet does not belong to your team")

    if ts.get("status") != "SUBMITTED":
        raise HTTPException(status_code=400, detail=f"Cannot reject timesheet with status '{ts.get('status')}'")

    now_str = datetime.now(timezone.utc).isoformat()

    update_fields = {
        "status": "REJECTED",
        "rejected_by": current_user.name or current_user.email or "",
        "rejected_at": now_str,
        "rejection_reason": payload.reason,
        "updated_at": now_str,
    }
    ts_coll.update_one({"id": timesheet_id}, {"$set": update_fields})

    cand_id = ts.get("candidate_id", "")
    if cand_id:
        db["candidate_notifications"].insert_one({
            "id": f"notif_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
            "candidate_id": cand_id,
            "type": "timesheet_rejected",
            "title": "Timesheet Rejected",
            "message": f"Your timesheet for week {ts.get('week_start_date', '')} – {ts.get('week_end_date', '')} was rejected. {payload.reason}".strip(),
            "read": False,
            "created_at": now_str,
        })

    return {"status": "success", "message": "Timesheet rejected"}


# ---------------------------------------------------------------------------
# GET /api/workforce/stats
# ---------------------------------------------------------------------------

@router.get("/stats")
def get_workforce_stats(current_user: User = Depends(get_current_user)):
    if current_user.role not in ("Hiring Manager", "Admin", "Super Admin", "HR"):
        raise HTTPException(status_code=403, detail="Hiring Manager role required")

    cand_ids = _get_hm_team_candidate_ids(current_user)
    if not cand_ids:
        return {"status": "success", "stats": {"total_team": 0, "active": 0, "onboarding": 0, "pending_timesheets": 0, "approved_this_week": 0}}

    # Batch: all onboardings
    ob_map = {}
    for doc in db["onboarding_checklists"].find({"candidate_id": {"$in": cand_ids}}):
        ob_map[doc.get("candidate_id")] = doc

    active_count = 0
    onboarding_count = 0
    for cid in cand_ids:
        ob = ob_map.get(cid, {})
        ob_items = ob.get("items", [])
        ob_enabled = [i for i in ob_items if i.get("enabled", True)]
        ob_completed = [i for i in ob_enabled if i.get("completed", False)]
        ob_pct = round((len(ob_completed) / len(ob_enabled)) * 100) if ob_enabled else 0
        ob_status = ob.get("status") or ("completed" if ob_pct == 100 else "in_progress" if ob_pct > 0 else "not_started")
        if ob_status in ("in_progress", "not_started"):
            onboarding_count += 1
        else:
            active_count += 1

    ts_coll = db["timesheets"]
    pending_ts = ts_coll.count_documents({"candidate_id": {"$in": cand_ids}, "status": "SUBMITTED"})

    today = datetime.now(timezone.utc).date()
    week_monday = today - timedelta(days=today.weekday())
    week_start = week_monday.isoformat()
    approved_week = ts_coll.count_documents({
        "candidate_id": {"$in": cand_ids},
        "status": "APPROVED",
        "approved_at": {"$gte": week_start},
    })

    return {
        "status": "success",
        "stats": {
            "total_team": len(cand_ids),
            "active": active_count,
            "onboarding": onboarding_count,
            "pending_timesheets": pending_ts,
            "approved_this_week": approved_week,
        },
    }
