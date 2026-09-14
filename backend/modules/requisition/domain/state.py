"""State machine for the requisition lifecycle.

Draft -> Intake -> Structuring -> PendingApproval -> Published -> Closed

The conversational intake phase is its own state (Intake), reflecting the
AI-driven JD generation flow. Rejection anywhere before Publish returns to
Draft so the manager can re-run intake/generation.
"""
from .schemas import RequisitionStatus

_TRANSITIONS: dict[RequisitionStatus, set[RequisitionStatus]] = {
    RequisitionStatus.DRAFT: {RequisitionStatus.INTAKE},
    RequisitionStatus.INTAKE: {
        RequisitionStatus.INTAKE,  # another intake turn
        RequisitionStatus.STRUCTURING,
        RequisitionStatus.DRAFT,
    },
    RequisitionStatus.STRUCTURING: {
        RequisitionStatus.PENDING_APPROVAL,
        RequisitionStatus.DRAFT,
    },
    RequisitionStatus.PENDING_APPROVAL: {
        RequisitionStatus.PUBLISHED,
        RequisitionStatus.STRUCTURING,
        RequisitionStatus.DRAFT,
    },
    RequisitionStatus.PUBLISHED: {RequisitionStatus.CLOSED},
    RequisitionStatus.CLOSED: set(),
}


class InvalidTransition(Exception):
    def __init__(self, frm: RequisitionStatus, to: RequisitionStatus) -> None:
        self.frm = frm
        self.to = to
        super().__init__(f"Invalid transition: {frm.value} -> {to.value}")


def can_transition(frm: RequisitionStatus, to: RequisitionStatus) -> bool:
    return to in _TRANSITIONS[frm]


class StateMachine:
    def __init__(self, status: RequisitionStatus) -> None:
        self.status = status

    def transition(self, to: RequisitionStatus) -> RequisitionStatus:
        if not can_transition(self.status, to):
            raise InvalidTransition(self.status, to)
        self.status = to
        return self.status
