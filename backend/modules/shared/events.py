"""Tiny in-process event bus.

Later modules (candidate/, identity/) subscribe to the same bus. Production
would back this with an outbox + broker, but the API shape stays the same.
"""


class EventBus:
    def __init__(self) -> None:
        self._handlers: dict[str, list] = {}

    def on(self, name: str, handler) -> None:
        self._handlers.setdefault(name, []).append(handler)

    def emit(self, name: str, **payload) -> None:
        for handler in list(self._handlers.get(name, [])):
            handler(**payload)


bus = EventBus()