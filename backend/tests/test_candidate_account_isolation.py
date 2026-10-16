from types import SimpleNamespace
import mongomock
import pytest


@pytest.fixture
def candidates(monkeypatch):
    from modules.candidate import router
    import importlib
    persistence = importlib.import_module("modules.shared.db")
    from modules.shared.cache import cache
    database = mongomock.MongoClient().isolation
    monkeypatch.setattr(persistence, 'db', database)
    cache.clear()
    database.requisitions.insert_many([
        {'id': 'req-a', 'tenant_id': 'company', 'created_by': 'manager-a'},
        {'id': 'req-b', 'tenant_id': 'company', 'created_by': 'manager-b'},
    ])
    database.candidate_submissions.insert_many([
        {'id': 'sub-a', 'requisition_id': 'req-a', 'candidate_email': 'same@example.com', 'status': 'Shortlisted'},
        {'id': 'sub-b', 'requisition_id': 'req-b', 'candidate_email': 'same@example.com', 'status': 'Shortlisted'},
    ])
    database.interview_rounds.insert_one({
        'id': 'round-b', 'requisition_id': 'req-b', 'candidate_email': 'same@example.com',
        'candidate_submission_id': 'sub-b', 'status': 'Completed', 'score': 95,
    })
    return router, database


def manager(id='manager-a', tenant='company'):
    return SimpleNamespace(id=id, tenant_id=tenant, role='Hiring Manager')


def test_list_only_contains_manager_requisition_candidates(candidates):
    router, _ = candidates
    rows = router._fetch_candidate_submissions_mongo({}, manager())
    assert [r['id'] for r in rows] == ['sub-a']
    assert rows[0].get('round_id') != 'round-b'
    assert rows[0].get('round_status') != 'Completed'
    assert router._fetch_candidate_submissions_mongo({}, manager('new-manager')) == []
    assert router._fetch_candidate_submissions_mongo({}, manager(tenant=None)) == []


def test_same_email_in_other_requisition_does_not_verify_shortlist(candidates):
    router, _ = candidates
    assert router.list_shortlisted(manager()) == []
    assert [c['id'] for c in router.list_shortlisted(manager('manager-b'))] == ['sub-b']


def test_manager_cannot_change_another_managers_candidate(candidates):
    from fastapi import HTTPException
    router, database = candidates
    with pytest.raises(HTTPException) as error:
        router.update_submission_status('sub-b', {'status': 'Rejected'}, manager())
    assert error.value.status_code == 403
    assert database.candidate_submissions.find_one({'id': 'sub-b'})['status'] == 'Shortlisted'


def test_deleting_foreign_candidate_cannot_remove_other_company_records(candidates):
    from fastapi import HTTPException
    router, database = candidates
    database.requisitions.update_one({'id': 'req-b'}, {'$set': {'tenant_id': 'foreign'}})
    with pytest.raises(HTTPException) as error:
        router.delete_candidate_submission('sub-b', manager())
    assert error.value.status_code == 404
    assert database.candidate_submissions.count_documents({'id': 'sub-b'}) == 1


def test_company_admin_cannot_download_another_company_resume(candidates):
    from fastapi import HTTPException
    router, database = candidates
    database.requisitions.update_one({'id': 'req-b'}, {'$set': {'tenant_id': 'foreign'}})
    database.candidate_submissions.update_one({'id': 'sub-b'}, {'$set': {'resume_pdf': 'c2VjcmV0'}})
    user = SimpleNamespace(id='admin', tenant_id='company', role='Admin')
    with pytest.raises(HTTPException) as error:
        router.get_candidate_resume('sub-b', user)
    assert error.value.status_code == 404
