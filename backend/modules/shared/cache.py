"""Lightweight in-memory TTL cache for hot-path API data.

Usage:
    from modules.shared.cache import cache, cached

    # Manual
    cache.set("team:hm123", data, ttl=60)
    data = cache.get("team:hm123")

    # Decorator
    @cached(ttl=60, key_func=lambda user: f"team:{user.id}")
    def get_team_data(user):
        ...
"""
import time
import threading
from typing import Any, Callable


class TTLCache:
    """Thread-safe in-memory cache with per-key TTL."""

    def __init__(self, max_size: int = 2048):
        self._store: dict[str, tuple[Any, float]] = {}
        self._lock = threading.Lock()
        self._max_size = max_size

    def get(self, key: str) -> Any | None:
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None
            value, expires_at = entry
            if time.time() > expires_at:
                del self._store[key]
                return None
            return value

    def set(self, key: str, value: Any, ttl: int = 60) -> None:
        with self._lock:
            if len(self._store) >= self._max_size and key not in self._store:
                self._evict_oldest()
            self._store[key] = (value, time.time() + ttl)

    def invalidate(self, key: str) -> None:
        with self._lock:
            self._store.pop(key, None)

    def invalidate_prefix(self, prefix: str) -> None:
        with self._lock:
            keys_to_delete = [k for k in self._store if k.startswith(prefix)]
            for k in keys_to_delete:
                del self._store[k]

    def clear(self) -> None:
        with self._lock:
            self._store.clear()

    def _evict_oldest(self) -> None:
        """Evict the entry closest to expiry (or already expired)."""
        if not self._store:
            return
        now = time.time()
        # Prefer evicting expired entries first
        expired = [k for k, (_, exp) in self._store.items() if now > exp]
        if expired:
            del self._store[expired[0]]
            return
        # Otherwise evict the one expiring soonest
        oldest_key = min(self._store, key=lambda k: self._store[k][1])
        del self._store[oldest_key]

    @property
    def stats(self) -> dict:
        with self._lock:
            return {"size": len(self._store), "max_size": self._max_size}


# Global singleton
cache = TTLCache()


def cached(ttl: int = 60, key_func: Callable | None = None):
    """Decorator that caches function results in-memory.

    Args:
        ttl: Time-to-live in seconds (default 60).
        key_func: Optional callable that builds the cache key from the
                  same arguments passed to the wrapped function. If None,
                  the function's module + qualname + args are used.
    """
    def decorator(fn: Callable) -> Callable:
        def wrapper(*args, **kwargs):
            # Build cache key
            if key_func:
                try:
                    cache_key = f"fn:{fn.__module__}.{fn.__qualname__}:{key_func(*args, **kwargs)}"
                except Exception:
                    cache_key = f"fn:{fn.__module__}.{fn.__qualname__}:{args}:{kwargs}"
            else:
                cache_key = f"fn:{fn.__module__}.{fn.__qualname__}:{args}:{kwargs}"

            result = cache.get(cache_key)
            if result is not None:
                return result

            result = fn(*args, **kwargs)
            cache.set(cache_key, result, ttl=ttl)
            return result

        wrapper.__name__ = fn.__name__
        wrapper.__qualname__ = fn.__qualname__
        return wrapper
    return decorator
