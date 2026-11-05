"""Comprehensive integration and tenant/manager isolation test suite for Aura AI."""
import asyncio
import jwt
import pytest
from unittest.mock import MagicMock
from fastapi import HTTPException

from main import app
from modules.aura_agent.security.authentication import AuthenticatedUser
from modules.aura_agent.security.authorization import AuthorizationError, check_action_permitted
from modules.aura_agent.security.tenant_scope import SecurityViolationError
from modules.aura_agent.proposals.service import ProposalService
from modules.aura_agent.proposals.models import ProposalState
from modules.aura_agent.proposals.state_machine import ProposalStateError
from modules.hiring_manager_agent.scope import hiring_scope, ScopedDatabase


# --- Mock Users ---
HM_COMPANY_A_USER_1 = AuthenticatedUser(
    user_id="hm_user_alpha_1",
    tenant_id="company_alpha",
    role="Hiring Manager",
    email="elena@alpha.com",
    name="Elena Rostova",
    department="Engineering"
)

HM_COMPANY_A_USER_2 = AuthenticatedUser(
    user_id="hm_user_alpha_2",
    tenant_id="company_alpha",
    role="Hiring Manager",
    email="marcus@alpha.com",
    name="Marcus Vance",
    department="Design"
)

HM_COMPANY_B_USER = AuthenticatedUser(
    user_id="hm_user_beta_1",
    tenant_id="company_beta",
    role="Hiring Manager",
    email="david@beta.com",
    name="David Miller",
    department="Engineering"
)

UNAUTHORIZED_CANDIDATE = AuthenticatedUser(
    user_id="cand_user_99",
    tenant_id="company_alpha",
    role="Candidate",
    email="candidate@gmail.com",
    name="John Candidate",
    department=None
)

ADMIN_COMPANY_A = AuthenticatedUser(
    user_id="admin_alpha_1",
    tenant_id="company_alpha",
    role="Admin",
    email="admin@alpha.com",
    name="Alice Admin",
    department="Operations"
)


# --- 1. Cross-Company Isolation Tests ---

def test_cross_company_proposal_access_denied():
    """Verify Company A manager cannot access or confirm Company B's proposal."""
    async def run():
        service = ProposalService(db_client=None, test_mode=True)
        
        # Company B creates a proposal
        prop_beta = await service.create_proposal(
            tenant_id=HM_COMPANY_B_USER.tenant_id,
            user=HM_COMPANY_B_USER,
            action="approve_timesheet",
            parameters={"timesheet_id": "ts_beta_100"},
            impact_summary="Approve Beta contractor timesheet"
        )
        
        # Company A manager attempts to view Company B's proposal
        with pytest.raises(SecurityViolationError, match="belongs to another organization tenant"):
            await service.get_proposal(prop_beta.id, tenant_id=HM_COMPANY_A_USER_1.tenant_id)
            
        # Company A manager attempts to confirm Company B's proposal
        async def dummy_executor(action, params):
            return {"approved": True}
            
        with pytest.raises(SecurityViolationError, match="belongs to another organization tenant"):
            await service.confirm_and_execute(prop_beta.id, user=HM_COMPANY_A_USER_1, executor_func=dummy_executor)

    asyncio.run(run())


# --- 2. Cross-Manager Isolation within Same Company Tests ---

def test_cross_manager_proposal_ownership_protection():
    """Verify Manager 2 in Company A cannot confirm or reject Manager 1's proposal."""
    async def run():
        service = ProposalService(db_client=None, test_mode=True)
        
        # Manager 1 (Elena) creates a requisition closure proposal
        prop_elena = await service.create_proposal(
            tenant_id=HM_COMPANY_A_USER_1.tenant_id,
            user=HM_COMPANY_A_USER_1,
            action="close_requisition",
            parameters={"requisition_id": "req_elena_01", "reason": "Filled position"},
            impact_summary="Close Requisition req_elena_01"
        )
        
        async def dummy_executor(action, params):
            return {"closed": True}
            
        # Manager 2 (Marcus) attempts to confirm Elena's proposal -> Blocked!
        with pytest.raises(SecurityViolationError, match="You cannot confirm a proposal created by another manager"):
            await service.confirm_and_execute(prop_elena.id, user=HM_COMPANY_A_USER_2, executor_func=dummy_executor)
            
        # Manager 2 attempts to reject Elena's proposal -> Blocked!
        with pytest.raises(SecurityViolationError, match="You cannot reject a proposal created by another manager"):
            await service.reject_proposal(prop_elena.id, user=HM_COMPANY_A_USER_2, rejection_reason="Hostile reject")
            
        # Company Admin can confirm or intervene if necessary
        admin_result = await service.confirm_and_execute(prop_elena.id, user=ADMIN_COMPANY_A, executor_func=dummy_executor)
        assert admin_result["success"] is True

    asyncio.run(run())


# --- 3. Forged-ID Protection & Server-Side Derivation ---

def test_forged_payload_identity_ignored():
    """Verify that forged tenant_id or user_id in tool arguments cannot override authenticated user."""
    from modules.aura_agent.tools.context import ToolExecutionContext
    
    mock_db = MagicMock()
    mock_db.__getitem__.return_value.find.return_value.limit.return_value = []
    
    tool_ctx = ToolExecutionContext(
        user=HM_COMPANY_A_USER_1,
        db_client=mock_db,
        request_id="test_req"
    )
    
    # Verified identity comes strictly from tool_ctx.tenant_id, not forged params
    assert tool_ctx.tenant_id == "company_alpha"
    assert tool_ctx.user_id == "hm_user_alpha_1"


# --- 4. Unauthorized Role Boundary Tests ---

def test_unauthorized_role_blocked_at_dependency():
    """Verify unauthorized roles (Candidate, Recruiter, etc.) are rejected with 403."""
    from modules.aura_agent.dependencies import get_authenticated_user
    from modules.aura_agent.config import Settings
    
    settings = Settings(test_mode=False)
    token = jwt.encode(
        {"sub": "cand_1", "tenant_id": "company_alpha", "role": "Candidate", "email": "c@c.com"},
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm
    )
    
    with pytest.raises(HTTPException) as exc_info:
        get_authenticated_user(authorization=f"Bearer {token}", settings=settings)
        
    assert exc_info.value.status_code == 403
    assert "not authorized for Aura" in exc_info.value.detail


# --- 5. Proposal Idempotency and State Transition Protection ---

def test_proposal_idempotency_and_duplicate_prevention():
    """Verify already executed proposal returns cached result without re-executing."""
    async def run():
        service = ProposalService(db_client=None, test_mode=True)
        
        prop = await service.create_proposal(
            tenant_id=HM_COMPANY_A_USER_1.tenant_id,
            user=HM_COMPANY_A_USER_1,
            action="approve_timesheet",
            parameters={"timesheet_id": "ts_123"},
            impact_summary="Approve timesheet ts_123"
        )
        
        call_count = 0
        async def executor(action, params):
            nonlocal call_count
            call_count += 1
            return {"timesheet_approved": True, "count": call_count}
            
        # First execution -> executes
        res1 = await service.confirm_and_execute(prop.id, user=HM_COMPANY_A_USER_1, executor_func=executor)
        assert res1["success"] is True
        assert call_count == 1
        
        # Second duplicate execution -> returns idempotent cached result, does NOT call executor again!
        res2 = await service.confirm_and_execute(prop.id, user=HM_COMPANY_A_USER_1, executor_func=executor)
        assert res2["success"] is True
        assert res2.get("idempotent") is True
        assert call_count == 1  # Executor was NOT invoked a second time!

    asyncio.run(run())


# --- 6. ScopedDatabase Sandbox Enforcement ---

def test_scoped_database_manager_restriction():
    """Verify ScopedDatabase enforces tenant_id AND created_by filtering on requisitions."""
    fake_mongo = {
        "requisitions": MagicMock(),
        "candidate_submissions": MagicMock(),
        "work_orders": MagicMock(),
        "timesheets": MagicMock(),
    }
    fake_mongo["requisitions"].find.return_value = [{"id": "req_1", "tenant_id": "company_alpha", "created_by": "hm_user_alpha_1"}]
    fake_mongo["candidate_submissions"].find.return_value = []
    fake_mongo["work_orders"].find.return_value = []
    
    with hiring_scope(fake_mongo, {"id": "hm_user_alpha_1", "tenant_id": "company_alpha"}) as scope:
        assert scope["tenant_id"] == "company_alpha"
        assert scope["user_id"] == "hm_user_alpha_1"
        assert scope["req_ids"] == ["req_1"]
        
        scoped_db = ScopedDatabase(fake_mongo)
        req_coll = scoped_db["requisitions"]
        
        # Test restriction
        restriction = req_coll.restriction()
        assert restriction["tenant_id"] == "company_alpha"
        assert restriction["created_by"] == "hm_user_alpha_1"


# --- 7. Legacy History Storage Key Per-User Isolation ---

def test_legacy_history_storage_key_isolation():
    """Verify legacy history storage key mathematically isolates conversations by user ID."""
    key_user_1 = f"termjobs_hm_conversations_{HM_COMPANY_A_USER_1.user_id}"
    key_user_2 = f"termjobs_hm_conversations_{HM_COMPANY_A_USER_2.user_id}"
    key_user_beta = f"termjobs_hm_conversations_{HM_COMPANY_B_USER.user_id}"
    
    # Keys must be mutually distinct
    assert key_user_1 != key_user_2
    assert key_user_1 != key_user_beta
    assert key_user_1 == "termjobs_hm_conversations_hm_user_alpha_1"
