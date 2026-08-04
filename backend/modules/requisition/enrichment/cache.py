"""Best-effort caching of LLM-generated JD output.

Keyed by (company profile, role intent, intake answers) so identical or
re-tried requests never re-invoke the model. In-memory for MVP; swap for
SQLite/Redis later without changing callers.
"""
import hashlib
import json

_cache: dict[str, dict] = {}


def _key(profile: dict, intent: dict, answers: list) -> str:
    payload = {
        "profile": profile,
        "intent": intent,
        "answers": answers,
    }
    blob = json.dumps(payload, sort_keys=True, default=str)
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


def cache_get(profile: dict, intent: dict, answers: list) -> dict | None:
    return _cache.get(_key(profile, intent, answers))


def cache_set(profile: dict, intent: dict, answers: list, output: dict) -> None:
    _cache[_key(profile, intent, answers)] = output


def cache_clear() -> None:
    _cache.clear()