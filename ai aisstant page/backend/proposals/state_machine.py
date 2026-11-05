"""State machine enforcing valid transitions for proposals."""
from typing import Dict, Set
from .models import ProposalDocument, ProposalState


class ProposalStateError(Exception):
    """Raised when an illegal proposal state transition is attempted."""
    def __init__(self, message: str, current_state: ProposalState, target_state: ProposalState):
        super().__init__(message)
        self.message = message
        self.current_state = current_state
        self.target_state = target_state


# Directed Acyclic Graph of allowed lifecycle transitions
VALID_TRANSITIONS: Dict[ProposalState, Set[ProposalState]] = {
    ProposalState.PENDING: {
        ProposalState.CONFIRMED,
        ProposalState.REJECTED,
        ProposalState.EXPIRED,
        ProposalState.FAILED
    },
    ProposalState.CONFIRMED: {
        ProposalState.EXECUTING,
        ProposalState.FAILED
    },
    ProposalState.EXECUTING: {
        ProposalState.EXECUTED,
        ProposalState.FAILED
    },
    ProposalState.EXECUTED: set(),  # Terminal state
    ProposalState.REJECTED: set(),  # Terminal state
    ProposalState.EXPIRED: set(),   # Terminal state
    ProposalState.FAILED: set()     # Terminal state
}


def transition_proposal(proposal: ProposalDocument, target_state: ProposalState) -> None:
    """Validate and perform a state transition on a proposal."""
    # Check expiry first
    if proposal.state == ProposalState.PENDING and proposal.is_expired():
        proposal.state = ProposalState.EXPIRED
        if target_state != ProposalState.EXPIRED:
            raise ProposalStateError(
                f"Proposal {proposal.id} has expired and cannot transition to {target_state.value}",
                current_state=ProposalState.EXPIRED,
                target_state=target_state
            )

    allowed = VALID_TRANSITIONS.get(proposal.state, set())
    if target_state not in allowed:
        raise ProposalStateError(
            f"Illegal state transition from {proposal.state.value} to {target_state.value}",
            current_state=proposal.state,
            target_state=target_state
        )

    proposal.state = target_state
