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


def test_authorized_submission_survives_draft_and_redispatch_attempts(billing):
    service, workforce, db = billing
    service.dispatch_vendor_sow('candidate-1', actor('Super Admin'), '2026-10')
    workforce.approve_procurement_sow('candidate-1', period='2026-10', current_user=actor('Procurement'))
    authorized = db.sow_documents.find_one({'period': '2026-10'})
    for action in (
        lambda: service.dispatch_vendor_sow('candidate-1', actor('Super Admin'), '2026-10'),
        lambda: workforce.send_sow_to_procurement('candidate-1', {'grand_total': 1}, period='2026-10', current_user=actor('Super Admin')),
        lambda: workforce.save_sow_draft('candidate-1', {'grand_total': 1}, period='2026-10', current_user=actor('Super Admin')),
    ):
        with pytest.raises(HTTPException) as error:
            action()
        assert error.value.status_code == 409
        assert 'revision' in error.value.detail.lower()
        assert db.sow_documents.find_one({'period': '2026-10'}) == authorized
    workforce.director_approve_procurement_sow('candidate-1', period='2026-10', current_user=actor('Director'))
    assert db.sow_documents.find_one({'period': '2026-10'})['status'] == 'Approved by Director'
    with pytest.raises(HTTPException):
        workforce.save_sow_draft('candidate-1', {}, period='2026-10', current_user=actor('Super Admin'))


def test_explicit_revision_requires_reason_and_new_procurement_approval(billing):
    service, workforce, db = billing
    service.dispatch_vendor_sow('candidate-1', actor('Super Admin'), '2026-10')
    workforce.approve_procurement_sow('candidate-1', period='2026-10', current_user=actor('Procurement'))
    with pytest.raises(HTTPException) as error:
        workforce.request_procurement_sow_revision('candidate-1', {}, period='2026-10', current_user=actor('Director'))
    assert error.value.status_code == 422
    assert db.sow_documents.find_one({'period': '2026-10'})['status'] == 'Pending Director Approval'
    workforce.request_procurement_sow_revision('candidate-1', {'notes': 'Correct the approved hours'}, period='2026-10', current_user=actor('Director'))
    returned = db.sow_documents.find_one({'period': '2026-10'})
    assert returned['procurement_authorized'] is False
    assert returned['revision_notes'] == 'Correct the approved hours'
    service.dispatch_vendor_sow('candidate-1', actor('Super Admin'), '2026-10')
    with pytest.raises(HTTPException) as error:
        workforce.director_approve_procurement_sow('candidate-1', period='2026-10', current_user=actor('Director'))
    assert error.value.status_code == 409
    workforce.approve_procurement_sow('candidate-1', period='2026-10', current_user=actor('Procurement'))
    workforce.director_approve_procurement_sow('candidate-1', period='2026-10', current_user=actor('Director'))


@pytest.mark.parametrize('writer', ['draft', 'dispatch', 'send'])
def test_concurrent_procurement_approval_cannot_be_overwritten(billing, monkeypatch, writer):
    service, workforce, db = billing
    service.dispatch_vendor_sow('candidate-1', actor('Super Admin'), '2026-10')
    original_update = db.sow_documents.update_one
    raced = False

    def approve_before_write(query, update, **kwargs):
        nonlocal raced
        if not raced:
            raced = True
            original_update({'period': '2026-10'}, {'$set': {
                'status': 'Pending Director Approval', 'procurement_authorized': True,
                'procurement_approved_by': 'Procurement', 'updated_at': 'concurrent-approval',
            }})
        return original_update(query, update, **kwargs)

    monkeypatch.setattr(db.sow_documents, 'update_one', approve_before_write)
    actions = {
        'draft': lambda: workforce.save_sow_draft('candidate-1', {}, period='2026-10', current_user=actor('Super Admin')),
        'send': lambda: workforce.send_sow_to_procurement('candidate-1', {}, period='2026-10', current_user=actor('Super Admin')),
        'dispatch': lambda: service.dispatch_vendor_sow('candidate-1', actor('Super Admin'), '2026-10'),
    }
    with pytest.raises(HTTPException) as error:
        actions[writer]()
    assert error.value.status_code == 409
    assert db.sow_documents.count_documents({'period': '2026-10'}) == 1
    assert db.sow_documents.find_one({'period': '2026-10'})['status'] == 'Pending Director Approval'
    workforce.director_approve_procurement_sow('candidate-1', period='2026-10', current_user=actor('Director'))


def test_payment_confirmation_returns_saved_details_even_if_alert_fails(billing, monkeypatch):
    service, workforce, db = billing
    service.dispatch_vendor_sow('candidate-1', actor('Super Admin'), '2026-10')
    workforce.approve_procurement_sow('candidate-1', period='2026-10', current_user=actor('Procurement'))
    workforce.director_approve_procurement_sow('candidate-1', period='2026-10', current_user=actor('Director'))

    def fail_alert(*args, **kwargs):
        raise RuntimeError('Notification delivery unavailable')

    monkeypatch.setattr(db.candidate_notifications, 'insert_one', fail_alert)
    result = workforce.process_finance_work_order_payment('candidate-1', {
        'transaction_ref': 'UTR-confirmed', 'payment_method': 'NEFT/RTGS',
    }, period='2026-10', current_user=actor('Finance Team'))
    assert result['status'] == 'success'
    assert result['payment']['payment_status'] == 'Paid'
    assert result['payment']['transaction_ref'] == 'UTR-confirmed'
    stored = db.sow_documents.find_one({'period': '2026-10'})
    assert stored['payment_status'] == 'Paid'
    assert result['payment']['payment_amount'] == stored['payment_amount']
    assert result['payment']['payment_processed_at'] == stored['payment_processed_at']


def test_finance_pending_director_bill_is_not_ready_and_cannot_be_paid(billing):
    service, workforce, db = billing
    service.dispatch_vendor_sow('candidate-1', actor('Super Admin'), '2026-10')
    workforce.approve_procurement_sow('candidate-1', period='2026-10', current_user=actor('Procurement'))
    response = workforce.get_finance_work_orders(period='2026-10', current_user=actor('Finance'))
    assert response['ready_for_payment_count'] == 0
    assert response['work_orders'][0]['ready_for_payment'] is False
    assert response['work_orders'][0]['status'] == 'Pending Director Approval'
    with pytest.raises(HTTPException) as error:
        workforce.process_finance_work_order_payment('candidate-1', {}, period='2026-10', current_user=actor('Finance'))
    assert error.value.status_code == 409
    assert db.sow_documents.find_one({'period': '2026-10'})['status'] == 'Pending Director Approval'
    workforce.director_approve_procurement_sow('candidate-1', period='2026-10', current_user=actor('Director'))
    assert workforce.get_finance_work_orders(period='2026-10', current_user=actor('Finance'))['ready_for_payment_count'] == 1


def test_director_rejection_is_recorded_and_requires_resubmission(billing):
    service, workforce, db = billing
    service.dispatch_vendor_sow('candidate-1', actor('Super Admin'), '2026-10')
    with pytest.raises(HTTPException) as error:
        workforce.reject_procurement_sow('candidate-1', {'rejection_notes': 'Correct hours'}, period='2026-10', current_user=actor('Director'))
    assert error.value.status_code == 409
    workforce.approve_procurement_sow('candidate-1', period='2026-10', current_user=actor('Procurement'))
    workforce.reject_procurement_sow('candidate-1', {'rejection_notes': 'Correct hours'}, period='2026-10', current_user=actor('Director'))
    doc = db.sow_documents.find_one({'period': '2026-10'})
    assert doc['status'] == 'Rejected by Director'
    assert doc['sow_data']['status'] == 'Rejected by Director'
    assert doc['rejection_notes'] == 'Correct hours'
    assert doc['rejected_by'] == 'Director (Director)'
    assert doc['procurement_authorized'] is False
    assert workforce.get_finance_work_orders(period='2026-10', current_user=actor('Finance'))['ready_for_payment_count'] == 0
    service.dispatch_vendor_sow('candidate-1', actor('Super Admin'), '2026-10')
    assert db.sow_documents.find_one({'period': '2026-10'})['status'] == 'Sent to Procurement'
