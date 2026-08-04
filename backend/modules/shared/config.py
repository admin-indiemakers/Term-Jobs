"""Global config for the backend, loaded once and shared across modules."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Postgres
    database_url: str = "postgresql://localhost/termejobs"

    # Ollama (offline LLM)
    ollama_base_url: str = "http://192.168.29.78:11434"
    ollama_default_model: str = "llama3.2:3b"
    model_tiers: dict[str, str] = {
        "small": "llama3.2:3b",
        "mid": "llama3.2:3b",
        "large": "llama3.2:3b",
    }

    # Agent guardrails
    max_intake_turns: int = 8
    max_tool_calls: int = 5
    confidence_threshold: float = 0.7


settings = Settings()