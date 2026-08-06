"""Global config for the backend, loaded once and shared across modules."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # MongoDB
    mongodb_url: str = "mongodb://localhost:27017/termjobs"
    mongo_db_name: str = "termjobs"

    # Groq (cloud LLM)
    groq_api_key: str = ""
    groq_base_url: str = "https://api.groq.com/openai/v1"
    groq_default_model: str = "llama-3.3-70b-versatile"
    model_tiers: dict[str, str] = {
        "small": "llama-3.3-70b-versatile",
        "mid": "llama-3.3-70b-versatile",
        "large": "llama-3.3-70b-versatile",
    }

    # Agent guardrails
    max_intake_turns: int = 8
    max_tool_calls: int = 5
    max_refinements: int = 5
    confidence_threshold: float = 0.7


settings = Settings()