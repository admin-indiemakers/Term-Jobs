"""Audit logging for the Aura AI Assistant operations."""
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

UTC = timezone.utc


class AuditRecord(BaseModel):
    """Schema for records stored in the `ai_actions` collection."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tenant_id: str
    user_id: str
    user_email: str
    action: str
    target_resource: str = "general"
    target_id: Optional[str] = None
    parameters: Dict[str, Any] = Field(default_factory=dict)
    result_summary: Dict[str, Any] = Field(default_factory=dict)
    status: str = "SUCCESS"  # SUCCESS | FAILED | ABORTED | CONFIRMATION_REQUIRED
    error_message: Optional[str] = None
    proposal_id: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))


SENSITIVE_KEYS = {
    "password", "secret", "token", "authorization", "api_key",
    "credit_card", "ssn", "access_token", "refresh_token"
}


def sanitize_payload(payload: Any) -> Any:
    """Recursively redact sensitive key-values from logged payloads."""
    if isinstance(payload, dict):
        clean = {}
        for k, v in payload.items():
            if any(s in k.lower() for s in SENSITIVE_KEYS):
                clean[k] = "[REDACTED]"
            else:
                clean[k] = sanitize_payload(v)
        return clean
    elif isinstance(payload, list):
        return [sanitize_payload(item) for item in payload]
    return payload


class AuditLogger:
    """Manages audit persistence to MongoDB Atlas `ai_actions`."""
    def __init__(self, db_client=None, test_mode: bool = False):
        self.db = db_client
        self.test_mode = test_mode
        self.in_memory_records: List[AuditRecord] = []

    async def log_action(
        self,
        tenant_id: str,
        user_id: str,
        user_email: str,
        action: str,
        target_resource: str = "general",
        target_id: Optional[str] = None,
        parameters: Optional[Dict[str, Any]] = None,
        result_summary: Optional[Dict[str, Any]] = None,
        status: str = "SUCCESS",
        error_message: Optional[str] = None,
        proposal_id: Optional[str] = None,
    ) -> AuditRecord:
        """Create and persist an immutable audit record."""
        record = AuditRecord(
            tenant_id=tenant_id,
            user_id=user_id,
            user_email=user_email,
            action=action,
            target_resource=target_resource,
            target_id=target_id,
            parameters=sanitize_payload(parameters or {}),
            result_summary=sanitize_payload(result_summary or {}),
            status=status,
            error_message=error_message,
            proposal_id=proposal_id,
            timestamp=datetime.now(UTC)
        )

        if self.test_mode or self.db is None:
            self.in_memory_records.append(record)
            return record

        try:
            # Insert into TermJobs MongoDB `ai_actions` collection
            doc = record.model_dump()
            # Convert datetime to ISO string if needed by driver
            doc["timestamp"] = record.timestamp.isoformat()
            if hasattr(self.db["ai_actions"], "insert_one"):
                self.db["ai_actions"].insert_one(doc)
        except Exception as exc:
            # Fallback to in-memory to prevent audit log failure from crashing transaction
            self.in_memory_records.append(record)

        return record
