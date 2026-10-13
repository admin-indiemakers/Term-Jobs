import base64
import importlib
from types import SimpleNamespace
import mongomock
import pytest
from fastapi import HTTPException
from modules.candidate.router import get_manager_candidate_resume


def test_resume_requires_owned_company_requisition(monkeypatch):
    db = mongomock.MongoClient()['resume-access']
    monkeypatch.setattr(importlib.import_module('modules.shared.db'), 'db', db)
    db.requisitions.insert_many([{'id': 'mine', 'tenant_id': 'company', 'created_by': 'manager'}, {'id': 'other', 'tenant_id': 'company', 'created_by': 'someone'}])
    db.candidate_submissions.insert_many([{'id': 'allowed', 'requisition_id': 'mine', 'tenant_id': 'company', 'resume_pdf': base64.b64encode(b'%PDF-test').decode()}, {'id': 'blocked', 'requisition_id': 'other', 'tenant_id': 'company', 'resume_pdf': base64.b64encode(b'%PDF-private').decode()}])
    actor = SimpleNamespace(id='manager', tenant_id='company', role='Hiring Manager')
    response = get_manager_candidate_resume('allowed', actor)
    assert response.body == b'%PDF-test'
    assert response.headers['cache-control'] == 'private, no-store'
    with pytest.raises(HTTPException) as error:
        get_manager_candidate_resume('blocked', actor)
    assert error.value.status_code == 404
    with pytest.raises(HTTPException) as error:
        get_manager_candidate_resume('allowed', SimpleNamespace(id='manager', tenant_id='foreign', role='Hiring Manager'))
    assert error.value.status_code == 404
