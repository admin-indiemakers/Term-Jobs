import os
import sys
import traceback
import urllib.parse
from pathlib import Path

# Add project root and backend directory to sys.path
root_dir = Path(__file__).resolve().parent.parent
backend_dir = root_dir / "backend"

for path_str in (str(backend_dir), str(root_dir)):
    if path_str not in sys.path:
        sys.path.insert(0, path_str)

# Ensure serverless flag is set so background loops don't hang Lambda
os.environ["VERCEL"] = "1"

fastapi_app = None
init_error = None
init_traceback = None

try:
    from main import app as _app
    fastapi_app = _app
except Exception as e:
    init_error = str(e)
    init_traceback = traceback.format_exc()
    print(f"[VERCEL INIT ERROR] {init_error}\n{init_traceback}", file=sys.stderr)


class VercelASGIApp:
    def __init__(self, asgi_app):
        self.asgi_app = asgi_app

    async def __call__(self, scope, receive, send):
        if scope["type"] in ("http", "websocket"):
            # If main failed to import, return friendly JSON error instead of crashing Lambda
            if self.asgi_app is None:
                import json
                err_payload = json.dumps({
                    "error": "Backend initialization failed",
                    "details": init_error,
                    "traceback": init_traceback
                }).encode("utf-8")
                await send({
                    "type": "http.response.start",
                    "status": 500,
                    "headers": [
                        (b"content-type", b"application/json"),
                        (b"content-length", str(len(err_payload)).encode("ascii")),
                    ],
                })
                await send({
                    "type": "http.response.body",
                    "body": err_payload,
                })
                return

            qs = scope.get("query_string", b"").decode("utf-8", errors="ignore")
            params = urllib.parse.parse_qs(qs)

            target_path = None
            if "__vercel_path" in params and params["__vercel_path"]:
                target_path = params["__vercel_path"][0]

            if not target_path:
                headers = dict(scope.get("headers", []))
                for h_name in (b"x-matched-path", b"x-forwarded-uri", b"x-invoke-path", b"x-real-url"):
                    h_val = headers.get(h_name, b"").decode("utf-8", errors="ignore")
                    if h_val and h_val not in ("/api", "/api/", "/api/index", "/api/index.py"):
                        target_path = h_val
                        break

            if not target_path:
                current_p = scope.get("path", "")
                if current_p and current_p not in ("/api", "/api/", "/api/index", "/api/index.py"):
                    target_path = current_p

            if target_path:
                if target_path.startswith("//"):
                    target_path = "/" + target_path.lstrip("/")
                if "?" in target_path:
                    target_path = target_path.split("?")[0]
                scope["root_path"] = ""
                scope["path"] = target_path
                scope["raw_path"] = target_path.encode("utf-8")

            if "__vercel_path" in params:
                cleaned_params = {k: v for k, v in params.items() if k != "__vercel_path"}
                scope["query_string"] = urllib.parse.urlencode(cleaned_params, doseq=True).encode("utf-8")

        await self.asgi_app(scope, receive, send)


app = VercelASGIApp(fastapi_app)
