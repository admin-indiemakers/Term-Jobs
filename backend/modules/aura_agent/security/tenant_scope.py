"""Tenant isolation enforcement and scoping utilities."""
from typing import Any, Dict


class SecurityViolationError(Exception):
    """Raised when cross-tenant boundary breach is detected."""
    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


def scope_query(query: Dict[str, Any], tenant_id: str) -> Dict[str, Any]:
    """Ensure a MongoDB query strictly filters by the authenticated tenant_id."""
    if not tenant_id:
        raise SecurityViolationError("Tenant ID cannot be empty when scoping database queries.")
    
    scoped = dict(query)
    # Never allow user-provided parameters to overwrite tenant_id
    scoped["tenant_id"] = tenant_id
    return scoped


def verify_tenant_ownership(document: Dict[str, Any], expected_tenant_id: str, resource_name: str = "record") -> None:
    """Verify that a retrieved MongoDB document belongs to the authenticated tenant."""
    if not document:
        return
    doc_tenant = document.get("tenant_id")
    if doc_tenant and doc_tenant != expected_tenant_id:
        raise SecurityViolationError(
            f"Access Denied: Attempted to access {resource_name} belonging to another organization tenant."
        )
