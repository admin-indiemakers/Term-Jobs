"""
Resume Screener config — used when running inside Term-Jobs backend.
Reads from the same .env as Term-Jobs (GROQ_API_KEY, GROQ_MODEL, OLLAMA_BASE_URL, etc.).
"""
from pydantic_settings import BaseSettings
from functools import lru_cache


class ScreenerSettings(BaseSettings):
    github_pat: str = ""
    llm_provider: str = "groq"
    groq_api_key: str = ""
    groq_model: str = "openai/gpt-oss-120b"
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.2:3b"
    tesseract_cmd: str = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
    upload_dir: str = "uploads"

    class Config:
        env_file = ".env"
        extra = "ignore"  # ignore Term-Jobs specific keys (MONGODB_URL etc.)


@lru_cache
def get_settings() -> ScreenerSettings:
    return ScreenerSettings()
