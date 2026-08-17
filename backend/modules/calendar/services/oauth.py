"""OAuth2 authorization-code flows for company calendar providers.

Supports Google Calendar, Microsoft (Outlook / Microsoft 365) and Zoho
Calendar. The backend never sees long-lived user passwords; we exchange an
authorization code for access + refresh tokens via each provider's token
endpoint and store them against the tenant's CalendarConfig document.

To enable a provider you must create an OAuth app at the provider's console
and set the matching client id / secret in the environment (see .env).
"""
import time
import urllib.parse
import uuid
from dataclasses import dataclass, field

import httpx

from modules.shared.config import settings


@dataclass
class OAuthProvider:
    key: str
    name: str
    auth_url: str
    token_url: str
    scopes: list[str]
    client_id: str
    client_secret: str
    userinfo_url: str = ""
    userinfo_email_field: str = "email"
    # Some providers need the redirect_uri to match exactly what was
    # registered in their console.
    use_redirect_uri: bool = True
    extra_auth_params: dict[str, str] = field(default_factory=dict)


def _build_providers() -> dict[str, OAuthProvider]:
    return {
        "google": OAuthProvider(
            key="google",
            name="Google Calendar",
            auth_url="https://accounts.google.com/o/oauth2/v2/auth",
            token_url="https://oauth2.googleapis.com/token",
            scopes=[
                "https://www.googleapis.com/auth/calendar",
                "https://www.googleapis.com/auth/calendar.events",
                "https://www.googleapis.com/auth/userinfo.email",
            ],
            client_id=settings.google_client_id,
            client_secret=settings.google_client_secret,
            userinfo_url="https://www.googleapis.com/oauth2/v3/userinfo",
            userinfo_email_field="email",
            extra_auth_params={"access_type": "offline", "prompt": "consent"},
        ),
        "microsoft": OAuthProvider(
            key="microsoft",
            name="Microsoft Calendar",
            auth_url="https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
            token_url="https://login.microsoftonline.com/common/oauth2/v2.0/token",
            scopes=[
                "https://graph.microsoft.com/Calendars.ReadWrite",
                "https://graph.microsoft.com/User.Read",
                "offline_access",
            ],
            client_id=settings.microsoft_client_id,
            client_secret=settings.microsoft_client_secret,
            userinfo_url="https://graph.microsoft.com/v1.0/me",
            userinfo_email_field="userPrincipalName",
            extra_auth_params={"prompt": "consent"},
        ),
        "zoho": OAuthProvider(
            key="zoho",
            name="Zoho Calendar",
            auth_url="https://accounts.zoho.com/oauth/v2/auth",
            token_url="https://accounts.zoho.com/oauth/v2/token",
            scopes=[
                "ZohoCalendar.calendar.READ",
                "ZohoCalendar.calendar.WRITE",
                "ZohoCalendar.attendee.READ",
                "ZohoCalendar.attendee.WRITE",
                "AaaServer.profile.Read",
            ],
            client_id=settings.zoho_client_id,
            client_secret=settings.zoho_client_secret,
            userinfo_url="https://accounts.zoho.com/oauth/v2/userinfo",
            userinfo_email_field="Email",
        ),
    }


PROVIDERS = _build_providers()

# provider-key -> tenant_id, keyed by a one-time state value
_pending_states: dict[str, str] = {}


def get_provider(key: str) -> OAuthProvider:
    provider = PROVIDERS.get(key)
    if provider is None:
        raise ValueError(f"Unsupported calendar provider: {key}")
    return provider


def is_configured(key: str) -> bool:
    provider = get_provider(key)
    return bool(provider.client_id and provider.client_secret)


def build_redirect_uri(provider: OAuthProvider) -> str:
    base = (settings.calendar_redirect_base or "").rstrip("/")
    return f"{base}/api/calendar/callback/{provider.key}"


def build_auth_url(key: str, tenant_id: str) -> str:
    provider = get_provider(key)
    state = uuid.uuid4().hex
    _pending_states[state] = tenant_id

    params = {
        "client_id": provider.client_id,
        "response_type": "code",
        "scope": " ".join(provider.scopes),
        "state": state,
        "response_mode": "query",
    }
    if provider.use_redirect_uri:
        params["redirect_uri"] = build_redirect_uri(provider)
    params.update(provider.extra_auth_params)

    return f"{provider.auth_url}?{urllib.parse.urlencode(params)}"


def exchange_code(key: str, code: str) -> dict:
    provider = get_provider(key)
    data = {
        "client_id": provider.client_id,
        "client_secret": provider.client_secret,
        "code": code,
        "grant_type": "authorization_code",
    }
    if provider.use_redirect_uri:
        data["redirect_uri"] = build_redirect_uri(provider)

    with httpx.Client(timeout=30) as client:
        resp = client.post(provider.token_url, data=data)
    if resp.status_code != 200:
        raise RuntimeError(f"Token exchange failed: {resp.status_code} {resp.text[:300]}")
    return resp.json()


def fetch_user_email(key: str, access_token: str) -> str | None:
    provider = get_provider(key)
    if not provider.userinfo_url:
        return None
    with httpx.Client(timeout=20) as client:
        resp = client.get(
            provider.userinfo_url,
            headers={"Authorization": f"Bearer {access_token}"},
        )
    if resp.status_code != 200:
        return None
    data = resp.json()
    return data.get(provider.userinfo_email_field)


def refresh_access_token(key: str, refresh_token: str) -> dict:
    provider = get_provider(key)
    data = {
        "client_id": provider.client_id,
        "client_secret": provider.client_secret,
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
    }
    with httpx.Client(timeout=30) as client:
        resp = client.post(provider.token_url, data=data)
    if resp.status_code != 200:
        raise RuntimeError(f"Token refresh failed: {resp.status_code} {resp.text[:300]}")
    return resp.json()


def consume_state(state: str) -> str | None:
    return _pending_states.pop(state, None)


def token_expiry_epoch(token_data: dict) -> int | None:
    """Return expiry as an epoch timestamp from an OAuth token response."""
    expires_in = token_data.get("expires_in")
    if not expires_in:
        return None
    return int(time.time()) + int(expires_in)