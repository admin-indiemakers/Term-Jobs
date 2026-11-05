"""Models and schemas for the Human-in-the-Loop Proposal Engine."""
import uuid
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field

UTC = timezone.utc


class ProposalState(str, Enum):
    """Lifecycle states of a proposed state-changing operation."""
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    EXECUTING = "EXECUTING"
    EXECUTED = "EXECUTED"
    REJECTED = "REJECTED"
    EXPIRED = "EXPIRED"
    FAILED = "FAILED"


class ProposalDocument(BaseModel):
    """Data model for pending proposals stored in MongoDB `agent_proposals`."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tenant_id: str
    user_id: str
    user_email: str
    action: str
    parameters: Dict[str, Any]
    impact_summary: str
    state: ProposalState = ProposalState.PENDING
    idempotency_key: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    expires_at: datetime = Field(default_factory=lambda: datetime.now(UTC) + timedelta(hours=24))
    confirmed_at: Optional[datetime] = None
    executed_at: Optional[datetime] = None
    execution_result: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None

    def is_expired(self) -> bool:
        return datetime.now(UTC) > self.expires_at


class ProposalConfirmationRequest(BaseModel):
    """Payload sent by client when confirming or rejecting a proposal."""
    proposal_id: str
    action: str = Field(default="CONFIRM", description="'CONFIRM' or 'REJECT'")
    rejection_reason: Optional[str] = None
