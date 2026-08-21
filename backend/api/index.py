import sys
from pathlib import Path

backend_root = Path(__file__).resolve().parent.parent
if str(backend_root) not in sys.path:
    sys.path.insert(0, str(backend_root))

from main import app as fastapi_app

# ASGI middleware wrapper to resolve Vercel serverless rewritten paths
class VercelASGIApp:
    def __init__(self, asgi_app):
        self.asgi_app = asgi_app

    async def __call__(self, scope, receive, send):
        if scope["type"] in ("http", "websocket"):
            headers = dict(scope.get("headers", []))
            # Vercel provides the original matched path in x-matched-path
            matched = headers.get(b"x-matched-path", b"").decode("utf-8", errors="ignore")
            raw_path = scope.get("path", "")

            if matched and matched not in ("/api/index", "/api/index.py", "/api"):
                scope["path"] = matched
            elif raw_path in ("/api/index", "/api/index.py"):
                scope["path"] = "/"

        await self.asgi_app(scope, receive, send)

app = VercelASGIApp(fastapi_app)
