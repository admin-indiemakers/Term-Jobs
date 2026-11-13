from typing import Optional, Dict, Any, List
from fastapi import APIRouter, HTTPException, Query, Header, Depends, Body, status

from modules.shared.db import get_session
from modules.identity.services.auth_service import decode_access_token
from modules.identity.domain.models import User
from .service import (
    get_report_by_date_and_type,
    get_report_by_id,
    list_reports,
    save_or_update_report,
    delete_report,
    calculate_growth_analytics,
)

router = APIRouter(prefix="/reports", tags=["Reports & Growth"])


def _extract_actor(authorization: Optional[str] = Header(default=None)) -> Optional[Dict[str, Any]]:
    """Helper to extract user information from Authorization header if present."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split(" ")[1]
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        return None
    user_id = payload.get("sub")
    with get_session() as session:
        user = session.get(User, user_id)
        if user:
            return user.to_doc()
    return {"id": user_id, "name": payload.get("name", "Team Member"), "email": payload.get("email", ""), "role": payload.get("role", "Operator")}


@router.get("", response_model=Dict[str, Any])
def get_reports_endpoint(
    report_type: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    skip: int = Query(0, ge=0),
):
    """List historical reports."""
    items = list_reports(report_type=report_type, limit=limit, skip=skip)
    return {"reports": items, "count": len(items)}


@router.get("/by-date", response_model=Dict[str, Any])
def get_report_by_date_endpoint(
    date: str = Query(..., description="YYYY-MM-DD"),
    report_type: str = Query("daily", description="daily | weekly | monthly"),
):
    """Retrieve an existing report for a specific date and type."""
    report = get_report_by_date_and_type(report_date=date, report_type=report_type)
    return {"report": report}


@router.get("/analytics", response_model=Dict[str, Any])
def get_growth_analytics_endpoint(
    period: str = Query("30d", description="today | 7d | 30d | 90d | custom"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
):
    """
    Get aggregated growth dashboard analytics, KPIs, conversion funnels,
    marketing performance, and AI-assisted strategic insights.
    """
    analytics = calculate_growth_analytics(
        period=period,
        start_date=start_date,
        end_date=end_date,
    )
    return analytics


@router.get("/{report_id}", response_model=Dict[str, Any])
def get_single_report_endpoint(report_id: str):
    """Retrieve single report by UUID."""
    report = get_report_by_id(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return {"report": report}


@router.post("", response_model=Dict[str, Any])
def create_or_save_report_endpoint(
    body: Dict[str, Any] = Body(...),
    authorization: Optional[str] = Header(default=None),
):
    """
    Save as draft or submit a daily, weekly, or monthly report.
    Automatically prevents duplicates for the same date and report type.
    """
    actor = _extract_actor(authorization)
    saved = save_or_update_report(body, user=actor)
    return {
        "report": saved,
        "message": f"Report successfully {saved.get('status', 'saved')}",
    }


@router.put("/{report_id}", response_model=Dict[str, Any])
def update_report_endpoint(
    report_id: str,
    body: Dict[str, Any] = Body(...),
    authorization: Optional[str] = Header(default=None),
):
    """Update an existing report with audit tracking."""
    existing = get_report_by_id(report_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Report not found")
    
    actor = _extract_actor(authorization)
    body["report_date"] = existing.get("report_date")
    body["report_type"] = existing.get("report_type")
    saved = save_or_update_report(body, user=actor)
    return {
        "report": saved,
        "message": f"Report successfully updated ({saved.get('status', 'saved')})",
    }


@router.delete("/{report_id}", response_model=Dict[str, Any])
def delete_report_endpoint(report_id: str):
    """Delete a report."""
    success = delete_report(report_id)
    if not success:
        raise HTTPException(status_code=404, detail="Report not found")
    return {"success": True, "message": "Report deleted successfully"}
