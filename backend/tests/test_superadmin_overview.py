from contextvars import ContextVar
from datetime import datetime, timedelta, timezone

import mongomock
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from modules.identity.domain.models import User
from modules.identity.router import get_current_user
from modules.superadmin_agent import overview


@pytest.fixture
def setup(monkeypatch):
    db = mongomock.MongoClient().db
    monkeypatch.setattr(overview, 'db', db)
    overview.cache.clear()
    app = FastAPI()
    app.include_router(overview.router)
    app.dependency_overrides[get_current_user] = lambda: User(id='admin', role='Super Admin')
    return db, app, TestClient(app)


def test_overview_counts_match_pool_identity_and_source_precedence(setup):
    db, _, client = setup
    now = datetime.now(timezone.utc)
    private = 'PRIVATE-RESUME-' * 10000
    db.tenants.insert_many([
        {'id': 'client', 'tenant_type': 'client', 'name': 'Buyer', 'created_at': now},
        {'id': 'vendor', 'tenant_type': 'consultancy', 'name': 'Agency', 'is_guest': True, 'created_at': now},
    ])
    db.users.insert_many([{'id': 'admin', 'role': 'Admin', 'tenant_id': 'client', 'password_hash': 'secret'},
                          {'id': 'recruiter', 'role': 'Recruiter'}, {'id': 'root', 'role': 'Super Admin'}])
    db.candidates.insert_many([
        {'id': 'a', 'candidate_email': ' PERSON@example.test ', 'vendor_name': 'Direct Applicant', 'created_at': now, 'resume_pdf': private},
        {'id': 'old', 'candidate_email': 'person@example.test', 'vendor_name': 'Agency', 'created_at': now - timedelta(days=1)},
    ])
    db.candidate_submissions.insert_many([
        {'id': 's1', 'candidate_email': 'person@example.test', 'vendor_name': 'Agency', 'resume_pdf': private},
        {'id': 's2', 'candidate_email': 'vendor@example.test', 'vendor_name': 'Agency'},
        {'id': 's3', 'candidate_id': 'no-email', 'vendor_name': 'Portal Registration'},
        {'id': 's4', 'candidate_id': 'no-email', 'vendor_name': 'Agency'},
    ])
    db.candidate_outreach.insert_many([{'status': 'interested'}, {'status': 'declined'}, {'status': 'pending'}])
    result = client.get('/api/superadmin/overview')
    assert result.status_code == 200
    data = result.json()
    assert data['stats']['buyer_companies'] == 1
    assert data['stats']['vendor_consultancies'] == 1
    assert data['stats']['total_admin_accounts'] == 3
    assert data['pool_stats'] == {'total': 3, 'portal_applicants': 2, 'vendor_candidates': 1}
    assert data['outreach_stats'] == {'total_outreach_sent': 3, 'interested_count': 1, 'response_rate_percent': 66.7}
    for forbidden in ['PRIVATE-RESUME', 'password_hash', 'person@example.test', 'resume_pdf', '"candidates":[']:
        assert forbidden not in result.text


def test_activity_is_bounded_and_empty_database_has_real_zeroes(setup):
    db, _, client = setup
    empty = client.get('/api/superadmin/overview').json()
    assert empty['pool_stats']['total'] == 0
    assert empty['stats']['platform_activities'] == []
    now = datetime.now(timezone.utc)
    db.requisitions.insert_many([{'id': str(i), 'title': f'Role {i}', 'created_at': now + timedelta(seconds=i), 'generated_jd_markdown': 'private-large-description'} for i in range(40)])
    data = client.get('/api/superadmin/overview?refresh=true').json()
    activity = data['stats']['platform_activities']
    assert len(activity) == 25
    assert activity[0]['id'] == 'req-39' and activity[-1]['id'] == 'req-15'
    assert 'private-large-description' not in str(data)


def test_summary_cache_is_cluster_scoped_and_manual_refresh_is_immediate(setup, monkeypatch):
    db, _, client = setup
    monkeypatch.setattr(overview, 'get_active_cluster', lambda: 'dev_qa')
    assert client.get('/api/superadmin/overview').json()['stats']['buyer_companies'] == 0
    db.tenants.insert_one({'id': 'new', 'tenant_type': 'client'})
    assert client.get('/api/superadmin/overview').json()['stats']['buyer_companies'] == 0
    assert client.get('/api/superadmin/overview?refresh=true').json()['stats']['buyer_companies'] == 1
    db.tenants.insert_one({'id': 'other-cluster', 'tenant_type': 'client'})
    monkeypatch.setattr(overview, 'get_active_cluster', lambda: 'main')
    assert client.get('/api/superadmin/overview').json()['stats']['buyer_companies'] == 2


def test_workers_preserve_the_request_context(setup, monkeypatch):
    _, _, client = setup
    cluster = ContextVar('test_cluster', default='wrong')
    original = overview._pool
    def checked_pool():
        assert cluster.get() == 'testing'
        return original()
    monkeypatch.setattr(overview, '_pool', checked_pool)
    token = cluster.set('testing')
    try:
        assert client.get('/api/superadmin/overview').status_code == 200
    finally:
        cluster.reset(token)


@pytest.mark.parametrize('role', ['Admin', 'Recruiter', 'Candidate'])
def test_overview_requires_superadmin(setup, role):
    _, app, client = setup
    app.dependency_overrides[get_current_user] = lambda: User(id='other', role=role)
    assert client.get('/api/superadmin/overview').status_code == 403
