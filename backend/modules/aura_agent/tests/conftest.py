"""Test fixtures for Aura AI Assistant."""
import pytest
try:
    from modules.aura_agent.security.authentication import AuthenticatedUser
    from modules.aura_agent.security.authorization import check_action_permitted
    from modules.aura_agent.audit.logger import AuditLogger
    from modules.aura_agent.proposals.service import ProposalService
    from modules.aura_agent.tools.context import ToolExecutionContext
    from modules.aura_agent.tools.registry import registry
    import modules.aura_agent.tools.handlers
except ImportError:
    from backend.security.authentication import AuthenticatedUser
    from backend.security.authorization import check_action_permitted
    from backend.audit.logger import AuditLogger
    from backend.proposals.service import ProposalService
    from backend.tools.context import ToolExecutionContext
    from backend.tools.registry import registry
    import backend.tools.handlers


@pytest.fixture
def mock_user() -> AuthenticatedUser:
    return AuthenticatedUser(
        user_id="user_hm_test_01",
        tenant_id="tenant_enterprise_test_01",
        role="Hiring Manager",
        email="hm@enterprise.com",
        name="Elena Rostova",
        department="Engineering"
    )


@pytest.fixture
def mock_other_tenant_user() -> AuthenticatedUser:
    return AuthenticatedUser(
        user_id="user_hm_test_02",
        tenant_id="tenant_competing_corp_02",
        role="Hiring Manager",
        email="other@competing.com",
        name="Other HM",
        department="Product"
    )


@pytest.fixture
def audit_logger() -> AuditLogger:
    return AuditLogger(db_client=None, test_mode=True)


@pytest.fixture
def proposal_service() -> ProposalService:
    return ProposalService(db_client=None, test_mode=True)


@pytest.fixture
def tool_context(mock_user, audit_logger, proposal_service) -> ToolExecutionContext:
    return ToolExecutionContext(
        user=mock_user,
        db_client=None,
        audit_logger=audit_logger,
        proposal_service=proposal_service,
        request_id="test_req_001"
    )
