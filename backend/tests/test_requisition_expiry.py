"""Deadline checks execute real handlers/services against an isolated database."""
import ast
from datetime import datetime, timedelta, date
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock
from zoneinfo import ZoneInfo

import mongomock
import pytest
from fastapi import HTTPException
from modules.shared.db import Session, _utcnow
from modules.requisition.domain import models, schemas
from modules.requisition.domain.deadline import submission_deadline_passed
from modules.requisition.services.deadline_policy import enforce_approval_deadline, DeadlineExpired
from modules.requisition.services.requisition_service import RequisitionService


def today():
    return datetime.now(ZoneInfo('Asia/Kolkata')).date()


def handlers(database):
    names = {'list_requisitions', '_auto_close_expired', '_require_approval_deadline', '_get_requisition',
             'approve_requisition', 'director_approve_requisition', 'submit_requisition_for_director_approval_route', 'publish_requisition'}
    tree = ast.parse((Path(__file__).parents[1] / 'main.py').read_text())
    nodes = [n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name in names]
    for node in nodes:
        node.decorator_list = []
        node.returns = None
        for arg in node.args.args:
            arg.annotation = None
        node.args.defaults = [ast.Constant(None) for _ in node.args.defaults]
    context = {'get_session': lambda: Session(database), 'models': models, 'schemas': schemas,
        '_utcnow': _utcnow, '_format_datetime': lambda value: value, '_cache': MagicMock(), '_auto_close_last_run': 0,
        'submission_deadline_passed': submission_deadline_passed, 'enforce_approval_deadline': enforce_approval_deadline,
        'DeadlineExpired': DeadlineExpired, 'HTTPException': HTTPException,
        '_require_tenant': lambda *args: None, '_require_writable': lambda *args: None, 'service': MagicMock()}
    exec(compile(ast.fix_missing_locations(ast.Module(body=nodes, type_ignores=[])), '<expiry handlers>', 'exec'), context)
    return context


@pytest.mark.parametrize('deadline, expected', [('2026-10-15', True), ('2026-10-16', False), ('2026-10-17', False), ('', False), (None, False)])
def test_deadline_includes_full_indian_calendar_day(deadline, expected):
    assert submission_deadline_passed({'submission_deadline': deadline}, date(2026, 10, 16)) is expected


def test_expiry_closes_pending_and_published_but_keeps_todays_deadline():
    db = mongomock.MongoClient().expiry
    yesterday = (today() - timedelta(days=1)).isoformat()
    for index, status in enumerate(['Pending Approval', 'PendingApproval', 'Pending_Approval', 'Published', 'Draft']):
        db.requisitions.insert_one({'id': str(index), 'status': status, 'structured_role': {'submission_deadline': yesterday}})
    db.requisitions.insert_one({'id': 'valid-today', 'status': 'Pending Approval', 'structured_role': {'submission_deadline': today().isoformat()}})
    context = handlers(db)
    context['_auto_close_expired']()
    assert all(db.requisitions.find_one({'id': str(i)})['status'] == 'Closed' for i in range(4))
    assert db.requisitions.find_one({'id': '4'})['status'] == 'Draft'
    assert db.requisitions.find_one({'id': 'valid-today'})['status'] == 'Pending Approval'
    context['_cache'].clear.assert_called_once()


@pytest.mark.parametrize('route, role', [('approve_requisition', 'Hiring Manager'),
    ('submit_requisition_for_director_approval_route', 'Hiring Manager'),
    ('director_approve_requisition', 'Director'), ('publish_requisition', 'Director')])
def test_stale_browser_or_direct_api_cannot_approve_expired_request(route, role):
    db = mongomock.MongoClient().expiry
    db.requisitions.insert_one({'id': 'expired', 'status': 'Pending Approval', 'tenant_id': 'company',
        'structured_role': {'submission_deadline': (today() - timedelta(days=1)).isoformat()}})
    context = handlers(db)
    with pytest.raises(HTTPException) as error:
        context[route]('expired', current_user=SimpleNamespace(role=role, tenant_id='company'))
    assert error.value.status_code == 409
    assert 'deadline has passed' in error.value.detail
    assert db.requisitions.find_one({'id': 'expired'})['status'] == 'Closed'
    assert not db.requisitions.find_one({'id': 'expired'}).get('director_approved')
    context['service'].publish.assert_not_called()


@pytest.mark.parametrize('operation', ['approve', 'publish'])
def test_service_prevents_ai_or_background_publish_after_expiry(operation):
    db = mongomock.MongoClient().expiry
    db.requisitions.insert_one({'id': 'expired', 'status': 'PendingApproval',
        'structured_role': {'submission_deadline': (today() - timedelta(days=1)).isoformat()}})
    service = RequisitionService(session_factory=lambda: Session(db))
    with pytest.raises(DeadlineExpired):
        getattr(service, operation)('expired')
    assert db.requisitions.find_one({'id': 'expired'})['status'] == 'Closed'


def test_today_deadline_is_still_eligible_for_approval():
    db = mongomock.MongoClient().expiry
    db.requisitions.insert_one({'id': 'valid', 'status': 'Pending Approval', 'structured_role': {'submission_deadline': today().isoformat()}})
    handlers(db)['_require_approval_deadline']('valid')
    assert db.requisitions.find_one({'id': 'valid'})['status'] == 'Pending Approval'


def test_portal_list_closes_expired_queue_before_returning_cached_pending_status():
    from modules.shared.cache import TTLCache
    db = mongomock.MongoClient().expiry
    db.requisitions.insert_one({'id': 'expired', 'status': 'Pending Approval', 'tenant_id': 'company',
        'structured_role': {'submission_deadline': (today() - timedelta(days=1)).isoformat()}})
    context = handlers(db)
    context['_cache'] = TTLCache()
    context['_cache'].set('reqs:director:Director:company:dashboard', [{'id': 'expired', 'status': 'Pending Approval'}], ttl=30)
    rows = context['list_requisitions'](dashboard=True, fresh=False,
        current_user=SimpleNamespace(id='director', role='Director', tenant_id='company'))
    assert rows[0]['status'] == 'Closed'
