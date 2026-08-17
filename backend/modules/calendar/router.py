"""Router exposing the company calendar configuration for the Admin UI.

Handles the OAuth authorization-code flow for Google / Microsoft / Zoho:
  1. GET  /api/calendar/auth/{provider}  -> builds the provider consent URL
  2. GET  /api/calendar/callback/{provider} <- provider redirects here with ?code=
  3. GET  /api/calendar/config            -> connected provider + account email
  4. POST /api/calendar/disconnect        -> clears tokens
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse

from modules.calendar.domain.models import CalendarConfig
from modules.calendar.domain.schemas import (
    AuthUrlResponse,
    CalendarConfigResponse,
    CalendarConfigUpdate,
    CalendarProvidersResponse,
)
from modules.calendar.services import provider_meta
from modules.calendar.services.oauth import (
    build_auth_url,
    consume_state,
    exchange_code,
    fetch_user_email,
    get_provider,
    is_configured,
    token_expiry_epoch,
)
from modules.identity.domain.models import User
from modules.identity.router import get_current_user
from modules.shared.config import settings
from modules.shared.db import get_session

router = APIRouter(prefix="/calendar", tags=["Calendar"])


def _response(config: CalendarConfig | None, tenant_id: str) -> CalendarConfigResponse:
    return CalendarConfigResponse(
        tenant_id=tenant_id,
        provider=config.provider if config else None,
        status=(config.status if config else "disconnected") or "disconnected",
        connected_email=config.connected_email if config else None,
        connected_at=config.updated_at.isoformat() if config and config.updated_at else None,
    )


def _get_or_create_config(session, tenant_id: str) -> CalendarConfig:
    config = session.query(CalendarConfig).filter(
        CalendarConfig.tenant_id == tenant_id
    ).first()
    if config is None:
        config = CalendarConfig(tenant_id=tenant_id)
        session.add(config)
        session.flush()
    return config


@router.get("/config", response_model=CalendarConfigResponse)
def get_calendar_config(current_user: User = Depends(get_current_user)):
    """Fetch the company calendar provider configured for the user's tenant."""
    with get_session() as session:
        config = session.query(CalendarConfig).filter(
            CalendarConfig.tenant_id == current_user.tenant_id
        ).first()
        return _response(config, current_user.tenant_id)


@router.put("/config", response_model=CalendarConfigResponse)
def update_calendar_config(
    body: CalendarConfigUpdate,
    current_user: User = Depends(get_current_user),
):
    """Set the calendar provider / status manually (no OAuth)."""
    with get_session() as session:
        config = _get_or_create_config(session, current_user.tenant_id)
        if body.provider:
            config.provider = body.provider
        config.status = body.status
        if body.connected_email is not None:
            config.connected_email = body.connected_email
        if body.status == "disconnected":
            config.access_token = None
            config.refresh_token = None
            config.token_expiry = None
        config.updated_at = datetime.now(timezone.utc)
        session._track(config)
        session.commit()
        return _response(config, current_user.tenant_id)


@router.get("/providers", response_model=CalendarProvidersResponse)
def list_calendar_providers(current_user: User = Depends(get_current_user)):
    """List the calendar providers available for configuration."""
    return {"providers": provider_meta()}


@router.get("/auth/{provider}", response_model=AuthUrlResponse)
def calendar_auth_url(provider: str, current_user: User = Depends(get_current_user)):
    """Build the OAuth consent URL for a provider so the admin can connect it."""
    try:
        get_provider(provider)
    except ValueError:
        raise HTTPException(status_code=404, detail="Unknown calendar provider")
    if not is_configured(provider):
        raise HTTPException(
            status_code=400,
            detail=f"{provider.title()} Calendar is not configured yet. Add its OAuth client id/secret to the backend .env.",
        )
    url = build_auth_url(provider, current_user.tenant_id)
    return AuthUrlResponse(provider=provider, auth_url=url, configured=True)


@router.get("/callback/{provider}")
def calendar_callback(
    provider: str,
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    error: str | None = Query(default=None),
):
    """OAuth redirect target. Exchanges the code for tokens and sends the
    admin back to the frontend."""
    frontend = (settings.calendar_frontend_url or "http://localhost:5173/dashboard/admin").rstrip("/")

    if error:
        return RedirectResponse(f"{frontend}?calendar=error&provider={provider}")

    if not code or not state:
        return RedirectResponse(f"{frontend}?calendar=error&provider={provider}")

    tenant_id = consume_state(state)
    if not tenant_id:
        return RedirectResponse(f"{frontend}?calendar=error&provider={provider}")

    try:
        token_data = exchange_code(provider, code)
    except Exception:
        return RedirectResponse(f"{frontend}?calendar=error&provider={provider}")

    access_token = token_data.get("access_token")
    refresh_token = token_data.get("refresh_token")
    if not access_token:
        return RedirectResponse(f"{frontend}?calendar=error&provider={provider}")

    email = fetch_user_email(provider, access_token)

    with get_session() as session:
        config = _get_or_create_config(session, tenant_id)
        config.provider = provider
        config.status = "connected"
        config.access_token = access_token
        config.refresh_token = refresh_token
        config.token_expiry = token_expiry_epoch(token_data)
        config.connected_email = email
        config.updated_at = datetime.now(timezone.utc)
        session._track(config)
        session.commit()

    return RedirectResponse(f"{frontend}?calendar=connected&provider={provider}")


@router.post("/disconnect", response_model=CalendarConfigResponse)
def calendar_disconnect(current_user: User = Depends(get_current_user)):
    """Disconnect the company calendar and clear stored tokens."""
    with get_session() as session:
        config = _get_or_create_config(session, current_user.tenant_id)
        config.status = "disconnected"
        config.access_token = None
        config.refresh_token = None
        config.token_expiry = None
        config.connected_email = None
        config.updated_at = datetime.now(timezone.utc)
        session._track(config)
        session.commit()
        return _response(config, current_user.tenant_id)