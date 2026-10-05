"""FastAPI Router for Microsoft Teams Bot Integration.

Endpoints:
- POST /api/teams/messages (Universal Bot Framework webhook)
- POST /api/teams/messages/{tenant_id} (Tenant-specific Bot Framework webhook)
- GET  /api/teams/manifest[/{tenant_id}] (Inspect manifest.json)
- GET  /api/teams/package[/{tenant_id}] (Download ready-to-sideload .zip package)
- POST /api/teams/test (Connection test)
"""
import os
from typing import Dict, Any, Optional
from fastapi import APIRouter, Request, Response, HTTPException, status
from fastapi.responses import JSONResponse, Response

from modules.shared.db import db
from .handlers import handle_teams_activity
from .manifest import generate_teams_manifest, build_teams_app_package_zip
from .auth import get_teams_credentials, send_proactive_teams_activity
from .cards import build_welcome_card

router = APIRouter(prefix="/api/teams", tags=["Microsoft Teams Bot"])


@router.post("/messages")
@router.post("/messages/{tenant_id}")
async def teams_messages_webhook(
    request: Request,
    tenant_id: Optional[str] = None
) -> JSONResponse:
    """Universal Bot Framework endpoint for Microsoft Teams activities."""
    try:
        activity = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload.")

    try:
        reply_activity = await handle_teams_activity(activity, tenant_id=tenant_id)
        return JSONResponse(status_code=200, content=reply_activity)
    except Exception as e:
        print(f"[MS TEAMS WEBHOOK ERROR] {e}")
        import traceback
        traceback.print_exc()
        return JSONResponse(
            status_code=200,
            content={
                "type": "message",
                "text": "⚠️ Something went wrong processing your request in Microsoft Teams. Please try again."
            }
        )


@router.get("/manifest")
@router.get("/manifest/{tenant_id}")
async def get_teams_manifest_endpoint(
    tenant_id: Optional[str] = None
) -> Dict[str, Any]:
    """Retrieve the generated manifest.json for Microsoft Teams."""
    creds = get_teams_credentials(tenant_id)
    app_id = creds.get("app_id", "")
    bot_name = creds.get("bot_name", "TermJobs Assistant")
    company_name = "TermJobs"

    if tenant_id and tenant_id != "local":
        t_doc = db["tenants"].find_one({"$or": [{"id": tenant_id}, {"_id": tenant_id}]})
        if t_doc and t_doc.get("name"):
            company_name = t_doc.get("name")

    return generate_teams_manifest(
        app_id=app_id,
        bot_name=bot_name,
        company_name=company_name
    )


@router.get("/package")
@router.get("/package/{tenant_id}")
async def download_teams_package_endpoint(
    tenant_id: Optional[str] = None
) -> Response:
    """Download the installable Microsoft Teams App Package (.zip)."""
    creds = get_teams_credentials(tenant_id)
    app_id = creds.get("app_id", "")
    bot_name = creds.get("bot_name", "TermJobs Assistant")
    company_name = "TermJobs"

    if tenant_id and tenant_id != "local":
        t_doc = db["tenants"].find_one({"$or": [{"id": tenant_id}, {"_id": tenant_id}]})
        if t_doc and t_doc.get("name"):
            company_name = t_doc.get("name")

    zip_bytes = build_teams_app_package_zip(
        app_id=app_id,
        bot_name=bot_name,
        company_name=company_name
    )

    clean_name = company_name.lower().replace(" ", "_")
    filename = f"{clean_name}_teams_bot_app.zip"

    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={
            "Content-Disposition": f"attachment; filename=\"{filename}\""
        }
    )


@router.post("/test")
async def test_teams_connection(
    request: Request
) -> Dict[str, Any]:
    """Test sending an activity directly to a Teams conversation via serviceUrl."""
    body = await request.json()
    service_url = body.get("service_url", "")
    conversation_id = body.get("conversation_id", "")
    tenant_id = body.get("tenant_id")

    creds = get_teams_credentials(tenant_id)
    test_activity = {
        "type": "message",
        "attachments": [build_welcome_card("Hiring Manager", creds.get("bot_name", "TermJobs"))]
    }

    success = await send_proactive_teams_activity(
        service_url=service_url,
        conversation_id=conversation_id,
        activity_payload=test_activity,
        app_id=creds.get("app_id", ""),
        app_password=creds.get("app_password", "")
    )

    return {
        "success": success,
        "message": "Activity dispatched to Microsoft Teams." if success else "Failed to send activity to Teams serviceUrl."
    }
