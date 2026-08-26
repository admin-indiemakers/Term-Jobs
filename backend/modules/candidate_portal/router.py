from typing import Optional, List, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from modules.identity.domain.models import User
from modules.identity.router import get_current_user
from modules.shared.db import db, get_session
from modules.candidate.domain.models import CandidateSubmission
from modules.requisition.domain.models import Requisition
from .domain.models import WorkOrder, Timesheet, AttendanceSheet

router = APIRouter(prefix="/api/candidate-portal", tags=["Candidate Portal"])


def _get_current_week_bounds():
    today = datetime.now(timezone.utc).date()
    # Monday is weekday 0
    mon = today - timedelta(days=today.weekday())
    sun = mon + timedelta(days=6)
    return mon.isoformat(), sun.isoformat()


def _ensure_active_work_order(candidate_id: str, candidate_name: str, candidate_email: str, tenant_id: str):
    wo_coll = db["work_orders"]
    existing = wo_coll.find_one({"$or": [{"candidate_id": candidate_id}, {"candidate_email": candidate_email}]})
    if existing:
        existing.pop("_id", None)
        return existing

    ob = db["onboarding_checklists"].find_one({"candidate_id": candidate_id}) or {}
    sub = db["candidate_submissions"].find_one({"$or": [{"id": candidate_id}, {"candidate_email": candidate_email}]}) or {}

    role_title = ob.get("requisition_title") or sub.get("requisition_title") or "DevOps Engineer"
    comp_name = ob.get("company_name") or "Bearitt"
    vend_name = ob.get("vendor_name") or sub.get("vendor_name") or "Bridgeon"
    req_id = ob.get("requisition_id") or sub.get("requisition_id") or ""

    today = datetime.now(timezone.utc).date()
    new_wo = {
        "id": f"wo_{uuid.uuid4().hex[:12]}",
        "work_order_number": "WO-2026-00124",
        "tenant_id": tenant_id or "default-tenant",
        "requisition_id": req_id,
        "requisition_title": role_title,
        "offer_id": "",
        "candidate_id": candidate_id,
        "candidate_name": candidate_name or "Candidate",
        "candidate_email": candidate_email,
        "vendor_id": "",
        "vendor_name": vend_name,
        "company_name": comp_name,
        "bill_rate": 1550.0,
        "rate_basis": "hourly",
        "currency": "INR",
        "start_date": "25 Aug 2026",
        "end_date": "25 Feb 2027",
        "weekly_hours": 40.0,
        "location": "Bangalore",
        "work_arrangement": "Hybrid",
        "reporting_manager": "Arun Deshpande",
        "overtime_eligible": True,
        "overtime_policy": "Allowed",
        "engagement_type": "Contractor",
        "status": "ACTIVE",
        "is_conditional_start": False,
        "conditional_expiry_date": "",
        "activated_at": datetime.now(timezone.utc).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    wo_coll.insert_one(new_wo)
    new_wo.pop("_id", None)
    return new_wo


def _sanitize_work_order_for_candidate(wo: dict) -> dict:
    if not wo:
        return {}
    return {
        "id": wo.get("id"),
        "work_order_number": wo.get("work_order_number", "WO-2026-00124"),
        "requisition_title": wo.get("requisition_title", "DevOps Engineer"),
        "company_name": wo.get("company_name", "Bearitt"),
        "vendor_name": wo.get("vendor_name", "Bridgeon"),
        "start_date": wo.get("start_date", "25 Aug 2026"),
        "end_date": wo.get("end_date", "25 Feb 2027"),
        "weekly_hours": wo.get("weekly_hours", 40.0),
        "location": wo.get("location", "Bangalore"),
        "work_arrangement": wo.get("work_arrangement", "Hybrid"),
        "reporting_manager": wo.get("reporting_manager", "Arun Deshpande"),
        "overtime_eligible": wo.get("overtime_eligible", True),
        "overtime_policy": wo.get("overtime_policy", "Allowed"),
        "engagement_type": wo.get("engagement_type", "Contractor"),
        "status": wo.get("status", "ACTIVE"),
        "activated_at": wo.get("activated_at"),
    }


def _generate_smart_draft_entries(week_start: str, start_date_str: str = "2026-08-25"):
    start_dt = datetime.fromisoformat(week_start).date()
    today_dt = datetime.now(timezone.utc).date()
    assignment_start_dt = datetime.fromisoformat(start_date_str).date() if start_date_str else start_dt
    days_labels = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]
    default_tasks = [
        "Infrastructure monitoring & deployment pipelines",
        "CI/CD workflow optimization & test runs",
        "Container security & Kubernetes cluster audit",
        "Service reliability & cloud resource configuration",
        "Release readiness review & sprint retro",
        "",
        ""
    ]
    entries = []
    for i in range(7):
        cur_date = start_dt + timedelta(days=i)
        is_weekend = i >= 5
        is_future = cur_date > today_dt
        is_before_start = cur_date < assignment_start_dt
        
        # Only log hours if the date is >= assignment start date, <= today, and not weekend
        hrs = 8.0 if (not is_weekend and not is_future and not is_before_start) else 0.0
        entries.append({
            "day": days_labels[i],
            "day_number": cur_date.strftime("%d"),
            "date": cur_date.isoformat(),
            "hours": hrs,
            "category": "Weekend" if is_weekend else "Regular",
            "task": default_tasks[i] if hrs > 0 else "",
            "note": "",
        })
    return entries


def _analyze_timesheet_with_assistant(daily_entries: list, expected_hours: float = 40.0) -> dict:
    total_reg = 0.0
    total_ot = 0.0
    irregularities = []

    for entry in daily_entries:
        hrs = float(entry.get("hours") or 0.0)
        day = entry.get("day", "")
        cat = entry.get("category", "Regular")
        if hrs > 12.0:
            irregularities.append(f"High daily hours on {day} ({hrs}h entered).")
        if cat == "Weekend" and hrs > 0:
            irregularities.append(f"Weekend hours logged on {day} ({hrs}h).")
        if cat == "Overtime":
            total_ot += hrs
        elif hrs > 8.0:
            total_reg += 8.0
            total_ot += (hrs - 8.0)
        else:
            total_reg += hrs

    total_hrs = total_reg + total_ot
    
    if total_hrs == expected_hours and not irregularities:
        summary = "Your total hours match the expected weekly hours."
        status_flag = "LOOKS_GOOD"
        badge_label = "Looks good"
    elif total_hrs > expected_hours:
        diff = total_hrs - expected_hours
        summary = f"Total logged is {total_hrs}h ({diff}h overtime entered)."
        status_flag = "OVERTIME"
        badge_label = "Overtime logged"
    else:
        diff = expected_hours - total_hrs
        summary = f"Total logged is {total_hrs}h ({diff}h below expected {expected_hours}h)."
        status_flag = "INCOMPLETE"
        badge_label = "Incomplete hours"

    return {
        "status_flag": status_flag,
        "badge_label": badge_label,
        "summary": summary,
        "irregularities": irregularities,
        "total_regular_hours": round(total_reg, 1),
        "total_overtime_hours": round(total_ot, 1),
        "total_hours": round(total_hrs, 1),
        "expected_hours": round(expected_hours, 1),
    }


def _ensure_seed_history(candidate_id: str, tenant_id: str, work_order: dict):
    ts_coll = db["timesheets"]
    count = ts_coll.count_documents({"candidate_id": candidate_id, "status": "APPROVED"})
    if count == 0:
        history_records = [
            {
                "id": f"ts_hist_{uuid.uuid4().hex[:8]}",
                "timesheet_number": "TS-2026-W34-8841",
                "candidate_id": candidate_id,
                "work_order_id": work_order.get("id"),
                "work_order_number": work_order.get("work_order_number", "WO-2026-00124"),
                "tenant_id": tenant_id,
                "period_label": "17 – 23 Aug 2026",
                "week_start_date": "2026-08-17",
                "week_end_date": "2026-08-23",
                "total_regular_hours": 40.0,
                "total_overtime_hours": 0.0,
                "total_hours": 40.0,
                "status": "APPROVED",
                "submitted_at": "23 Aug 2026",
                "created_at": "2026-08-23T18:00:00Z",
            },
            {
                "id": f"ts_hist_{uuid.uuid4().hex[:8]}",
                "timesheet_number": "TS-2026-W33-4109",
                "candidate_id": candidate_id,
                "work_order_id": work_order.get("id"),
                "work_order_number": work_order.get("work_order_number", "WO-2026-00124"),
                "tenant_id": tenant_id,
                "period_label": "10 – 16 Aug 2026",
                "week_start_date": "2026-08-10",
                "week_end_date": "2026-08-16",
                "total_regular_hours": 42.0,
                "total_overtime_hours": 2.0,
                "total_hours": 44.0,
                "status": "APPROVED",
                "submitted_at": "16 Aug 2026",
                "created_at": "2026-08-16T18:00:00Z",
            }
        ]
        ts_coll.insert_many(history_records)


# --- Endpoints ---

@router.get("/me")
def get_candidate_profile(current_user: User = Depends(get_current_user)):
    if current_user.role != "Candidate":
        raise HTTPException(status_code=403, detail="Candidate role required")
    
    cand_id = current_user.candidate_id or ""
    ob = db["onboarding_checklists"].find_one({"candidate_id": cand_id}) or {}
    sub = db["candidate_submissions"].find_one({"$or": [{"id": cand_id}, {"candidate_email": current_user.email}]}) or {}

    return {
        "id": cand_id or sub.get("id") or "BEAR-c7a70f8a",
        "name": current_user.name or ob.get("candidate_name") or sub.get("candidate_name") or "Sreehari P S",
        "email": current_user.email,
        "company": ob.get("company_name") or "Bearitt",
        "vendor": ob.get("vendor_name") or sub.get("vendor_name") or "Bridgeon",
        "requisition_title": ob.get("requisition_title") or sub.get("requisition_title") or "DevOps Engineer",
        "requisition_id": ob.get("requisition_id") or sub.get("requisition_id") or "",
        "onboarding_status": ob.get("status") or "completed",
        "status": "Active & Verified",
    }


@router.get("/dashboard")
def get_candidate_dashboard(current_user: User = Depends(get_current_user)):
    if current_user.role != "Candidate":
        raise HTTPException(status_code=403, detail="Candidate role required")

    cand_id = current_user.candidate_id or ""
    cand_name = current_user.name or "Sreehari P S"
    cand_email = current_user.email

    ob = db["onboarding_checklists"].find_one({"candidate_id": cand_id}) or {}
    sub = db["candidate_submissions"].find_one({"$or": [{"id": cand_id}, {"candidate_email": cand_email}]}) or {}

    raw_wo = _ensure_active_work_order(cand_id, cand_name, cand_email, current_user.tenant_id)
    safe_wo = _sanitize_work_order_for_candidate(raw_wo)
    _ensure_seed_history(cand_id, current_user.tenant_id, safe_wo)

    mon_str, sun_str = _get_current_week_bounds()
    ts_coll = db["timesheets"]
    current_ts = ts_coll.find_one({
        "candidate_id": cand_id,
        "week_start_date": mon_str
    })

    if not current_ts:
        entries = _generate_smart_draft_entries(mon_str)
        analysis = _analyze_timesheet_with_assistant(entries, expected_hours=40.0)
        current_ts = {
            "id": f"ts_{uuid.uuid4().hex[:12]}",
            "timesheet_number": "TS-2026-W35-8910",
            "candidate_id": cand_id,
            "work_order_id": safe_wo.get("id"),
            "work_order_number": safe_wo.get("work_order_number"),
            "tenant_id": current_user.tenant_id,
            "week_start_date": mon_str,
            "week_end_date": sun_str,
            "period_label": "24 – 30 August 2026",
            "daily_entries": entries,
            "total_regular_hours": analysis["total_regular_hours"],
            "total_overtime_hours": analysis["total_overtime_hours"],
            "total_hours": analysis["total_hours"],
            "expected_hours": 40.0,
            "status": "DRAFT",
            "ai_insights": analysis,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    else:
        current_ts.pop("_id", None)

    daily_status = []
    logged_hrs = 0.0
    for e in current_ts.get("daily_entries", [])[:5]:
        h = float(e.get("hours", 0.0))
        logged_hrs += h
        daily_status.append({
            "day": e.get("day"),
            "date": e.get("date"),
            "hours": h,
            "status": "logged" if h > 0 else "action_needed",
            "label": f"{int(h)}h" if h > 0 else "Action needed"
        })

    expected_h = safe_wo.get("weekly_hours", 40.0)
    progress_pct = int(round((logged_hrs / expected_h) * 100)) if expected_h > 0 else 80

    recent_ts = list(ts_coll.find({"candidate_id": cand_id, "status": "APPROVED"}).sort("created_at", -1).limit(5))
    for t in recent_ts:
        t.pop("_id", None)

    return {
        "candidate": {
            "id": cand_id or "BEAR-c7a70f8a",
            "name": cand_name or ob.get("candidate_name") or "Sreehari P S",
            "first_name": cand_name.split()[0] if cand_name else "Sreehari",
            "email": cand_email,
            "company": safe_wo.get("company_name") or ob.get("company_name") or "Bearitt",
            "vendor": safe_wo.get("vendor_name") or ob.get("vendor_name") or "Bridgeon",
            "requisition_title": safe_wo.get("requisition_title") or ob.get("requisition_title") or "DevOps Engineer",
            "onboarding_status": ob.get("status") or "completed",
            "status": "ACTIVE",
            "active_badge": "Active candidate",
        },
        "kpi_stats": {
            "assignment": {
                "label": "ASSIGNMENT",
                "value": safe_wo.get("status", "ACTIVE"),
                "subtext": safe_wo.get("work_order_number", "WO-2026-00124"),
            },
            "this_week": {
                "label": "THIS WEEK",
                "value": f"{int(logged_hrs)}h",
                "subtext": f"of {int(expected_h)} expected",
            },
            "timesheet": {
                "label": "TIMESHEET",
                "value": "1" if current_ts.get("status") == "DRAFT" else "0",
                "subtext": "action required" if current_ts.get("status") == "DRAFT" else "all submitted",
            },
            "expenses": {
                "label": "EXPENSES",
                "value": "₹1.2K",
                "subtext": "this month",
            }
        },
        "work_order": safe_wo,
        "current_timesheet": current_ts,
        "time_capture": {
            "progress_pct": progress_pct,
            "logged_hours": int(logged_hrs) if logged_hrs.is_integer() else logged_hrs,
            "expected_hours": int(expected_h),
            "week_range": "24–30 Aug",
            "daily_entries": daily_status,
        },
        "assignment_snapshot": {
            "work_arrangement": safe_wo.get("work_arrangement", "Hybrid"),
            "weekly_expectation": f"{int(expected_h)}h",
            "overtime": safe_wo.get("overtime_policy", "Allowed"),
            "engagement": safe_wo.get("engagement_type", "Contractor"),
        },
        "smart_actions": {
            "ai_title": "Time Assistant",
            "ai_desc": "Use your work pattern and previous entries to prepare your timesheet. You only confirm the final hours.",
        },
        "weekly_summary": {
            "logged_hours": round(logged_hrs, 1),
            "expected_hours": expected_h,
            "status": current_ts.get("status", "DRAFT"),
            "week_start": mon_str,
            "week_end": sun_str,
            "daily_status": daily_status,
        },
        "recent_timesheets": recent_ts,
    }


@router.get("/assignment")
def get_candidate_assignment(current_user: User = Depends(get_current_user)):
    if current_user.role != "Candidate":
        raise HTTPException(status_code=403, detail="Candidate role required")

    cand_id = current_user.candidate_id or ""
    raw_wo = _ensure_active_work_order(cand_id, current_user.name, current_user.email, current_user.tenant_id)
    safe_wo = _sanitize_work_order_for_candidate(raw_wo)

    return {
        "status": "success",
        "assignment": safe_wo,
        "timeline": {
            "started_at": safe_wo.get("start_date", "25 Aug 2026"),
            "current_phase": "Active Delivery & Sprint Execution",
            "target_completion": safe_wo.get("end_date", "25 Feb 2027"),
            "progress_pct": 15,
        }
    }


@router.get("/timesheet/current")
def get_current_timesheet(current_user: User = Depends(get_current_user)):
    if current_user.role != "Candidate":
        raise HTTPException(status_code=403, detail="Candidate role required")

    cand_id = current_user.candidate_id or ""
    mon_str, sun_str = _get_current_week_bounds()
    ts_coll = db["timesheets"]
    
    ts = ts_coll.find_one({"candidate_id": cand_id, "week_start_date": mon_str})
    if ts:
        ts.pop("_id", None)
        return {"status": "success", "is_smart_draft": False, "timesheet": ts}

    raw_wo = _ensure_active_work_order(cand_id, current_user.name, current_user.email, current_user.tenant_id)
    entries = _generate_smart_draft_entries(mon_str)
    analysis = _analyze_timesheet_with_assistant(entries, expected_hours=40.0)

    draft_ts = {
        "id": f"ts_{uuid.uuid4().hex[:12]}",
        "timesheet_number": "TS-2026-W35-8910",
        "candidate_id": cand_id,
        "work_order_id": raw_wo.get("id"),
        "work_order_number": raw_wo.get("work_order_number", "WO-2026-00124"),
        "tenant_id": current_user.tenant_id,
        "week_start_date": mon_str,
        "week_end_date": sun_str,
        "period_label": "24 – 30 August 2026",
        "daily_entries": entries,
        "total_regular_hours": analysis["total_regular_hours"],
        "total_overtime_hours": analysis["total_overtime_hours"],
        "total_hours": analysis["total_hours"],
        "expected_hours": 40.0,
        "status": "DRAFT",
        "ai_insights": analysis,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    return {"status": "success", "is_smart_draft": True, "timesheet": draft_ts}


@router.get("/timesheets")
def list_candidate_timesheets(current_user: User = Depends(get_current_user)):
    if current_user.role != "Candidate":
        raise HTTPException(status_code=403, detail="Candidate role required")

    cand_id = current_user.candidate_id or ""
    raw_wo = _ensure_active_work_order(cand_id, current_user.name, current_user.email, current_user.tenant_id)
    _ensure_seed_history(cand_id, current_user.tenant_id, raw_wo)

    ts_coll = db["timesheets"]
    timesheets = list(ts_coll.find({"candidate_id": cand_id, "status": "APPROVED"}).sort("created_at", -1))
    for t in timesheets:
        t.pop("_id", None)
    return {"status": "success", "timesheets": timesheets}


class SaveTimesheetRequest(BaseModel):
    id: str | None = None
    week_start_date: str
    week_end_date: str
    period_label: str | None = "24 – 30 August 2026"
    daily_entries: list[dict]
    notes: str | None = ""


@router.post("/timesheets/draft")
def save_timesheet_draft(
    payload: SaveTimesheetRequest,
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "Candidate":
        raise HTTPException(status_code=403, detail="Candidate role required")

    cand_id = current_user.candidate_id or ""
    ts_coll = db["timesheets"]
    raw_wo = _ensure_active_work_order(cand_id, current_user.name, current_user.email, current_user.tenant_id)

    today_str = datetime.now(timezone.utc).date().isoformat()

    for entry in payload.daily_entries:
        h = float(entry.get("hours", 0.0))
        if h < 0 or h > 24:
            raise HTTPException(status_code=400, detail="Daily hours must be between 0 and 24")
        # Strict validation: future dates cannot have hours > 0
        entry_date = entry.get("date", "")
        if entry_date and entry_date > today_str and h > 0:
            raise HTTPException(status_code=400, detail=f"Cannot mark hours for future date ({entry_date}).")

    analysis = _analyze_timesheet_with_assistant(payload.daily_entries, expected_hours=40.0)

    existing = ts_coll.find_one({"candidate_id": cand_id, "week_start_date": payload.week_start_date})
    if existing and existing.get("status") in ["APPROVED", "INVOICED"]:
        raise HTTPException(status_code=400, detail="Approved timesheet cannot be modified.")

    ts_data = {
        "id": payload.id or (existing.get("id") if existing else f"ts_{uuid.uuid4().hex[:12]}"),
        "timesheet_number": existing.get("timesheet_number") if existing else "TS-2026-W35-8910",
        "candidate_id": cand_id,
        "worker_name": current_user.name,
        "work_order_id": raw_wo.get("id"),
        "work_order_number": raw_wo.get("work_order_number", "WO-2026-00124"),
        "tenant_id": current_user.tenant_id,
        "week_start_date": payload.week_start_date,
        "week_end_date": payload.week_end_date,
        "period_label": payload.period_label or "24 – 30 August 2026",
        "daily_entries": payload.daily_entries,
        "total_regular_hours": analysis["total_regular_hours"],
        "total_overtime_hours": analysis["total_overtime_hours"],
        "total_hours": analysis["total_hours"],
        "expected_hours": 40.0,
        "status": "DRAFT",
        "ai_insights": analysis,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    if existing:
        ts_coll.update_one({"id": existing["id"]}, {"$set": ts_data})
    else:
        ts_data["created_at"] = datetime.now(timezone.utc).isoformat()
        ts_coll.insert_one(ts_data)

    ts_data.pop("_id", None)
    return {"status": "success", "message": "Draft saved successfully", "timesheet": ts_data}


@router.post("/timesheets/submit")
def submit_timesheet(
    payload: SaveTimesheetRequest,
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "Candidate":
        raise HTTPException(status_code=403, detail="Candidate role required")

    cand_id = current_user.candidate_id or ""
    ts_coll = db["timesheets"]
    raw_wo = _ensure_active_work_order(cand_id, current_user.name, current_user.email, current_user.tenant_id)

    today_str = datetime.now(timezone.utc).date().isoformat()

    for entry in payload.daily_entries:
        h = float(entry.get("hours", 0.0))
        if h < 0 or h > 24:
            raise HTTPException(status_code=400, detail="Daily hours must be between 0 and 24")
        # Strict validation: future dates cannot have hours > 0
        entry_date = entry.get("date", "")
        if entry_date and entry_date > today_str and h > 0:
            raise HTTPException(status_code=400, detail=f"Cannot mark hours for future date ({entry_date}).")

    analysis = _analyze_timesheet_with_assistant(payload.daily_entries, expected_hours=40.0)

    existing = ts_coll.find_one({"candidate_id": cand_id, "week_start_date": payload.week_start_date})
    if existing and existing.get("status") in ["APPROVED", "INVOICED"]:
        raise HTTPException(status_code=400, detail="Approved timesheet cannot be modified.")

    ts_data = {
        "id": payload.id or (existing.get("id") if existing else f"ts_{uuid.uuid4().hex[:12]}"),
        "timesheet_number": existing.get("timesheet_number") if existing else "TS-2026-W35-8910",
        "candidate_id": cand_id,
        "worker_name": current_user.name,
        "work_order_id": raw_wo.get("id"),
        "work_order_number": raw_wo.get("work_order_number", "WO-2026-00124"),
        "tenant_id": current_user.tenant_id,
        "week_start_date": payload.week_start_date,
        "week_end_date": payload.week_end_date,
        "period_label": payload.period_label or "24 – 30 August 2026",
        "daily_entries": payload.daily_entries,
        "total_regular_hours": analysis["total_regular_hours"],
        "total_overtime_hours": analysis["total_overtime_hours"],
        "total_hours": analysis["total_hours"],
        "expected_hours": 40.0,
        "status": "SUBMITTED",
        "has_exceptions": len(analysis.get("irregularities", [])) > 0,
        "exception_flags": analysis.get("irregularities", []),
        "ai_insights": analysis,
        "submitted_at": datetime.now(timezone.utc).strftime("%d %b %Y"),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    if existing:
        ts_coll.update_one({"id": existing["id"]}, {"$set": ts_data})
    else:
        ts_data["created_at"] = datetime.now(timezone.utc).isoformat()
        ts_coll.insert_one(ts_data)

    ts_data.pop("_id", None)
    return {"status": "success", "message": "Timesheet submitted for manager review", "timesheet": ts_data}


@router.post("/timesheets/ai-assist")
def run_ai_timesheet_assistant(
    payload: dict,
    current_user: User = Depends(get_current_user)
):
    entries = payload.get("daily_entries", [])
    expected = float(payload.get("expected_hours", 40.0))
    analysis = _analyze_timesheet_with_assistant(entries, expected_hours=expected)
    return {"status": "success", "insights": analysis}


@router.get("/attendance")
def get_candidate_attendance(
    month: str = "2026-08",
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "Candidate":
        raise HTTPException(status_code=403, detail="Candidate role required")

    cand_id = current_user.candidate_id or ""
    att_coll = db["attendance_sheets"]

    att = att_coll.find_one({"candidate_id": cand_id, "month_year": month})
    if not att:
        if month == "2026-08":
            att = {
                "id": f"att_{uuid.uuid4().hex[:12]}",
                "attendance_number": f"ATT-2026-08-{uuid.uuid4().hex[:4].upper()}",
                "candidate_id": cand_id,
                "worker_name": current_user.name,
                "month_year": "2026-08",
                "month_label": "August 2026",
                "total_calendar_days": 31,
                "present_days": 0,
                "paid_leave_days": 0,
                "client_holidays": 0,
                "absent_days": 0,
                "payable_days": 0.0,
                "status": "ACTIVE",
                "daily_records": [
                    {"date": "25 Aug", "date_iso": "2026-08-25", "day": "Tuesday", "status": "Pending", "note": "Assignment start"},
                    {"date": "26 Aug", "date_iso": "2026-08-26", "day": "Wednesday", "status": "Pending", "note": "Regular"},
                    {"date": "27 Aug", "date_iso": "2026-08-27", "day": "Thursday", "status": "Pending", "note": "Regular"},
                    {"date": "28 Aug", "date_iso": "2026-08-28", "day": "Friday", "status": "Pending", "note": "Regular"}
                ]
            }
        else:
            att = {
                "id": f"att_{uuid.uuid4().hex[:12]}",
                "attendance_number": f"ATT-2026-07-{uuid.uuid4().hex[:4].upper()}",
                "candidate_id": cand_id,
                "worker_name": current_user.name,
                "month_year": "2026-07",
                "month_label": "July 2026",
                "total_calendar_days": 31,
                "present_days": 21,
                "paid_leave_days": 1,
                "client_holidays": 1,
                "absent_days": 0,
                "payable_days": 23.0,
                "status": "COMPLETED",
                "daily_records": [
                    {"date": "28 Jul", "date_iso": "2026-07-28", "day": "Tuesday", "status": "Present", "note": "Regular"},
                    {"date": "29 Jul", "date_iso": "2026-07-29", "day": "Wednesday", "status": "Present", "note": "Regular"},
                    {"date": "30 Jul", "date_iso": "2026-07-30", "day": "Thursday", "status": "Present", "note": "Regular"},
                    {"date": "31 Jul", "date_iso": "2026-07-31", "day": "Friday", "status": "Present", "note": "Regular"}
                ]
            }
        att_coll.insert_one(att.copy())
        att.pop("_id", None)
    else:
        att.pop("_id", None)
        if "daily_records" not in att:
            att["daily_records"] = [
                {"date": "25 Aug", "date_iso": "2026-08-25", "day": "Tuesday", "status": "Present", "note": "Regular"},
                {"date": "26 Aug", "date_iso": "2026-08-26", "day": "Wednesday", "status": "Present", "note": "Regular"},
                {"date": "27 Aug", "date_iso": "2026-08-27", "day": "Thursday", "status": "Present", "note": "Regular"},
                {"date": "28 Aug", "date_iso": "2026-08-28", "day": "Friday", "status": "Pending", "note": "Awaiting entry"}
            ]

    return {"status": "success", "attendance": att}


class ExpenseCreateRequest(BaseModel):
    id: Optional[str] = None
    date: str
    category: str
    amount: float
    receipt_name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = "Submitted"


@router.get("/expenses")
def list_candidate_expenses(
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "Candidate":
        raise HTTPException(status_code=403, detail="Candidate role required")

    cand_id = current_user.candidate_id or ""
    exp_coll = db["candidate_expenses"]

    expenses = list(exp_coll.find({"candidate_id": cand_id}).sort("created_at", -1))
    for e in expenses:
        e.pop("_id", None)

    if not expenses:
        expenses = []

    total_sum = sum(float(e.get("amount", 0)) for e in expenses if e.get("status") in ["Submitted", "Pending", "Approved"])

    return {
        "status": "success",
        "total_this_month": total_sum,
        "currency": "₹",
        "expenses": expenses
    }


@router.post("/expenses")
def create_candidate_expense(
    payload: ExpenseCreateRequest,
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "Candidate":
        raise HTTPException(status_code=403, detail="Candidate role required")

    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Expense amount must be greater than 0")

    assignment_start = "2026-08-25"
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    if payload.date < assignment_start:
        raise HTTPException(
            status_code=400,
            detail=f"Expense date cannot be before assignment start date ({assignment_start})."
        )

    if payload.date > today_str:
        raise HTTPException(
            status_code=400,
            detail="Cannot log expenses for a future date ahead of time."
        )

    cand_id = current_user.candidate_id or ""
    exp_coll = db["candidate_expenses"]
    
    # Format date label (e.g. "2026-08-28" -> "28 Aug")
    try:
        dt = datetime.fromisoformat(payload.date).date()
        date_label = dt.strftime("%d %b")
    except Exception:
        date_label = payload.date

    doc = {
        "id": payload.id or f"exp_{uuid.uuid4().hex[:10]}",
        "candidate_id": cand_id,
        "candidate_name": current_user.name,
        "work_order_number": "WO-2026-00124",
        "date": payload.date,
        "date_label": date_label,
        "category": payload.category or "Travel",
        "amount": float(payload.amount),
        "receipt_name": payload.receipt_name or "",
        "description": payload.description or "",
        "status": payload.status or "Pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    exp_coll.update_one({"id": doc["id"]}, {"$set": doc}, upsert=True)
    doc.pop("_id", None)

    return {"status": "success", "message": "Expense submitted successfully", "expense": doc}


@router.get("/notifications")
def list_candidate_notifications(
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "Candidate":
        raise HTTPException(status_code=403, detail="Candidate role required")

    cand_id = current_user.candidate_id or ""
    notif_coll = db["candidate_notifications"]

    notifs = list(notif_coll.find({"candidate_id": cand_id}).sort("created_at", -1))
    for n in notifs:
        n.pop("_id", None)

    if not notifs:
        initial_notifs = [
            {
                "id": f"notif_{uuid.uuid4().hex[:10]}",
                "candidate_id": cand_id,
                "title": "Assignment Starts Tomorrow",
                "message": "Your DevOps Engineer assignment at Bearitt begins on 25 Aug 2026. Review work order & workspace access.",
                "category": "assignment",
                "timestamp_label": "Today · 10:30 AM",
                "is_read": False,
                "target_tab": "assignment",
                "created_at": datetime.now(timezone.utc).isoformat()
            },
            {
                "id": f"notif_{uuid.uuid4().hex[:10]}",
                "candidate_id": cand_id,
                "title": "Timesheet Cycle Initialized",
                "message": "Weekly timesheet cycle (24–30 Aug) initialized. Daily time capture unlocks tomorrow 25 Aug.",
                "category": "timesheet",
                "timestamp_label": "Today · 09:00 AM",
                "is_read": False,
                "target_tab": "timesheet",
                "created_at": datetime.now(timezone.utc).isoformat()
            },
            {
                "id": f"notif_{uuid.uuid4().hex[:10]}",
                "candidate_id": cand_id,
                "title": "Onboarding Clearance Complete",
                "message": "Background verification, identity KYC, and NDA compliance completed successfully.",
                "category": "compliance",
                "timestamp_label": "Yesterday",
                "is_read": True,
                "target_tab": "dashboard",
                "created_at": datetime.now(timezone.utc).isoformat()
            },
            {
                "id": f"notif_{uuid.uuid4().hex[:10]}",
                "candidate_id": cand_id,
                "title": "Work Order Confirmed",
                "message": "Bridgeon confirmed onboarding paperwork and work order WO-2026-00124.",
                "category": "contract",
                "timestamp_label": "22 Aug 2026",
                "is_read": True,
                "target_tab": "assignment",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
        ]
        for n in initial_notifs:
            notif_coll.insert_one(n.copy())
            n.pop("_id", None)
        notifs = initial_notifs

    unread_count = sum(1 for n in notifs if not n.get("is_read", False))

    return {
        "status": "success",
        "unread_count": unread_count,
        "notifications": notifs
    }


@router.post("/notifications/{notification_id}/read")
def mark_notification_read(
    notification_id: str,
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "Candidate":
        raise HTTPException(status_code=403, detail="Candidate role required")

    cand_id = current_user.candidate_id or ""
    notif_coll = db["candidate_notifications"]
    notif_coll.update_one({"id": notification_id, "candidate_id": cand_id}, {"$set": {"is_read": True}})
    return {"status": "success", "message": "Notification marked as read"}


@router.post("/notifications/mark-all-read")
def mark_all_notifications_read(
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "Candidate":
        raise HTTPException(status_code=403, detail="Candidate role required")

    cand_id = current_user.candidate_id or ""
    notif_coll = db["candidate_notifications"]
    notif_coll.update_many({"candidate_id": cand_id}, {"$set": {"is_read": True}})
    return {"status": "success", "message": "All notifications marked as read"}
