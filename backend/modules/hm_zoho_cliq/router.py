"""FastAPI Router for Zoho Cliq Integration.

Exposes endpoints for Zoho Cliq Message Handler, Action Handler, and health check.
"""
from fastapi import APIRouter, Request, BackgroundTasks
from fastapi.responses import JSONResponse
from typing import Dict, Any
import json

from modules.hm_zoho_cliq.handlers import (
    process_cliq_request,
    dispatch_cliq_incoming_message,
    format_cliq_welcome
)

router = APIRouter(tags=["Zoho Cliq"])


async def _extract_payload(request: Request) -> Dict[str, Any]:
    """Gracefully extract payload from JSON body, Form data, or Query params."""
    content_type = request.headers.get("content-type", "")
    
    # 1. Try parsing JSON body
    if "application/json" in content_type:
        try:
            return await request.json()
        except Exception:
            pass

    # 2. Try parsing form data
    try:
        form = await request.form()
        if form:
            data = dict(form)
            # Check if payload was wrapped in a 'payload' or 'data' field
            if "payload" in data:
                try:
                    return json.loads(data["payload"])
                except Exception:
                    pass
            return data
    except Exception:
        pass

    # 3. Try reading raw body as JSON fallback
    try:
        body = await request.body()
        if body:
            return json.loads(body.decode("utf-8"))
    except Exception:
        pass

    # 4. Fallback to query params
    return dict(request.query_params)


@router.post("/api/zoho-cliq/bot")
@router.post("/zoho-cliq/bot")
@router.post("/api/zoho-cliq/webhook")
@router.post("/zoho-cliq/webhook")
async def zoho_cliq_bot_handler(request: Request):
    """
    Main webhook endpoint for Zoho Cliq Message Handler, Slash Commands, and Button actions.
    Configure this URL in the Zoho Cliq Developer Console under Bot Message Handler.
    """
    payload = await _extract_payload(request)
    response_data = await process_cliq_request(payload)
    return JSONResponse(content=response_data)


@router.post("/api/zoho-cliq/actions")
@router.post("/zoho-cliq/actions")
async def zoho_cliq_action_handler(request: Request):
    """
    Dedicated action callback endpoint if Zoho Cliq Action Handlers are configured separately.
    """
    payload = await _extract_payload(request)
    response_data = await process_cliq_request(payload)
    return JSONResponse(content=response_data)


@router.post("/api/zoho-cliq/push-notification")
@router.post("/zoho-cliq/push-notification")
async def zoho_cliq_push_notification(request: Request):
    """
    Push a proactive notification or card directly into the Zoho Cliq Bot chat
    using the bot's incoming webhook endpoint.
    """
    payload = await _extract_payload(request)
    card_data = payload.get("card") or payload
    success = await dispatch_cliq_incoming_message(card_data)
    return {"status": "success" if success else "failed", "dispatched": success}


@router.get("/api/zoho-cliq/health")
@router.get("/zoho-cliq/health")
@router.get("/api/zoho-cliq/test")
@router.get("/zoho-cliq/test")
async def zoho_cliq_health():
    """Health check and setup test for Zoho Cliq integration."""
    return {
        "status": "active",
        "service": "TermJobs Hiring Manager AI for Zoho Cliq",
        "bot_handle": "hiringmanagerterm",
        "api_endpoint": "https://cliq.zoho.in/api/v2/bots/hiringmanagerterm/message",
        "incoming_webhook": "https://cliq.zoho.in/api/v2/bots/hiringmanagerterm/incoming",
        "endpoints": {
            "message_handler": "/api/zoho-cliq/bot",
            "action_handler": "/api/zoho-cliq/actions",
            "push_notification": "/api/zoho-cliq/push-notification"
        }
    }
