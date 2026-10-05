"""FastAPI Router for Telegram Webhook multi-tenant bot integration."""
import os
import asyncio
from typing import Dict, Any, Optional
from fastapi import APIRouter, Request, Header, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse

from modules.shared.db import db
from modules.shared.config import settings
from .handlers import handle_message, handle_callback_query
from .bot import get_hm_bot_token

router = APIRouter(tags=["Telegram Bot Webhook"])


async def _process_telegram_update(token: str, update: Dict[str, Any], tenant_id: Optional[str] = None):
    """Dispatch Telegram update to message or callback query handler."""
    try:
        if "message" in update:
            await handle_message(token, update["message"], tenant_id=tenant_id)
        elif "callback_query" in update:
            await handle_callback_query(token, update["callback_query"], tenant_id=tenant_id)
    except Exception as e:
        print(f"[TELEGRAM WEBHOOK ERROR] tenant={tenant_id}: {e}")


@router.post("/api/telegram/webhook/{tenant_id}")
@router.post("/telegram/webhook/{tenant_id}")
async def telegram_tenant_webhook(
    tenant_id: str,
    request: Request,
    background_tasks: BackgroundTasks,
    x_telegram_bot_api_secret_token: Optional[str] = Header(None)
):
    """
    Dynamic webhook endpoint for company-specific Telegram bots.
    Each company tenant registers this URL with Telegram setWebhook.
    """
    # 1. Fetch tenant bot config
    doc = db["tenant_bot_configs"].find_one({"tenant_id": tenant_id}) or {}
    tg_data = doc.get("telegram") or {}

    token = tg_data.get("bot_token") or get_hm_bot_token()
    if not token:
        raise HTTPException(status_code=404, detail="No Telegram bot configured for this workspace.")

    # 2. Verify secret token if configured
    stored_secret = tg_data.get("webhook_secret")
    if stored_secret and x_telegram_bot_api_secret_token:
        if x_telegram_bot_api_secret_token != stored_secret:
            raise HTTPException(status_code=403, detail="Invalid Telegram secret token.")

    # 3. Extract JSON payload
    try:
        update = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload.")

    # 4. Dispatch processing
    background_tasks.add_task(_process_telegram_update, token, update, tenant_id)
    return {"ok": True}


@router.post("/api/telegram/webhook")
@router.post("/telegram/webhook")
async def telegram_default_webhook(
    request: Request,
    background_tasks: BackgroundTasks
):
    """Default fallback webhook endpoint for single-bot or platform-wide deployments."""
    token = get_hm_bot_token()
    if not token:
        raise HTTPException(status_code=404, detail="Global HM_TELEGRAM_BOT_TOKEN not configured.")

    try:
        update = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload.")

    background_tasks.add_task(_process_telegram_update, token, update, None)
    return {"ok": True}
