"""Ollama-backed LLM client.

Talks to the offline Ollama server via its OpenAI-compatible endpoint, so any
model that exposes /v1/chat/completions works. Three-tier routing picks a
model per stage; all tiers fall back to the configured default model when the
server only has one model installed.

generate_structured returns parsed JSON *without* full schema validation — the
agent's guardrail loop owns validation + sanitization so small-model quirks
(e.g. a single-value rate_band) don't crash generation outright.
"""
import json

import httpx
from pydantic import BaseModel

from ...shared.config import settings
from .base import LLMClient

_DEFAULT_MESSAGES = [
    {
        "role": "system",
        "content": (
            "You are a precise structured-data extractor. Respond only with valid JSON "
            "matching the requested schema. Do not add commentary."
        ),
    }
]


class _Schema(BaseModel):
    pass


class OllamaClient(LLMClient):
    def __init__(self, base_url: str | None = None, default_model: str | None = None) -> None:
        self.base_url = (base_url or settings.ollama_base_url).rstrip("/")
        self.default_model = default_model or settings.ollama_default_model

    @property
    def _chat_url(self) -> str:
        return f"{self.base_url}/v1/chat/completions"

    def _resolve_model(self, tier: str) -> str:
        return settings.model_tiers.get(tier) or self.default_model

    def _post(self, payload: dict) -> dict:
        resp = httpx.post(self._chat_url, json=payload, timeout=120.0)
        resp.raise_for_status()
        return resp.json()

    def chat(self, messages: list[dict[str, str]], tier: str = "small") -> str:
        payload = {
            "model": self._resolve_model(tier),
            "messages": _DEFAULT_MESSAGES + messages,
            "stream": False,
        }
        data = self._post(payload)
        return data["choices"][0]["message"]["content"]

    def generate_text(self, prompt: str, tier: str = "small") -> str:
        return self.chat([{"role": "user", "content": prompt}], tier=tier)

    def generate_structured(self, prompt: str, schema: type[BaseModel], tier: str = "mid") -> dict:
        """Request JSON conforming to `schema` and parse it (without strict validation)."""
        system = (
            f"Respond with valid JSON that conforms to this JSON Schema:\n"
            f"{schema.model_json_schema()}\n"
            "Return ONLY the JSON object, no markdown fences."
        )
        payload = {
            "model": self._resolve_model(tier),
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ],
            "stream": False,
            "response_format": {"type": "json_object"},
        }
        data = self._post(payload)
        raw = data["choices"][0]["message"]["content"].strip()
        raw = raw.strip("`")
        if raw.startswith("json"):
            raw = raw[4:].strip()
        return json.loads(raw)