import ast
from pathlib import Path
import mongomock


def resolve(database, candidate_id='candidate'):
    tree = ast.parse((Path(__file__).parents[1] / 'modules/candidate_portal/router.py').read_text())
    node = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == '_ensure_active_work_order')
    scope = {'db': database}
    exec(compile(ast.Module(body=[node], type_ignores=[]), '<assignment>', 'exec'), scope)
    return scope[node.name](candidate_id, 'Person', 'person@example.com', 'company')


def test_exact_work_order_wins_over_newer_unrelated_email_record():
    db = mongomock.MongoClient().db
    db.work_orders.insert_many([
        {'id': 'candidate', 'tenant_id': 'company', 'requisition_id': 'req', 'status': 'ACTIVE', 'updated_at': '2026-10-18'},
        {'id': 'other', 'candidate_email': 'person@example.com', 'tenant_id': 'company', 'start_date': '2026-01-01', 'updated_at': '2026-10-19'},
        {'id': 'candidate', 'tenant_id': 'foreign', 'updated_at': '2026-10-20'},
    ])
    db.requisitions.insert_one({'id': 'req', 'tenant_id': 'company', 'title': 'Backend Engineer', 'structured_role': {'start_date': '2026-10-20', 'ends_on': '2027-04-20', 'primary_location': 'Chennai', 'reporting_manager': 'Actual Manager'}})
    result = resolve(db)
    assert result['requisition_title'] == 'Backend Engineer'
    assert result['start_date'] == '2026-10-20'
    assert result['end_date'] == '2027-04-20'
    assert result['location'] == 'Chennai'
    assert result['reporting_manager'] == 'Actual Manager'


def test_configured_work_order_dates_preserved():
    db = mongomock.MongoClient().db
    db.work_orders.insert_one({'id': 'candidate', 'tenant_id': 'company', 'start_date': '2026-10-15', 'end_date': '2027-02-25'})
    result = resolve(db)
    assert result['start_date'] == '2026-10-15'
    assert result['end_date'] == '2027-02-25'
    assert result.get('location', '') == ''
    assert result.get('reporting_manager', '') == ''


def test_same_name_does_not_select_another_candidates_assignment():
    db = mongomock.MongoClient().db
    db.work_orders.insert_one({'id': 'other', 'tenant_id': 'company', 'candidate_name': 'Person'})
    assert resolve(db) is None


def test_manager_resolved_only_from_linked_requisition_tenant():
    db = mongomock.MongoClient().db
    db.work_orders.insert_one({'id': 'candidate', 'tenant_id': 'company', 'requisition_id': 'req', 'procurement_name': 'Assigned Buyer'})
    db.requisitions.insert_one({'id': 'req', 'tenant_id': 'company', 'created_by': 'hm'})
    db.users.insert_many([
        {'id': 'hm', 'tenant_id': 'foreign', 'role': 'Hiring Manager', 'name': 'Wrong Manager'},
        {'id': 'hm', 'tenant_id': 'company', 'role': 'Hiring Manager', 'name': 'Assigned Manager'},
    ])
    result = resolve(db)
    assert result['reporting_manager'] == 'Assigned Manager'
    assert result['procurement_name'] == 'Assigned Buyer'
    assert not result.get('finance_name')


def test_absent_manager_does_not_pick_any_company_manager():
    db = mongomock.MongoClient().db
    db.work_orders.insert_one({'id': 'candidate', 'tenant_id': 'company', 'requisition_id': 'req'})
    db.requisitions.insert_one({'id': 'req', 'tenant_id': 'company'})
    db.users.insert_one({'id': 'hm', 'tenant_id': 'company', 'role': 'Hiring Manager', 'name': 'Unrelated Manager'})
    assert not resolve(db).get('reporting_manager')
