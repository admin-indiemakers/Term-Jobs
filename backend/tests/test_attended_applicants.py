import mongomock
from modules.interview.domain.applicants import attended_applicants


def test_only_completed_interview_qualifies_and_is_scoped_to_requisition():
    db = mongomock.MongoClient().test
    rows = [{'id': 'a', 'requisition_id': 'req', 'candidate_email': 'a@example.com'},
            {'id': 'b', 'requisition_id': 'req', 'candidate_email': 'b@example.com'},
            {'id': 'c', 'requisition_id': 'req', 'candidate_email': 'c@example.com'}]
    db.interview_rounds.insert_many([
        {'candidate_submission_id': 'a', 'requisition_id': 'req', 'status': 'In Progress'},
        {'candidate_submission_id': 'b', 'requisition_id': 'req', 'status': 'Completed'},
        {'candidate_email': 'c@example.com', 'requisition_id': 'other', 'status': 'Completed'},
    ])
    assert attended_applicants(db, rows) == [rows[1]]


def test_legacy_submission_id_matches_email_only_for_same_requisition():
    db = mongomock.MongoClient().test
    row = {'id': 'new', 'requisition_id': 'req', 'candidate_email': 'Name@Example.com'}
    db.interview_rounds.insert_one({'candidate_submission_id': 'old', 'candidate_email': 'name@example.com', 'requisition_id': 'req', 'status': 'Completed'})
    assert attended_applicants(db, [row]) == [row]
