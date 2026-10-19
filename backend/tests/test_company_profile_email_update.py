"""Exercise profile email uniqueness through the production Mongo query builder."""
import re
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from fastapi import HTTPException
from modules.identity.domain.models import User
from modules.identity.domain.schemas import CompanyProfileUpdate
from modules.shared.db import Session
from tests.test_company_profile_name_update import profile_endpoint, body


class Users:
    def __init__(self, documents):
        self.documents = documents

    def find_one(self, filters, **kwargs):
        for document in self.documents:
            def matches(key, value):
                actual = document.get(key)
                if isinstance(value, dict):
                    if '$ne' in value:
                        return actual != value['$ne']
                    if '$regex' in value:
                        return re.search(value['$regex'], actual or '', re.I) is not None
                return actual == value
            if all(matches(key, value) for key, value in filters.items()):
                return document.copy()
        return None


def run_update(email, other_email='unrelated@example.com', deleted=False):
    endpoint, original_session, tenant, company, _ = profile_endpoint()
    endpoint.__globals__.update(User=User, re=re)
    users = Users([
        dict(id='user-1', email='admin@example.com', name='Admin', role='Admin', is_deleted=False),
        dict(id='user-2', email=other_email, name='Other', role='Admin', is_deleted=deleted),
    ])
    mongo_session = Session({User.__tablename__: users})
    session = SimpleNamespace(
        query=lambda model: mongo_session.query(model) if model is User else original_session.query(model),
        commit=Mock(),
    )
    payload = body(None)
    payload.admin_email = email
    current = SimpleNamespace(role='Admin', tenant_id=tenant.id, id='user-1')
    return endpoint, payload, current, session


@pytest.mark.parametrize('email', ['new@example.com', ' NEW@Example.com ', 'admin@example.com', 'ADMIN@EXAMPLE.COM', 'new+tag@example.com'])
def test_available_or_own_email_saves(email):
    endpoint, payload, current, session = run_update(email)
    result = endpoint(payload, current, session)
    assert result['admin_email'] == email.strip().lower()
    session.commit.assert_called_once()


def test_another_accounts_email_rejected_case_insensitively():
    endpoint, payload, current, session = run_update('taken@example.com', 'Taken@Example.com')
    with pytest.raises(HTTPException) as error:
        endpoint(payload, current, session)
    assert error.value.status_code == 400
    assert 'enter a different email' in error.value.detail
    session.commit.assert_not_called()


def test_deleted_account_does_not_block_email():
    endpoint, payload, current, session = run_update('old@example.com', 'old@example.com', deleted=True)
    assert endpoint(payload, current, session)['admin_email'] == 'old@example.com'


def test_email_match_escapes_regex_characters():
    endpoint, payload, current, session = run_update('first.last@example.com', 'firstXlast@example.com')
    assert endpoint(payload, current, session)['admin_email'] == 'first.last@example.com'


@pytest.mark.parametrize('email', ['', '   ', 'invalid', 'a@@example.com', 'a b@example.com', 'a..b@example.com'])
def test_invalid_email_is_rejected(email):
    with pytest.raises(ValueError):
        CompanyProfileUpdate(admin_email=email)


def test_schema_normalizes_email():
    assert CompanyProfileUpdate(admin_email=' Admin@Example.com ').admin_email == 'admin@example.com'
