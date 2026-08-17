"""Global config for the backend, loaded once and shared across modules."""
import os
from pathlib import Path
from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict

# Ensure .env from backend directory is loaded
backend_env = Path(__file__).resolve().parent.parent.parent / ".env"
if backend_env.exists():
    load_dotenv(dotenv_path=backend_env, override=True)
else:
    load_dotenv(override=True)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(backend_env), env_file_encoding="utf-8", extra="ignore")

    # MongoDB
    mongodb_url: str = os.getenv("MONGODB_URL", "mongodb+srv://worksarjunm_db_user:Y3fv1MhYgoa94NXT@termjob.bnwy4et.mongodb.net")
    mongo_db_name: str = os.getenv("MONGO_DB_NAME", "termjobs")

    # Groq (cloud LLM)
    groq_api_key: str = os.getenv("GROQ_API_KEY", "")
    groq_base_url: str = "https://api.groq.com/openai/v1"
    groq_default_model: str = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
    model_tiers: dict[str, str] = {
        "small": "openai/gpt-oss-120b",
        "mid": "openai/gpt-oss-120b",
        "large": "openai/gpt-oss-120b",
    }

    # Agent guardrails
    max_intake_turns: int = 8
    max_tool_calls: int = 5
    max_refinements: int = 5
    confidence_threshold: float = 0.7

    # Calendar OAuth (Google / Microsoft / Zoho)
    calendar_redirect_base: str = "http://localhost:8000"          # public URL of the backend (used for OAuth callback)
    calendar_frontend_url: str = "http://localhost:5173/dashboard/admin"  # where the admin lands after connecting

    google_client_id: str = ""
    google_client_secret: str = ""
    microsoft_client_id: str = ""
    microsoft_client_secret: str = ""
    zoho_client_id: str = ""
    zoho_client_secret: str = ""


settings = Settings()
