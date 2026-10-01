import os
import sys
from pathlib import Path

root_dir = Path(__file__).resolve().parent.parent
backend_dir = root_dir / "backend"

for path_str in (str(backend_dir), str(root_dir)):
    if path_str not in sys.path:
        sys.path.insert(0, path_str)

os.environ["VERCEL"] = "1"

try:
    from main import app
except Exception as e:
    import traceback
    from fastapi import FastAPI
    from fastapi.responses import JSONResponse

    err_msg = str(e)
    tb_str = traceback.format_exc()

    app = FastAPI()

    @app.api_route("/{path_name:path}", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"])
    async def catch_all(path_name: str):
        return JSONResponse(
            status_code=500,
            content={
                "error": "Backend initialization exception",
                "details": err_msg,
                "traceback": tb_str
            }
        )
