import sys
import traceback
from pathlib import Path

backend_root = Path(__file__).resolve().parent.parent
if str(backend_root) not in sys.path:
    sys.path.insert(0, str(backend_root))

try:
    from main import app
except Exception as e:
    from fastapi import FastAPI, Request
    from fastapi.responses import JSONResponse
    
    tb_str = traceback.format_exc()
    print(f"🔥 [CRITICAL VERCEL BACKEND IMPORT ERROR]: {e}\n{tb_str}", file=sys.stderr)
    
    app = FastAPI(title="TermJobs Backend Diagnostic Fallback")
    
    @app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"])
    async def catch_all_error(request: Request, path: str = ""):
        origin = request.headers.get("origin") or "*"
        return JSONResponse(
            status_code=500,
            content={
                "error": "Backend Application Failed to Start on Vercel",
                "detail": str(e),
                "type": type(e).__name__,
                "traceback": tb_str.splitlines(),
            },
            headers={
                "Access-Control-Allow-Origin": origin,
                "Access-Control-Allow-Credentials": "true",
                "Access-Control-Allow-Methods": "*",
                "Access-Control-Allow-Headers": "*",
            },
        )
