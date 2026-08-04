"""LLM client interface.

The agent depends on this abstraction, not on any concrete provider, so
offline tests run against MockLLM and dev/prod runs use the Ollama client.
"""
from abc import ABC, abstractmethod
from typing import Any


class LLMClient(ABC):
    @abstractmethod
    def chat(self, messages: list[dict[str, str]]) -> str:
        """Plain chat completion. Returns the assistant text."""

    @abstractmethod
    def generate_text(self, prompt: str) -> str:
        """Single-turn text generation (e.g. JD markdown)."""

    @abstractmethod
    def generate_structured(self, prompt: str, schema: Any) -> dict:
        """Generate output conforming to the given pydantic schema."""


def route_model(tier: str) -> str:
    """Small/mid/large routing hook. Implemented by the concrete client."""
    raise NotImplementedError
