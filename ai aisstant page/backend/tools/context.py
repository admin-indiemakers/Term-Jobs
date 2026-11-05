"""Execution context injected into every tool handler."""
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from pydantic import BaseModel, ConfigDict, Field
try:
    from ..security.authentication import AuthenticatedUser
    from ..audit.logger import AuditLogger
    from ..proposals.service import ProposalService
except (ImportError, ValueError):
    try:
        from backend.security.authentication import AuthenticatedUser
        from backend.audit.logger import AuditLogger
        from backend.proposals.service import ProposalService
    except (ImportError, ValueError):
        from security.authentication import AuthenticatedUser
        from audit.logger import AuditLogger
        from proposals.service import ProposalService

UTC = timezone.utc


class ToolExecutionContext:
    """Carries verified identity, scoped database session, and audit services."""
    def __init__(
        self,
        user: AuthenticatedUser,
        db_client=None,
        audit_logger: Optional[AuditLogger] = None,
        proposal_service: Optional[ProposalService] = None,
        request_id: Optional[str] = None
    ):
        self.user = user
        self.tenant_id = user.tenant_id
        self.user_id = user.user_id
        self.user_email = user.email
        self.user_role = user.role
        self.department = user.department
        self.db = db_client
        self.audit_logger = audit_logger or AuditLogger(db_client=db_client, test_mode=(db_client is None))
        self.proposal_service = proposal_service or ProposalService(db_client=db_client, test_mode=(db_client is None))
        self.request_id = request_id or str(uuid.uuid4())
        self.timestamp = datetime.now(UTC)

    async def log_action(
        self,
        action: str,
        target_resource: str = "general",
        target_id: Optional[str] = None,
        parameters: Optional[Dict[str, Any]] = None,
        result_summary: Optional[Dict[str, Any]] = None,
        status: str = "SUCCESS",
        error_message: Optional[str] = None,
        proposal_id: Optional[str] = None
    ):
        return await self.audit_logger.log_action(
            tenant_id=self.tenant_id,
            user_id=self.user_id,
            user_email=self.user_email,
            action=action,
            target_resource=target_resource,
            target_id=target_id,
            parameters=parameters,
            result_summary=result_summary,
            status=status,
            error_message=error_message,
            proposal_id=proposal_id
        )
