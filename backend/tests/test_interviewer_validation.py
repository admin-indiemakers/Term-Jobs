import mongomock
import pytest
from fastapi import HTTPException
from types import SimpleNamespace

from modules.shared.db import Session
from modules.interview import router
from modules.identity.domain.models import User


@pytest.fixture
def test_setup(monkeypatch):
    database = mongomock.MongoClient()['test-interviewers']
    factory = lambda: Session(database)
    monkeypatch.setattr(router, 'db', database)
    monkeypatch.setattr(router, 'get_session', factory)
    
    actor = SimpleNamespace(id='hm_user', tenant_id='corp_1', role='Hiring Manager', name='Manager', email='manager@corp.com')
    with factory() as session:
        session.add(User(id='staff_1', tenant_id='corp_1', role='HR', name='Existing Staff', email='staff@corp.com', is_active=True))
        session.commit()
    return database, factory, actor


def test_add_valid_interviewer(test_setup):
    database, factory, actor = test_setup
    payload = {
        "name": "Sarah Connor",
        "role": "Principal Architect",
        "email": "sarah.connor@cyberdyne.com"
    }
    res = router.add_new_interviewer(payload, current_user=actor)
    assert res["success"] is True
    assert res["interviewer"]["name"] == "Sarah Connor"
    assert res["interviewer"]["role"] == "Principal Architect"
    assert res["interviewer"]["email"] == "sarah.connor@cyberdyne.com"
    
    # Verify in DB
    found = database["hiring_manager_interviewers"].find_one({"email": "sarah.connor@cyberdyne.com"})
    assert found is not None
    assert found["name"] == "Sarah Connor"


def test_reject_fake_or_placeholder_name(test_setup):
    _, _, actor = test_setup
    for bad_name in ["test", "fake", "asdf", "12345", "a", "dummy user"]:
        with pytest.raises(HTTPException) as exc:
            router.add_new_interviewer({
                "name": bad_name,
                "role": "Senior Engineer",
                "email": "valid.person@cyberdyne.com"
            }, current_user=actor)
        assert exc.value.status_code == 400


def test_reject_fake_or_placeholder_role(test_setup):
    _, _, actor = test_setup
    for bad_role in ["test", "fake", "123", "a", "---"]:
        with pytest.raises(HTTPException) as exc:
            router.add_new_interviewer({
                "name": "Alex Mercer",
                "role": bad_role,
                "email": "alex.m@cyberdyne.com"
            }, current_user=actor)
        assert exc.value.status_code == 400


def test_reject_fake_or_invalid_emails(test_setup):
    _, _, actor = test_setup
    invalid_emails = [
        "notanemail",
        "test@test.com",
        "fake@fake.com",
        "random@mailinator.com",
        "placeholder@tempmail.com",
        "dummy@company.com",
        "@nodomain.com",
        "missingtld@domain",
    ]
    for bad_email in invalid_emails:
        with pytest.raises(HTTPException) as exc:
            router.add_new_interviewer({
                "name": "Alex Mercer",
                "role": "Staff Engineer",
                "email": bad_email
            }, current_user=actor)
        assert exc.value.status_code == 400


def test_reject_duplicate_email_against_staff(test_setup):
    _, _, actor = test_setup
    # staff@corp.com is already registered as staff
    with pytest.raises(HTTPException) as exc:
        router.add_new_interviewer({
            "name": "Imposter Staff",
            "role": "Fake Role",
            "email": "staff@corp.com"
        }, current_user=actor)
    assert exc.value.status_code == 400
    assert "already registered" in exc.value.detail.lower()


def test_reject_duplicate_email_does_not_overwrite_existing(test_setup):
    database, _, actor = test_setup
    # Create initial interviewer
    router.add_new_interviewer({
        "name": "Original Interviewer",
        "role": "Lead Architect",
        "email": "lead.interviewer@cyberdyne.com"
    }, current_user=actor)
    
    original = database["hiring_manager_interviewers"].find_one({"email": "lead.interviewer@cyberdyne.com"})
    assert original["name"] == "Original Interviewer"
    original_id = original["id"]

    # Attempt to create duplicate with different details
    with pytest.raises(HTTPException) as exc:
        router.add_new_interviewer({
            "name": "Overwritten Name",
            "role": "Overwritten Role",
            "email": "lead.interviewer@cyberdyne.com"
        }, current_user=actor)
    assert exc.value.status_code == 400
    assert "already registered" in exc.value.detail.lower()

    # Verify original interviewer was NOT replaced or altered
    refreshed = database["hiring_manager_interviewers"].find_one({"email": "lead.interviewer@cyberdyne.com"})
    assert refreshed["name"] == "Original Interviewer"
    assert refreshed["role"] == "Lead Architect"
    assert refreshed["id"] == original_id
