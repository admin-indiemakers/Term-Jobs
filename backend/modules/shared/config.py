from typing import Any
import os
from pathlib import Path
from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict

# Ensure .env from backend directory is loaded
backend_env = Path(__file__).resolve().parent.parent.parent / ".env"
if backend_env.exists():
    load_dotenv(dotenv_path=backend_env, override=not bool(os.getenv("VERCEL")))
else:
    load_dotenv(override=not bool(os.getenv("VERCEL")))

DEV_QA_MONGODB_URL = "mongodb+srv://worksarjunm_db_user:CwGHqtAh7UY6YB3H@cluster0.9v3d7xx.mongodb.net/?appName=TERMJOB_DEV_QA"


def detect_branch_name() -> str:
    """Detect current branch from Vercel / CI environment variables or local .git/HEAD."""
    for var in ("VERCEL_GIT_COMMIT_REF", "GIT_BRANCH", "BRANCH_NAME", "APP_ENV", "ENVIRONMENT"):
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
    """Detect whether current runtime is Dev or QA environment across local, CI, and Vercel."""
    branch = detect_branch_name()

    # Rule 1: If branch is explicitly main or master, it is NEVER Dev/QA
    if branch in ("main", "master", "prod", "production"):
        return False

    # Rule 2: If branch is explicitly qa or dev
    if branch in ("qa", "dev") or branch.startswith("qa-") or branch.startswith("dev-"):
        return True

    # Rule 3: Check Vercel branch URLs with strict boundaries (e.g. -git-qa- or -git-dev-)
    for url_var in ("VERCEL_URL", "VERCEL_BRANCH_URL"):
        url_val = (os.getenv(url_var) or "").lower()
        if "-git-qa-" in url_val or "-git-dev-" in url_val or url_val.startswith("term-jobs-git-qa-") or url_val.startswith("term-jobs-git-dev-"):
            return True

    # Rule 4: If Vercel Preview and not on main
    if (os.getenv("VERCEL_ENV") or "").lower() == "preview" and branch not in ("main", "master"):
        return True

    return False


def resolve_mongodb_url() -> str:
    """Resolve database URL ensuring dev and qa branches never connect to main production database."""
    if is_dev_qa_environment():
        return (
            os.getenv("MONGODB_URL_DEV_QA")
            or os.getenv("MONGODB_URL_DEV")
            or os.getenv("MONGODB_URL_QA")
            or DEV_QA_MONGODB_URL
        )

    # Main production branch environment: read from MONGODB_URL_MAIN or MONGODB_URL
    return (
        os.getenv("MONGODB_URL_MAIN")
        or os.getenv("MONGODB_URL_PROD")
        or os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    )


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(backend_env), env_file_encoding="utf-8", extra="ignore")

    # MongoDB
    mongodb_url: str = ""
    mongo_db_name: str = os.getenv("MONGO_DB_NAME", "termjobs")

    def __init__(self, **values: Any):
        super().__init__(**values)
        self.mongodb_url = resolve_mongodb_url()

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
