import pytest

from modules.requisition.domain.schemas import RequisitionStatus
from modules.requisition.domain.state import InvalidTransition, StateMachine, can_transition

ALL = list(RequisitionStatus)


@pytest.mark.parametrize(
    "frm,to,expected",
    [
        (RequisitionStatus.DRAFT, RequisitionStatus.INTAKE, True),
        (RequisitionStatus.DRAFT, RequisitionStatus.PUBLISHED, False),
        (RequisitionStatus.INTAKE, RequisitionStatus.INTAKE, True),
        (RequisitionStatus.INTAKE, RequisitionStatus.STRUCTURING, True),
        (RequisitionStatus.INTAKE, RequisitionStatus.DRAFT, True),
        (RequisitionStatus.STRUCTURING, RequisitionStatus.PENDING_APPROVAL, True),
        (RequisitionStatus.STRUCTURING, RequisitionStatus.PUBLISHED, False),
        (RequisitionStatus.PENDING_APPROVAL, RequisitionStatus.PUBLISHED, True),
        (RequisitionStatus.PENDING_APPROVAL, RequisitionStatus.DRAFT, True),
        (RequisitionStatus.PUBLISHED, RequisitionStatus.CLOSED, True),
        (RequisitionStatus.PUBLISHED, RequisitionStatus.PENDING_APPROVAL, False),
        (RequisitionStatus.CLOSED, RequisitionStatus.PUBLISHED, False),
        (RequisitionStatus.CLOSED, RequisitionStatus.DRAFT, False),
    ],
)
def test_transitions(frm, to, expected):
    assert can_transition(frm, to) is expected


def test_state_machine_advances():
    sm = StateMachine(RequisitionStatus.DRAFT)
    sm.transition(RequisitionStatus.INTAKE)
    assert sm.status == RequisitionStatus.INTAKE


def test_state_machine_rejects_invalid():
    sm = StateMachine(RequisitionStatus.CLOSED)
    with pytest.raises(InvalidTransition):
        sm.transition(RequisitionStatus.PUBLISHED)


def test_terminal_state_is_closed():
    # Only Published may transition to Closed.
    for status in ALL:
        assert can_transition(status, RequisitionStatus.CLOSED) is (status == RequisitionStatus.PUBLISHED)
