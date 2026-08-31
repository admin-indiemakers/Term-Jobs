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
    """Return candidate_ids for this HM's team.
    
    For Hiring Managers: scoped to only requisitions they created.
    For Admin/HR/Director: scoped to their tenant.
    For Super Admin: sees all.
    
    Deduplicates by email: if the same person appears in both candidate_submissions
    and work_orders with different IDs, keeps the submission ID (canonical).
    """
    sub_coll = db["candidate_submissions"]
    wo_coll = db["work_orders"]

    # Determine tenant-scoped requisition IDs
    from modules.requisition.domain.models import Requisition
    tenant_req_ids: set[str] = set()
    if user.role == "Super Admin":
        tenant_req_ids = None  # no filter
    else:
        from modules.shared.db import get_session
        with get_session() as session:
            filters = [Requisition.tenant_id == user.tenant_id]
            if user.role == "Hiring Manager":
                filters.append(Requisition.created_by == user.id)
            tenant_req_ids = {r.id for r in session.query(Requisition).filter(*filters).all()}

    # Build email -> canonical candidate_id mapping
    email_to_id: dict[str, str] = {}
    id_set: set[str] = set()

    # Step 1: Accepted / hired candidates from submissions (canonical source)
    sub_filter: dict = {"status": {"$in": ["Accepted", "Hired"]}}
    if tenant_req_ids is not None:
        sub_filter["requisition_id"] = {"$in": list(tenant_req_ids)} if tenant_req_ids else {"$in": []}
    for doc in sub_coll.find(sub_filter):
        cid = doc.get("id")
        email = (doc.get("candidate_email") or doc.get("email") or "").lower().strip()
        if cid and email:
            email_to_id[email] = cid
            id_set.add(cid)
        elif cid:
            id_set.add(cid)

    # Step 2: Active work orders — merge by email to avoid duplicates
    wo_filter: dict = {"status": "ACTIVE"}
    if tenant_req_ids is not None:
        wo_filter["requisition_id"] = {"$in": list(tenant_req_ids)} if tenant_req_ids else {"$in": []}
    for doc in wo_coll.find(wo_filter):
        cid = doc.get("candidate_id")
        email = (doc.get("candidate_email") or "").lower().strip()
        if not cid:
            continue
        if email and email in email_to_id:
            pass
        else:
            id_set.add(cid)
            if email:
                email_to_id[email] = cid

    return list(id_set)


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

    # Enrich work orders from requisition/submission/onboarding
    for cid, wo in wo_map.items():
        if not wo.get("requisition_title") or not wo.get("location") or not wo.get("company_name"):
            sub = sub_map.get(cid, {})
            ob = ob_map.get(cid, {})
            req_id = wo.get("requisition_id") or sub.get("requisition_id") or ""
            req_doc = db["requisitions"].find_one({"id": req_id}) if req_id else {}
            sr = (req_doc or {}).get("structured_role") or {}

            cp_name = ""
            cp_id = (req_doc or {}).get("company_profile_id") or ""
            if cp_id:
                cp = db["company_profiles"].find_one({"id": cp_id}) or {}
                cp_name = cp.get("name") or ""

            def _fill_w(field, *sources):
                if not wo.get(field):
                    for src in sources:
                        val = src.get(field) if src else None
                        if val:
                            wo[field] = val
                            return

            _fill_w("requisition_title", sub, ob, req_doc)
            if not wo.get("requisition_title"):
                wo["requisition_title"] = sr.get("job_title") or sr.get("title") or (req_doc or {}).get("title") or ""
            _fill_w("vendor_name", sub, ob, req_doc)
            _fill_w("company_name", sub, ob, req_doc)
            if not wo.get("company_name") and cp_name:
                wo["company_name"] = cp_name
            _fill_w("location", sr)
            if not wo.get("location"):
                locations = sr.get("work_locations") or []
                wo["location"] = locations[0] if locations else sr.get("location") or ""
            _fill_w("work_arrangement", sr, req_doc)
            if not wo.get("work_arrangement"):
                wo["work_arrangement"] = sr.get("work_mode") or (req_doc or {}).get("work_mode") or ""
            _fill_w("engagement_type", sr, req_doc)
            if not wo.get("engagement_type"):
                wo["engagement_type"] = sr.get("engagement_type") or (req_doc or {}).get("engagement_type") or ""
            _fill_w("end_date", sr, req_doc)
            if not wo.get("end_date"):
                wo["end_date"] = sr.get("ends_on") or (req_doc or {}).get("end_date") or ""
            _fill_w("reporting_manager", sr, req_doc)
            if not wo.get("reporting_manager"):
                wo["reporting_manager"] = sr.get("hiring_manager") or (req_doc or {}).get("hiring_manager") or ""
            _fill_w("overtime_policy", sr, req_doc)
            if not wo.get("overtime_policy"):
                wo["overtime_policy"] = sr.get("overtime_policy") or (req_doc or {}).get("overtime_policy") or ""
            if not wo.get("requisition_id"):
                wo["requisition_id"] = req_id

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
# GET /api/workforce/team/{candidate_id} — Premium Candidate Detail
# ---------------------------------------------------------------------------

@router.get("/team/{candidate_id}")
def get_candidate_detail(candidate_id: str, current_user: User = Depends(get_current_user)):
    """Return ALL data for a single candidate — work order, timesheets,
    attendance, expenses, onboarding, issues, notifications, graph data."""
    if current_user.role not in ("Hiring Manager", "Admin", "Super Admin", "HR"):
        raise HTTPException(status_code=403, detail="Hiring Manager role required")

    # Verify candidate belongs to HM's team
    cand_ids = _get_hm_team_candidate_ids(current_user)
    if candidate_id not in cand_ids:
        raise HTTPException(status_code=403, detail="Candidate not in your team")

    wo_coll = db["work_orders"]
    ts_coll = db["timesheets"]
    att_coll = db["attendance_sheets"]
    exp_coll = db["candidate_expenses"]
    ob_coll = db["onboarding_checklists"]
    issue_coll = db["onboarding_issues"]
    notif_coll = db["candidate_notifications"]
    sub_coll = db["candidate_submissions"]
    user_coll = db["users"]

    # --- Work Order ---
    wo = wo_coll.find_one({"candidate_id": candidate_id, "status": "ACTIVE"})
    if wo:
        wo.pop("_id", None)

    # --- Candidate Submission ---
    sub = sub_coll.find_one({"$or": [{"id": candidate_id}, {"candidate_email": wo.get("candidate_email") if wo else ""}]}) or {}
    sub.pop("_id", None)

    # --- Enrich empty work order fields from requisition/submission/onboarding ---
    if wo:
        req_id = wo.get("requisition_id") or sub.get("requisition_id") or ""
        req_doc = db["requisitions"].find_one({"id": req_id}) if req_id else {}
        sr = (req_doc or {}).get("structured_role") or {}
        ob_doc = ob_coll.find_one({"candidate_id": candidate_id}) or {}

        comp_profile_name = ""
        cp_id = (req_doc or {}).get("company_profile_id") or ""
        if cp_id:
            cp = db["company_profiles"].find_one({"id": cp_id}) or {}
            comp_profile_name = cp.get("name") or ""

        def _fill_w(field, *sources):
            if not wo.get(field):
                for src in sources:
                    val = src.get(field) if src else None
                    if val:
                        wo[field] = val
                        return

        _fill_w("requisition_title", sub, ob_doc, req_doc)
        if not wo.get("requisition_title"):
            wo["requisition_title"] = sr.get("job_title") or sr.get("title") or (req_doc or {}).get("title") or ""
        _fill_w("vendor_name", sub, ob_doc, req_doc)
        _fill_w("company_name", sub, ob_doc, req_doc)
        if not wo.get("company_name") and comp_profile_name:
            wo["company_name"] = comp_profile_name
        _fill_w("location", sr)
        if not wo.get("location"):
            locations = sr.get("work_locations") or []
            wo["location"] = locations[0] if locations else sr.get("location") or ""
        _fill_w("work_arrangement", sr, req_doc)
        if not wo.get("work_arrangement"):
            wo["work_arrangement"] = sr.get("work_mode") or (req_doc or {}).get("work_mode") or ""
        _fill_w("reporting_manager", sr, req_doc)
        if not wo.get("reporting_manager"):
            wo["reporting_manager"] = sr.get("hiring_manager") or (req_doc or {}).get("hiring_manager") or ""
        _fill_w("overtime_policy", sr, req_doc)
        if not wo.get("overtime_policy"):
            wo["overtime_policy"] = sr.get("overtime_policy") or (req_doc or {}).get("overtime_policy") or ""
        _fill_w("engagement_type", sr, req_doc)
        if not wo.get("engagement_type"):
            wo["engagement_type"] = sr.get("engagement_type") or (req_doc or {}).get("engagement_type") or ""
        _fill_w("end_date", sr, req_doc)
        if not wo.get("end_date"):
            wo["end_date"] = sr.get("ends_on") or (req_doc or {}).get("end_date") or ""

    # --- User record ---
    user_doc = user_coll.find_one({"candidate_id": candidate_id}) or {}
    user_doc.pop("_id", None)

    # --- Onboarding ---
    ob = ob_coll.find_one({"candidate_id": candidate_id}) or {}
    ob.pop("_id", None)
    ob_items = ob.get("software", []) + ob.get("training", []) + ob.get("custom_items", [])
    ob_enabled = [i for i in ob_items if i.get("enabled", True)]
    ob_completed = [i for i in ob_enabled if i.get("completed", False) or i.get("enabled", False)]
    ob_pct = round((len(ob_completed) / len(ob_enabled)) * 100) if ob_enabled else 0

    # --- ALL Timesheets (for graph + summary) ---
    all_ts = list(ts_coll.find({"candidate_id": candidate_id}).sort("week_start_date", -1))
    for t in all_ts:
        t.pop("_id", None)

    ts_submitted = sum(1 for t in all_ts if t.get("status") == "SUBMITTED")
    ts_approved = sum(1 for t in all_ts if t.get("status") == "APPROVED")
    ts_rejected = sum(1 for t in all_ts if t.get("status") == "REJECTED")
    total_hours_all = sum(float(t.get("total_hours", 0)) for t in all_ts)
    total_ot_all = sum(float(t.get("total_overtime_hours", 0)) for t in all_ts)

    # Graph data: last 12 weeks of hours
    graph_data = []
    for t in all_ts[:12]:
        graph_data.append({
            "week": t.get("week_start_date", ""),
            "period_label": t.get("period_label", t.get("week_start_date", "")),
            "hours": float(t.get("total_hours", 0)),
            "regular": float(t.get("total_regular_hours", 0)),
            "overtime": float(t.get("total_overtime_hours", 0)),
            "status": t.get("status", ""),
        })
    graph_data.reverse()  # chronological order

    # --- Attendance ---
    attendance = list(att_coll.find({"candidate_id": candidate_id}).sort("created_at", -1).limit(6))
    for a in attendance:
        a.pop("_id", None)

    # --- Expenses ---
    expenses = list(exp_coll.find({"candidate_id": candidate_id}).sort("created_at", -1))
    for e in expenses:
        e.pop("_id", None)
    exp_total = sum(float(e.get("amount", 0)) for e in expenses if e.get("status") in ["Submitted", "Pending", "Approved"])

    # --- Issues ---
    issues = list(issue_coll.find({"candidate_id": candidate_id}).sort("created_at", -1))
    for i in issues:
        i.pop("_id", None)
    open_issues = sum(1 for i in issues if i.get("status") == "open")

    # --- Notifications ---
    notifs = list(notif_coll.find({"candidate_id": candidate_id}).sort("created_at", -1).limit(10))
    for n in notifs:
        n.pop("_id", None)

    return {
        "status": "success",
        "candidate": {
            "id": candidate_id,
            "name": user_doc.get("name") or sub.get("candidate_name") or (wo.get("candidate_name") if wo else ""),
            "email": user_doc.get("email") or sub.get("candidate_email") or (wo.get("candidate_email") if wo else ""),
        },
        "work_order": wo or {},
        "submission": sub,
        "onboarding": {
            "status": ob.get("status", "not_started"),
            "completion_pct": ob_pct,
            "items_total": len(ob_enabled),
            "items_completed": len(ob_completed),
            "checklist": ob,
        },
        "timesheets": {
            "all": all_ts,
            "graph": graph_data,
            "summary": {
                "total_count": len(all_ts),
                "submitted": ts_submitted,
                "approved": ts_approved,
                "rejected": ts_rejected,
                "total_hours": round(total_hours_all, 1),
                "total_overtime": round(total_ot_all, 1),
                "avg_hours": round(total_hours_all / max(len(all_ts), 1), 1),
            },
        },
        "attendance": attendance,
        "expenses": {
            "all": expenses,
            "total": exp_total,
        },
        "issues": {
            "all": issues,
            "open_count": open_issues,
        },
        "notifications": notifs,
    }


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
    payload: ApproveTimesheetRequest = ApproveTimesheetRequest(),
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
# GET /api/workforce/expenses
# ---------------------------------------------------------------------------

class ExpenseActionRequest(BaseModel):
    notes: str = ""


@router.get("/expenses")
def list_team_expenses(
    current_user: User = Depends(get_current_user),
    status: Optional[str] = Query(None, description="Filter by status: Pending, Approved, Rejected"),
):
    """List all expenses for the HM's team."""
    if current_user.role not in ("Hiring Manager", "Admin", "Super Admin", "HR"):
        raise HTTPException(status_code=403, detail="Hiring Manager role required")

    cand_ids = _get_hm_team_candidate_ids(current_user)
    if not cand_ids:
        return {"status": "success", "expenses": [], "pending_count": 0, "total_amount": 0}

    exp_coll = db["candidate_expenses"]
    query = {"candidate_id": {"$in": cand_ids}}
    if status:
        query["status"] = status

    expenses = list(exp_coll.find(query).sort("created_at", -1))
    for e in expenses:
        e.pop("_id", None)

    pending_count = sum(1 for e in expenses if e.get("status") in ("Pending", "Submitted"))
    total_amount = sum(float(e.get("amount", 0)) for e in expenses if e.get("status") in ("Pending", "Submitted"))

    return {
        "status": "success",
        "expenses": expenses,
        "pending_count": pending_count,
        "total_amount": total_amount,
    }


# ---------------------------------------------------------------------------
# POST /api/workforce/expenses/{expense_id}/approve
# ---------------------------------------------------------------------------

@router.post("/expenses/{expense_id}/approve")
def approve_expense(
    expense_id: str,
    payload: ExpenseActionRequest = ExpenseActionRequest(),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ("Hiring Manager", "Admin", "Super Admin", "HR"):
        raise HTTPException(status_code=403, detail="Hiring Manager role required")

    cand_ids = _get_hm_team_candidate_ids(current_user)
    exp_coll = db["candidate_expenses"]

    exp = exp_coll.find_one({"id": expense_id})
    if not exp:
        raise HTTPException(status_code=404, detail="Expense not found")
    if exp.get("candidate_id") not in cand_ids:
        raise HTTPException(status_code=403, detail="Expense not in your team")

    exp_coll.update_one(
        {"id": expense_id},
        {"$set": {
            "status": "Approved",
            "approved_by": current_user.name,
            "approved_at": datetime.now(timezone.utc).isoformat(),
            "notes": payload.notes or exp.get("notes", ""),
        }}
    )

    # Notify candidate
    notif_coll = db["candidate_notifications"]
    notif_coll.insert_one({
        "id": f"notif_{uuid.uuid4().hex[:10]}",
        "candidate_id": exp.get("candidate_id"),
        "type": "expense_approved",
        "title": "Expense Approved",
        "message": f"Your expense of ₹{exp.get('amount', 0):,.0f} ({exp.get('category', '')}) has been approved by your hiring manager.",
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    return {"status": "success", "message": "Expense approved"}


# ---------------------------------------------------------------------------
# POST /api/workforce/expenses/{expense_id}/reject
# ---------------------------------------------------------------------------

@router.post("/expenses/{expense_id}/reject")
def reject_expense(
    expense_id: str,
    payload: ExpenseActionRequest = ExpenseActionRequest(),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ("Hiring Manager", "Admin", "Super Admin", "HR"):
        raise HTTPException(status_code=403, detail="Hiring Manager role required")

    cand_ids = _get_hm_team_candidate_ids(current_user)
    exp_coll = db["candidate_expenses"]

    exp = exp_coll.find_one({"id": expense_id})
    if not exp:
        raise HTTPException(status_code=404, detail="Expense not found")
    if exp.get("candidate_id") not in cand_ids:
        raise HTTPException(status_code=403, detail="Expense not in your team")

    exp_coll.update_one(
        {"id": expense_id},
        {"$set": {
            "status": "Rejected",
            "rejected_by": current_user.name,
            "rejected_at": datetime.now(timezone.utc).isoformat(),
            "rejection_reason": payload.notes or "",
        }}
    )

    # Notify candidate
    notif_coll = db["candidate_notifications"]
    notif_coll.insert_one({
        "id": f"notif_{uuid.uuid4().hex[:10]}",
        "candidate_id": exp.get("candidate_id"),
        "type": "expense_rejected",
        "title": "Expense Rejected",
        "message": f"Your expense of ₹{exp.get('amount', 0):,.0f} ({exp.get('category', '')}) was rejected.{' Reason: ' + payload.notes if payload.notes else ''}",
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    return {"status": "success", "message": "Expense rejected"}


# ---------------------------------------------------------------------------
# GET /api/workforce/stats
# ---------------------------------------------------------------------------

@router.get("/stats")
def get_workforce_stats(current_user: User = Depends(get_current_user)):
    if current_user.role not in ("Hiring Manager", "Admin", "Super Admin", "HR"):
        raise HTTPException(status_code=403, detail="Hiring Manager role required")

    cand_ids = _get_hm_team_candidate_ids(current_user)
    if not cand_ids:
        return {"status": "success", "stats": {"total_team": 0, "active": 0, "onboarding": 0, "pending_timesheets": 0, "pending_expenses": 0, "approved_this_week": 0}}

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

    exp_coll = db["candidate_expenses"]
    pending_exp = exp_coll.count_documents({"candidate_id": {"$in": cand_ids}, "status": {"$in": ["Pending", "Submitted"]}})

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
            "pending_expenses": pending_exp,
            "approved_this_week": approved_week,
        },
    }
