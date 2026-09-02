"""Platform-wide settings persisted in MongoDB (``platform_settings`` collection).

Stores simple ``key -> value`` records. The Super Admin console edits these;
vendors/recruiters read them to enforce submission limits etc.
"""
from .db import db

DEFAULT_MAX_CANDIDATES_PER_REQUISITION = 3

_MAX_CANDIDATES_KEY = "max_candidates_per_requisition"

_COLLECTION = "platform_settings"


def _get(key: str, default) -> object:
    doc = db[_COLLECTION].find_one({"key": key})
    return doc.get("value", default) if doc else default


def _set(key: str, value) -> None:
    db[_COLLECTION].replace_one({"key": key}, {"key": key, "value": value}, upsert=True)


def get_max_candidates_per_requisition() -> int:
    try:
        value = int(_get(_MAX_CANDIDATES_KEY, DEFAULT_MAX_CANDIDATES_PER_REQUISITION))
    except (TypeError, ValueError):
        value = DEFAULT_MAX_CANDIDATES_PER_REQUISITION
    return max(1, value)


def set_max_candidates_per_requisition(limit: int) -> int:
    value = max(1, int(limit))
    _set(_MAX_CANDIDATES_KEY, value)
    return value
