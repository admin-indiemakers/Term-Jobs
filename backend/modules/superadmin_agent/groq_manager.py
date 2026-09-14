"""Groq API Key Rotation Manager for Super Admin Agent.

Automatically rotates through available Groq API keys upon encountering rate limits (429)
or authentication errors, guaranteeing high uptime and resilient LLM operations.
"""
import os
from dotenv import load_dotenv
from loguru import logger

load_dotenv(override=True)

_current_index = 0


def get_all_groq_keys() -> list[str]:
    """Gather all configured Groq API keys from environment."""
    possible_keys = [
        os.getenv("GROQ_API_KEY"),
        os.getenv("GROQ_API_KEY_1"),
        os.getenv("GROQ_API_KEY_2"),
        os.getenv("GROQ_API_KEY_3"),
        os.getenv("GROQ_API_KEY_4"),
        os.getenv("GROQ_API_KEY_5"),
        os.getenv("GROQ_API_KEY_CANDIDATE"),
    ]
    seen = set()
    unique_keys = []
    for k in possible_keys:
        if k and k.strip() and k.strip() not in seen:
            seen.add(k.strip())
            unique_keys.append(k.strip())
    return unique_keys


def get_next_groq_key() -> str | None:
    """Select the next Groq API key in rotation."""
    global _current_index
    keys = get_all_groq_keys()
    if not keys:
        logger.error("No active Groq API keys found in environment variables!")
        return None

    key = keys[_current_index % len(keys)]
    masked = f"...{key[-6:]}" if len(key) > 6 else "***"
    logger.info(f"🔑 [GROQ KEY ROTATION] Active Key Index {_current_index % len(keys) + 1}/{len(keys)} ({masked})")

    _current_index = (_current_index + 1) % len(keys)
    return key
