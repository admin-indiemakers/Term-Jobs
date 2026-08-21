import sys
import urllib.parse
from pathlib import Path

backend_root = Path(__file__).resolve().parent.parent
if str(backend_root) not in sys.path:
    sys.path.insert(0, str(backend_root))

from main import app as fastapi_app

class VercelASGIApp:
    def __init__(self, asgi_app):
        self.asgi_app = asgi_app

    async def __call__(self, scope, receive, send):
        if scope["type"] in ("http", "websocket"):
            qs = scope.get("query_string", b"").decode("utf-8", errors="ignore")
            params = urllib.parse.parse_qs(qs)
            raw_path = scope.get("path", "")

            # 1. Try query param __vercel_path
            target_path = None
            if "__vercel_path" in params and params["__vercel_path"]:
                target_path = params["__vercel_path"][0]

            # 2. Try headers
            if not target_path:
                headers = dict(scope.get("headers", []))
                for h_name in (b"x-matched-path", b"x-forwarded-uri", b"x-invoke-path"):
                    h_val = headers.get(h_name, b"").decode("utf-8", errors="ignore")
                    if h_val and h_val not in ("/api", "/api/", "/api/index", "/api/index.py"):
                        target_path = h_val
                        break

            if target_path:
                if target_path.startswith("//"):
                    target_path = "/" + target_path.lstrip("/")
                if "?" in target_path:
                    target_path = target_path.split("?")[0]
                scope["path"] = target_path

            # Clean query string
            if "__vercel_path" in params:
                cleaned_params = {k: v for k, v in params.items() if k != "__vercel_path"}
                scope["query_string"] = urllib.parse.urlencode(cleaned_params, doseq=True).encode("utf-8")

        await self.asgi_app(scope, receive, send)

app = VercelASGIApp(fastapi_app)
