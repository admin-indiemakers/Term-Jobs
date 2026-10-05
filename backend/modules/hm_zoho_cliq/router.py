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


def parse_deluge_map_str(raw: str) -> Dict[str, Any]:
    """Parse Deluge Map string representation `{k1=v1, k2={sub_k=sub_v}}` into Python dict."""
    if not isinstance(raw, str) or not raw.strip():
        return {}
    s = raw.strip()
    if s.startswith("{") and s.endswith("}"):
        s = s[1:-1].strip()

    result = {}
    tokens = []
    current = []
    brace_depth = 0
    in_quote = False
    quote_char = ""

    for char in s:
        if char in ('"', "'"):
            if not in_quote:
                in_quote = True
                quote_char = char
            elif char == quote_char:
                in_quote = False
            current.append(char)
        elif not in_quote and char == "{":
            brace_depth += 1
            current.append(char)
        elif not in_quote and char == "}":
            brace_depth -= 1
            current.append(char)
        elif not in_quote and brace_depth == 0 and char == ",":
            token = "".join(current).strip()
            if token:
                tokens.append(token)
            current = []
        else:
            current.append(char)
    last_token = "".join(current).strip()
    if last_token:
        tokens.append(last_token)

    for token in tokens:
        if "=" in token:
            k, v = token.split("=", 1)
            k = k.strip().strip('"').strip("'")
            v = v.strip().strip('"').strip("'")
            if v.startswith("{") and v.endswith("}"):
                result[k] = parse_deluge_map_str(v)
            else:
                result[k] = v
    return result


async def _extract_payload(request: Request) -> Dict[str, Any]:
    """Gracefully extract payload from JSON body, Form data, Deluge Map string, or Query params."""
    body_bytes = b""
    try:
        body_bytes = await request.body()
    except Exception:
        pass

    raw_str = ""
    if body_bytes:
        try:
            raw_str = body_bytes.decode("utf-8", errors="replace").strip()
        except Exception:
            pass

    content_type = request.headers.get("content-type", "").lower()
    extracted: Dict[str, Any] = {}

    # 1. Try standard JSON parsing
    if raw_str:
        try:
            parsed = json.loads(raw_str)
            if isinstance(parsed, str):
                # Double-encoded JSON string
                try:
                    parsed = json.loads(parsed)
                except Exception:
                    pass
            if isinstance(parsed, dict):
                # Unpack 'payload' or 'data' subfield if wrapped
                if "payload" in parsed and isinstance(parsed["payload"], str):
                    try:
                        inner = json.loads(parsed["payload"])
                        if isinstance(inner, dict):
                            parsed = inner
                    except Exception:
                        pass
                elif "data" in parsed and isinstance(parsed["data"], str):
                    try:
                        inner = json.loads(parsed["data"])
                        if isinstance(inner, dict):
                            parsed = inner
                    except Exception:
                        pass
                extracted = parsed
        except Exception:
            pass

    # 2. Try Deluge Map string parsing `{key=val, key2={...}}`
    if not extracted and raw_str and (raw_str.startswith("{") or "=" in raw_str):
        try:
            deluge_dict = parse_deluge_map_str(raw_str)
            if deluge_dict and any(k in deluge_dict for k in ("message", "text", "user", "action", "key", "command")):
                extracted = deluge_dict
        except Exception:
            pass

    # 3. Try parsing form data
    if not extracted:
        try:
            form = await request.form()
            if form:
                data = dict(form)
                if "payload" in data and isinstance(data["payload"], str):
                    try:
                        inner = json.loads(data["payload"])
                        if isinstance(inner, dict):
                            data = inner
                    except Exception:
                        pass
                for k, v in list(data.items()):
                    if isinstance(v, str) and (v.startswith("{") or "=" in v):
                        try:
                            data[k] = json.loads(v)
                        except Exception:
                            deluge_v = parse_deluge_map_str(v)
                            if deluge_v:
                                data[k] = deluge_v
                extracted = data
        except Exception:
            pass

    # 4. Fallback to query params
    if not extracted:
        extracted = dict(request.query_params)

    # 5. Regex salvage from raw_str if both message and user are still missing
    if not extracted.get("message") and not extracted.get("text") and raw_str:
        import re
        m_match = re.search(r'["\']?(?:message|text)["\']?\s*[:=]\s*["\']?([^"\'}\n,]+)', raw_str, re.IGNORECASE)
        if m_match:
            extracted["message"] = m_match.group(1).strip()
        u_match = re.search(r'["\']?(?:id|zuid|user_id)["\']?\s*[:=]\s*["\']?(\d+)', raw_str, re.IGNORECASE)
        if u_match:
            extracted.setdefault("user", {})["id"] = u_match.group(1).strip()

    # Log incoming payload for visibility and debugging
    try:
        from modules.shared.db import db
        import datetime
        db["cliq_incoming_logs"].insert_one({
            "timestamp": datetime.datetime.utcnow().isoformat(),
            "content_type": content_type,
            "raw_snippet": raw_str[:300],
            "extracted": {k: str(v)[:150] for k, v in extracted.items()}
        })
    except Exception:
        pass

    return extracted


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
