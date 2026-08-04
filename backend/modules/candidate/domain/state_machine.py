from datetime import datetime
from typing import Dict, Set
from backend.modules.candidate.domain.models import Submission, SubmissionStatus

class InvalidStateTransitionException(Exception):
    """Raised when an invalid submission state transition is attempted."""
    pass

class SubmissionStateMachine:
    """
    State machine for Candidate Submission lifecycle:
    Submitted -> Screened -> Shortlisted -> InterviewScheduled -> InterviewCompleted -> Selected/Rejected
    """
    
    VALID_TRANSITIONS: Dict[SubmissionStatus, Set[SubmissionStatus]] = {
        SubmissionStatus.SUBMITTED: {SubmissionStatus.SCREENED, SubmissionStatus.REJECTED},
        SubmissionStatus.SCREENED: {SubmissionStatus.SHORTLISTED, SubmissionStatus.REJECTED},
        SubmissionStatus.SHORTLISTED: {SubmissionStatus.INTERVIEW_SCHEDULED, SubmissionStatus.REJECTED},
        SubmissionStatus.INTERVIEW_SCHEDULED: {SubmissionStatus.INTERVIEW_COMPLETED, SubmissionStatus.REJECTED},
        SubmissionStatus.INTERVIEW_COMPLETED: {SubmissionStatus.SELECTED, SubmissionStatus.REJECTED},
        SubmissionStatus.REJECTED: set(),  # Terminal state
        SubmissionStatus.SELECTED: set(),  # Terminal state
    }

    @classmethod
    def can_transition(cls, current_status: SubmissionStatus, target_status: SubmissionStatus) -> bool:
        allowed = cls.VALID_TRANSITIONS.get(current_status, set())
        return target_status in allowed

    @classmethod
    def transition(cls, submission: Submission, target_status: SubmissionStatus) -> Submission:
        if not cls.can_transition(submission.status, target_status):
            raise InvalidStateTransitionException(
                f"Cannot transition submission {submission.id} from '{submission.status.value}' to '{target_status.value}'."
            )
        submission.status = target_status
        submission.updated_at = datetime.utcnow()
        return submission
