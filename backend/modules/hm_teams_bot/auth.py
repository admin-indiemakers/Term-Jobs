"""Microsoft Bot Framework Authentication & Proactive Messaging Helper.

Handles:
- Fetching Bot Framework access token from login.microsoftonline.com
- Sending outbound activities (messages & Adaptive Cards) back to MS Teams serviceUrl
- Multi-tenant credential resolution
"""
import os
import time
import httpx
from typing import Dict, Any, Optional

from modules.shared.db import db
from modules.shared.config import settings

OAUTH_URL = "https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token"
_TOKEN_CACHE: Dict[str, Dict[str, Any]] = {}


def get_teams_credentials(tenant_id: Optional[str] = None) -> Dict[str, str]:
    """Resolve Microsoft App ID and App Password from DB or env."""
    app_id = ""
    app_pw = ""
    bot_name = "TermJobs Assistant"

    # 1. Try tenant config in DB
    if tenant_id and tenant_id != "local":
        try:
            cfg = db["tenant_bot_configs"].find_one({"tenant_id": tenant_id}) or {}
            ms_cfg = cfg.get("ms_teams") or {}
            app_id = (ms_cfg.get("app_id") or "").strip()
            app_pw = (ms_cfg.get("app_password") or "").strip()
            bot_name = ms_cfg.get("bot_name") or bot_name
        except Exception:
            pass

    # 2. Fallback to platform settings / env
    if not app_id:
        app_id = os.getenv("MS_TEAMS_APP_ID", "") or os.getenv("MICROSOFT_APP_ID", "") or getattr(settings, "microsoft_client_id", "")
    if not app_pw:
        app_pw = os.getenv("MS_TEAMS_APP_PASSWORD", "") or os.getenv("MICROSOFT_APP_PASSWORD", "") or getattr(settings, "microsoft_client_secret", "")

    return {
        "app_id": app_id.strip(),
        "app_password": app_pw.strip(),
        "bot_name": bot_name
    }


async def get_bot_framework_token(app_id: str, app_password: str) -> Optional[str]:
    """Retrieve Bot Framework OAuth2 bearer token for calling Microsoft Teams serviceUrl."""
    if not app_id or not app_password:
        return None

    now = time.time()
    cached = _TOKEN_CACHE.get(app_id)
    if cached and cached.get("expires_at", 0) > now + 60:
        return cached.get("access_token")

    payload = {
        "grant_type": "client_credentials",
        "client_id": app_id,
        "client_secret": app_password,
        "scope": "https://api.botframework.com/.default"
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.post(OAUTH_URL, data=payload)
            if res.status_code == 200:
                data = res.json()
                token = data.get("access_token")
                expires_in = int(data.get("expires_in", 3600))
                _TOKEN_CACHE[app_id] = {
                    "access_token": token,
                    "expires_at": now + expires_in
                }
                return token
            else:
                print(f"[MS TEAMS AUTH ERROR] Status {res.status_code}: {res.text}")
    except Exception as e:
        print(f"[MS TEAMS TOKEN EXCEPTION] {e}")

    return None


async def send_proactive_teams_activity(
    service_url: str,
    conversation_id: str,
    activity_payload: Dict[str, Any],
    app_id: str = "",
    app_password: str = ""
) -> bool:
    """Send an activity (message or card) directly to a Teams conversation via serviceUrl."""
    if not service_url or not conversation_id:
        return False

    service_url = service_url.rstrip("/")
    url = f"{service_url}/v3/conversations/{conversation_id}/activities"

    headers = {"Content-Type": "application/json"}
    if app_id and app_password:
        token = await get_bot_framework_token(app_id, app_password)
        if token:
            headers["Authorization"] = f"Bearer {token}"

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.post(url, json=activity_payload, headers=headers)
            if res.status_code in (200, 201, 202):
                return True
            print(f"[MS TEAMS SEND FAILED] {res.status_code}: {res.text}")
    except Exception as e:
        print(f"[MS TEAMS PROACTIVE SEND ERROR] {e}")

    return False
