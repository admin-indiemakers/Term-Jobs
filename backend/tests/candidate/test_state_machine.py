import pytest
from backend.modules.candidate.domain.models import Submission, SubmissionStatus
from backend.modules.candidate.domain.state_machine import SubmissionStateMachine, InvalidStateTransitionException

def test_valid_state_transitions():
    sub = Submission(
        id="sub_001",
        candidate_id="cand_001",
        requisition_id="req_001",
        status=SubmissionStatus.SUBMITTED
    )

    # Submitted -> Screened
    sub = SubmissionStateMachine.transition(sub, SubmissionStatus.SCREENED)
    assert sub.status == SubmissionStatus.SCREENED

    # Screened -> Shortlisted
    sub = SubmissionStateMachine.transition(sub, SubmissionStatus.SHORTLISTED)
    assert sub.status == SubmissionStatus.SHORTLISTED

    # Shortlisted -> InterviewScheduled
    sub = SubmissionStateMachine.transition(sub, SubmissionStatus.INTERVIEW_SCHEDULED)
    assert sub.status == SubmissionStatus.INTERVIEW_SCHEDULED

    # InterviewScheduled -> InterviewCompleted
    sub = SubmissionStateMachine.transition(sub, SubmissionStatus.INTERVIEW_COMPLETED)
    assert sub.status == SubmissionStatus.INTERVIEW_COMPLETED

    # InterviewCompleted -> Selected
    sub = SubmissionStateMachine.transition(sub, SubmissionStatus.SELECTED)
    assert sub.status == SubmissionStatus.SELECTED

def test_invalid_state_transition_raises_exception():
    sub = Submission(
        id="sub_002",
        candidate_id="cand_002",
        requisition_id="req_001",
        status=SubmissionStatus.SUBMITTED
    )

    # Cannot skip directly from Submitted to InterviewScheduled
    with pytest.raises(InvalidStateTransitionException):
        SubmissionStateMachine.transition(sub, SubmissionStatus.INTERVIEW_SCHEDULED)

def test_rejection_from_any_active_state():
    for active_status in [
        SubmissionStatus.SUBMITTED,
        SubmissionStatus.SCREENED,
        SubmissionStatus.SHORTLISTED,
        SubmissionStatus.INTERVIEW_SCHEDULED,
        SubmissionStatus.INTERVIEW_COMPLETED,
    ]:
        sub = Submission(
            id=f"sub_{active_status.value}",
            candidate_id="cand_test",
            requisition_id="req_test",
            status=active_status
        )
        updated = SubmissionStateMachine.transition(sub, SubmissionStatus.REJECTED)
        assert updated.status == SubmissionStatus.REJECTED
