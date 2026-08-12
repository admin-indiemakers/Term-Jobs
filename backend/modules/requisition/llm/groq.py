"""Groq-backed LLM client.

Talks to Groq's OpenAI-compatible endpoint, so any model served there works.
Three-tier routing picks a model per stage; all tiers fall back to the
configured default model when only one is set.

generate_structured returns parsed JSON *without* full schema validation — the
agent's guardrail loop owns validation + sanitization so model quirks don't
crash generation outright.
"""
import json
import time

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


class GroqClient(LLMClient):
    def __init__(self, api_key: str | None = None, base_url: str | None = None, default_model: str | None = None) -> None:
        self.api_key = api_key or settings.groq_api_key
        self.base_url = (base_url or settings.groq_base_url).rstrip("/")
        self.default_model = default_model or settings.groq_default_model

    @property
    def _chat_url(self) -> str:
        return f"{self.base_url}/chat/completions"

    def _resolve_model(self, tier: str) -> str:
        return settings.model_tiers.get(tier) or self.default_model

    def _headers(self) -> dict[str, str]:
        return {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }

    def _post(self, payload: dict, max_retries: int = 5) -> dict:
        """POST with exponential backoff on rate limits (429) and transient 5xx errors."""
        last_exc: Exception | None = None
        for attempt in range(max_retries):
            try:
                resp = httpx.post(self._chat_url, json=payload, headers=self._headers(), timeout=120.0)
                if resp.status_code in (429, 500, 502, 503, 504):
                    last_exc = httpx.HTTPStatusError(
                        f"Groq {resp.status_code} (attempt {attempt + 1}/{max_retries})",
                        request=resp.request,
                        response=resp,
                    )
                    retry_after = resp.headers.get("retry-after")
                    delay = float(retry_after) if retry_after and retry_after.isdigit() else min(2 ** attempt, 30)
                    time.sleep(delay)
                    continue
                resp.raise_for_status()
                return resp.json()
            except httpx.TimeoutException as exc:
                last_exc = exc
                time.sleep(min(2 ** attempt, 30))
        raise RuntimeError(f"Groq request failed after {max_retries} attempts: {last_exc}") from last_exc

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
