"""
Router exposing the company Cal.com / Cal.diy configuration for the Admin and Hiring Manager UI.
"""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException

from modules.calendar.domain.models import CalendarConfig
from modules.calendar.domain.schemas import CalendarConfigResponse, CalendarConfigUpdate
from modules.identity.domain.models import User
from modules.identity.router import get_current_user
from modules.shared.db import get_session
from pydantic import BaseModel
from fastapi import Header

router = APIRouter(prefix="/calendar", tags=["Calendar"])


class AvailabilityRequest(BaseModel):
    scheduled_date: str
    scheduled_time: str
    scheduled_timezone: str = 'Asia/Kolkata'
    duration_minutes: int = 45
    round_id: str | None = None


@router.post('/google/availability')
def google_availability(body: AvailabilityRequest, current_user: User = Depends(get_current_user)):
    from .services.google_calendar import check_availability
    from modules.interview.domain.models import InterviewRound
    exclude = None
    if body.round_id:
        with get_session() as session:
            interview = session.get(InterviewRound, body.round_id)
            if not interview or interview.tenant_id != current_user.tenant_id or interview.created_by != str(current_user.id):
                raise HTTPException(status_code=404, detail='Interview not found')
            import hashlib
            exclude = interview.google_event_id or hashlib.sha256(interview.id.encode()).hexdigest()[:32]
    try:
        return check_availability(current_user, body.scheduled_date, body.scheduled_time, body.scheduled_timezone, body.duration_minutes, exclude)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get('/reminders/run')
@router.post('/reminders/run')
def run_interview_reminders(authorization: str = Header(default='')):
    import os
    import secrets
    secret = os.getenv('CRON_SECRET')
    if not secret or not secrets.compare_digest(authorization, 'Bearer ' + secret):
        raise HTTPException(status_code=403, detail='Reminder worker authentication required')
    from modules.interview.services.reminders import dispatch_due_interview_reminders
    return dispatch_due_interview_reminders()


@router.get("/google/status")
def google_calendar_status(current_user: User = Depends(get_current_user)):
    from .services.google_calendar import connection_status
    return connection_status(current_user)


@router.post("/google/connect")
def google_calendar_connect(return_origin: str = "", current_user: User = Depends(get_current_user)):
    from .services.google_calendar import begin_connection
    if current_user.role not in ("Hiring Manager", "Admin", "HR", "Director"):
        raise HTTPException(status_code=403, detail="Calendar integration is available to company hiring staff.")
    try:
        return {"authorization_url": begin_connection(current_user, return_origin)}
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get("/callback/google")
def google_calendar_callback(state: str, code: str = "", error: str = ""):
    from fastapi.responses import RedirectResponse
    from .services.google_calendar import finish_connection
    try:
        return RedirectResponse(finish_connection(state, code, error), status_code=303)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


def _response(config: CalendarConfig | None, tenant_id: str) -> CalendarConfigResponse:
    return CalendarConfigResponse(
        tenant_id=tenant_id,
        provider=(config.provider if config and config.provider else "cal"),
        status=(config.status if config else "connected") or "connected",
        cal_link=(config.cal_link if config and config.cal_link else "https://cal.com/"),
        cal_username=(config.cal_username if config else ""),
        event_slug=(config.event_slug if config and config.event_slug else "30min"),
        cal_api_key=(config.cal_api_key if config else ""),
        default_duration=int(getattr(config, "default_duration", 60) or 60) if config else 60,
        default_timezone=getattr(config, "default_timezone", "Asia/Kolkata") or "Asia/Kolkata",
        instructions=getattr(config, "instructions", "") or "",
        connected_at=config.updated_at.isoformat() if config and config.updated_at else None,
    )


def _get_or_create_config(session, tenant_id: str) -> CalendarConfig:
    config = session.query(CalendarConfig).filter(
        CalendarConfig.tenant_id == tenant_id
    ).first()
    if config is None:
        config = CalendarConfig(
            tenant_id=tenant_id,
            provider="cal",
            status="connected",
            cal_link="https://cal.com/",
            cal_username="",
            event_slug="30min",
            cal_api_key="",
            default_duration=60,
            default_timezone="Asia/Kolkata",
            instructions="",
        )
        session.add(config)
        session.flush()
    return config


@router.get("/config", response_model=CalendarConfigResponse)
def get_calendar_config(current_user: User = Depends(get_current_user)):
    """Fetch the company Cal.com / Cal.diy configuration for the user's tenant."""
    with get_session() as session:
        config = _get_or_create_config(session, current_user.tenant_id)
        return _response(config, current_user.tenant_id)


@router.put("/config", response_model=CalendarConfigResponse)
def update_calendar_config(
    body: CalendarConfigUpdate,
    current_user: User = Depends(get_current_user),
):
    """Save the company Cal.com / Cal.diy link, event type slug, and preferences."""
    with get_session() as session:
        config = _get_or_create_config(session, current_user.tenant_id)
        if body.provider:
            config.provider = body.provider
        if body.status:
            config.status = body.status
        if body.cal_link is not None:
            config.cal_link = body.cal_link
        if body.cal_username is not None:
            config.cal_username = body.cal_username
        if body.event_slug is not None:
            config.event_slug = body.event_slug
        if body.cal_api_key is not None:
            config.cal_api_key = body.cal_api_key
        if body.default_duration is not None:
            config.default_duration = body.default_duration
        if body.default_timezone is not None:
            config.default_timezone = body.default_timezone
        if body.instructions is not None:
            config.instructions = body.instructions
            
        config.updated_at = datetime.now(timezone.utc)
        session._track(config)
        session.commit()
        return _response(config, current_user.tenant_id)
