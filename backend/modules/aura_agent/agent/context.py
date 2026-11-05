"""Agent context holding verified session variables."""
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from pydantic import BaseModel, Field

try:
    from ..security.authentication import AuthenticatedUser
except (ImportError, ValueError):
    try:
        from backend.security.authentication import AuthenticatedUser
    except (ImportError, ValueError):
        from security.authentication import AuthenticatedUser

UTC = timezone.utc


class AgentContext(BaseModel):
    """Contextual envelope injected into prompt assembly and agent turns."""
    user: AuthenticatedUser
    request_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    active_requisition_ids: List[str] = Field(default_factory=list)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))

    @property
    def tenant_id(self) -> str:
        return self.user.tenant_id

    @property
    def user_id(self) -> str:
        return self.user.user_id
