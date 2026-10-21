from types import SimpleNamespace
import mongomock
import pytest
from modules.notifications import router


@pytest.mark.parametrize('role', ['Super Admin', 'Admin'])
def test_read_all_persists_legacy_and_personal_notifications_per_user(monkeypatch, role):
    database = mongomock.MongoClient().db
    monkeypatch.setattr(router, 'db', database)
    user = SimpleNamespace(id='u1', tenant_id='company', role=role)
    other = SimpleNamespace(id='u2', tenant_id='company', role=role)
    database.notifications.insert_many([
        {'tenant_id': 'company', 'type': 'general', 'title': 'Legacy alert'},
        {'id': 'personal', 'user_id': 'u1', 'title': 'Personal alert'},
        {'id': 'private', 'user_id': 'u2', 'title': 'Other user'},
        {'id': 'other-company', 'tenant_id': 'elsewhere'},
    ])
    before = router.list_notifications(user)
    assert len(before) == 2
    assert before == router.list_notifications(user)  # IDs stay stable across reloads.
    assert router.mark_all_read(user)['marked'] == 2
    assert router.unread_count(user) == {'count': 0}
    assert all(item['read'] for item in router.list_notifications(user))
    assert len(router.list_notifications(user, unread_only=True)) == 0
    assert router.unread_count(other) == {'count': 2}
    assert database.notifications.count_documents({}) == 4
    assert database.notifications.find_one({'id': 'private'}).get('read_by') is None


@pytest.mark.parametrize('role', ['Super Admin', 'Admin'])
def test_single_read_uses_legacy_mongo_id_and_survives_reload(monkeypatch, role):
    database = mongomock.MongoClient().db
    monkeypatch.setattr(router, 'db', database)
    user = SimpleNamespace(id='u1', tenant_id='company', role=role)
    database.notifications.insert_one({'tenant_id': 'company', 'title': 'Legacy'})
    notification_id = router.list_notifications(user)[0]['id']
    router.mark_notification_read(notification_id, user)
    router.mark_notification_read(notification_id, user)
    assert router.list_notifications(user)[0]['read'] is True
    assert database.notifications.find_one({})['read_by'] == ['u1']
    assert database.notifications.count_documents({}) == 1


@pytest.mark.parametrize('role', ['Super Admin', 'Admin'])
def test_historical_clone_is_one_event_and_read_state_survives_refresh(monkeypatch, role):
    database = mongomock.MongoClient().db
    monkeypatch.setattr(router, 'db', database)
    user = SimpleNamespace(id='u1', tenant_id='company', role=role)
    event = {'tenant_id': 'company', 'type': 'offer_letter_sent', 'title': 'Formal Offer Letter Dispatched', 'message': 'Offer dispatched', 'candidate_id': 'C1', 'created_at': '2026-10-19T10:00:00Z'}
    database.notifications.insert_one(dict(event))
    database.notifications.insert_one({**event, 'id': 'historical-clone', 'read': True, 'read_by': ['u1'], 'user_id': '', 'target_role': '', 'body': '', 'data': {}})
    for _ in range(3):
        items = router.list_notifications(user)
        assert len(items) == 1
        assert items[0]['read'] is True
        assert router.unread_count(user) == {'count': 0}
        assert router.list_notifications(user, unread_only=True) == []
    assert database.notifications.count_documents({}) == 2
    # Same message at a different time is a genuine new notification.
    database.notifications.insert_one({**event, '_id': 'new-event', 'created_at': '2026-10-20T10:00:00Z'})
    assert len(router.list_notifications(user)) == 2
    assert router.unread_count(user) == {'count': 1}


def test_reading_duplicate_updates_all_copies_without_creating_records(monkeypatch):
    database = mongomock.MongoClient().db
    monkeypatch.setattr(router, 'db', database)
    user = SimpleNamespace(id='admin', tenant_id='company', role='Admin')
    event = {'tenant_id': 'company', 'type': 'general', 'created_at': '2026-10-19', 'title': 'Same event'}
    database.notifications.insert_many([dict(event), {**event, 'id': 'clone'}])
    notification_id = router.list_notifications(user)[0]['id']
    router.mark_notification_read(notification_id, user)
    assert all('admin' in row['read_by'] for row in database.notifications.find({}))
    assert len(router.list_notifications(user)) == 1
    assert router.unread_count(user) == {'count': 0}
    assert database.notifications.count_documents({}) == 2
