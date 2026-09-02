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

router = APIRouter(prefix="/calendar", tags=["Calendar"])


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
