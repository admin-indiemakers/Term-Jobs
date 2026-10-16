"""Workforce statistics and approvals are scoped to the manager's requisitions."""
import importlib
from types import SimpleNamespace

import mongomock
import pytest
from fastapi import HTTPException
from modules.shared.cache import TTLCache


@pytest.fixture
def workforce(monkeypatch):
    router = importlib.import_module('modules.workforce.router')
    persistence = importlib.import_module('modules.shared.db')
    db = mongomock.MongoClient().workforce_test
    monkeypatch.setattr(router, 'db', db)
    monkeypatch.setattr(persistence, 'db', db)
    monkeypatch.setattr(router, 'cache', TTLCache())
    db.requisitions.insert_many([
        {'id': 'own-req', 'tenant_id': 'company-a', 'created_by': 'existing-hm'},
        {'id': 'colleague-req', 'tenant_id': 'company-a', 'created_by': 'colleague-hm'},
        {'id': 'other-company-req', 'tenant_id': 'company-b', 'created_by': 'existing-hm'},
    ])
    for cid, req, tenant in [
        ('own-worker', 'own-req', 'company-a'),
        ('colleague-worker', 'colleague-req', 'company-a'),
        ('foreign-worker', 'other-company-req', 'company-b'),
        ('unlinked-worker', None, 'company-a'),
    ]:
        db.work_orders.insert_one({'candidate_id': cid, 'workorder_id': cid, 'requisition_id': req, 'tenant_id': tenant, 'status': 'ACTIVE'})
        db.onboarding_checklists.insert_one({'candidate_id': cid, 'status': 'completed'})
        db.timesheets.insert_one({'id': f'ts-{cid}', 'candidate_id': cid, 'tenant_id': tenant, 'status': 'SUBMITTED'})
        db.candidate_expenses.insert_one({'id': f'exp-{cid}', 'candidate_id': cid, 'tenant_id': tenant, 'status': 'Pending'})
    return router, db


def manager(id='fresh-hm', tenant='company-a', role='Hiring Manager'):
    return SimpleNamespace(id=id, tenant_id=tenant, role=role, name=id)


@pytest.mark.parametrize('tenant', ['company-a', 'new-company', None])
def test_fresh_hm_has_zero_workforce_even_when_other_workers_exist(workforce, tenant):
    router, _ = workforce
    user = manager(tenant=tenant)
    assert router._get_hm_team_candidate_ids(user) == []
    stats = router.get_workforce_stats(current_user=user)['stats']
    assert all(value == 0 for value in stats.values())
    assert router.list_team_timesheets(status=None, week=None, current_user=user)['timesheets'] == []
    assert router.list_team_expenses(current_user=user, status=None)['expenses'] == []


def test_existing_hm_only_sees_own_requisition_workers_and_counts(workforce):
    router, _ = workforce
    user = manager('existing-hm')
    assert router._get_hm_team_candidate_ids(user) == ['own-worker']
    stats = router.get_workforce_stats(current_user=user)['stats']
    assert stats['active'] == 1
    assert stats['total_team'] == 1
    assert stats['pending_timesheets'] == 1
    assert stats['pending_expenses'] == 1


def test_company_admin_retains_company_wide_team_without_cross_company_workers(workforce):
    router, _ = workforce
    ids = router._get_hm_team_candidate_ids(manager('admin', role='Admin'))
    assert set(ids) == {'own-worker', 'colleague-worker'}


def test_manager_can_still_approve_their_own_worker_records(workforce):
    router, db = workforce
    user = manager('existing-hm')
    router.approve_timesheet('ts-own-worker', current_user=user)
    router.approve_expense('exp-own-worker', current_user=user)
    assert db.timesheets.find_one({'id': 'ts-own-worker'})['status'] == 'APPROVED'
    assert db.candidate_expenses.find_one({'id': 'exp-own-worker'})['status'] == 'Approved'


def test_super_admin_retains_global_workforce_access(workforce):
    router, _ = workforce
    assert set(router._get_hm_team_candidate_ids(manager('super', role='Super Admin'))) == {
        'own-worker', 'colleague-worker', 'foreign-worker', 'unlinked-worker',
    }


@pytest.mark.parametrize('hm', ['fresh-hm', 'existing-hm'])
@pytest.mark.parametrize('action', ['approve_timesheet', 'reject_timesheet', 'approve_expense', 'reject_expense'])
def test_hm_cannot_review_colleague_records_even_in_the_same_company(workforce, hm, action):
    router, db = workforce
    kwargs = {'current_user': manager(hm)}
    if 'timesheet' in action:
        kwargs['timesheet_id'] = 'ts-colleague-worker'
        if action == 'reject_timesheet':
            kwargs['payload'] = router.RejectTimesheetRequest(reason='Test')
    else:
        kwargs['expense_id'] = 'exp-colleague-worker'
    with pytest.raises(HTTPException) as error:
        getattr(router, action)(**kwargs)
    assert error.value.status_code == 403
    assert db.timesheets.find_one({'id': 'ts-colleague-worker'})['status'] == 'SUBMITTED'
    assert db.candidate_expenses.find_one({'id': 'exp-colleague-worker'})['status'] == 'Pending'
