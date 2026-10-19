from unittest.mock import Mock
import mongomock
import pytest

from modules.hiring_manager_agent import agent
from modules.hiring_manager_agent.scope import ScopedDatabase, hiring_scope


@pytest.mark.parametrize('status,expected', [
    ('all', ['approved', 'submitted', 'draft', 'rejected']),
    ('approved', ['approved']), ('pending', ['submitted']), ('rejected', ['rejected']),
])
def test_timesheets_filter_status_without_crossing_manager_or_tenant(monkeypatch, status, expected):
    database = mongomock.MongoClient().db
    database.requisitions.insert_one({'id': 'req', 'tenant_id': 'company', 'created_by': 'hm'})
    database.timesheets.insert_many([
        {'id': value, 'status': value.upper(), 'tenant_id': 'company', 'requisition_id': 'req'}
        for value in ['approved', 'submitted', 'draft', 'rejected']
    ] + [
        {'id': 'foreign', 'status': 'APPROVED', 'tenant_id': 'other', 'requisition_id': 'req'},
        {'id': 'other-manager', 'status': 'APPROVED', 'tenant_id': 'company', 'requisition_id': 'other-req'},
    ])
    monkeypatch.setattr(agent, 'db', ScopedDatabase(database))
    with hiring_scope(database, {'id': 'hm', 'tenant_id': 'company'}):
        rows = agent.list_hiring_timesheets('company', status)
    assert [row['id'] for row in rows] == expected
    assert all(row['hourly_rate'] is None and row['total_hours'] is None for row in rows)
