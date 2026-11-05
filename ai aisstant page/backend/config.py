"""Configuration management for the Aura AI Assistant."""
import os
import pathlib
from functools import lru_cache
from typing import List, Literal
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

_env_path = pathlib.Path(__file__).parent.resolve() / ".env"


class Settings(BaseSettings):
    """Application settings loaded from environment or .env file."""
    model_config = SettingsConfigDict(
        env_file=str(_env_path),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # Server
    host: str = Field(default="0.0.0.0", alias="HOST")
    port: int = Field(default=8001, alias="PORT")
    environment: str = Field(default="development", alias="ENVIRONMENT")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")
    debug: bool = Field(default=False, alias="DEBUG")

    # LLM Provider
    llm_provider: str = Field(default="openrouter", alias="LLM_PROVIDER")
    
    # OpenRouter
    openrouter_api_key: str = Field(
        default="",
        alias="OPENROUTER_API_KEY"
    )
    openrouter_api_base: str = Field(default="https://openrouter.ai/api/v1", alias="OPENROUTER_API_BASE")
    openrouter_model: str = Field(default="openrouter/free", alias="OPENROUTER_MODEL")

    # OpenAI Fallback
    openai_api_key: str = Field(
        default="",
        alias="OPENAI_API_KEY"
    )
    openai_model: str = Field(default="openrouter/free", alias="OPENAI_MODEL")
    openai_api_base: str = Field(default="https://openrouter.ai/api/v1", alias="OPENAI_API_BASE")

    # Database
    mongodb_uri: str = Field(default="mongodb://localhost:27017/termjobs_test", alias="MONGODB_URI")
    database_name: str = Field(default="termjobs", alias="DATABASE_NAME")

    # Auth & JWT
    jwt_secret_key: str = Field(default="termjobs_super_secret_jwt_key_change_in_production", alias="JWT_SECRET_KEY")
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")

    # Safety & Limits
    max_agent_steps: int = Field(default=8, alias="MAX_AGENT_STEPS")
    max_memory_tokens: int = Field(default=16000, alias="MAX_MEMORY_TOKENS")
    proposal_expiry_hours: int = Field(default=24, alias="PROPOSAL_EXPIRY_HOURS")
    test_mode: bool = Field(default=False, alias="TEST_MODE")


@lru_cache()
def get_settings() -> Settings:
    """Return cached application settings singleton."""
    return Settings()
