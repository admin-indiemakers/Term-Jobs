"""
Workforce Management — Hiring Manager endpoints.

Provides:
  GET  /api/workforce/team          — active team members with status
  GET  /api/workforce/timesheets    — timesheets for HM's team (filterable)
  POST /api/workforce/timesheets/{id}/approve  — approve a submitted timesheet
  POST /api/workforce/timesheets/{id}/reject   — reject a submitted timesheet
  GET  /api/workforce/stats         — quick KPI counts for the HM dashboard
"""

import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from modules.identity.domain.models import User
from modules.identity.router import get_current_user
from modules.shared.db import db
from modules.shared.cache import cache

router = APIRouter(prefix="/workforce", tags=["Workforce"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_hm_team_candidate_ids(user: User, use_cache: bool = True) -> list[str]:
    """Return candidate_ids for this HM's team.
    
    For Hiring Managers: scoped to only requisitions they created.
    For Admin/HR/Director: scoped to their tenant.
    For Super Admin: sees all.
    
    Deduplicates by email: if the same person appears in both candidate_submissions
    and work_orders with different IDs, keeps the submission ID (canonical).
    """
    cache_key = f"team_ids:{user.id}:{user.role}:{user.tenant_id}"
    if use_cache:
        cached = cache.get(cache_key)
        if cached is not None:
            return cached

    sub_coll = db["candidate_submissions"]
    wo_coll = db["work_orders"]

    # Determine tenant-scoped requisition IDs
    # For team overview: HMs see ALL candidates in their tenant (not just their own reqs)
    from modules.requisition.domain.models import Requisition
    tenant_req_ids: set[str] = set()
    if user.role == "Super Admin":
        tenant_req_ids = None  # no filter
    else:
        from modules.shared.db import get_session
        with get_session() as session:
            filters = [Requisition.tenant_id == user.tenant_id]
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
        cid = doc.get("workorder_id") or doc.get("candidate_id")
        email = (doc.get("candidate_email") or "").lower().strip()
        if not cid:
            continue
        if email and email in email_to_id:
            pass
        else:
            id_set.add(cid)
            if email:
                email_to_id[email] = cid

    # Fallback: if no candidates found via requisitions, show ALL active work orders for tenant
    if not id_set and user.role != "Super Admin":
        for doc in wo_coll.find({"status": "ACTIVE", "tenant_id": user.tenant_id}):
            cid = doc.get("workorder_id") or doc.get("candidate_id")
            if cid:
                id_set.add(cid)

    result = list(id_set)
    if use_cache:
        cache.set(cache_key, result, ttl=30)  # cache for 30s
    return result


def _build_team_batch(cand_ids: list[str], use_cache: bool = True) -> dict:
    """Batch-fetch all related data for a list of candidate IDs.
    Returns dict with keys: work_orders, submissions, onboardings, timesheets, users
    Each value is a dict keyed by candidate_id for O(1) lookup.
    """
    if not cand_ids:
        return {"work_orders": {}, "submissions": {}, "onboardings": {}, "timesheets": {}, "users": {}}

    cache_key = f"team_batch:{':'.join(sorted(cand_ids[:20]))}"
    if use_cache:
        cached = cache.get(cache_key)
        if cached is not None:
            return cached

    wo_coll = db["work_orders"]
    ts_coll = db["timesheets"]
    ob_coll = db["onboarding_checklists"]
    sub_coll = db["candidate_submissions"]
    users_coll = db["users"]

    # Batch: all work orders for these candidates
    wo_map = {}
    for doc in wo_coll.find({"$or": [{"workorder_id": {"$in": cand_ids}}, {"candidate_id": {"$in": cand_ids}}], "status": "ACTIVE"}):
        cid = doc.get("workorder_id") or doc.get("candidate_id")
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
        for doc in sub_coll.find({"$or": [{"workorder_id": {"$in": missing}}, {"candidate_id": {"$in": missing}}]}):
            doc.pop("_id", None)
            cid = doc.get("workorder_id") or doc.get("candidate_id")
            if cid:
                sub_map[cid] = doc

    # Batch: all onboarding checklists
    ob_map = {}
    for doc in ob_coll.find({"$or": [{"workorder_id": {"$in": cand_ids}}, {"candidate_id": {"$in": cand_ids}}]}):
        doc.pop("_id", None)
        cid = doc.get("workorder_id") or doc.get("candidate_id")
        ob_map[cid] = doc

    # Batch: pre-fetch all needed requisitions and company profiles (eliminates N+1)
    req_ids_needed = set()
    for cid, wo in wo_map.items():
        if not wo.get("requisition_title") or not wo.get("location") or not wo.get("company_name"):
            sub = sub_map.get(cid, {})
            rid = wo.get("requisition_id") or sub.get("requisition_id") or ""
            if rid:
                req_ids_needed.add(rid)

    req_cache = {}
    cp_ids_needed = set()
    if req_ids_needed:
        for rd in db["requisitions"].find({"id": {"$in": list(req_ids_needed)}},
                                           {"id": 1, "title": 1, "structured_role": 1, "company_profile_id": 1,
                                            "work_mode": 1, "engagement_type": 1, "ends_on": 1}):
            req_cache[rd.get("id")] = rd
            if rd.get("company_profile_id"):
                cp_ids_needed.add(rd["company_profile_id"])

    cp_cache = {}
    if cp_ids_needed:
        for cd in db["company_profiles"].find({"id": {"$in": list(cp_ids_needed)}}, {"id": 1, "name": 1}):
            cp_cache[cd.get("id")] = cd.get("name") or ""

    # Enrich work orders from requisition/submission/onboarding (uses batch caches)
    for cid, wo in wo_map.items():
        if not wo.get("requisition_title") or not wo.get("location") or not wo.get("company_name"):
            sub = sub_map.get(cid, {})
            ob = ob_map.get(cid, {})
            req_id = wo.get("requisition_id") or sub.get("requisition_id") or ""
            req_doc = req_cache.get(req_id, {}) if req_id else {}
            sr = (req_doc or {}).get("structured_role") or {}

            cp_name = cp_cache.get((req_doc or {}).get("company_profile_id") or "") or ""

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
        {"$match": {"$or": [{"workorder_id": {"$in": cand_ids}}, {"candidate_id": {"$in": cand_ids}}]}},
        {"$sort": {"created_at": -1}},
        {"$group": {
            "_id": {"$ifNull": ["$workorder_id", "$candidate_id"]},
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
    for doc in users_coll.find({"$or": [{"workorder_id": {"$in": cand_ids}}, {"candidate_id": {"$in": cand_ids}}]}):
        doc.pop("_id", None)
        cid = doc.get("workorder_id") or doc.get("candidate_id")
        user_map[cid] = doc

    result = {
        "work_orders": wo_map,
        "submissions": sub_map,
        "onboardings": ob_map,
        "timesheets": ts_map,
        "users": user_map,
    }
    if use_cache:
        cache.set(cache_key, result, ttl=30)  # cache for 30s
    return result


# ---------------------------------------------------------------------------
# GET /api/workforce/dashboard — combined team + stats (single fetch)
# ---------------------------------------------------------------------------

@router.get("/dashboard")
def get_workforce_dashboard(current_user: User = Depends(get_current_user)):
    """Combined endpoint: team list + stats + pending counts in ONE call.
    Replaces 6 separate API calls the frontend was making."""
    if current_user.role not in ("Hiring Manager", "Admin", "Super Admin", "HR"):
        raise HTTPException(status_code=403, detail="Hiring Manager role required")

    cand_ids = _get_hm_team_candidate_ids(current_user)
    if not cand_ids:
        return {
            "status": "success",
            "team": [],
            "stats": {"total_team": 0, "active": 0, "onboarding": 0, "pending_timesheets": 0, "pending_expenses": 0, "approved_this_week": 0},
            "pending_issues": 0,
        }

    # Single batch fetch — covers team, work orders, timesheets, onboardings
    batch = _build_team_batch(cand_ids)
    wo_map = batch["work_orders"]
    sub_map = batch["submissions"]
    ob_map = batch["onboardings"]
    ts_map = batch["timesheets"]
    user_map = batch["users"]

    # Build team list + compute stats in same pass
    team = []
    active_count = 0
    onboarding_count = 0

    for cid in cand_ids:
        wo = wo_map.get(cid, {})
        sub = sub_map.get(cid, {})
        ob = ob_map.get(cid, {})

        ob_items = ob.get("items", [])
        ob_enabled = [i for i in ob_items if i.get("enabled", True)]
        ob_completed = [i for i in ob_enabled if i.get("completed", False)]
        ob_pct = round((len(ob_completed) / len(ob_enabled)) * 100) if ob_enabled else 0
        ob_status = ob.get("status") or ("completed" if ob_pct == 100 else "in_progress" if ob_pct > 0 else "not_started")
        overall_status = "ACTIVE" if ob_status == "completed" else "ONBOARDING"

        if overall_status == "ACTIVE":
            active_count += 1
        else:
            onboarding_count += 1

        cand_user = user_map.get(cid, {})
        cand_name = sub.get("candidate_name") or wo.get("candidate_name") or cand_user.get("name") or ""
        cand_email = sub.get("candidate_email") or wo.get("candidate_email") or cand_user.get("email") or ""
        latest_ts = ts_map.get(cid, {})

        team.append({
            "candidate_id": cid,
            "workorder_id": cid,
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

    # Stats — use cached counts where possible
    ts_coll = db["timesheets"]
    exp_coll = db["candidate_expenses"]
    pending_ts = ts_coll.count_documents({"candidate_id": {"$in": cand_ids}, "status": "SUBMITTED"})
    pending_exp = exp_coll.count_documents({"candidate_id": {"$in": cand_ids}, "status": {"$in": ["Pending", "Submitted"]}})

    today = datetime.now(timezone.utc).date()
    week_monday = today - timedelta(days=today.weekday())
    week_start = week_monday.isoformat()
    approved_week = ts_coll.count_documents({
        "candidate_id": {"$in": cand_ids},
        "status": "APPROVED",
        "approved_at": {"$gte": week_start},
    })

    # Pending issues count
    pending_issues = db["onboarding_issues"].count_documents({
        "candidate_id": {"$in": cand_ids},
        "status": {"$in": ["Open", "Pending", "In Progress"]}
    })

    return {
        "status": "success",
        "team": team,
        "stats": {
            "total_team": len(cand_ids),
            "active": active_count,
            "onboarding": onboarding_count,
            "pending_timesheets": pending_ts,
            "pending_expenses": pending_exp,
            "approved_this_week": approved_week,
        },
        "pending_issues": pending_issues,
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
            "workorder_id": cid,
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
    wo = wo_coll.find_one({"$or": [{"workorder_id": candidate_id}, {"candidate_id": candidate_id}], "status": "ACTIVE"})
    if wo:
        wo.pop("_id", None)

    # --- Candidate Submission ---
    sub = sub_coll.find_one({"$or": [{"id": candidate_id}, {"workorder_id": candidate_id}, {"candidate_id": candidate_id}, {"candidate_email": wo.get("candidate_email") if wo else ""}]}) or {}
    sub.pop("_id", None)

    # --- Enrich empty work order fields from requisition/submission/onboarding ---
    if wo:
        req_id = wo.get("requisition_id") or sub.get("requisition_id") or ""
        req_doc = db["requisitions"].find_one({"id": req_id}) if req_id else {}
        sr = (req_doc or {}).get("structured_role") or {}
        ob_doc = ob_coll.find_one({"$or": [{"workorder_id": candidate_id}, {"candidate_id": candidate_id}]}) or {}

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
    user_doc = user_coll.find_one({"$or": [{"workorder_id": candidate_id}, {"candidate_id": candidate_id}]}) or {}
    user_doc.pop("_id", None)

    # --- Onboarding ---
    ob = ob_coll.find_one({"$or": [{"workorder_id": candidate_id}, {"candidate_id": candidate_id}]}) or {}
    ob.pop("_id", None)
    ob_items = ob.get("software", []) + ob.get("training", []) + ob.get("custom_items", [])
    ob_enabled = [i for i in ob_items if i.get("enabled", True)]
    ob_completed = [i for i in ob_enabled if i.get("completed", False) or i.get("enabled", False)]
    ob_pct = round((len(ob_completed) / len(ob_enabled)) * 100) if ob_enabled else 0

    # --- ALL Timesheets (for graph + summary) ---
    all_ts = list(ts_coll.find({"$or": [{"workorder_id": candidate_id}, {"candidate_id": candidate_id}]}).sort("week_start_date", -1))
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
    attendance = list(att_coll.find({"$or": [{"workorder_id": candidate_id}, {"candidate_id": candidate_id}]}).sort("created_at", -1).limit(6))
    for a in attendance:
        a.pop("_id", None)

    # --- Expenses ---
    expenses = list(exp_coll.find({"$or": [{"workorder_id": candidate_id}, {"candidate_id": candidate_id}]}).sort("created_at", -1))
    for e in expenses:
        e.pop("_id", None)
    exp_total = sum(float(e.get("amount", 0)) for e in expenses if e.get("status") in ["Submitted", "Pending", "Approved"])

    # --- Issues ---
    issues = list(issue_coll.find({"$or": [{"workorder_id": candidate_id}, {"candidate_id": candidate_id}]}).sort("created_at", -1))
    for i in issues:
        i.pop("_id", None)
    open_issues = sum(1 for i in issues if i.get("status") == "open")

    # --- Notifications ---
    notifs = list(notif_coll.find({"$or": [{"workorder_id": candidate_id}, {"candidate_id": candidate_id}]}).sort("created_at", -1).limit(10))
    for n in notifs:
        n.pop("_id", None)

    return {
        "status": "success",
        "candidate": {
            "id": candidate_id,
            "candidate_id": candidate_id,
            "workorder_id": candidate_id,
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

    query: dict = {"$or": [{"workorder_id": {"$in": cand_ids}}, {"candidate_id": {"$in": cand_ids}}]}
    if status:
        query["status"] = status.upper()
    if week:
        query["week_start_date"] = week

    timesheets = list(ts_coll.find(query).sort("created_at", -1))
    pending_count = ts_coll.count_documents({"$or": [{"workorder_id": {"$in": cand_ids}}, {"candidate_id": {"$in": cand_ids}}], "status": "SUBMITTED"})

    # Batch enrich with names
    sub_coll = db["candidate_submissions"]
    wo_coll = db["work_orders"]

    sub_map = {}
    for doc in sub_coll.find({"id": {"$in": cand_ids}}):
        sub_map[doc.get("id")] = doc
    wo_map = {}
    for doc in wo_coll.find({"$or": [{"workorder_id": {"$in": cand_ids}}, {"candidate_id": {"$in": cand_ids}}], "status": "ACTIVE"}):
        cid = doc.get("workorder_id") or doc.get("candidate_id")
        wo_map[cid] = doc

    result = []
    for ts in timesheets:
        ts.pop("_id", None)
        cid = ts.get("workorder_id") or ts.get("candidate_id", "")
        sub = sub_map.get(cid, {})
        wo = wo_map.get(cid, {})

        result.append({
            **ts,
            "candidate_name": ts.get("worker_name") or sub.get("candidate_name") or "",
            "candidate_id": cid,
            "workorder_id": cid,
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
    cand_id = ts.get("workorder_id") or ts.get("candidate_id")
    ts_tenant = ts.get("tenant_id")
    is_team_member = (
        (cand_id and cand_id in cand_ids) or
        (ts_tenant and current_user.tenant_id and ts_tenant == current_user.tenant_id) or
        current_user.role in ("Super Admin", "Admin")
    )
    if not is_team_member:
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

    cand_id = ts.get("workorder_id") or ts.get("candidate_id", "")
    if cand_id:
        db["candidate_notifications"].insert_one({
            "id": f"notif_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
            "candidate_id": cand_id,
            "workorder_id": cand_id,
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
    cand_id = ts.get("workorder_id") or ts.get("candidate_id")
    ts_tenant = ts.get("tenant_id")
    is_team_member = (
        (cand_id and cand_id in cand_ids) or
        (ts_tenant and current_user.tenant_id and ts_tenant == current_user.tenant_id) or
        current_user.role in ("Super Admin", "Admin")
    )
    if not is_team_member:
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

    cand_id = ts.get("workorder_id") or ts.get("candidate_id", "")
    if cand_id:
        db["candidate_notifications"].insert_one({
            "id": f"notif_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
            "candidate_id": cand_id,
            "workorder_id": cand_id,
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


def _ensure_expense_receipt_url(e: dict) -> dict:
    if not e.get("receipt_url") and e.get("receipt_name"):
        rname = e["receipt_name"]
        existing = db["candidate_expenses"].find_one({"receipt_name": rname, "receipt_url": {"$regex": "^data:"}})
        if existing and existing.get("receipt_url"):
            e["receipt_url"] = existing["receipt_url"]
            db["candidate_expenses"].update_one({"id": e.get("id")}, {"$set": {"receipt_url": existing["receipt_url"]}})
        else:
            import os, base64
            for folder in ["/Users/mac/Downloads", "/Users/mac/Desktop"]:
                target = os.path.join(folder, rname)
                if os.path.exists(target):
                    try:
                        with open(target, "rb") as f:
                            content_bytes = f.read()
                        b64 = base64.b64encode(content_bytes).decode("ascii")
                        ext = rname.rsplit(".", 1)[-1].lower() if "." in rname else ""
                        mime = "application/pdf" if ext == "pdf" else ("image/jpeg" if ext in ["jpg", "jpeg"] else f"image/{ext}")
                        url = f"data:{mime};base64,{b64}"
                        e["receipt_url"] = url
                        db["candidate_expenses"].update_one({"id": e.get("id")}, {"$set": {"receipt_url": url}})
                        break
                    except Exception:
                        pass
    return e


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
    query = {"$or": [{"workorder_id": {"$in": cand_ids}}, {"candidate_id": {"$in": cand_ids}}]}
    if status:
        query["status"] = status

    expenses = list(exp_coll.find(query).sort("created_at", -1))
    for e in expenses:
        e.pop("_id", None)
        _ensure_expense_receipt_url(e)

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

    cand_id = exp.get("workorder_id") or exp.get("candidate_id") or ""
    cand_id_clean = cand_id.replace("SDC-", "").replace("SDC -", "").replace("BEAR-", "").strip()
    cand_ids_clean = {c.replace("SDC-", "").replace("SDC -", "").replace("BEAR-", "").strip() for c in cand_ids}

    if cand_ids and (cand_id not in cand_ids and cand_id_clean not in cand_ids_clean):
        if current_user.role not in ("Super Admin", "Admin", "HR"):
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
    import uuid as _uuid
    notif_coll = db["candidate_notifications"]
    notif_coll.insert_one({
        "id": f"notif_{_uuid.uuid4().hex[:10]}",
        "candidate_id": cand_id,
        "workorder_id": cand_id,
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

    cand_id = exp.get("workorder_id") or exp.get("candidate_id") or ""
    cand_id_clean = cand_id.replace("SDC-", "").replace("SDC -", "").replace("BEAR-", "").strip()
    cand_ids_clean = {c.replace("SDC-", "").replace("SDC -", "").replace("BEAR-", "").strip() for c in cand_ids}

    if cand_ids and (cand_id not in cand_ids and cand_id_clean not in cand_ids_clean):
        if current_user.role not in ("Super Admin", "Admin", "HR"):
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
    import uuid as _uuid
    notif_coll = db["candidate_notifications"]
    notif_coll.insert_one({
        "id": f"notif_{_uuid.uuid4().hex[:10]}",
        "candidate_id": cand_id,
        "workorder_id": cand_id,
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
    for doc in db["onboarding_checklists"].find({"$or": [{"workorder_id": {"$in": cand_ids}}, {"candidate_id": {"$in": cand_ids}}]}):
        cid = doc.get("workorder_id") or doc.get("candidate_id")
        ob_map[cid] = doc

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
    pending_ts = ts_coll.count_documents({"$or": [{"workorder_id": {"$in": cand_ids}}, {"candidate_id": {"$in": cand_ids}}], "status": "SUBMITTED"})

    exp_coll = db["candidate_expenses"]
    pending_exp = exp_coll.count_documents({"$or": [{"workorder_id": {"$in": cand_ids}}, {"candidate_id": {"$in": cand_ids}}], "status": {"$in": ["Pending", "Submitted"]}})

    today = datetime.now(timezone.utc).date()
    week_monday = today - timedelta(days=today.weekday())
    week_start = week_monday.isoformat()
    approved_week = ts_coll.count_documents({
        "$or": [{"workorder_id": {"$in": cand_ids}}, {"candidate_id": {"$in": cand_ids}}],
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


# ---------------------------------------------------------------------------
# GET /workforce/work-orders — List all work orders for onboarding/workforce
# ---------------------------------------------------------------------------

@router.get("/work-orders")
def list_workforce_work_orders(
    current_user: User = Depends(get_current_user),
) -> dict:
    """Return all work orders for workforce and onboarding management."""
    wo_coll = db["work_orders"]
    docs = list(wo_coll.find().sort("updated_at", -1))
    for d in docs:
        d.pop("_id", None)
        if not d.get("work_order_number"):
            wid = d.get("workorder_id") or d.get("candidate_id") or d.get("id") or ""
            clean = str(wid).replace("SDC-", "").replace("SDC -", "").replace("BEAR-", "").replace("BEAR -", "").strip()
            d["work_order_number"] = f"WO-2026-{clean[:4].upper()}" if clean else "WO-2026-0001"
    return {"status": "success", "work_orders": docs}


# ---------------------------------------------------------------------------
# POST /workforce/work-orders — Create a work order for a candidate
# ---------------------------------------------------------------------------

@router.post("/work-orders")
def create_work_order(
    body: dict,
    current_user: User = Depends(get_current_user),
):
    """Create a new work order for an accepted candidate.
    
    The work order starts in PENDING status until all activation gates
    are cleared and the Hiring Manager activates it.
    """
    if current_user.role not in ("Hiring Manager", "Admin", "Super Admin", "HR", "Recruiter"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    candidate_id = body.get("workorder_id") or body.get("candidate_id", "")
    if not candidate_id:
        raise HTTPException(status_code=400, detail="workorder_id or candidate_id is required")

    # Check if a work order already exists for this candidate
    existing = db["work_orders"].find_one({"$or": [{"workorder_id": candidate_id}, {"candidate_id": candidate_id}], "status": {"$ne": "CLOSED"}})
    if existing:
        existing.pop("_id", None)
        return {"status": "success", "work_order": existing, "message": "Work order already exists"}

    # Get the submission data for enrichment
    sub = db["candidate_submissions"].find_one({"$or": [{"id": candidate_id}, {"workorder_id": candidate_id}, {"candidate_id": candidate_id}]}) or {}
    req_id = body.get("requisition_id") or sub.get("requisition_id") or ""
    req_doc = db["requisitions"].find_one({"id": req_id}) or {} if req_id else {}

    # Check activation gates from onboarding
    ob_doc = db["onboarding_checklists"].find_one({"$or": [{"workorder_id": candidate_id}, {"candidate_id": candidate_id}]}) or {}
    gates = ob_doc.get("activation_gates", [])
    all_blocking_cleared = all(
        g.get("status") == "cleared" for g in gates if g.get("type") == "blocking"
    ) if gates else False

    # Determine status
    status = "ACTIVE" if all_blocking_cleared and gates else "PENDING"

    import uuid as _uuid
    now = datetime.now(timezone.utc)
    wo_number = f"WO-{now.year}-{_uuid.uuid4().hex[:4].upper()}"

    wo = {
        "id": _uuid.uuid4().hex,
        "work_order_number": wo_number,
        "tenant_id": current_user.tenant_id,
        "requisition_id": req_id,
        "requisition_title": body.get("requisition_title") or req_doc.get("title") or sub.get("title") or "",
        "candidate_id": candidate_id,
        "workorder_id": candidate_id,
        "candidate_name": body.get("candidate_name") or sub.get("candidate_name") or "",
        "candidate_email": sub.get("candidate_email") or "",
        "vendor_name": body.get("vendor_name") or sub.get("vendor_name") or "",
        "company_name": body.get("company_name") or sub.get("client") or "",
        "bill_rate": req_doc.get("structured_role", {}).get("bill_rate") or 1500,
        "rate_basis": "hourly",
        "currency": "INR",
        "start_date": req_doc.get("structured_role", {}).get("start_date") or now.strftime("%Y-%m-%d"),
        "end_date": req_doc.get("structured_role", {}).get("ends_on") or "",
        "weekly_hours": req_doc.get("structured_role", {}).get("weekly_hours", 40),
        "location": (req_doc.get("structured_role", {}).get("location", ["Bangalore"]) or ["Bangalore"])[0] if isinstance(req_doc.get("structured_role", {}).get("location"), list) else req_doc.get("structured_role", {}).get("location", "Bangalore"),
        "work_arrangement": req_doc.get("structured_role", {}).get("work_mode", "Hybrid"),
        "reporting_manager": req_doc.get("structured_role", {}).get("reporting_manager", ""),
        "overtime_eligible": False,
        "overtime_policy": "Standard 40h/week cap, overtime requires prior manager approval",
        "engagement_type": req_doc.get("structured_role", {}).get("engagement_type", "Contract Staffing"),
        "status": status,
        "created_at": now,
        "updated_at": now,
    }
    db["work_orders"].insert_one(wo)
    wo.pop("_id", None)

    # Invalidate caches
    cache.invalidate_prefix("team_ids:")

    return {"status": "success", "work_order": wo, "message": f"Work order {wo_number} created with status {status}"}


# ---------------------------------------------------------------------------
# GET /workforce/workers — List all workers with billing & contract details
# ---------------------------------------------------------------------------

@router.get("/workers")
def list_workers(current_user: User = Depends(get_current_user)):
    """List all deployed workers with contract details, billing rates, cycles, timesheets, and expenses.
    Accessible by Recruiter, Hiring Manager, Director, Admin, Super Admin.
    """
    wo_coll = db["work_orders"]
    ts_coll = db["timesheets"]
    exp_coll = db["candidate_expenses"]
    sub_coll = db["candidate_submissions"]

    # Fetch active work orders or candidate submissions
    work_orders = list(wo_coll.find({"status": {"$in": ["ACTIVE", "Approved", "Submitted", "Pending"]}}))
    if not work_orders and current_user.role == "Recruiter":
        work_orders = list(wo_coll.find({}))

    workers_list = []
    seen_ids = set()

    for wo in work_orders:
        wo.pop("_id", None)
        cid = wo.get("workorder_id") or wo.get("candidate_id") or wo.get("id")
        if not cid or cid in seen_ids:
            continue
        seen_ids.add(cid)

        sub = sub_coll.find_one({"$or": [{"id": cid}, {"workorder_id": cid}, {"candidate_id": cid}]}) or {}
        sub.pop("_id", None)

        cand_name = wo.get("candidate_name") or sub.get("candidate_name") or "Deployed Personnel"
        cand_email = wo.get("candidate_email") or sub.get("candidate_email") or ""
        role = wo.get("job_title") or wo.get("requisition_title") or sub.get("requisition_title") or "Contractor"
        company = wo.get("company_name") or sub.get("client") or "Acme Systems"
        vendor = wo.get("vendor_name") or sub.get("vendor_name") or current_user.tenant_name or "Partner Vendor"

        # Billing details from MSA / Work Order
        raw_rate = wo.get("billing_rate") or wo.get("bill_rate") or 2200
        billing_rate = f"₹{raw_rate:,.0f} per hour" if isinstance(raw_rate, (int, float)) else str(raw_rate)
        billing_cycle = wo.get("billing_cycle") or "Monthly"
        payment_terms = wo.get("payment_terms") or "Net 30 days from invoice release"
        supplier_margin = wo.get("supplier_margin") or "30%"

        # Approved Timesheets for candidate
        ts_docs = list(ts_coll.find({"$or": [{"workorder_id": cid}, {"candidate_id": cid}], "status": "APPROVED"}))
        total_hours = sum(t.get("total_hours", 0) for t in ts_docs)
        
        # Calculate regular vs overtime (>40h/week)
        regular_hours = 0
        overtime_hours = 0
        for t in ts_docs:
            h = t.get("total_hours", 0)
            if h > 40:
                regular_hours += 40
                overtime_hours += (h - 40)
            else:
                regular_hours += h

        num_rate = float(raw_rate) if str(raw_rate).replace(".", "", 1).isdigit() else 2200.0
        base_pay = regular_hours * num_rate
        overtime_pay = overtime_hours * (num_rate * 1.5)

        # Approved Expenses for candidate
        exp_docs = list(exp_coll.find({"$or": [{"workorder_id": cid}, {"candidate_id": cid}], "status": "Approved"}))
        approved_expenses_total = sum(e.get("amount", 0) for e in exp_docs)

        # SOW Document Status
        sow_doc = db["sow_documents"].find_one({"candidate_id": cid}) or {}
        sow_status = sow_doc.get("status") or "Draft"

        workers_list.append({
            "candidate_id": cid,
            "workorder_id": cid,
            "candidate_name": cand_name,
            "candidate_email": cand_email,
            "role": role,
            "company_name": company,
            "vendor_name": vendor,
            "ws_number": wo.get("work_order_number") or f"WO-2026-{str(cid)[:4].upper()}",
            "msa_ref": wo.get("msa_ref") or f"MSA-{str(cid)[:6].upper()}-2026",
            "commencement": wo.get("start_date") or "2026-09-01",
            "expiry": wo.get("end_date") or "2026-12-31",
            "duration": f"{wo.get('contract_duration_months', 3)} months",
            "billing_rate": billing_rate,
            "raw_billing_rate": num_rate,
            "billing_cycle": billing_cycle,
            "payment_terms": payment_terms,
            "supplier_margin": supplier_margin,
            "standard_work_day": "8 hours",
            "total_approved_hours": total_hours,
            "regular_hours": regular_hours,
            "overtime_hours": overtime_hours,
            "base_pay": base_pay,
            "overtime_pay": overtime_pay,
            "approved_expenses_total": approved_expenses_total,
            "approved_expenses_count": len(exp_docs),
            "total_billing_amount": base_pay + overtime_pay + approved_expenses_total,
            "sow_status": sow_status,
            "reporting_to": wo.get("hiring_manager_name") or wo.get("reporting_manager") or "Reporting Manager",
            "place_of_work": wo.get("work_location") or wo.get("location") or "Remote / Office",
        })

    return {"status": "success", "workers": workers_list}


# ---------------------------------------------------------------------------
# GET /workforce/workers/{candidate_id}/sow — Get SOW details for a worker
# ---------------------------------------------------------------------------

@router.get("/workers/{candidate_id}/sow")
def get_worker_sow(
    candidate_id: str,
    billing_cycle: Optional[str] = None,
    cycle_period: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Generate or retrieve SOW & billing sheet details for a worker, filtered by billing cycle."""
    wo_coll = db["work_orders"]
    ts_coll = db["timesheets"]
    exp_coll = db["candidate_expenses"]
    sub_coll = db["candidate_submissions"]
    sow_coll = db["sow_documents"]

    # Existing SOW doc
    saved_sow = sow_coll.find_one({"candidate_id": candidate_id})
    if saved_sow:
        saved_sow.pop("_id", None)

    wo = wo_coll.find_one({"$or": [{"workorder_id": candidate_id}, {"candidate_id": candidate_id}]}) or {}
    sub = sub_coll.find_one({"$or": [{"id": candidate_id}, {"workorder_id": candidate_id}, {"candidate_id": candidate_id}]}) or {}
    
    # Look up requisition for additional structured role terms
    req_id = wo.get("requisition_id") or sub.get("requisition_id") or ""
    req_doc = db["requisitions"].find_one({"id": req_id}) if req_id else {}
    sr = (req_doc or {}).get("structured_role") or {}

    cand_name = wo.get("candidate_name") or sub.get("candidate_name") or "Deployed Personnel"
    role = wo.get("job_title") or wo.get("requisition_title") or sub.get("requisition_title") or sr.get("job_title") or "Contractor"
    company = wo.get("company_name") or sub.get("client") or req_doc.get("company_name") or "Bearitt"
    vendor = wo.get("vendor_name") or sub.get("vendor_name") or getattr(current_user, "tenant_name", "") or "Vendor"

    # Safely sanitize cycle & period
    if isinstance(billing_cycle, str) and billing_cycle.strip():
        cycle = billing_cycle.strip()
    elif isinstance(wo.get("billing_cycle"), str) and wo.get("billing_cycle").strip():
        cycle = wo.get("billing_cycle").strip()
    else:
        cycle = "Monthly"

    if isinstance(cycle_period, str) and cycle_period.strip():
        period_str = cycle_period.strip()
    else:
        period_str = "Sep 1, 2026 - Sep 30, 2026"
    
    # Resolve buyer charge rate and worker pay rate from work order / requisition / submission
    raw_buyer_rate = wo.get("bill_rate") or wo.get("billing_rate") or wo.get("charge_rate_buyer") or sr.get("max_rate") or sub.get("billing_rate") or 828
    charge_rate_buyer = float(raw_buyer_rate) if str(raw_buyer_rate).replace(".", "", 1).isdigit() else 828.0

    raw_worker_rate = wo.get("pay_rate") or wo.get("rate_to_worker") or sub.get("expected_rate") or sub.get("pay_rate") or round(charge_rate_buyer * 0.7186)
    rate_to_worker = float(raw_worker_rate) if str(raw_worker_rate).replace(".", "", 1).isdigit() else 595.0

    duration_months = int(wo.get("contract_duration_months") or wo.get("duration_months") or sr.get("duration_months") or 6)
    start_date = wo.get("start_date") or sub.get("start_date") or "2026-09-01"

    # Calculate supplier margin
    margin_pct = ((charge_rate_buyer - rate_to_worker) / charge_rate_buyer * 100) if charge_rate_buyer > 0 else 28.1
    supplier_margin_str = f"{margin_pct:.1f}%"

    # Fetch approved timesheets from DB
    ts_docs = list(ts_coll.find({"$or": [{"workorder_id": candidate_id}, {"candidate_id": candidate_id}], "status": "APPROVED"}))
    
    total_hours = sum(t.get("total_hours", 0) for t in ts_docs)
    regular_hours = min(160 if cycle == "Monthly" else 80 if cycle == "Fortnightly" else 40 if cycle == "Weekly" else 1920, total_hours)
    overtime_hours = max(0, total_hours - regular_hours)

    base_cost = regular_hours * charge_rate_buyer
    overtime_rate = charge_rate_buyer * 1.5
    overtime_cost = overtime_hours * overtime_rate

    # Fetch approved expenses from DB
    exp_docs = list(exp_coll.find({"$or": [{"workorder_id": candidate_id}, {"candidate_id": candidate_id}], "status": "Approved"}))
    expense_items = []
    if exp_docs:
        for e in exp_docs:
            expense_items.append({
                "id": e.get("id"),
                "category": e.get("category", "General Expense"),
                "description": e.get("description", ""),
                "amount": float(e.get("amount", 0)),
                "approved_at": e.get("approved_at") or e.get("date") or "",
            })

    total_expenses = sum(item["amount"] for item in expense_items)
    grand_total = base_cost + overtime_cost + total_expenses

    sow_data = {
        "candidate_id": candidate_id,
        "ws_number": wo.get("work_order_number") or wo.get("workorder_id") or f"WSOW-2026-{str(candidate_id)[:4].upper()}",
        "msa_ref": wo.get("msa_ref") or f"MSA-TB-2024-11",
        "company_name": company,
        "supplier_name": vendor,
        "supplier_suffix": "",
        "deployed_personnel": cand_name,
        "role": role,
        "reporting_to": wo.get("hiring_manager_name") or wo.get("reporting_manager") or sr.get("hiring_manager") or "Arun Deshpande, Engineering",
        "place_of_work": wo.get("work_location") or wo.get("location") or sr.get("location") or "Gurgaon",
        "commencement": start_date,
        "start_date": start_date,
        "expiry": wo.get("end_date") or "2027-03-01",
        "duration": f"{duration_months} months",
        "duration_months": duration_months,
        "notice": "15 days",
        "billing_basis": "Hourly, against approved timesheets",
        "charge_rate": f"₹{charge_rate_buyer:,.0f} per hour",
        "charge_rate_buyer": charge_rate_buyer,
        "raw_charge_rate": charge_rate_buyer,
        "rate_to_worker": rate_to_worker,
        "overtime_multiplier": "1.5x base hourly rate",
        "standard_work_day": "8 hours",
        "billing_cycle": cycle,
        "cycle_period": period_str,
        "payment_terms": 30,
        "payment_terms_label": "30 days",
        "supplier_margin": supplier_margin_str,
        "overtime_15x": True,
        "expenses_reimbursable": False,
        "extension_permitted": True,
        "bgv_warranty": True,
        "regular_hours": regular_hours,
        "overtime_hours": overtime_hours,
        "base_cost": base_cost,
        "overtime_cost": overtime_cost,
        "expense_items": expense_items,
        "total_expenses": total_expenses,
        "grand_total": grand_total,
        "signatory_supplier": "Authorised Signatory",
        "signatory_company": "Procurement / Director",
        "status": saved_sow.get("status") if saved_sow else "Draft",
        "submitted_at": saved_sow.get("submitted_at") if saved_sow else None,
    }

    if saved_sow and "sow_data" in saved_sow:
        sow_data.update(saved_sow["sow_data"])

    return {"status": "success", "sow_data": sow_data}


@router.post("/workers/{candidate_id}/sow/send-to-procurement")
def send_sow_to_procurement(
    candidate_id: str,
    body: dict,
    current_user: User = Depends(get_current_user)
):
    """Recruiter submits SOW & Billing Sheet package to Procurement."""
    sow_coll = db["sow_documents"]
    notif_coll = db["candidate_notifications"]
    wo_coll = db["work_orders"]

    now_iso = datetime.now(timezone.utc).isoformat()
    sow_payload = body.get("sow_data") or body

    # Resolve company tenant ID
    wo = wo_coll.find_one({"candidate_id": candidate_id}) or wo_coll.find_one({"id": candidate_id}) or {}
    tenant_id = wo.get("tenant_id") or sow_payload.get("tenant_id")
    company_name = wo.get("company_name") or sow_payload.get("company_name") or "Bearitt"

    if not tenant_id and company_name:
        tenant_doc = db["tenants"].find_one({"name": {"$regex": f"^{company_name}$", "$options": "i"}})
        if tenant_doc:
            tenant_id = str(tenant_doc.get("_id") or tenant_doc.get("id"))

    doc_record = {
        "candidate_id": candidate_id,
        "workorder_id": candidate_id,
        "tenant_id": tenant_id or "50c9753b-ad12-4783-b519-9080358f5359",
        "company_name": company_name,
        "recruiter_id": current_user.id,
        "recruiter_name": current_user.name,
        "status": "Sent to Procurement",
        "submitted_at": now_iso,
        "sow_data": sow_payload,
        "updated_at": now_iso,
    }

    sow_coll.update_one(
        {"candidate_id": candidate_id},
        {"$set": doc_record},
        upsert=True
    )

    # Insert notification for procurement/admin
    import uuid as _uuid
    notif_coll.insert_one({
        "id": f"notif_{_uuid.uuid4().hex[:10]}",
        "candidate_id": candidate_id,
        "type": "sow_submitted_to_procurement",
        "title": "SOW & Billing Sheet Submitted to Procurement",
        "message": f"Recruiter {current_user.name} submitted SOW billing sheet for {sow_payload.get('deployed_personnel', 'Worker')} ({sow_payload.get('ws_number', '')}) to Procurement.",
        "is_read": False,
        "created_at": now_iso,
    })

    return {
        "status": "success",
        "message": f"SOW & Billing Sheet for {sow_payload.get('deployed_personnel', 'Worker')} sent to Procurement successfully!",
        "submitted_at": now_iso
    }


# ---------------------------------------------------------------------------
# POST /workforce/workers/{candidate_id}/sow/save-draft
# ---------------------------------------------------------------------------

@router.post("/workers/{candidate_id}/sow/save-draft")
def save_sow_draft(
    candidate_id: str,
    body: dict,
    current_user: User = Depends(get_current_user)
):
    """Save SOW & Billing sheet draft."""
    sow_coll = db["sow_documents"]
    now_iso = datetime.now(timezone.utc).isoformat()
    sow_payload = body.get("sow_data") or body

    sow_coll.update_one(
        {"candidate_id": candidate_id},
        {"$set": {
            "candidate_id": candidate_id,
            "recruiter_id": current_user.id,
            "status": "Draft",
            "sow_data": sow_payload,
            "updated_at": now_iso,
        }},
        upsert=True
    )

    return {"status": "success", "message": "SOW billing sheet draft saved successfully."}


# ---------------------------------------------------------------------------
# GET /workforce/procurement/sow-agreements
# ---------------------------------------------------------------------------

@router.get("/procurement/sow-agreements")
def get_procurement_sow_agreements(current_user: User = Depends(get_current_user)):
    """Fetch all SOW billing sheets sent to Procurement for the current user's company."""
    sow_coll = db["sow_documents"]
    wo_coll = db["work_orders"]

    query = {}
    if current_user.role not in ("Super Admin", "Recruiter"):
        tenant_match = []
        if current_user.tenant_id:
            tenant_match.append({"tenant_id": current_user.tenant_id})
            tenant_match.append({"sow_data.tenant_id": current_user.tenant_id})
        comp_name = getattr(current_user, "tenant_name", "") or ""
        if comp_name:
            tenant_match.append({"company_name": {"$regex": f"^{comp_name}$", "$options": "i"}})
            tenant_match.append({"sow_data.company_name": {"$regex": f"^{comp_name}$", "$options": "i"}})
        if tenant_match:
            query["$or"] = tenant_match

    # Find all SOW documents matching company
    docs = list(sow_coll.find(query).sort("submitted_at", -1))

    # Also find all company work orders to ensure all candidates placed by recruiters are available for verification
    wo_query = {}
    if current_user.role not in ("Super Admin", "Recruiter"):
        wo_match = []
        if current_user.tenant_id:
            wo_match.append({"tenant_id": current_user.tenant_id})
        comp_name = getattr(current_user, "tenant_name", "") or ""
        if comp_name:
            wo_match.append({"company_name": {"$regex": f"^{comp_name}$", "$options": "i"}})
        if wo_match:
            wo_query["$or"] = wo_match

    company_wos = list(wo_coll.find(wo_query).sort("created_at", -1))
    existing_cand_ids = {d.get("candidate_id") for d in docs if d.get("candidate_id")}

    for wo in company_wos:
        cid = wo.get("candidate_id") or wo.get("workorder_id") or wo.get("id")
        if cid and cid not in existing_cand_ids:
            # Build full SOW data for this candidate
            sow_res = get_worker_sow(cid, current_user=current_user)
            sow_payload = sow_res.get("sow_data") or {}
            
            auto_doc = {
                "candidate_id": cid,
                "workorder_id": cid,
                "tenant_id": current_user.tenant_id or wo.get("tenant_id") or "50c9753b-ad12-4783-b519-9080358f5359",
                "company_name": wo.get("company_name") or getattr(current_user, "tenant_name", "") or "Bearitt",
                "recruiter_id": wo.get("recruiter_id") or "recruiter_01",
                "recruiter_name": wo.get("vendor_name") or "TalentBridge Staffing",
                "status": "Sent to Procurement",
                "submitted_at": wo.get("created_at") or datetime.now(timezone.utc).isoformat(),
                "sow_data": sow_payload,
            }
            docs.append(auto_doc)
            existing_cand_ids.add(cid)

    # Clean ObjectIds
    results = []
    for d in docs:
        d["_id"] = str(d["_id"]) if "_id" in d else None
        results.append(d)

    return {"status": "success", "sow_agreements": results, "count": len(results)}


# ---------------------------------------------------------------------------
# GET /workforce/director/work-orders
# ---------------------------------------------------------------------------

@router.get("/director/work-orders")
def get_director_work_orders(current_user: User = Depends(get_current_user)):
    """Fetch all Work Orders / SOW documents for Company Director executive review & approval."""
    if current_user.role not in ("Director", "Super Admin", "Admin", "HR"):
        raise HTTPException(status_code=403, detail="Only Company Directors or Admins can access Director Work Orders.")

    sow_coll = db["sow_documents"]
    wo_coll = db["work_orders"]

    query = {}
    if current_user.role != "Super Admin":
        tenant_match = []
        if current_user.tenant_id:
            tenant_match.append({"tenant_id": current_user.tenant_id})
            tenant_match.append({"sow_data.tenant_id": current_user.tenant_id})
        comp_name = getattr(current_user, "tenant_name", "") or ""
        if comp_name:
            tenant_match.append({"company_name": {"$regex": f"^{comp_name}$", "$options": "i"}})
            tenant_match.append({"sow_data.company_name": {"$regex": f"^{comp_name}$", "$options": "i"}})
        if tenant_match:
            query["$or"] = tenant_match

    docs = list(sow_coll.find(query).sort("updated_at", -1))
    
    # Also find all work orders for the company to ensure all active placed candidates appear
    wo_query = {}
    if current_user.role != "Super Admin":
        wo_match = []
        if current_user.tenant_id:
            wo_match.append({"tenant_id": current_user.tenant_id})
        comp_name = getattr(current_user, "tenant_name", "") or ""
        if comp_name:
            wo_match.append({"company_name": {"$regex": f"^{comp_name}$", "$options": "i"}})
        if wo_match:
            wo_query["$or"] = wo_match

    company_wos = list(wo_coll.find(wo_query).sort("created_at", -1))
    existing_cand_ids = {d.get("candidate_id") for d in docs if d.get("candidate_id")}

    for wo in company_wos:
        cid = wo.get("candidate_id") or wo.get("workorder_id") or wo.get("id")
        if cid and cid not in existing_cand_ids:
            sow_res = get_worker_sow(cid, current_user=current_user)
            sow_payload = sow_res.get("sow_data") or {}
            
            auto_doc = {
                "candidate_id": cid,
                "workorder_id": cid,
                "tenant_id": current_user.tenant_id or wo.get("tenant_id") or "50c9753b-ad12-4783-b519-9080358f5359",
                "company_name": wo.get("company_name") or getattr(current_user, "tenant_name", "") or "Bearitt",
                "recruiter_id": wo.get("recruiter_id") or "recruiter_01",
                "recruiter_name": wo.get("vendor_name") or "TalentBridge Staffing",
                "status": wo.get("sow_status") or wo.get("agreement_status") or "Pending Director Approval",
                "submitted_at": wo.get("created_at") or datetime.now(timezone.utc).isoformat(),
                "procurement_authorized": wo.get("procurement_authorized", True),
                "procurement_approved_by": wo.get("procurement_approved_by", "Aditi (Procurement)"),
                "director_approved": wo.get("director_approved", False),
                "sow_data": sow_payload,
            }
            docs.append(auto_doc)
            existing_cand_ids.add(cid)

    # Sort with Pending Director Approval first, then Approved by Director, etc.
    priority = {
        "Pending Director Approval": 0,
        "Sent to Procurement": 1,
        "Revision Requested": 2,
        "Approved by Director": 3,
        "Approved": 3,
        "ACTIVE": 3,
        "Rejected": 4,
        "Draft": 5,
    }

    cleaned = []
    for d in docs:
        d["_id"] = str(d["_id"]) if "_id" in d else None
        cleaned.append(d)

    cleaned.sort(key=lambda x: priority.get(x.get("status", ""), 6))

    pending_count = sum(1 for d in cleaned if d.get("status") in ("Pending Director Approval", "Approved by Procurement"))
    approved_count = sum(1 for d in cleaned if d.get("status") in ("Approved by Director", "Approved", "ACTIVE"))

    return {
        "status": "success",
        "work_orders": cleaned,
        "count": len(cleaned),
        "pending_director_count": pending_count,
        "approved_count": approved_count
    }


# ---------------------------------------------------------------------------
# GET /workforce/finance/work-orders
# ---------------------------------------------------------------------------

@router.get("/finance/work-orders")
def get_finance_work_orders(current_user: User = Depends(get_current_user)):
    """Fetch all Work Orders & invoices for Financial Team payment processing and disbursement."""
    if current_user.role not in ("Finance", "Finance Team", "Admin", "Super Admin", "Director", "HR"):
        raise HTTPException(status_code=403, detail="Only Finance Team or Admins can access Financial Work Orders.")

    sow_coll = db["sow_documents"]
    wo_coll = db["work_orders"]
    inv_coll = db["vendor_invoices"]

    query = {}
    if current_user.role not in ("Super Admin",):
        tenant_match = []
        if current_user.tenant_id:
            tenant_match.append({"tenant_id": current_user.tenant_id})
            tenant_match.append({"sow_data.tenant_id": current_user.tenant_id})
        comp_name = getattr(current_user, "tenant_name", "") or ""
        if comp_name:
            tenant_match.append({"company_name": {"$regex": f"^{comp_name}$", "$options": "i"}})
            tenant_match.append({"sow_data.company_name": {"$regex": f"^{comp_name}$", "$options": "i"}})
        if tenant_match:
            query["$or"] = tenant_match

    docs = list(sow_coll.find(query).sort("updated_at", -1))

    # Also pull company work orders to ensure all active worker records are included
    wo_query = {}
    if current_user.role not in ("Super Admin",):
        wo_match = []
        if current_user.tenant_id:
            wo_match.append({"tenant_id": current_user.tenant_id})
        comp_name = getattr(current_user, "tenant_name", "") or ""
        if comp_name:
            wo_match.append({"company_name": {"$regex": f"^{comp_name}$", "$options": "i"}})
        if wo_match:
            wo_query["$or"] = wo_match

    company_wos = list(wo_coll.find(wo_query).sort("created_at", -1))
    existing_cand_ids = {d.get("candidate_id") for d in docs if d.get("candidate_id")}

    for wo in company_wos:
        cid = wo.get("candidate_id") or wo.get("workorder_id") or wo.get("id")
        if cid and cid not in existing_cand_ids:
            sow_res = get_worker_sow(cid, current_user=current_user)
            sow_payload = sow_res.get("sow_data") or {}

            st = wo.get("sow_status") or wo.get("agreement_status") or "Approved by Director"
            auto_doc = {
                "candidate_id": cid,
                "workorder_id": cid,
                "tenant_id": current_user.tenant_id or wo.get("tenant_id") or "50c9753b-ad12-4783-b519-9080358f5359",
                "company_name": wo.get("company_name") or getattr(current_user, "tenant_name", "") or "Bearitt",
                "recruiter_id": wo.get("recruiter_id") or "recruiter_01",
                "recruiter_name": wo.get("vendor_name") or "TalentBridge Staffing",
                "status": st,
                "procurement_authorized": wo.get("procurement_authorized", True),
                "procurement_approved_by": wo.get("procurement_approved_by", "Aditi (Procurement Lead)"),
                "director_approved": wo.get("director_approved", True),
                "director_approved_by": wo.get("approved_by") or "Company Director",
                "submitted_at": wo.get("created_at") or datetime.now(timezone.utc).isoformat(),
                "sow_data": sow_payload,
            }
            docs.append(auto_doc)
            existing_cand_ids.add(cid)

    # Clean ObjectIds and attach invoice info and top-level display fields
    cleaned = []
    for d in docs:
        d["_id"] = str(d["_id"]) if "_id" in d else None
        cid = d.get("candidate_id") or d.get("workorder_id")

        # Ensure sow_data is populated if missing
        sow_p = d.get("sow_data") or {}
        if not sow_p and cid:
            sow_res = get_worker_sow(cid, current_user=current_user)
            sow_p = sow_res.get("sow_data") or {}
            d["sow_data"] = sow_p

        # Find linked work_order / submission / requisition to backfill details
        wo_rec = wo_coll.find_one({"$or": [{"candidate_id": cid}, {"workorder_id": cid}]}) or {}
        sub_rec = db["candidate_submissions"].find_one({"$or": [{"id": cid}, {"candidate_id": cid}, {"workorder_id": cid}]}) or {}
        req_id = wo_rec.get("requisition_id") or sub_rec.get("requisition_id") or sow_p.get("requisition_id") or ""
        req_rec = db["requisitions"].find_one({"id": req_id}) if req_id else {}

        # Resolve candidate name
        cand_name = (
            d.get("candidate_name")
            or sow_p.get("deployed_personnel")
            or sow_p.get("candidate_name")
            or wo_rec.get("candidate_name")
            or sub_rec.get("candidate_name")
            or "Candidate"
        )
        d["candidate_name"] = cand_name

        # Resolve role / requisition title
        req_title = (
            d.get("requisition_title")
            or sow_p.get("role")
            or sow_p.get("requisition_title")
            or wo_rec.get("requisition_title")
            or wo_rec.get("job_title")
            or sub_rec.get("requisition_title")
            or (req_rec.get("title") if req_rec else "")
            or "Contractor"
        )
        d["requisition_title"] = req_title

        # Resolve vendor name
        vendor_name = (
            d.get("vendor_name")
            or d.get("recruiter_name")
            or sow_p.get("supplier_name")
            or sow_p.get("vendor_name")
            or wo_rec.get("vendor_name")
            or sub_rec.get("vendor_name")
            or "TalentBridge Staffing"
        )
        d["vendor_name"] = vendor_name
        d["recruiter_name"] = vendor_name

        # Resolve amounts
        tot_amount = float(
            d.get("total_amount")
            or sow_p.get("grand_total")
            or sow_p.get("calculated_grand_total")
            or wo_rec.get("total_amount")
            or 9800.0
        )
        d["total_amount"] = tot_amount

        base_rate = float(
            d.get("rate")
            or d.get("base_rate")
            or sow_p.get("charge_rate_buyer")
            or sow_p.get("raw_charge_rate")
            or sow_p.get("base_cost")
            or wo_rec.get("charge_rate_buyer")
            or wo_rec.get("billing_rate")
            or 828.0
        )
        d["rate"] = base_rate
        d["base_rate"] = base_rate

        d["work_order_number"] = (
            d.get("work_order_number")
            or sow_p.get("ws_number")
            or wo_rec.get("work_order_number")
            or f"WO-{str(cid)[-6:].upper()}"
        )
        d["billing_period"] = (
            d.get("billing_period")
            or sow_p.get("cycle_period")
            or "30-Day Billing Cycle"
        )
        d["rate_type"] = sow_p.get("billing_basis") or "Hourly / Monthly Fixed"
        d["approved_expenses"] = float(sow_p.get("total_expenses") or 0.0)

        st = d.get("status") or sow_p.get("status") or "Approved by Director"
        d["status"] = st
        d["ready_for_payment"] = st in ("Approved by Director", "Approved", "ACTIVE") and d.get("payment_status") != "Paid"

        inv = inv_coll.find_one({"$or": [{"candidate_id": cid}, {"workorder_id": cid}]})
        if inv:
            inv["_id"] = str(inv["_id"])
            d["invoice"] = inv
        cleaned.append(d)

    # Sort with Director Approved items needing payment first
    priority = {
        "Approved by Director": 0,
        "Approved": 0,
        "ACTIVE": 0,
        "Pending Director Approval": 1,
        "Sent to Procurement": 2,
        "Paid": 3,
        "Revision Requested": 4,
        "Rejected": 5,
        "Draft": 6
    }
    cleaned.sort(key=lambda x: priority.get(x.get("status", ""), 7))

    ready_for_payment_count = sum(1 for d in cleaned if d.get("status") in ("Approved by Director", "Approved", "ACTIVE") and d.get("payment_status") != "Paid")
    paid_count = sum(1 for d in cleaned if d.get("status") == "Paid" or d.get("payment_status") == "Paid")

    total_payable = sum(
        float(d.get("total_amount") or 0)
        for d in cleaned if d.get("status") in ("Approved by Director", "Approved", "ACTIVE") and d.get("payment_status") != "Paid"
    )

    total_paid = sum(
        float(d.get("total_amount") or 0)
        for d in cleaned if d.get("status") == "Paid" or d.get("payment_status") == "Paid"
    )

    return {
        "status": "success",
        "work_orders": cleaned,
        "count": len(cleaned),
        "ready_for_payment_count": ready_for_payment_count,
        "paid_count": paid_count,
        "total_payable_amount": total_payable,
        "total_paid_amount": total_paid
    }


# ---------------------------------------------------------------------------
# POST /workforce/finance/work-orders/{candidate_id}/process-payment
# ---------------------------------------------------------------------------

@router.post("/finance/work-orders/{candidate_id}/process-payment")
def process_finance_work_order_payment(
    candidate_id: str,
    body: dict,
    current_user: User = Depends(get_current_user)
):
    """Finance Team processes and marks payment disbursement for authorized Work Order."""
    if current_user.role not in ("Finance", "Finance Team", "Admin", "Super Admin", "Director"):
        raise HTTPException(status_code=403, detail="Only Finance Team or Admins can process payments.")

    sow_coll = db["sow_documents"]
    wo_coll = db["work_orders"]
    inv_coll = db["vendor_invoices"]
    notif_coll = db["candidate_notifications"]
    now_iso = datetime.now(timezone.utc).isoformat()
    import uuid as _uuid

    doc = sow_coll.find_one({"$or": [{"candidate_id": candidate_id}, {"workorder_id": candidate_id}]})
    cid = doc.get("candidate_id") if doc else candidate_id

    payment_method = body.get("payment_method") or "Direct Bank Transfer (NEFT/RTGS)"
    txn_ref = body.get("transaction_ref") or f"TXN-{_uuid.uuid4().hex[:8].upper()}"
    notes = body.get("notes") or "Payment disbursed by Finance AP team."
    amount = float(body.get("amount") or 0)

    # 1. Update SOW Document
    sow_coll.update_many(
        {"$or": [{"candidate_id": cid}, {"workorder_id": cid}]},
        {"$set": {
            "status": "Paid",
            "payment_status": "Paid",
            "payment_processed": True,
            "payment_processed_by": f"{current_user.name} ({current_user.role})",
            "payment_processed_at": now_iso,
            "payment_amount": amount,
            "transaction_ref": txn_ref,
            "payment_method": payment_method,
            "payment_notes": notes,
            "updated_at": now_iso,
            "sow_data.status": "Paid",
            "sow_data.payment_status": "Paid",
            "sow_data.transaction_ref": txn_ref
        }}
    )

    # 2. Update Work Order
    wo_coll.update_many(
        {"$or": [{"candidate_id": cid}, {"workorder_id": cid}, {"id": cid}]},
        {"$set": {
            "payment_status": "Paid",
            "transaction_ref": txn_ref,
            "payment_processed_at": now_iso,
            "payment_processed_by": f"{current_user.name} ({current_user.role})",
            "updated_at": now_iso
        }}
    )

    # 3. Update Invoice
    inv_coll.update_many(
        {"$or": [{"candidate_id": cid}, {"workorder_id": cid}]},
        {"$set": {
            "status": "Paid",
            "paid_at": now_iso,
            "transaction_ref": txn_ref,
            "updated_at": now_iso
        }}
    )

    # 4. Insert Notifications
    notif_coll.insert_one({
        "id": f"notif_{_uuid.uuid4().hex[:10]}",
        "candidate_id": cid,
        "type": "payment_disbursed",
        "title": "Payment Disbursed by Finance Team!",
        "message": f"Finance lead {current_user.name} has disbursed payment (Txn Ref: {txn_ref}) for Work Order {cid}.",
        "is_read": False,
        "target_tab": "billing",
        "created_at": now_iso,
    })

    return {
        "status": "success",
        "message": f"Payment successfully processed and disbursed (Ref: {txn_ref}).",
        "transaction_ref": txn_ref,
        "payment_processed_by": current_user.name,
        "payment_processed_at": now_iso
    }




# ---------------------------------------------------------------------------
# POST /workforce/procurement/sow/{candidate_id}/approve
# ---------------------------------------------------------------------------

@router.post("/procurement/sow/{candidate_id}/approve")
def approve_procurement_sow(
    candidate_id: str,
    current_user: User = Depends(get_current_user)
):
    """Procurement Team authorizes Work Order and forwards to Director for executive sign-off."""
    sow_coll = db["sow_documents"]
    wo_coll = db["work_orders"]
    notif_coll = db["candidate_notifications"]
    now_iso = datetime.now(timezone.utc).isoformat()
    import uuid as _uuid

    doc = sow_coll.find_one({"$or": [{"candidate_id": candidate_id}, {"workorder_id": candidate_id}]})
    if not doc:
        raise HTTPException(status_code=404, detail="Work Order document not found")

    cid = doc.get("candidate_id") or candidate_id
    approver_info = f"{current_user.name} ({current_user.role})"

    sow_coll.update_one(
        {"candidate_id": cid},
        {"$set": {
            "status": "Pending Director Approval",
            "procurement_authorized": True,
            "procurement_approved_by": approver_info,
            "procurement_approved_at": now_iso,
            "approved_by": approver_info,
            "approved_at": now_iso,
            "updated_at": now_iso,
            "sow_data.status": "Pending Director Approval",
            "sow_data.procurement_approved_by": approver_info,
            "sow_data.procurement_approved_at": now_iso
        }}
    )

    # Sync into work_orders so Director Portal sees it immediately
    wo_coll.update_many(
        {"$or": [{"candidate_id": cid}, {"workorder_id": cid}, {"id": cid}]},
        {"$set": {
            "status": "Pending Director Approval",
            "agreement_status": "Pending Director Approval",
            "sow_status": "Pending Director Approval",
            "procurement_authorized": True,
            "procurement_approved_by": approver_info,
            "procurement_approved_at": now_iso,
            "updated_at": now_iso
        }}
    )

    # Notification to Company Directors
    notif_coll.insert_one({
        "id": f"notif_{_uuid.uuid4().hex[:10]}",
        "candidate_id": cid,
        "type": "sow_forwarded_to_director",
        "title": "Work Order Authorized by Procurement — Awaiting Director Sign-off",
        "message": f"Procurement lead {current_user.name} has authorized the Work Order for candidate {cid}. It is now pending final Company Director approval.",
        "is_read": False,
        "target_tab": "director",
        "created_at": now_iso,
    })

    return {
        "status": "success",
        "message": "Work Order authorized by Procurement and routed to Company Director for final sign-off.",
        "approved_by": current_user.name,
        "next_step": "Director Approval",
        "approved_at": now_iso
    }


# ---------------------------------------------------------------------------
# POST /workforce/procurement/sow/{candidate_id}/director-approve
# ---------------------------------------------------------------------------

@router.post("/procurement/sow/{candidate_id}/director-approve")
def director_approve_procurement_sow(
    candidate_id: str,
    current_user: User = Depends(get_current_user)
):
    """Company Director grants final executive approval for Work Order."""
    sow_coll = db["sow_documents"]
    wo_coll = db["work_orders"]
    notif_coll = db["candidate_notifications"]
    now_iso = datetime.now(timezone.utc).isoformat()
    import uuid as _uuid

    doc = sow_coll.find_one({"$or": [{"candidate_id": candidate_id}, {"workorder_id": candidate_id}]})
    if not doc:
        raise HTTPException(status_code=404, detail="Work Order document not found")

    cid = doc.get("candidate_id") or candidate_id
    director_info = f"{current_user.name} (Director)"

    sow_coll.update_one(
        {"candidate_id": cid},
        {"$set": {
            "status": "Approved by Director",
            "director_approved": True,
            "director_approved_by": director_info,
            "director_approved_at": now_iso,
            "updated_at": now_iso,
            "sow_data.status": "Approved by Director",
            "sow_data.director_approved_by": director_info,
            "sow_data.director_approved_at": now_iso
        }}
    )

    # Activate work order in MongoDB
    wo_coll.update_many(
        {"$or": [{"candidate_id": cid}, {"workorder_id": cid}, {"id": cid}]},
        {"$set": {
            "status": "ACTIVE",
            "agreement_status": "Approved",
            "sow_status": "Approved by Director",
            "director_approved": True,
            "activated_at": now_iso,
            "approved_at": now_iso,
            "approved_by": director_info,
            "updated_at": now_iso
        }}
    )

    # Unlock onboarding checklists
    db["onboarding_checklists"].update_many(
        {"$or": [{"candidate_id": cid}, {"workorder_id": cid}]},
        {"$set": {
            "activation_status": "activated",
            "onboarding_status": "completed",
            "status": "completed",
            "activated_at": now_iso,
            "updated_at": now_iso
        }}
    )

    # Notification to Candidate & Recruiter
    notif_coll.insert_one({
        "id": f"notif_{_uuid.uuid4().hex[:10]}",
        "candidate_id": cid,
        "type": "work_order_fully_approved",
        "title": "Work Order Fully Approved by Company Director!",
        "message": f"Director {current_user.name} has granted final executive approval for Work Order {cid}. Candidate Portal and billing are fully active.",
        "is_read": False,
        "target_tab": "timesheet",
        "created_at": now_iso,
    })

    return {
        "status": "success",
        "message": "Work Order fully approved by Company Director.",
        "approved_by": director_info,
        "approved_at": now_iso
    }

def reject_procurement_sow(
    candidate_id: str,
    body: dict,
    current_user: User = Depends(get_current_user)
):
    """Procurement rejects SOW with rejection notes."""
    sow_coll = db["sow_documents"]
    now_iso = datetime.now(timezone.utc).isoformat()
    notes = body.get("notes") or body.get("rejection_notes") or "Commercial terms rejected by Procurement."

    sow_coll.update_one(
        {"candidate_id": candidate_id},
        {"$set": {
            "status": "Rejected by Procurement",
            "rejected_by": f"{current_user.name} ({current_user.role})",
            "rejection_notes": notes,
            "rejected_at": now_iso,
            "updated_at": now_iso,
            "sow_data.status": "Rejected by Procurement"
        }}
    )

    return {
        "status": "success",
        "message": "SOW billing sheet rejected.",
        "rejected_by": current_user.name,
        "rejected_at": now_iso
    }


# ---------------------------------------------------------------------------
# POST /workforce/procurement/sow/{candidate_id}/request-revision
# ---------------------------------------------------------------------------

@router.post("/procurement/sow/{candidate_id}/request-revision")
def request_procurement_sow_revision(
    candidate_id: str,
    body: dict,
    current_user: User = Depends(get_current_user)
):
    """Procurement sends SOW back to Recruiter for rate/hours revision."""
    sow_coll = db["sow_documents"]
    now_iso = datetime.now(timezone.utc).isoformat()
    notes = body.get("notes") or body.get("revision_notes") or "Please revise rates/hours as discussed."

    sow_coll.update_one(
        {"candidate_id": candidate_id},
        {"$set": {
            "status": "Revision Requested",
            "revision_notes": notes,
            "revision_requested_by": f"{current_user.name} ({current_user.role})",
            "revision_requested_at": now_iso,
            "updated_at": now_iso,
            "sow_data.status": "Revision Requested"
        }}
    )

    return {
        "status": "success",
        "message": "Revision feedback sent back to Recruiter successfully.",
        "revision_requested_at": now_iso
    }


