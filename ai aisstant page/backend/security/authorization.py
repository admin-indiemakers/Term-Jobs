"""Role-Based Access Control and hard role boundary enforcement."""
from typing import Set


class AuthorizationError(Exception):
    """Raised when an operation is outside the user's permitted role scope."""
    def __init__(self, message: str, status_code: int = 403):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


# Explicit list of enterprise actions that a Hiring Manager is PROHIBITED from executing
PROHIBITED_HM_OPERATIONS: Set[str] = {
    "onboard_vendor",
    "onboard_company",
    "countersign_msa",
    "execute_payout",
    "generate_utr",
    "create_billing_line_item",
    "change_sow_billing_terms",
    "override_commission_rates",
    "delete_audit_logs",
    "manage_tenant_billing"
}

ROLE_BOUNDARY_EXPLANATIONS = {
    "onboard_vendor": "Vendor onboarding and vetting must be initiated and approved by the Super Admin team to ensure compliance with master service policies.",
    "onboard_company": "Tenant and organization provisioning is restricted to Platform Super Administrators.",
    "countersign_msa": "Executing or countersigning Master Services Agreements (MSAs) requires corporate legal authorization by an authorized Director or Legal Officer.",
    "execute_payout": "Direct financial payout disbursements and banking transactions are managed exclusively by the Enterprise Finance & Accounts Payable team.",
    "generate_utr": "UTR (Unique Transaction Reference) generation occurs through the automated banking gateway managed by Finance.",
    "create_billing_line_item": "Vendor invoicing and billing modifications are handled by Finance and Procurement.",
    "change_sow_billing_terms": "SOW contractual and financial rate schedule amendments require Procurement and Director approval.",
    "override_commission_rates": "Commission structures are governed by platform agency terms under Super Admin jurisdiction."
}


def check_action_permitted(action_name: str, user_role: str) -> None:
    """Verify that the requested action does not breach role boundaries."""
    normalized_action = action_name.lower().strip()
    if normalized_action in PROHIBITED_HM_OPERATIONS:
        explanation = ROLE_BOUNDARY_EXPLANATIONS.get(
            normalized_action,
            "This action exceeds the authorized operational envelope of the Hiring Manager role."
        )
        raise AuthorizationError(
            f"Operation '{action_name}' is strictly prohibited for the '{user_role}' role. {explanation}"
        )


def get_boundary_explanation(action_name: str) -> str:
    """Return a polite, professional explanation of why an action is restricted."""
    normalized_action = action_name.lower().strip()
    return ROLE_BOUNDARY_EXPLANATIONS.get(
        normalized_action,
        "This operation is restricted to Super Admin, Legal, or Finance personnel."
    )
