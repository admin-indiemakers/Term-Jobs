from contextvars import ContextVar
from typing import Any
import os
from pathlib import Path
from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict

current_cluster_var: ContextVar[str | None] = ContextVar("current_cluster", default=None)

# Ensure .env from backend directory is loaded
backend_env = Path(__file__).resolve().parent.parent.parent / ".env"
if backend_env.exists():
    load_dotenv(dotenv_path=backend_env, override=not bool(os.getenv("VERCEL")))
else:
    load_dotenv(override=not bool(os.getenv("VERCEL")))

DEV_QA_MONGODB_URL = "mongodb+srv://worksarjunm_db_user:CwGHqtAh7UY6YB3H@cluster0.9v3d7xx.mongodb.net/?appName=TERMJOB_DEV_QA"
# Production credentials must exist only in the main deployment's environment.
PRODUCTION_MONGODB_HOSTS = {'termjob.bnwy4et.mongodb.net'}


def detect_branch_name() -> str:
    """Detect current branch from Vercel / CI environment variables or local .git/HEAD."""
    for var in ("VERCEL_GIT_COMMIT_REF", "GIT_BRANCH", "BRANCH_NAME"):
        val = (os.getenv(var) or "").strip().lower()
        if val:
            return val
    try:
        repo_root = Path(__file__).resolve().parent.parent.parent.parent
        git_head = repo_root / ".git" / "HEAD"
        if git_head.exists():
            content = git_head.read_text(encoding="utf-8").strip()
            if "ref: refs/heads/" in content:
                return content.split("ref: refs/heads/")[-1].strip().lower()
            return content.strip().lower()
    except Exception:
        pass
    return ""


def is_dev_qa_environment() -> bool:
    """Only an explicitly identified main branch may use production."""
    if os.getenv('VERCEL') and os.getenv('VERCEL_ENV') != 'production':
        return True
    return detect_branch_name() != "main"


def get_mongodb_url_for_cluster(cluster: str) -> str:
    """Return MongoDB connection string for specific cluster ('dev_qa' or 'main')."""
    if cluster == "dev_qa" or is_dev_qa_environment():
        testing_url = (
            os.getenv("MONGODB_URL_DEV_QA")
            or os.getenv("MONGODB_URL_DEV")
            or os.getenv("MONGODB_URL_QA")
            or DEV_QA_MONGODB_URL
        )
        from urllib.parse import urlsplit
        production_urls = [os.getenv(key) for key in ('MONGODB_URL_MAIN', 'MONGODB_URL_PROD', 'MONGODB_URL')]
        testing_host = urlsplit(testing_url).hostname
        if testing_host and (testing_host in PRODUCTION_MONGODB_HOSTS or any(urlsplit(url).hostname == testing_host for url in production_urls if url)):
            raise RuntimeError('QA/dev database configuration points to a production database host. Connection refused.')
        return testing_url
    production_url = (
        os.getenv("MONGODB_URL_MAIN")
        or os.getenv("MONGODB_URL_PROD")
        or os.getenv("MONGODB_URL")
    )
    if not production_url:
        raise RuntimeError('Production database URL is not configured.')
    return production_url


def get_active_cluster() -> str:
    """Determine currently active cluster based on request context, branch, or environment."""
    if is_dev_qa_environment():
        return "dev_qa"
    ctx_cluster = current_cluster_var.get()
    if ctx_cluster in ("dev_qa", "main"):
        return ctx_cluster
    return "dev_qa" if is_dev_qa_environment() else "main"


def resolve_mongodb_url() -> str:
    """Resolve database URL ensuring dev and qa branches/requests never connect to main production database."""
    return get_mongodb_url_for_cluster(get_active_cluster())


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(backend_env), env_file_encoding="utf-8", extra="ignore")

    # MongoDB
    mongo_db_name: str = os.getenv("MONGO_DB_NAME", "termjobs")

    @property
    def mongodb_url(self) -> str:
        return resolve_mongodb_url()

    # Groq (cloud LLM)
    groq_api_key: str = os.getenv("GROQ_API_KEY", "")
    groq_base_url: str = "https://api.groq.com/openai/v1"
    groq_default_model: str = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")
    model_tiers: dict[str, str] = {
        "small": "openai/gpt-oss-20b",
        "mid": "openai/gpt-oss-20b",
        "large": "openai/gpt-oss-20b",
    }

    # Agent guardrails
    max_intake_turns: int = 8
    max_tool_calls: int = 5
    max_refinements: int = 5
    confidence_threshold: float = 0.7

    # Calendar OAuth (Google / Microsoft / Zoho)
    calendar_redirect_base: str = "https://termjobs.in"          # registered OAuth callback origin
    calendar_frontend_url: str = "https://termjobs.in/dashboard/hiring-manager"

    google_client_id: str = ""
    google_client_secret: str = ""
    microsoft_client_id: str = ""
    microsoft_client_secret: str = ""
    zoho_client_id: str = ""
    zoho_client_secret: str = ""

    # Telegram Bot Alerts
    telegram_bot_token: str = os.getenv("TELEGRAM_BOT_TOKEN", "")
    telegram_bot_username: str = os.getenv("TELEGRAM_BOT_USERNAME", "Termjobs_alertbot")

    # Hiring Manager Telegram AI Bot
    hm_telegram_bot_token: str = os.getenv("HM_TELEGRAM_BOT_TOKEN", "")
    hm_telegram_bot_username: str = os.getenv("HM_TELEGRAM_BOT_USERNAME", "Termjobs_hm_bot")


settings = Settings()
