"""Router for Multi-Tenant Telegram and Zoho Cliq Bot Integrations.

Supports:
- Company Admin bot configuration (bot tokens, incoming webhooks, verification).
- Hiring Manager 1-click deep-link account pairing (/start link_<token>).
- Real-time connection testing and status queries.
"""
import os
import time
import secrets
import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field
import httpx

from fastapi import APIRouter, Depends, HTTPException, Request, status
from modules.identity.domain.models import User
from modules.identity.router import get_current_user
from modules.shared.db import db
from modules.shared.config import settings

router = APIRouter(prefix="/api/integrations", tags=["Bot Integrations"])

TELEGRAM_API_BASE = "https://api.telegram.org"
DEFAULT_TELEGRAM_BOT_USERNAME = "HirMngerbot"


def _mask_token(token: str) -> str:
    """Mask bot token for safe display on dashboard."""
    if not token or len(token) < 10:
        return ""
    return f"{token[:6]}...{token[-4:]}"


def _get_public_api_base(request: Request) -> str:
    """Resolve the public API URL for webhook generation."""
    configured = os.getenv("PUBLIC_API_URL", "").strip().rstrip("/")
    if configured:
        return configured
    # Fallback to request host
    proto = request.headers.get("x-forwarded-proto", request.url.scheme)
    host = request.headers.get("x-forwarded-host", request.url.netloc)
    return f"{proto}://{host}"


# --- Pydantic Request/Response Models ---

class TelegramConfigIn(BaseModel):
    enabled: bool = True
    bot_token: Optional[str] = None
    bot_username: Optional[str] = None


class ZohoCliqConfigIn(BaseModel):
    enabled: bool = True
    bot_name: Optional[str] = None
    incoming_webhook_url: Optional[str] = None


class TenantBotConfigUpdate(BaseModel):
    telegram: Optional[TelegramConfigIn] = None
    zoho_cliq: Optional[ZohoCliqConfigIn] = None


class TestPingIn(BaseModel):
    message: Optional[str] = "🔔 Test ping from TermJobs Dashboard! Your bot integration is working properly."


# --- Endpoints ---

@router.get("/tenant-bots")
async def get_tenant_bot_config(
    request: Request,
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Retrieve the bot integration settings for the current user's company tenant."""
    tenant_id = str(current_user.tenant_id or "local")
    api_base = _get_public_api_base(request)

    doc = None
    try:
        doc = db["tenant_bot_configs"].find_one({"tenant_id": tenant_id})
    except Exception as e:
        print("[INTEGRATIONS] Error fetching tenant bot config:", e)

    tg_doc = (doc or {}).get("telegram") or {}
    cliq_doc = (doc or {}).get("zoho_cliq") or {}

    # Check fallback environment variables if not configured
    default_tg_token = getattr(settings, "hm_telegram_bot_token", "") or os.getenv("HM_TELEGRAM_BOT_TOKEN", "").strip()

    tg_token = tg_doc.get("bot_token") or ""
    effective_tg_username = tg_doc.get("bot_username") or (DEFAULT_TELEGRAM_BOT_USERNAME if default_tg_token else "")

    return {
        "tenant_id": tenant_id,
        "api_base": api_base,
        "telegram": {
            "enabled": bool(tg_doc.get("enabled", True if (tg_token or default_tg_token) else False)),
            "bot_username": effective_tg_username,
            "bot_token_masked": _mask_token(tg_token or default_tg_token),
            "is_custom": bool(tg_token),
            "webhook_url": f"{api_base}/api/telegram/webhook/{tenant_id}",
            "is_verified": bool(tg_doc.get("is_verified", bool(tg_token or default_tg_token))),
            "last_synced_at": tg_doc.get("last_synced_at"),
        },
        "zoho_cliq": {
            "enabled": bool(cliq_doc.get("enabled", False)),
            "bot_name": cliq_doc.get("bot_name") or "TermJobs Bot",
            "incoming_webhook_url": cliq_doc.get("incoming_webhook_url") or "",
            "webhook_url": f"{api_base}/api/zoho-cliq/webhook/{tenant_id}",
            "is_verified": bool(cliq_doc.get("is_verified", False)),
            "last_synced_at": cliq_doc.get("last_synced_at"),
        }
    }


@router.post("/tenant-bots")
async def save_tenant_bot_config(
    payload: TenantBotConfigUpdate,
    request: Request,
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Save or update bot credentials for the current company tenant."""
    tenant_id = str(current_user.tenant_id or "local")
    api_base = _get_public_api_base(request)

    # Fetch existing config
    existing = db["tenant_bot_configs"].find_one({"tenant_id": tenant_id}) or {}
    update_doc: Dict[str, Any] = {
        "tenant_id": tenant_id,
        "updated_at": datetime.datetime.utcnow().isoformat(),
    }

    # 1. Handle Telegram configuration
    if payload.telegram is not None:
        tg_data = existing.get("telegram") or {}
        tg_data["enabled"] = payload.telegram.enabled

        token_to_check = payload.telegram.bot_token
        # If new token provided (and not just masked stars)
        if token_to_check and not token_to_check.startswith("...") and "..." not in token_to_check:
            token_clean = token_to_check.strip()
            # Verify token with Telegram API
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    me_res = await client.get(f"{TELEGRAM_API_BASE}/bot{token_clean}/getMe")
                    if me_res.status_code != 200:
                        raise HTTPException(
                            status_code=400,
                            detail=f"Invalid Telegram bot token. Telegram returned: {me_res.text}"
                        )
                    me_data = me_res.json().get("result", {})
                    verified_username = me_data.get("username", "")

                    tg_data["bot_token"] = token_clean
                    tg_data["bot_username"] = verified_username or payload.telegram.bot_username or ""
                    tg_data["is_verified"] = True
                    tg_data["last_synced_at"] = datetime.datetime.utcnow().isoformat()

                    # Register webhook automatically if public URL is active
                    webhook_secret = tg_data.get("webhook_secret") or secrets.token_hex(20)
                    tg_data["webhook_secret"] = webhook_secret
                    webhook_url = f"{api_base}/api/telegram/webhook/{tenant_id}"
                    tg_data["webhook_url"] = webhook_url

                    # Call setWebhook on Telegram
                    try:
                        wh_res = await client.post(
                            f"{TELEGRAM_API_BASE}/bot{token_clean}/setWebhook",
                            json={
                                "url": webhook_url,
                                "secret_token": webhook_secret,
                                "drop_pending_updates": False
                            }
                        )
                        print(f"[INTEGRATIONS] Telegram setWebhook response: {wh_res.status_code} - {wh_res.text}")
                    except Exception as wh_err:
                        print(f"[INTEGRATIONS] Webhook registration warning: {wh_err}")
            except HTTPException:
                raise
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Failed to communicate with Telegram: {str(e)}")
        elif payload.telegram.bot_username:
            tg_data["bot_username"] = payload.telegram.bot_username.strip().lstrip("@")

        update_doc["telegram"] = tg_data

    # 2. Handle Zoho Cliq configuration
    if payload.zoho_cliq is not None:
        cliq_data = existing.get("zoho_cliq") or {}
        cliq_data["enabled"] = payload.zoho_cliq.enabled
        if payload.zoho_cliq.bot_name:
            cliq_data["bot_name"] = payload.zoho_cliq.bot_name.strip()
        if payload.zoho_cliq.incoming_webhook_url is not None:
            cliq_data["incoming_webhook_url"] = payload.zoho_cliq.incoming_webhook_url.strip()
            cliq_data["is_verified"] = bool(cliq_data["incoming_webhook_url"])
            cliq_data["last_synced_at"] = datetime.datetime.utcnow().isoformat()
        cliq_data["webhook_url"] = f"{api_base}/api/zoho-cliq/webhook/{tenant_id}"
        update_doc["zoho_cliq"] = cliq_data

    # Save to MongoDB
    db["tenant_bot_configs"].update_one(
        {"tenant_id": tenant_id},
        {"$set": update_doc},
        upsert=True
    )

    return await get_tenant_bot_config(request, current_user)


@router.delete("/tenant-bots/{platform}")
async def delete_tenant_bot_config(
    platform: str,
    request: Request,
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Disconnect and disable a specific bot integration platform (telegram or zoho_cliq)."""
    tenant_id = str(current_user.tenant_id or "local")
    doc = db["tenant_bot_configs"].find_one({"tenant_id": tenant_id}) or {}

    platform = platform.lower().strip()
    if platform == "telegram":
        tg_data = doc.get("telegram") or {}
        token = tg_data.get("bot_token")
        if token:
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    await client.post(f"{TELEGRAM_API_BASE}/bot{token}/deleteWebhook")
            except Exception:
                pass
        db["tenant_bot_configs"].update_one(
            {"tenant_id": tenant_id},
            {"$unset": {"telegram": ""}}
        )
    elif platform in ("zoho_cliq", "cliq"):
        db["tenant_bot_configs"].update_one(
            {"tenant_id": tenant_id},
            {"$unset": {"zoho_cliq": ""}}
        )
    else:
        raise HTTPException(status_code=400, detail="Invalid platform. Choose 'telegram' or 'zoho_cliq'.")

    return {"status": "success", "message": f"{platform.title()} bot integration disconnected."}


@router.post("/tenant-bots/test-telegram")
async def test_telegram_token(
    payload: TelegramConfigIn,
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Directly test a Telegram Bot Token against api.telegram.org."""
    token = (payload.bot_token or "").strip()
    if not token or token.startswith("...") or "..." in token:
        # Check stored token
        tenant_id = str(current_user.tenant_id or "local")
        doc = db["tenant_bot_configs"].find_one({"tenant_id": tenant_id}) or {}
        token = (doc.get("telegram") or {}).get("bot_token") or getattr(settings, "hm_telegram_bot_token", "") or os.getenv("HM_TELEGRAM_BOT_TOKEN", "").strip()

    if not token:
        raise HTTPException(status_code=400, detail="No Telegram bot token provided to test.")

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get(f"{TELEGRAM_API_BASE}/bot{token}/getMe")
            if res.status_code == 200:
                data = res.json().get("result", {})
                return {
                    "success": True,
                    "bot_name": data.get("first_name"),
                    "bot_username": data.get("username"),
                    "can_join_groups": data.get("can_join_groups", False),
                    "supports_inline_queries": data.get("supports_inline_queries", False),
                }
            else:
                return {
                    "success": False,
                    "error": f"Telegram API returned status {res.status_code}: {res.text}"
                }
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.post("/tenant-bots/test-cliq")
async def test_cliq_webhook(
    payload: ZohoCliqConfigIn,
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Send a test card to the Zoho Cliq incoming webhook URL."""
    url = (payload.incoming_webhook_url or "").strip()
    if not url:
        tenant_id = str(current_user.tenant_id or "local")
        doc = db["tenant_bot_configs"].find_one({"tenant_id": tenant_id}) or {}
        url = (doc.get("zoho_cliq") or {}).get("incoming_webhook_url") or ""

    if not url:
        raise HTTPException(status_code=400, detail="No Zoho Cliq Incoming Webhook URL configured.")

    test_card = {
        "text": "🎉 **TermJobs Zoho Cliq Integration Test**",
        "card": {
            "title": "✅ Connection Verified",
            "theme": "modern-inline",
            "thumbnail": "https://img.icons8.com/color/96/bot.png"
        },
        "bot": {
            "name": payload.bot_name or "TermJobs Assistant",
            "image": "https://img.icons8.com/fluency/96/artificial-intelligence.png"
        },
        "slides": [
            {
                "type": "text",
                "title": "Zoho Cliq Bot Ready",
                "data": "Your TermJobs Bot integration has been verified. Hiring Managers in your workspace can now receive notifications and manage requisitions directly in Zoho Cliq."
            }
        ]
    }

    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            res = await client.post(url, json=test_card)
            if res.status_code in (200, 204):
                return {"success": True, "message": "Test card delivered successfully to Zoho Cliq channel."}
            return {
                "success": False,
                "error": f"Zoho Cliq returned status {res.status_code}: {res.text}"
            }
    except Exception as e:
        return {"success": False, "error": str(e)}


# --- Hiring Manager Endpoints ---

@router.get("/user-bot-status")
async def get_user_bot_status(
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Retrieve the personal bot linking status for the logged-in Hiring Manager."""
    user_id = str(current_user.id)
    tenant_id = str(current_user.tenant_id or "local")

    # Fetch user from db
    u = db["users"].find_one({"$or": [{"_id": user_id}, {"id": user_id}, {"email": current_user.email}]}) or {}
    tenant_cfg = db["tenant_bot_configs"].find_one({"tenant_id": tenant_id}) or {}

    tg_cfg = tenant_cfg.get("telegram") or {}
    default_tg_token = getattr(settings, "hm_telegram_bot_token", "") or os.getenv("HM_TELEGRAM_BOT_TOKEN", "").strip()
    bot_username = tg_cfg.get("bot_username") or (DEFAULT_TELEGRAM_BOT_USERNAME if default_tg_token else "")

    cliq_cfg = tenant_cfg.get("zoho_cliq") or {}

    is_telegram_linked = bool(u.get("telegram_chat_id"))
    is_cliq_linked = bool(u.get("zoho_cliq_user_id"))

    return {
        "user_id": user_id,
        "name": u.get("name") or current_user.name,
        "email": u.get("email") or current_user.email,
        "tenant_id": tenant_id,
        "telegram": {
            "is_linked": is_telegram_linked,
            "username": u.get("telegram_username") or "",
            "chat_id": u.get("telegram_chat_id") or "",
            "linked_at": u.get("telegram_linked_at"),
            "bot_username": bot_username,
            "bot_available": bool(bot_username),
        },
        "zoho_cliq": {
            "is_linked": is_cliq_linked,
            "user_id": u.get("zoho_cliq_user_id") or "",
            "email": u.get("zoho_cliq_email") or u.get("email") or current_user.email,
            "linked_at": u.get("zoho_cliq_linked_at"),
            "bot_available": bool(cliq_cfg.get("enabled")),
        }
    }


@router.post("/telegram/generate-link")
async def generate_telegram_pairing_link(
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Generate a secure, single-use 10-minute deep-link for pairing the user's Telegram."""
    user_id = str(current_user.id)
    tenant_id = str(current_user.tenant_id or "local")

    # Generate a cryptographically random token
    pair_token = secrets.token_urlsafe(16)
    expires_at = time.time() + 600  # 10 minutes TTL

    # Store on user doc
    db["users"].update_one(
        {"$or": [{"_id": user_id}, {"id": user_id}, {"email": current_user.email}]},
        {"$set": {
            "bot_pairing_token": pair_token,
            "bot_pairing_token_expires_at": expires_at
        }}
    )

    # Determine bot username
    tenant_cfg = db["tenant_bot_configs"].find_one({"tenant_id": tenant_id}) or {}
    tg_cfg = tenant_cfg.get("telegram") or {}
    default_tg_token = getattr(settings, "hm_telegram_bot_token", "") or os.getenv("HM_TELEGRAM_BOT_TOKEN", "").strip()
    bot_username = tg_cfg.get("bot_username") or (DEFAULT_TELEGRAM_BOT_USERNAME if default_tg_token else "")

    if not bot_username:
        bot_username = DEFAULT_TELEGRAM_BOT_USERNAME

    bot_username_clean = bot_username.lstrip("@")
    direct_link = f"https://t.me/{bot_username_clean}?start=link_{pair_token}"

    return {
        "pairing_token": pair_token,
        "direct_link": direct_link,
        "bot_username": bot_username_clean,
        "expires_in_seconds": 600
    }


@router.post("/telegram/unlink")
async def unlink_telegram_account(
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Unlink the user's Telegram account from their TermJobs profile."""
    user_id = str(current_user.id)
    db["users"].update_one(
        {"$or": [{"_id": user_id}, {"id": user_id}, {"email": current_user.email}]},
        {"$unset": {
            "telegram_chat_id": "",
            "telegram_username": "",
            "telegram_linked_at": "",
            "bot_pairing_token": "",
            "bot_pairing_token_expires_at": ""
        }}
    )
    return {"status": "success", "message": "Telegram account unlinked successfully."}


@router.post("/telegram/test-ping")
async def send_telegram_test_ping(
    payload: TestPingIn,
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Send an instant test notification to the user's linked Telegram chat."""
    user_id = str(current_user.id)
    tenant_id = str(current_user.tenant_id or "local")

    u = db["users"].find_one({"$or": [{"_id": user_id}, {"id": user_id}, {"email": current_user.email}]}) or {}
    chat_id = u.get("telegram_chat_id")
    if not chat_id:
        raise HTTPException(
            status_code=400,
            detail="Your Telegram account is not linked yet. Click 'Connect Telegram' first."
        )

    # Determine bot token
    tenant_cfg = db["tenant_bot_configs"].find_one({"tenant_id": tenant_id}) or {}
    tg_cfg = tenant_cfg.get("telegram") or {}
    token = tg_cfg.get("bot_token") or getattr(settings, "hm_telegram_bot_token", "") or os.getenv("HM_TELEGRAM_BOT_TOKEN", "").strip()

    if not token:
        raise HTTPException(status_code=500, detail="Telegram bot token not configured.")

    msg_text = (
        f"⚡ *TermJobs Bot Test Ping*\n\n"
        f"{payload.message}\n\n"
        f"👤 *Linked User:* {u.get('name', current_user.name)}\n"
        f"🏢 *Tenant ID:* `{tenant_id}`\n"
        f"🕒 *Timestamp:* `{datetime.datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}`"
    )

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.post(
                f"{TELEGRAM_API_BASE}/bot{token}/sendMessage",
                json={
                    "chat_id": int(chat_id) if str(chat_id).lstrip("-").isdigit() else chat_id,
                    "text": msg_text,
                    "parse_mode": "Markdown"
                }
            )
            if res.status_code == 200:
                return {"success": True, "message": "Test ping sent to your Telegram chat!"}
            return {
                "success": False,
                "error": f"Telegram API returned status {res.status_code}: {res.text}"
            }
    except Exception as e:
        return {"success": False, "error": str(e)}
