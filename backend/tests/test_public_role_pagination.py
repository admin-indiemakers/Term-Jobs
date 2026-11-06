from datetime import datetime, timezone
from unittest.mock import Mock

import mongomock
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from modules.requisition import public_listing as listing
from modules.requisition.superadmin_router import public_views_router


@pytest.fixture
def setup(monkeypatch):
    db = mongomock.MongoClient().db
    monkeypatch.setattr(listing, 'db', db)
    db.company_profiles.insert_many([
        {'id': 'a', 'name': 'First Company', 'private_token': 'secret'},
        {'id': 'b', 'name': 'Second Company'},
    ])
    db.requisitions.insert_many([{
        'id': f'role-{index:02}', 'title': 'Python Developer' if index % 2 == 0 else 'UI Designer',
        'status': 'Published', 'company_profile_id': 'a' if index < 10 else 'b',
        'tenant_id': 'platform', 'created_at': datetime(2026, 1, 1, tzinfo=timezone.utc),
        'structured_role': {'submission_deadline': '2099-01-01', 'location': 'Kochi' if index % 2 == 0 else ['Bengaluru', 'Chennai'],
                            'job_family': 'General', 'work_mode': 'Remote' if index % 2 == 0 else 'Hybrid',
                            'must_have_skills': ['Python'] if index % 2 == 0 else ['Figma'], 'internal_margin': 123},
        'generated_jd_markdown': 'Long job description ' * 100, 'private_notes': 'secret',
    } for index in range(19)])
    db.requisitions.insert_many([
        {'id': 'closed', 'status': 'Closed'},
        {'id': 'expired', 'status': 'Published', 'structured_role': {'submission_deadline': '2000-01-01'}},
        {'id': 'draft', 'status': 'Draft'},
    ])
    app = FastAPI()
    app.include_router(public_views_router)
    return db, TestClient(app)


def test_database_pages_are_bounded_stable_and_keep_global_metadata(setup):
    db, client = setup
    pages = [client.get(f'/api/public/requisitions/page?page={page}').json() for page in [1, 2, 3]]
    assert [len(data['items']) for data in pages] == [8, 8, 3]
    ids = [row['id'] for data in pages for row in data['items']]
    assert len(set(ids)) == 19 and ids == sorted(ids)
    first = pages[0]
    assert first['total'] == 19 and first['total_pages'] == 3
    assert first['stats'] == {'roles': 19, 'companies': 2}
    assert first['filters']['locations'] == ['Bengaluru', 'Chennai', 'Kochi']
    assert sum(row['count'] for row in first['categories']) == 19
    spy = Mock(wraps=db.requisitions.aggregate)
    db.requisitions.aggregate = spy
    listing.public_listing(2, 8)
    stages = spy.call_args.args[0][-1]['$facet']['items']
    assert {'$skip': 8} in stages and {'$limit': 8} in stages


def test_search_and_filters_cover_roles_outside_first_page(setup):
    _, client = setup
    path = '/api/public/requisitions/page'
    data = client.get(path, params={'q': 'Second Company', 'work_mode': 'remote', 'location': 'Kochi', 'category': 'Development'}).json()
    assert data['total'] == 5
    assert all(row['company_name'] == 'Second Company' for row in data['items'])
    assert data['stats']['roles'] == 19
    for params, expected in [({'q': 'Figma'}, 9), ({'category': 'Design'}, 9), ({'location': 'Chennai'}, 9), ({'q': '.*'}, 0), ({'family': 'Unknown'}, 0)]:
        assert client.get(path, params=params).json()['total'] == expected


def test_public_details_remain_available_and_private_fields_are_removed(setup):
    _, client = setup
    response = client.get('/api/public/requisitions/page')
    assert response.status_code == 200
    row = response.json()['items'][0]
    assert row['generated_jd_markdown'].startswith('Long job description')
    assert row['structured_role']['must_have_skills'] == ['Python']
    assert row['due_date'] == '2099-01-01'
    assert 'private' not in response.text and 'internal_margin' not in response.text
    for query in ['page=0', 'page_size=0', 'page_size=51']:
        assert client.get('/api/public/requisitions/page?' + query).status_code == 422


def test_empty_and_out_of_range_pages(setup):
    db, client = setup
    missing = client.get('/api/public/requisitions/page?page=20').json()
    assert missing['items'] == [] and missing['total'] == 19
    db.requisitions.delete_many({})
    empty = client.get('/api/public/requisitions/page').json()
    assert empty['items'] == [] and empty['total'] == 0 and empty['total_pages'] == 1
    assert empty['stats'] == {'roles': 0, 'companies': 0}


def test_today_deadlines_missing_families_and_onsite_aliases(setup):
    from datetime import datetime
    from zoneinfo import ZoneInfo
    db, client = setup
    today = datetime.now(ZoneInfo('Asia/Kolkata')).date().isoformat()
    db.requisitions.insert_one({'id': 'today-role', 'status': 'Published', 'title': 'QA Tester',
                               'structured_role': {'submission_deadline': today, 'work_mode': 'On-site'}})
    data = client.get('/api/public/requisitions/page', params={'work_mode': 'Onsite'}).json()
    assert data['total'] == 1 and data['items'][0]['id'] == 'today-role'
    assert data['categories'] == [{'id': 'QA & Testing', 'label': 'QA & Testing', 'count': 1}]
