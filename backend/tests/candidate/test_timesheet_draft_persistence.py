from types import SimpleNamespace
import mongomock
import pytest
from modules.candidate_portal import router


@pytest.fixture
def draft_store(monkeypatch):
    store = mongomock.MongoClient().db
    monkeypatch.setattr(router, 'db', store)
    monkeypatch.setattr(router, '_ensure_active_work_order', lambda *args: {'id': 'WO1', 'work_order_number': 'WO1'})
    monkeypatch.setattr(router, '_get_current_week_bounds', lambda: ('2026-01-05', '2026-01-11'))
    return store


def actor(candidate='C1'):
    return SimpleNamespace(role='Candidate', workorder_id=candidate, candidate_id=candidate, name='Candidate', email='candidate@example.com', tenant_id='T1', timesheet_frozen=False)


def payload():
    return router.SaveTimesheetRequest(id='client-generated-id', week_start_date='2026-01-05', week_end_date='2026-01-11', notes='Week note', daily_entries=[
        {'date': '2026-01-05', 'day': 'Mon', 'hours': 6.5, 'category': 'Regular', 'note': 'Implementation'},
        {'date': '2026-01-06', 'day': 'Tue', 'hours': 9, 'category': 'Overtime', 'note': 'Release'},
    ])


def test_draft_restores_hours_categories_notes_and_stable_identity(draft_store):
    first = router.save_timesheet_draft(payload(), actor())['timesheet']
    restored = router.get_current_timesheet(actor())['timesheet']
    assert restored['daily_entries'] == payload().daily_entries
    assert restored['notes'] == 'Week note'
    assert restored['status'] == 'DRAFT'
    assert restored['id'] == first['id']
    changed = payload()
    changed.id = 'different-client-id'
    changed.daily_entries[0]['hours'] = 7
    router.save_timesheet_draft(changed, actor())
    assert draft_store.timesheets.count_documents({}) == 1
    restored = router.get_current_timesheet(actor())['timesheet']
    assert restored['id'] == first['id']
    assert restored['daily_entries'][0]['hours'] == 7


def test_drafts_from_two_candidates_cannot_overwrite_each_other(draft_store):
    first = router.save_timesheet_draft(payload(), actor('C1'))['timesheet']
    second = router.save_timesheet_draft(payload(), actor('C2'))['timesheet']
    assert first['id'] != second['id']
    assert draft_store.timesheets.count_documents({}) == 2
