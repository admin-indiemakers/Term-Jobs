"""Tests for proposal state machine and idempotency."""
import pytest
from backend.proposals.models import ProposalState
from backend.proposals.service import ProposalService
from backend.proposals.state_machine import ProposalStateError, transition_proposal


def test_proposal_lifecycle_flow(proposal_service, mock_user):
    import asyncio

    async def run():
        # 1. Create proposal
        prop = await proposal_service.create_proposal(
            tenant_id=mock_user.tenant_id,
            user=mock_user,
            action="submit_requisition_for_approval",
            parameters={"requisition_id": "req_101"},
            impact_summary="Submitting requisition for Director review."
        )
        assert prop.state == ProposalState.PENDING

        # 2. Confirm and execute
        executed_calls = []
        async def mock_executor(action, params):
            executed_calls.append((action, params))
            return {"status": "SUBMITTED"}

        res = await proposal_service.confirm_and_execute(prop.id, mock_user, mock_executor)
        assert res["success"] is True
        assert len(executed_calls) == 1

        # 3. Verify final state
        updated = await proposal_service.get_proposal(prop.id, mock_user.tenant_id)
        assert updated.state == ProposalState.EXECUTED

        # 4. Idempotent re-execution
        idempotent_res = await proposal_service.confirm_and_execute(prop.id, mock_user, mock_executor)
        assert idempotent_res["idempotent"] is True
        assert len(executed_calls) == 1  # Executor not called second time

    asyncio.run(run())


def test_proposal_rejection(proposal_service, mock_user):
    import asyncio

    async def run():
        prop = await proposal_service.create_proposal(
            tenant_id=mock_user.tenant_id,
            user=mock_user,
            action="reject_candidate",
            parameters={"candidate_id": "c1"},
            impact_summary="Reject candidate"
        )
        rejected = await proposal_service.reject_proposal(prop.id, mock_user, "Changed mind")
        assert rejected.state == ProposalState.REJECTED

    asyncio.run(run())


def test_illegal_state_transition(proposal_service, mock_user):
    import asyncio

    async def run():
        prop = await proposal_service.create_proposal(
            tenant_id=mock_user.tenant_id,
            user=mock_user,
            action="reject_candidate",
            parameters={"candidate_id": "c1"},
            impact_summary="Reject"
        )
        # Cannot transition directly from PENDING to EXECUTED
        with pytest.raises(ProposalStateError):
            transition_proposal(prop, ProposalState.EXECUTED)

    asyncio.run(run())
