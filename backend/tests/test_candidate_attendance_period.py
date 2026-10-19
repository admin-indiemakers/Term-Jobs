import ast
from pathlib import Path
from datetime import datetime, timezone
from types import SimpleNamespace
import mongomock
import pytest
from fastapi import HTTPException


class Clock(datetime):
    @classmethod
    def now(cls, tz=None):
        return cls(2026, 10, 19, 12, tzinfo=timezone.utc).astimezone(tz)


def attendance(month=None, entries=None):
    database = mongomock.MongoClient().db
    database.work_orders.insert_one({'candidate_id': 'candidate', 'tenant_id': 'company', 'start_date': '2026-10-15'})
    database.timesheets.insert_one({'candidate_id': 'candidate', 'tenant_id': 'company', 'status': 'APPROVED', 'daily_entries': entries or []})
    tree = ast.parse((Path(__file__).parents[1] / 'modules/candidate_portal/router.py').read_text())
    node = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == 'get_candidate_attendance')
    node.decorator_list = []
    node.returns = None
    node.args.defaults = []
    for argument in node.args.args:
        argument.annotation = None
    scope = {'db': database, 'datetime': Clock, 'timezone': timezone, 'HTTPException': HTTPException}
    exec(compile(ast.Module(body=[node], type_ignores=[]), '<attendance>', 'exec'), scope)
    user = SimpleNamespace(role='Candidate', candidate_id='candidate', workorder_id='', tenant_id='company', email='person@example.com', name='Person')
    return scope['get_candidate_attendance'](month, user)['attendance']


def test_current_assignment_month_without_demo_records():
    result = attendance()
    assert result['month_year'] == '2026-10'
    assert [month['value'] for month in result['available_months']] == ['2026-10']
    assert min(row['date_iso'] for row in result['daily_records']) == '2026-10-15'
    assert not result['has_records']
    assert result['payable_days'] == 0


def test_actual_entries_counted_but_pre_assignment_and_future_ignored():
    result = attendance(entries=[{'date': day, 'hours': hours, 'category': category} for day, hours, category in [
        ('2026-10-14', 8, 'Regular'), ('2026-10-15', 8, 'Regular'),
        ('2026-10-16', 0, 'Paid Leave'), ('2026-10-17', 0, 'Holiday'), ('2026-10-20', 8, 'Regular')]])
    assert result['has_records']
    assert result['present_days'] == 1
    assert result['paid_leave_days'] == 1
    assert result['client_holidays'] == 1
    assert result['payable_days'] == 3


def test_before_assignment_month_has_no_active_attendance():
    result = attendance('2026-08')
    assert result['daily_records'] == []
    assert result['has_records'] is False


@pytest.mark.parametrize('month', ['2026-13', 'invalid', '2026-00'])
def test_invalid_month_is_validation_error(month):
    with pytest.raises(HTTPException) as error:
        attendance(month)
    assert error.value.status_code == 400
