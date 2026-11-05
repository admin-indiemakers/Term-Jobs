"""Tests for authentication, authorization, and tenant isolation."""
import pytest
from modules.aura_agent.security.authentication import (
    AuthenticatedUser,
    AuthenticationError,
    authenticate_bearer_token
)
from modules.aura_agent.security.authorization import (
    AuthorizationError,
    check_action_permitted,
    PROHIBITED_HM_OPERATIONS
)
from modules.aura_agent.security.tenant_scope import (
    SecurityViolationError,
    scope_query,
    verify_tenant_ownership
)


def test_missing_auth_header_raises_error():
    with pytest.raises(AuthenticationError) as exc_info:
        authenticate_bearer_token(None, secret_key="test_key", test_mode=False)
    assert exc_info.value.status_code == 401


def test_invalid_bearer_format_raises_error():
    with pytest.raises(AuthenticationError) as exc_info:
        authenticate_bearer_token("Basic 12345", secret_key="test_key", test_mode=False)
    assert "Expected 'Bearer <token>'" in str(exc_info.value)


def test_test_mode_auth_fallback():
    user = authenticate_bearer_token(None, secret_key="test_key", test_mode=True)
    assert user.user_id == "test_user_hm_01"
    assert user.is_hiring_manager is True


@pytest.mark.parametrize("prohibited_op", list(PROHIBITED_HM_OPERATIONS))
def test_prohibited_operations_blocked(prohibited_op):
    with pytest.raises(AuthorizationError) as exc_info:
        check_action_permitted(prohibited_op, "Hiring Manager")
    assert "strictly prohibited" in str(exc_info.value)


def test_allowed_operation_passes():
    # Should not raise
    check_action_permitted("list_requisitions", "Hiring Manager")
    check_action_permitted("shortlist_candidate", "Hiring Manager")


def test_scope_query_injects_tenant():
    base_query = {"status": "OPEN", "department": "Engineering"}
    scoped = scope_query(base_query, "tenant_corp_01")
    assert scoped["tenant_id"] == "tenant_corp_01"
    assert scoped["status"] == "OPEN"


def test_scope_query_overwrites_forged_tenant():
    forged_query = {"tenant_id": "evil_competitor", "status": "OPEN"}
    scoped = scope_query(forged_query, "tenant_corp_01")
    assert scoped["tenant_id"] == "tenant_corp_01"


def test_verify_tenant_ownership_detects_breach():
    foreign_doc = {"id": "req_1", "tenant_id": "tenant_other"}
    with pytest.raises(SecurityViolationError):
        verify_tenant_ownership(foreign_doc, "tenant_corp_01")
