"""Enforce persisted submission deadlines at approval/publishing boundaries."""
from ...shared.db import _utcnow
from ..domain.deadline import submission_deadline_passed


class DeadlineExpired(ValueError):
    pass


def enforce_approval_deadline(session, requisition):
    role = requisition.structured_role or (requisition.intake_meta or {}).get('prefill') or {}
    if submission_deadline_passed(role):
        requisition.status = 'Closed'
        requisition.updated_at = _utcnow()
        session.commit()
        raise DeadlineExpired('The submission deadline has passed. This requisition is closed and cannot be submitted or approved.')
    if str(requisition.status).lower() == 'closed':
        raise DeadlineExpired('This requisition is closed and cannot be submitted or approved.')
