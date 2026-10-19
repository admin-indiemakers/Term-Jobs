import mongomock
import pytest
from modules.hiring_manager_agent.applications import application_reply
from modules.hiring_manager_agent.scope import ScopedDatabase, hiring_scope


def reply(prompt):
    database = mongomock.MongoClient().db
    database.requisitions.insert_many([
        {'id': 'open', 'title': 'Backend Engineer', 'status': 'Published', 'tenant_id': 'company', 'created_by': 'hm'},
        {'id': 'closed', 'title': 'Designer', 'status': 'Closed', 'tenant_id': 'company', 'created_by': 'hm'},
        {'id': 'other', 'title': 'Engineer', 'status': 'Published', 'tenant_id': 'company', 'created_by': 'someone'},
    ])
    database.candidate_submissions.insert_many([
        {'id': 'a1', 'candidate_name': 'Applied Person', 'requisition_id': 'open', 'status': 'Applied', 'match_score': 0},
        {'id': 'a2', 'candidate_name': 'Shortlisted Person', 'requisition_id': 'open', 'status': 'Shortlisted'},
        {'id': 'a3', 'candidate_name': 'Closed Person', 'requisition_id': 'closed', 'status': 'Applied'},
        {'id': 'a4', 'candidate_name': 'Other Manager Person', 'requisition_id': 'other', 'status': 'Applied'},
        {'id': 'a5', 'candidate_name': 'Foreign Person', 'requisition_id': 'open', 'tenant_id': 'foreign', 'status': 'Applied'},
    ])
    with hiring_scope(database, {'id': 'hm', 'tenant_id': 'company'}):
        return application_reply(prompt, ScopedDatabase(database))


def test_applications_include_all_stages_and_preserve_scope():
    result = reply('give me a list of candidates that have applied')
    assert {row['id'] for row in result['executed_actions'][0]['result']} == {'a1', 'a2', 'a3'}
    assert 'Not recorded' in result['reply']
    assert '| 0 |' in result['reply']


def test_open_applications_with_interview_details_do_not_route_to_calendar():
    result = reply('Please provide a comprehensive fully detailed list of all candidates who have applied for the open job requisition. Include interview feedback, scores and compliance tracking.')
    assert {row['id'] for row in result['executed_actions'][0]['result']} == {'a1', 'a2'}
    assert 'scheduled interviews' not in result['reply']


def test_named_requisition_filters_applications():
    result = reply('List all applications for Backend Engineer')
    assert {row['id'] for row in result['executed_actions'][0]['result']} == {'a1', 'a2'}


def test_unknown_role_requires_clarification():
    assert reply('List applications for Accountant')['executed_actions'] == []


@pytest.mark.parametrize('prompt', ['Show my scheduled interviews', 'Show shortlisted candidates', 'schedule interview with the applicant'])
def test_other_intents_not_intercepted(prompt):
    assert reply(prompt) is None
