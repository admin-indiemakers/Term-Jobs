"""Global config for the backend, loaded once and shared across modules."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Postgres
    database_url: str = "postgresql://localhost/termejobs"

    # Ollama (offline LLM)
    ollama_base_url: str = "http://localhost:11434"
    ollama_default_model: str = "qwen3:1.7b"
    model_tiers: dict[str, str] = {
        "small": "qwen3:1.7b",
        "mid": "qwen3:1.7b",
        "large": "qwen3:1.7b",
    }

    # Agent guardrails
    max_intake_turns: int = 8
    max_tool_calls: int = 5
    max_refinements: int = 5
    confidence_threshold: float = 0.7


settings = Settings()