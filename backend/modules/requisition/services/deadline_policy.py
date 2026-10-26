"""Enforce persisted submission deadlines at approval/publishing boundaries."""
from ...shared.db import _utcnow
from ..domain.deadline import submission_deadline_passed, validate_submission_deadline


class DeadlineExpired(ValueError):
    pass


def enforce_approval_deadline(session, requisition, *, allow_resubmission=False):
    role = requisition.structured_role or (requisition.intake_meta or {}).get('prefill') or {}
    if submission_deadline_passed(role):
        requisition.status = 'Closed'
        requisition.updated_at = _utcnow()
        session.commit()
        raise DeadlineExpired('The submission deadline has passed. This requisition is closed and cannot be submitted or approved.')
    if allow_resubmission and submission_deadline_passed({'submission_deadline': role.get('ends_on')}):
        raise DeadlineExpired('The requisition end date has passed. Update it before resubmitting.')
    if str(requisition.status).lower() == 'closed':
        was_rejected = any(getattr(requisition, field, None) for field in ('rejection_reason', 'rejected_by', 'rejected_at'))
        if allow_resubmission and was_rejected and role.get('submission_deadline'):
            try:
                validate_submission_deadline(role['submission_deadline'])
            except ValueError as exc:
                raise DeadlineExpired(str(exc)) from exc
            return
        raise DeadlineExpired('This requisition is closed and cannot be submitted or approved.')
