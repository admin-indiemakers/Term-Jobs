from types import SimpleNamespace
import mongomock

from modules.hiring_dashboard import hiring_counts
from modules.shared.db import Session
from modules.interview.services import interview_service


def test_counts_keep_ownership_and_verified_shortlist_without_exposing_details():
    db = mongomock.MongoClient().dashboard
    user = SimpleNamespace(id='manager', tenant_id='company')
    db.requisitions.insert_many([
        {'id': 'mine', 'tenant_id': 'company', 'created_by': 'manager', 'status': 'Published'},
        {'id': 'other', 'tenant_id': 'company', 'created_by': 'someone', 'status': 'Published'},
        {'id': 'foreign', 'tenant_id': 'another', 'created_by': 'manager', 'status': 'Published'},
    ])
    db.candidate_submissions.insert_many([
        {'id': 'verified', 'requisition_id': 'mine', 'status': 'Shortlisted', 'resume_text': 'private'},
        {'id': 'unverified', 'requisition_id': 'mine', 'status': 'Shortlisted'},
        {'id': 'manual', 'requisition_id': 'mine', 'status': 'Screened', 'manual_shortlist': True},
        {'id': 'accepted', 'requisition_id': 'mine', 'status': 'Accepted'},
        {'id': 'other', 'requisition_id': 'other', 'status': 'Accepted'},
        {'id': 'foreign', 'requisition_id': 'foreign', 'status': 'Accepted'},
    ])
    db.interview_rounds.insert_one({'requisition_id': 'mine', 'candidate_submission_id': 'verified', 'status': 'Completed'})
    db.onboarding_issues.insert_many([
        {'candidate_id': 'accepted', 'status': 'Open'},
        {'candidate_id': 'other', 'status': 'Open'},
        {'candidate_id': 'accepted', 'status': 'Resolved'},
    ])
    result = hiring_counts(db, user, {'pending_timesheets': 2, 'pending_expenses': 1})
    assert result == {'requisitions': 1, 'candidates': 3, 'shortlisted': 2, 'accepted': 1,
                      'openIssues': 1, 'pendingTimesheets': 2, 'pendingExpenses': 1}
    assert hiring_counts(db, SimpleNamespace(id='nobody', tenant_id='company'), {})['candidates'] == 0


def test_compact_interviews_exclude_private_fields_history_and_other_managers(monkeypatch):
    db = mongomock.MongoClient().interviews
    monkeypatch.setattr(interview_service, 'get_session', lambda: Session(db))
    db.requisitions.insert_many([
        {'id': 'mine', 'tenant_id': 'company', 'created_by': 'manager'},
        {'id': 'other', 'tenant_id': 'company', 'created_by': 'someone'},
    ])
    for identity, req, status in [('upcoming', 'mine', 'Scheduled'), ('past', 'mine', 'Completed'), ('hidden', 'other', 'Scheduled')]:
        db.interview_rounds.insert_one({'id': identity, 'tenant_id': 'company', 'requisition_id': req,
                                      'status': status, 'scheduled_date': '2099-01-01',
                                      'candidate_submission_id': 'candidate', 'transcript': 'private',
                                      'candidate_token': 'secret', 'email_delivery': {'error': 'internal'}})
    rows = interview_service.get_hiring_manager_rounds(tenant_id='company', user_id='manager', user_role='Hiring Manager', dashboard=True)
    assert [row['id'] for row in rows] == ['upcoming']
    assert rows[0]['scheduled_date'] == '2099-01-01'
    assert not {'transcript', 'candidate_token', 'email_delivery'} & rows[0].keys()


def load_main_function(name, database):
    # Load the endpoint without starting main.py's background workers.
    import ast
    from pathlib import Path
    from unittest.mock import Mock
    from fastapi import Depends, HTTPException
    from modules.requisition.domain import models
    tree = ast.parse((Path(__file__).parents[1] / 'main.py').read_text())
    function = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == name)
    function.decorator_list = []
    namespace = {'User': object, 'Depends': Depends, 'get_current_user': lambda: None,
                 'HTTPException': HTTPException, '_cache': SimpleNamespace(get=lambda key: None, set=Mock()),
                 '_auto_close_expired': lambda: None, 'get_session': lambda: Session(database),
                 'models': models, '_format_datetime': str}
    exec(compile(ast.Module(body=[function], type_ignores=[]), 'main.py', 'exec'), namespace)
    return namespace[name]


def test_requisition_cards_use_projected_display_fields_and_keep_owner_scope():
    db = mongomock.MongoClient().requisitions
    db.requisitions.insert_many([
        {'id': 'mine', 'tenant_id': 'company', 'created_by': 'manager', 'title': 'Developer',
         'generated_jd_markdown': 'large job description', 'intake_answers': ['private'],
         'structured_role': {'department': 'Engineering', 'primary_location': 'Remote',
                             'headcount': 2, 'job_description': 'large role text'}},
        {'id': 'other', 'tenant_id': 'company', 'created_by': 'someone'},
    ])
    endpoint = load_main_function('list_requisitions', db)
    rows = endpoint(dashboard=True, current_user=SimpleNamespace(id='manager', tenant_id='company', role='Hiring Manager'))
    assert [row['id'] for row in rows] == ['mine']
    assert rows[0]['department'] == 'Engineering'
    assert rows[0]['primary_location'] == 'Remote'
    assert rows[0]['headcount'] == 2
    assert not {'structured_role', 'intake_answers', 'generated_jd_markdown'} & rows[0].keys()


def test_counts_endpoint_rejects_unrelated_roles_and_missing_company():
    import pytest
    from fastapi import HTTPException
    endpoint = load_main_function('hiring_manager_counts', mongomock.MongoClient().empty)
    for user in [SimpleNamespace(role='Candidate', tenant_id='company', id='candidate'),
                 SimpleNamespace(role='Hiring Manager', tenant_id=None, id='manager')]:
        with pytest.raises(HTTPException) as error:
            endpoint(user)
        assert error.value.status_code == 403
