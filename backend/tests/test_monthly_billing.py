"""Regression coverage for independent monthly billing approval lifecycles."""
import importlib
from types import SimpleNamespace

import mongomock
import pytest
from fastapi import HTTPException

from modules.billing.services.billing_periods import record_period


@pytest.fixture
def billing(monkeypatch):
    service = importlib.import_module('modules.billing.services.billing_service')
    workforce = importlib.import_module('modules.workforce.router')
    db = mongomock.MongoClient().billing_test
    monkeypatch.setattr(service, 'db', db)
    monkeypatch.setattr(workforce, 'db', db)
    db.work_orders.insert_one({
        'id': 'wo-1', 'candidate_id': 'candidate-1', 'candidate_name': 'Person',
        'candidate_email': 'person@example.com', 'work_order_number': 'WO-1',
        'tenant_id': 'client', 'company_name': 'Client', 'vendor_name': 'Supplier',
        'status': 'ACTIVE', 'billing_rate': 1500,
        # Old contract flags must never make a new month look paid.
        'payment_status': 'Paid', 'director_approved': True,
    })
    for month in ('10', '11'):
        db.timesheets.insert_one({
            'id': f'ts-{month}', 'candidate_id': 'candidate-1', 'workorder_id': 'candidate-1',
            'week_start_date': f'2026-{month}-12', 'created_at': f'2026-{month}-15',
            'status': 'APPROVED', 'total_regular_hours': 8, 'total_overtime_hours': 5, 'total_hours': 13,
        })
    return service, workforce, db


def actor(role):
    return SimpleNamespace(id=role, role=role, name=role, email='actor@example.com', tenant_id='client', tenant_name='Client')


def test_october_payment_does_not_approve_or_pay_november(billing):
    service, workforce, db = billing
    for month in ('2026-10', '2026-11'):
        service.dispatch_vendor_sow('candidate-1', actor('Super Admin'), month)
    # November must pass its own approval chain, even after October is paid.
    workforce.approve_procurement_sow('candidate-1', period='2026-10', current_user=actor('Procurement'))
    workforce.director_approve_procurement_sow('candidate-1', period='2026-10', current_user=actor('Director'))
    for month in ('2026-10', '2026-11'):
        db.vendor_invoices.insert_one({'workorder_id': 'candidate-1', 'period': month, 'status': 'Invoiced'})
    workforce.process_finance_work_order_payment('candidate-1', {'transaction_ref': 'OCT-REF', 'amount': 1}, period='2026-10', current_user=actor('Finance'))
    october = db.sow_documents.find_one({'period': '2026-10'})
    november = db.sow_documents.find_one({'period': '2026-11'})
    assert october['status'] == 'Paid'
    assert october['payment_amount'] == 23250  # Server total, not the client-supplied amount.
    assert november['status'] == 'Sent to Procurement'
    assert 'transaction_ref' not in november
    assert db.vendor_invoices.find_one({'period': '2026-10'})['status'] == 'Paid'
    assert db.vendor_invoices.find_one({'period': '2026-11'})['status'] == 'Invoiced'
    details = service.get_candidate_billing_breakdown('candidate-1', '2026-11')
    assert details['approval_trail']['payment_status'] == ''
    assert details['approval_trail']['director_approved'] is False
    assert workforce.get_finance_work_orders(period='2026-10', current_user=actor('Director'))['paid_count'] == 1
    assert workforce.get_finance_work_orders(period='2026-11', current_user=actor('Director'))['paid_count'] == 0
    with pytest.raises(HTTPException) as error:
        workforce.process_finance_work_order_payment('candidate-1', {}, period='2026-11', current_user=actor('Finance'))
    assert error.value.status_code == 409


def test_paid_period_cannot_be_redispatched_or_paid_again(billing):
    service, workforce, db = billing
    db.sow_documents.insert_one({'candidate_id': 'candidate-1', 'period': '2026-10', 'status': 'Paid', 'tenant_id': 'client'})
    for action in (
        lambda: service.dispatch_vendor_sow('candidate-1', actor('Super Admin'), '2026-10'),
        lambda: workforce.process_finance_work_order_payment('candidate-1', {}, period='2026-10', current_user=actor('Finance')),
        lambda: workforce.save_sow_draft('candidate-1', {}, period='2026-10', current_user=actor('Super Admin')),
    ):
        with pytest.raises(HTTPException) as error:
            action()
        assert error.value.status_code == 409
    assert db.sow_documents.count_documents({}) == 1


def test_legacy_paid_document_is_only_used_for_its_original_month(billing):
    service, workforce, db = billing
    db.sow_documents.insert_one({'candidate_id': 'candidate-1', 'status': 'Paid', 'tenant_id': 'client',
        'submitted_at': '2026-10-15', 'updated_at': '2026-11-02', 'sow_data': {'cycle_period': 'October 2026'}})
    assert service.get_candidate_billing_breakdown('candidate-1', '2026-10')['sow']['status'] == 'Paid'
    assert service.get_candidate_billing_breakdown('candidate-1', '2026-11')['sow'] is None
    assert len(workforce.get_procurement_sow_agreements(period='2026-11', current_user=actor('Procurement'))['sow_agreements']) == 0


def test_empty_month_has_no_fabricated_director_or_finance_approvals(billing):
    _, workforce, _ = billing
    assert workforce.get_director_work_orders(period='2026-12', current_user=actor('Director'))['work_orders'] == []
    assert workforce.get_finance_work_orders(period='2026-12', current_user=actor('Finance'))['work_orders'] == []


def test_approval_requires_previous_stage_and_correct_company(billing):
    service, workforce, _ = billing
    service.dispatch_vendor_sow('candidate-1', actor('Super Admin'), '2026-11')
    with pytest.raises(HTTPException) as error:
        workforce.director_approve_procurement_sow('candidate-1', period='2026-11', current_user=actor('Director'))
    assert error.value.status_code == 409
    outsider = actor('Procurement')
    outsider.tenant_id = 'another-client'
    with pytest.raises(HTTPException) as error:
        workforce.approve_procurement_sow('candidate-1', period='2026-11', current_user=outsider)
    assert error.value.status_code == 403


def test_invoice_mark_paid_uses_monthly_finance_approval_flow(billing, monkeypatch):
    service, workforce, db = billing
    router = importlib.import_module('modules.billing.router')
    monkeypatch.setattr(router, 'db', db)
    service.dispatch_vendor_sow('candidate-1', actor('Super Admin'), '2026-11')
    workforce.approve_procurement_sow('candidate-1', period='2026-11', current_user=actor('Procurement'))
    workforce.director_approve_procurement_sow('candidate-1', period='2026-11', current_user=actor('Director'))
    db.vendor_invoices.insert_one({'id': 'invoice-nov', 'workorder_id': 'candidate-1', 'period': '2026-11', 'status': 'Invoiced'})
    result = router.update_invoice_status_endpoint('invoice-nov', router.UpdateInvoiceStatusRequest(status='Paid'), current_user=actor('Finance'))
    assert result['invoice']['status'] == 'Paid'
    report = workforce.get_finance_work_orders(period='2026-11', current_user=actor('Procurement'))
    assert report['paid_count'] == 1
    assert report['work_orders'][0]['payment_processed_by'] == 'Finance (Finance)'
    assert report['work_orders'][0]['transaction_ref']


@pytest.mark.parametrize('label', ['October 2026', 'Oct 1, 2026 - Oct 31, 2026', '2026-10'])
def test_legacy_period_labels(label):
    assert record_period({'sow_data': {'cycle_period': label}}) == '2026-10'
