import uuid
import pytest
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException

from modules.shared.db import get_session, init_db, db
from modules.identity.domain.models import User, Tenant
from modules.candidate.domain.models import CandidateSubmission
from modules.onboarding.offboarding_router import (
    get_offboarding,
    initiate_offboarding,
    update_candidate_progress,
    complete_offboarding,
    get_offboarding_status,
    OffboardingInitiateRequest,
    CandidateProgressUpdate,
)
from modules.candidate_portal.router import (
    save_timesheet_draft,
    submit_timesheet,
    SaveTimesheetRequest,
)


@pytest.fixture
def setup_offboarding_test_data():
    init_db()
    with get_session() as session:
        tenant = session.query(Tenant).filter(Tenant.tenant_type == "client", Tenant.is_deleted == False).first()
        if not tenant:
            tenant = Tenant(name="Bearitt", tenant_type="client")
            session.add(tenant)
            session.commit()

        manager = User(
            email=f"manager_{uuid.uuid4().hex[:6]}@example.com",
            name="Rohith Manager",
            role="Hiring Manager",
            tenant_id=tenant.id,
        )
        session.add(manager)

        cand_id = f"BEAR-{uuid.uuid4().hex[:6]}"
        cand_email = f"hashil_{uuid.uuid4().hex[:6]}@company.com"
        cand_user = User(
            email=cand_email,
            name="Mohammed Hashil NK",
            role="Candidate",
            candidate_id=cand_id,
            workorder_id=cand_id,
            tenant_id=tenant.id,
        )
        session.add(cand_user)
        session.commit()

        # Seed onboarding checklist with laptop, badge, software, training
        db["onboarding_checklists"].insert_one({
            "candidate_id": cand_id,
            "workorder_id": cand_id,
            "candidate_name": "Mohammed Hashil NK",
            "candidate_email": cand_email,
            "requisition_title": "Senior Backend Engineer",
            "laptop_required": True,
            "laptop_spec": "MacBook Pro M3",
            "badge_required": True,
            "software": [
                {"id": "sw_github", "label": "GitHub Access", "enabled": True},
                {"id": "sw_slack", "label": "Slack Access", "enabled": True},
            ],
            "training": [
                {"id": "tr_security", "label": "Data Security & Privacy", "enabled": True},
            ],
            "status": "completed",
        })

        # Seed active work order
        db["work_orders"].insert_one({
            "id": f"wo_{uuid.uuid4().hex[:8]}",
            "work_order_number": f"WO-2026-{uuid.uuid4().hex[:4].upper()}",
            "candidate_id": cand_id,
            "workorder_id": cand_id,
            "candidate_name": cand_user.name,
            "candidate_email": cand_email,
            "status": "ACTIVE",
            "agreement_status": "Approved",
            "is_active": True,
        })

        yield {
            "manager": manager,
            "candidate": cand_user,
            "cand_id": cand_id,
            "cand_email": cand_email,
        }

        # Cleanup test records
        try:
            db["onboarding_checklists"].delete_many({"candidate_id": cand_id})
            db["work_orders"].delete_many({"candidate_id": cand_id})
            db["offboarding_checklists"].delete_many({"candidate_id": cand_id})
            db["users"].delete_many({"$or": [{"id": cand_user.id}, {"id": manager.id}, {"candidate_id": cand_id}]})
            session.delete(manager)
            session.delete(cand_user)
            session.commit()
        except Exception:
            pass


def test_offboarding_workflow(setup_offboarding_test_data):
    data = setup_offboarding_test_data
    manager = data["manager"]
    cand_user = data["candidate"]
    cand_id = data["cand_id"]

    # 1. GET /api/offboarding/{candidate_id} mirrors onboarding fields
    prepopulated = get_offboarding(cand_id, current_user=manager)
    assert prepopulated["candidate_id"] == cand_id
    assert prepopulated["laptop_return_required"] is True
    assert prepopulated["laptop_spec"] == "MacBook Pro M3"
    assert prepopulated["badge_return_required"] is True
    assert len(prepopulated["software_items"]) >= 2
    assert prepopulated["status"] == "not_started"

    # 2. POST /api/offboarding/{candidate_id}/initiate starts offboarding
    init_req = OffboardingInitiateRequest(
        laptop_return_required=True,
        laptop_spec="MacBook Pro M3",
        badge_return_required=True,
        software_items=prepopulated["software_items"],
        handover_items=prepopulated["handover_items"],
        custom_items=[{"id": "ci_nda", "label": "Exit NDA", "enabled": True}],
        notes="Please return equipment before Friday."
    )
    init_res = initiate_offboarding(cand_id, body=init_req, current_user=manager)
    assert init_res["status"] == "success"
    assert init_res["offboarding"]["status"] == "in_progress"

    # 3. PUT candidate progress
    progress_res = update_candidate_progress(
        cand_id,
        body=CandidateProgressUpdate(completed_items={"laptop": True, "badge": True}),
        current_user=cand_user,
    )
    assert progress_res["status"] == "success"
    assert progress_res["completed_items"]["laptop"] is True

    # 4. POST complete offboarding
    comp_res = complete_offboarding(cand_id, current_user=cand_user)
    assert comp_res["status"] == "success"
    assert comp_res["timesheet_frozen"] is True
    assert comp_res["access_expires_at"] is not None

    # Verify 48-hour access expiration calculation
    now = datetime.now(timezone.utc)
    exp_dt = datetime.fromisoformat(comp_res["access_expires_at"])
    if exp_dt.tzinfo is None:
        exp_dt = exp_dt.replace(tzinfo=timezone.utc)
    diff_hours = (exp_dt - now).total_seconds() / 3600.0
    assert 47.9 <= diff_hours <= 48.1

    # 5. Check offboarding status endpoint
    status_res = get_offboarding_status(cand_id)
    assert status_res["status"] == "completed"
    assert status_res["timesheet_frozen"] is True
    assert status_res["hours_remaining"] is not None
    assert status_res["is_expired"] is False

    # 6. Verify timesheet freezing: draft and submit reject immediately
    ts_req = SaveTimesheetRequest(
        daily_entries=[{"date": "2026-08-25", "hours": 8.0, "category": "Regular"}],
        week_start_date="2026-08-24",
        week_end_date="2026-08-30",
    )
    with pytest.raises(HTTPException) as exc_info:
        save_timesheet_draft(ts_req, current_user=cand_user)
    assert exc_info.value.status_code == 400
    assert "frozen" in exc_info.value.detail.lower()

    with pytest.raises(HTTPException) as exc_info:
        submit_timesheet(ts_req, current_user=cand_user)
    assert exc_info.value.status_code == 400
    assert "frozen" in exc_info.value.detail.lower()


def test_offboarding_48h_expiration_and_email_reuse(setup_offboarding_test_data):
    from modules.identity.router import login_user, create_or_update_portal_user, UserLogin
    from modules.identity.domain.models import User
    from modules.shared.db import get_session, db

    data = setup_offboarding_test_data
    manager = data["manager"]
    cand_user = data["candidate"]
    cand_id = data["cand_id"]
    cand_email = data["cand_email"]

    # Set password for candidate user
    with get_session() as session:
        cand_db = session.query(User).filter(User.id == cand_user.id).first()
        from modules.identity.router import hash_password
        cand_db.password_hash = hash_password("Password123!")
        session.commit()

    # Simulate that offboarding was completed and 48 hours have passed (expired 1 hour ago)
    past_expiration = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    db["offboarding_checklists"].update_one(
        {"candidate_id": cand_id},
        {"$set": {"status": "completed", "access_expires_at": past_expiration, "timesheet_frozen": True}},
        upsert=True,
    )
    db["users"].update_many(
        {"id": cand_user.id},
        {"$set": {"access_expires_at": past_expiration}},
    )

    # 1. Attempt candidate login after expiration -> Must be rejected with 403 Forbidden
    login_req = UserLogin(email=cand_email, password="Password123!")
    with get_session() as session:
        with pytest.raises(HTTPException) as exc_info:
            login_user(login_req, db=session)
        assert exc_info.value.status_code == 403
        assert "expired" in exc_info.value.detail.lower()

    # 2. Hiring manager / Admin provisions a new candidate using the SAME email
    new_candidate_id = f"BEAR-NEW-{uuid.uuid4().hex[:6]}"
    with get_session() as session:
        portal_res = create_or_update_portal_user(
            body={
                "email": cand_email,
                "name": "New Candidate Same Email",
                "workorder_id": new_candidate_id,
                "password": "NewPassword123!",
            },
            current_user=manager,
            db=session,
        )
        assert portal_res["ok"] is True

        # Verify old user email was archived and freed
        old_user = session.query(User).filter(User.id == cand_user.id).first()
        assert "offboarded_" in old_user.email
        assert old_user.is_active is False

        # Verify new user owns the original email
        new_user = session.query(User).filter(User.workorder_id == new_candidate_id).first()
        assert new_user is not None
        assert new_user.email == cand_email

    # 3. New candidate can successfully log in with their credentials
    with get_session() as session:
        new_login_req = UserLogin(email=cand_email, password="NewPassword123!")
        new_login_res = login_user(new_login_req, db=session)
        assert new_login_res.access_token is not None
        assert new_login_res.user.name == "New Candidate Same Email"


