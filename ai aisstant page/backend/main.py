"""FastAPI application entrypoint for Aura AI Assistant."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import get_settings
from .router import router as assistant_router

settings = get_settings()

app = FastAPI(
    title="TermJobs Aura AI Hiring Manager Assistant",
    description="Production-grade AI Hiring Operations Assistant for the TermJobs platform",
    version="2.0.0"
)

# Enable CORS for TermJobs frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include assistant API router
app.include_router(assistant_router, prefix="/api/v2/hm-agent", tags=["Aura Assistant"])


@app.get("/")
async def root():
    return {
        "service": "TermJobs Aura AI Assistant API",
        "version": "2.0.0",
        "docs_url": "/docs"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host=settings.host, port=settings.port, reload=settings.debug)
