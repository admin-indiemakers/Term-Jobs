"""Security package exports."""
from .authentication import AuthenticatedUser, AuthenticationError, authenticate_bearer_token, decode_token
from .authorization import AuthorizationError, check_action_permitted, get_boundary_explanation, PROHIBITED_HM_OPERATIONS
from .tenant_scope import SecurityViolationError, scope_query, verify_tenant_ownership

__all__ = [
    "AuthenticatedUser",
    "AuthenticationError",
    "authenticate_bearer_token",
    "decode_token",
    "AuthorizationError",
    "check_action_permitted",
    "get_boundary_explanation",
    "PROHIBITED_HM_OPERATIONS",
    "SecurityViolationError",
    "scope_query",
    "verify_tenant_ownership"
]
