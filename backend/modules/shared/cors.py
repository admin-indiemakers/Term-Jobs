"""Exact CORS origins shared by normal responses and exception handlers."""

ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "https://termjobs.in",
    "https://www.termjobs.in",
    "https://termjobs.vercel.app",
]


def cors_headers_for_origin(origin: str | None) -> dict[str, str]:
    # Error responses must use the same trust boundary as CORSMiddleware.
    headers = {"Vary": "Origin"}
    if origin in ALLOWED_ORIGINS:
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
    return headers
