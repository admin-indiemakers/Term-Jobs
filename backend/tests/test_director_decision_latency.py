"""Decisions persist without executing notifications, intake, or detail aggregation."""
from types import SimpleNamespace
from unittest.mock import Mock
import mongomock
import pytest
from fastapi import BackgroundTasks, HTTPException
from tests.test_requisition_expiry import handlers, today


def setup():
    database = mongomock.MongoClient().decisions
    database.requisitions.insert_one({'id': 'req', 'tenant_id': 'company', 'status': 'Pending Approval',
        'structured_role': {'submission_deadline': today().isoformat()}})
    context = handlers(database)
    context['notify_requisition_published'] = Mock()
    context['_async_trigger_top_candidate_outreach'] = Mock()
    context['_requisition_dict'] = Mock(side_effect=AssertionError('Slow detail aggregation must not run'))
    user = SimpleNamespace(role='Director', name='Director Name', email='director@example.com', tenant_id='company')
    return database, context, user


def test_approval_returns_saved_decision_and_defers_fanout():
    database, context, user = setup()
    tasks = BackgroundTasks()
    result = context['director_approve_requisition']('req', background_tasks=tasks, current_user=user)
    saved = database.requisitions.find_one({'id': 'req'})
    assert saved['status'] == result['status'] == 'Published'
    assert saved['director_approved'] is True
    assert result['director_approved_by'] == user.name
    context['notify_requisition_published'].assert_not_called()
    context['_async_trigger_top_candidate_outreach'].assert_not_called()
    context['service'].publish.assert_not_called()
    assert len(tasks.tasks) == 2


def test_rejection_records_decision_without_running_intake():
    database, context, user = setup()
    result = context['reject_requisition']('req', SimpleNamespace(reviewer=user.name, reason='Revise budget'), current_user=user)
    assert result['status'] == 'Restructuring'
    assert database.requisitions.find_one({'id': 'req'})['rejection_reason'] == 'Revise budget'
    context['service'].reject.assert_not_called()
    context['service']._record_review.assert_called_once_with('req', user.name, 'rejected')


def test_unauthorized_rejection_does_not_change_record():
    database, context, user = setup()
    user.role = 'Hiring Manager'
    with pytest.raises(HTTPException) as error:
        context['reject_requisition']('req', current_user=user)
    assert error.value.status_code == 403
    assert database.requisitions.find_one({'id': 'req'})['status'] == 'Pending Approval'
