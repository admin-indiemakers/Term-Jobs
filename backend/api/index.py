import sys
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
            headers = dict(scope.get("headers", []))

            path_candidates = [
                headers.get(b"x-matched-path", b"").decode("utf-8", errors="ignore"),
                headers.get(b"x-forwarded-uri", b"").decode("utf-8", errors="ignore"),
                headers.get(b"x-invoke-path", b"").decode("utf-8", errors="ignore"),
                headers.get(b"x-now-route-matches", b"").decode("utf-8", errors="ignore"),
                headers.get(b"x-real-url", b"").decode("utf-8", errors="ignore"),
            ]

            true_path = None
            for p in path_candidates:
                if p and p not in ("/api", "/api/", "/api/index", "/api/index.py"):
                    true_path = p
                    break

            if true_path:
                if "?" in true_path:
                    true_path = true_path.split("?")[0]
                scope["path"] = true_path

        await self.asgi_app(scope, receive, send)

app = VercelASGIApp(fastapi_app)
