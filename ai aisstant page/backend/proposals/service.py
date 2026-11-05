"""Service layer managing proposal creation, lookup, and idempotent execution."""
import asyncio
from datetime import datetime, timezone
from typing import Any, Callable, Coroutine, Dict, List, Optional
try:
    from ..security.authentication import AuthenticatedUser
    from ..security.authorization import AuthorizationError, check_action_permitted
    from ..security.tenant_scope import SecurityViolationError
except (ImportError, ValueError):
    try:
        from backend.security.authentication import AuthenticatedUser
        from backend.security.authorization import AuthorizationError, check_action_permitted
        from backend.security.tenant_scope import SecurityViolationError
    except (ImportError, ValueError):
        from security.authentication import AuthenticatedUser
        from security.authorization import AuthorizationError, check_action_permitted
        from security.tenant_scope import SecurityViolationError
from .models import ProposalDocument, ProposalState
from .state_machine import ProposalStateError, transition_proposal

UTC = timezone.utc


class ProposalService:
    """Manages Human-in-the-Loop proposals in MongoDB `agent_proposals`."""
    def __init__(self, db_client=None, test_mode: bool = False):
        self.db = db_client
        self.test_mode = test_mode
        self._memory_store: Dict[str, ProposalDocument] = {}
        self._locks: Dict[str, asyncio.Lock] = {}

    def _get_lock(self, proposal_id: str) -> asyncio.Lock:
        if proposal_id not in self._locks:
            self._locks[proposal_id] = asyncio.Lock()
        return self._locks[proposal_id]

    async def create_proposal(
        self,
        tenant_id: str,
        user: AuthenticatedUser,
        action: str,
        parameters: Dict[str, Any],
        impact_summary: str,
        expiry_hours: int = 24
    ) -> ProposalDocument:
        """Create and persist a new pending proposal."""
        # 1. Verify user role permissions
        check_action_permitted(action, user.role)

        proposal = ProposalDocument(
            tenant_id=tenant_id,
            user_id=user.user_id,
            user_email=user.email,
            action=action,
            parameters=parameters,
            impact_summary=impact_summary
        )

        if self.test_mode or self.db is None:
            self._memory_store[proposal.id] = proposal
            return proposal

        doc = proposal.model_dump()
        doc["created_at"] = proposal.created_at.isoformat()
        doc["expires_at"] = proposal.expires_at.isoformat()
        if hasattr(self.db["agent_proposals"], "insert_one"):
            self.db["agent_proposals"].insert_one(doc)
        self._memory_store[proposal.id] = proposal
        return proposal

    async def get_proposal(self, proposal_id: str, tenant_id: str) -> Optional[ProposalDocument]:
        """Fetch proposal ensuring strict tenant scoping."""
        if self.test_mode or self.db is None or proposal_id in self._memory_store:
            proposal = self._memory_store.get(proposal_id)
            if proposal and proposal.tenant_id != tenant_id:
                raise SecurityViolationError("Access Denied: Proposal belongs to another organization tenant.")
            return proposal

        doc = self.db["agent_proposals"].find_one({"id": proposal_id, "tenant_id": tenant_id})
        if not doc:
            return None
        return ProposalDocument(**doc)

    async def list_pending_proposals(self, tenant_id: str, user_id: str) -> List[ProposalDocument]:
        """List active pending proposals for a specific Hiring Manager."""
        if self.test_mode or self.db is None:
            return [
                p for p in self._memory_store.values()
                if p.tenant_id == tenant_id and p.user_id == user_id and p.state == ProposalState.PENDING and not p.is_expired()
            ]

        cursor = self.db["agent_proposals"].find({
            "tenant_id": tenant_id,
            "user_id": user_id,
            "state": ProposalState.PENDING.value
        })
        results = []
        for doc in cursor:
            p = ProposalDocument(**doc)
            if not p.is_expired():
                results.append(p)
        return results

    async def confirm_and_execute(
        self,
        proposal_id: str,
        user: AuthenticatedUser,
        executor_func: Callable[[str, Dict[str, Any]], Coroutine[Any, Any, Dict[str, Any]]]
    ) -> Dict[str, Any]:
        """Atomically confirm and execute a proposal with idempotency locking."""
        lock = self._get_lock(proposal_id)
        async with lock:
            proposal = await self.get_proposal(proposal_id, user.tenant_id)
            if not proposal:
                raise ValueError(f"Proposal '{proposal_id}' not found.")

            # Revalidate role permissions at execution time
            check_action_permitted(proposal.action, user.role)

            # Prevent replay or duplicate execution
            if proposal.state == ProposalState.EXECUTED:
                return {
                    "success": True,
                    "message": "Proposal has already been executed.",
                    "result": proposal.execution_result,
                    "idempotent": True
                }

            if proposal.state != ProposalState.PENDING:
                raise ProposalStateError(
                    f"Cannot execute proposal in state '{proposal.state.value}'",
                    current_state=proposal.state,
                    target_state=ProposalState.CONFIRMED
                )

            # Transition PENDING -> CONFIRMED -> EXECUTING
            transition_proposal(proposal, ProposalState.CONFIRMED)
            proposal.confirmed_at = datetime.now(UTC)
            transition_proposal(proposal, ProposalState.EXECUTING)

            try:
                # Execute underlying tool handler
                result = await executor_func(proposal.action, proposal.parameters)
                transition_proposal(proposal, ProposalState.EXECUTED)
                proposal.executed_at = datetime.now(UTC)
                proposal.execution_result = result

                # Update in storage
                self._memory_store[proposal.id] = proposal
                if self.db is not None and not self.test_mode:
                    self.db["agent_proposals"].update_one(
                        {"id": proposal.id},
                        {"$set": {
                            "state": ProposalState.EXECUTED.value,
                            "confirmed_at": proposal.confirmed_at.isoformat(),
                            "executed_at": proposal.executed_at.isoformat(),
                            "execution_result": result
                        }}
                    )

                return {
                    "success": True,
                    "message": f"Operation '{proposal.action}' executed successfully.",
                    "result": result
                }
            except Exception as exc:
                transition_proposal(proposal, ProposalState.FAILED)
                proposal.error_message = str(exc)
                self._memory_store[proposal.id] = proposal
                if self.db is not None and not self.test_mode:
                    self.db["agent_proposals"].update_one(
                        {"id": proposal.id},
                        {"$set": {
                            "state": ProposalState.FAILED.value,
                            "error_message": str(exc)
                        }}
                    )
                raise exc

    async def reject_proposal(
        self,
        proposal_id: str,
        user: AuthenticatedUser,
        rejection_reason: Optional[str] = None
    ) -> ProposalDocument:
        """Reject and cancel a pending proposal."""
        lock = self._get_lock(proposal_id)
        async with lock:
            proposal = await self.get_proposal(proposal_id, user.tenant_id)
            if not proposal:
                raise ValueError(f"Proposal '{proposal_id}' not found.")

            transition_proposal(proposal, ProposalState.REJECTED)
            proposal.error_message = rejection_reason or "Cancelled by user"

            self._memory_store[proposal.id] = proposal
            if self.db is not None and not self.test_mode:
                self.db["agent_proposals"].update_one(
                    {"id": proposal.id},
                    {"$set": {
                        "state": ProposalState.REJECTED.value,
                        "error_message": proposal.error_message
                    }}
                )

            return proposal
