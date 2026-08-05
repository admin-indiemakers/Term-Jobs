import os
from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from routers.screening import router as screening_router

app = FastAPI(
    title="Candidate Screening Agent",
    description="AI Agent for candidate screening, resume parsing, and match evaluation",
    version="1.0.0",
)

# Mount static folder if exists
static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")


@app.get("/", include_in_schema=False)
def serve_ui():
    """Serve the Vendor Candidate Screening UI."""
    index_path = os.path.join(static_dir, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "Candidate Screening Agent API is running"}


@app.get("/company-x", include_in_schema=False)
@app.get("/portal", include_in_schema=False)
def serve_company_x_portal():
    """Serve the Company X Enterprise HR Dashboard Portal."""
    portal_path = os.path.join(static_dir, "company_x_dashboard.html")
    if os.path.exists(portal_path):
        return FileResponse(portal_path)
    return {"message": "Company X Portal HTML missing"}


def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    openapi_schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
    )
    for schema in openapi_schema.get("components", {}).get("schemas", {}).values():
        if isinstance(schema, dict) and "properties" in schema:
            for prop in schema["properties"].values():
                if prop.get("type") == "array" and isinstance(prop.get("items"), dict):
                    if prop["items"].get("contentMediaType") == "application/octet-stream" or prop["items"].get("type") == "string":
                        prop["items"]["format"] = "binary"
    app.openapi_schema = openapi_schema
    return app.openapi_schema


app.openapi = custom_openapi

app.include_router(screening_router, prefix="/api", tags=["Screening"])
