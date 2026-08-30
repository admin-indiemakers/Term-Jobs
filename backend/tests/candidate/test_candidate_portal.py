import uuid
import pytest
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException

from modules.shared.db import get_session, init_db, db
from modules.identity.domain.models import User, Tenant
from modules.candidate.domain.models import CandidateSubmission
from modules.candidate_portal.router import (
    get_candidate_profile,
    get_candidate_dashboard,
    get_candidate_assignment,
    get_current_timesheet,
    list_candidate_timesheets,
    save_timesheet_draft,
    submit_timesheet,
    get_candidate_attendance,
    SaveTimesheetRequest,
)

@pytest.fixture
def setup_candidate_test_data():
    init_db()
    with get_session() as session:
        tenant = Tenant(name="Bearitt Client")
        session.add(tenant)
        session.commit()

        cand_user = User(
            email=f"candidate_test_{datetime.now().timestamp()}@example.com",
            name="Sreehari P S",
            role="Candidate",
            candidate_id=f"BEAR-{uuid.uuid4().hex[:8]}",
            tenant_id=tenant.id
        )
        session.add(cand_user)

        # Candidate submission record
        sub = CandidateSubmission(
            id=cand_user.candidate_id,
            candidate_name=cand_user.name,
            candidate_email=cand_user.email,
            vendor_name="bridgeon",
            status="Accepted"
        )
        session.add(sub)
        session.commit()

        # Onboarding checklist
        db["onboarding_checklists"].insert_one({
            "candidate_id": cand_user.candidate_id,
            "candidate_name": cand_user.name,
            "candidate_email": cand_user.email,
            "company_name": "Bearitt",
            "vendor_name": "bridgeon",
            "requisition_title": "DevOps Engineer",
            "status": "completed"
        })

        return {"user": cand_user, "tenant": tenant, "sub": sub}


def test_candidate_portal_dashboard_and_assignment(setup_candidate_test_data):
    data = setup_candidate_test_data
    user = data["user"]

    # 1. Profile / Me
    me = get_candidate_profile(current_user=user)
    assert me["name"] == "Sreehari P S"
    assert me["company"] == "Bearitt"
    assert me["vendor"] == "bridgeon"
    assert me["status"] == "Active & Verified"

    # 2. Dashboard payload
    dash = get_candidate_dashboard(current_user=user)
    assert dash["candidate"]["name"] == "Sreehari P S"
    assert dash["work_order"]["status"] == "ACTIVE"
    assert dash["work_order"]["weekly_hours"] == 40.0
    assert dash["weekly_summary"]["expected_hours"] == 40.0
    assert len(dash["current_timesheet"]["daily_entries"]) == 7

    # 3. Assignment spec
    assign = get_candidate_assignment(current_user=user)
    assert assign["status"] == "success"
    assert assign["assignment"]["work_order_number"].startswith("WO-2026-")
    assert assign["assignment"]["work_arrangement"] in ["Remote", "Hybrid", "On-site", ""]
    assert assign["timeline"]["current_phase"] == "Active Delivery & Sprint Execution"


def test_timesheet_draft_and_submission(setup_candidate_test_data):
    data = setup_candidate_test_data
    user = data["user"]

    # 1. Fetch current smart draft
    cur_res = get_current_timesheet(current_user=user)
    assert cur_res["status"] == "success"
    entries = cur_res["timesheet"]["daily_entries"]
    week_start = cur_res["timesheet"]["week_start_date"]
    week_end = cur_res["timesheet"]["week_end_date"]

    # 2. Edit Monday hours to 8.0h and save draft (Monday is today or past)
    entries[0]["hours"] = 8.0
    # ensure future days have 0.0 hours
    for i in range(1, 7):
        entries[i]["hours"] = 0.0

    draft_req = SaveTimesheetRequest(
        week_start_date=week_start,
        week_end_date=week_end,
        daily_entries=entries,
        notes="Adjusted Monday hours"
    )
    save_res = save_timesheet_draft(payload=draft_req, current_user=user)
    assert save_res["status"] == "success"
    assert save_res["timesheet"]["status"] == "DRAFT"
    assert save_res["timesheet"]["total_hours"] == 8.0

    # 3. Submit timesheet
    submit_res = submit_timesheet(payload=draft_req, current_user=user)
    assert submit_res["status"] == "success"
    assert submit_res["timesheet"]["status"] == "SUBMITTED"
    assert submit_res["timesheet"]["submitted_at"] is not None

    # 4. List timesheets
    list_res = list_candidate_timesheets(current_user=user)
    assert list_res["status"] == "success"
    assert len(list_res["timesheets"]) >= 1


def test_timesheet_validation_negative_hours(setup_candidate_test_data):
    data = setup_candidate_test_data
    user = data["user"]

    cur_res = get_current_timesheet(current_user=user)
    entries = cur_res["timesheet"]["daily_entries"]
    entries[0]["hours"] = -5.0  # Invalid negative hours

    invalid_req = SaveTimesheetRequest(
        week_start_date=cur_res["timesheet"]["week_start_date"],
        week_end_date=cur_res["timesheet"]["week_end_date"],
        daily_entries=entries
    )

    with pytest.raises(HTTPException) as exc_info:
        save_timesheet_draft(payload=invalid_req, current_user=user)
    assert exc_info.value.status_code == 400


def test_timesheet_validation_future_date(setup_candidate_test_data):
    data = setup_candidate_test_data
    user = data["user"]

    cur_res = get_current_timesheet(current_user=user)
    entries = cur_res["timesheet"]["daily_entries"]
    # Day index 6 is Sunday (future date)
    entries[6]["hours"] = 8.0

    invalid_req = SaveTimesheetRequest(
        week_start_date=cur_res["timesheet"]["week_start_date"],
        week_end_date=cur_res["timesheet"]["week_end_date"],
        daily_entries=entries
    )

    with pytest.raises(HTTPException) as exc_info:
        save_timesheet_draft(payload=invalid_req, current_user=user)
    assert exc_info.value.status_code == 400
    assert "Cannot mark hours for future date" in exc_info.value.detail


def test_candidate_attendance(setup_candidate_test_data):
    data = setup_candidate_test_data
    user = data["user"]

    att_res = get_candidate_attendance(current_user=user)
    assert att_res["status"] == "success"
    assert att_res["attendance"]["present_days"] == 0
    assert att_res["attendance"]["payable_days"] == 0.0


def test_candidate_expenses_list_and_create(setup_candidate_test_data):
    data = setup_candidate_test_data
    user = data["user"]
    from modules.candidate_portal.router import list_candidate_expenses, create_candidate_expense, ExpenseCreateRequest
    from fastapi import HTTPException

    # 1. List expenses (initial seed check)
    exp_res = list_candidate_expenses(current_user=user)
    assert exp_res["status"] == "success"
    assert exp_res["total_this_month"] == 0.0
    assert len(exp_res["expenses"]) == 0

    # 2. Reject expense before assignment start date (e.g. 2026-08-22)
    with pytest.raises(HTTPException) as exc_past:
        create_candidate_expense(
            payload=ExpenseCreateRequest(
                date="2026-08-22",
                category="Travel",
                amount=200.0,
                receipt_name="cab_bill.pdf",
                description="Pre-start travel"
            ),
            current_user=user
        )
    assert exc_past.value.status_code == 400

    # 3. Reject future expense (e.g. 2026-08-30)
    with pytest.raises(HTTPException) as exc_future:
        create_candidate_expense(
            payload=ExpenseCreateRequest(
                date="2026-08-30",
                category="Broadband & Internet",
                amount=850.0,
                receipt_name="broadband_bill_aug.pdf",
                description="Future internet"
            ),
            current_user=user
        )
    assert exc_future.value.status_code == 400

    # 4. Create valid expense for today (2026-08-25)
    new_req = ExpenseCreateRequest(
        date="2026-08-25",
        category="Broadband & Internet",
        amount=850.0,
        receipt_name="broadband_bill_aug.pdf",
        description="High speed internet for remote DevOps work",
        status="Pending"
    )
    create_res = create_candidate_expense(payload=new_req, current_user=user)
    assert create_res["status"] == "success"
    assert create_res["expense"]["amount"] == 850.0

    # 5. Verify total updated
    exp_res_after = list_candidate_expenses(current_user=user)
    assert exp_res_after["total_this_month"] == 850.0
    assert len(exp_res_after["expenses"]) == 1

def test_candidate_notifications_flow(setup_candidate_test_data):
    data = setup_candidate_test_data
    user = data["user"]
    cand_id = user.candidate_id or ""
    from modules.candidate_portal.router import list_candidate_notifications, mark_notification_read, mark_all_notifications_read

    # Insert test notification for candidate
    notif_id = f"notif_{uuid.uuid4().hex[:8]}"
    db["candidate_notifications"].insert_one({
        "id": notif_id,
        "candidate_id": cand_id,
        "title": "Welcome Notification",
        "message": "Your candidate portal session is active.",
        "category": "system",
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })

    # 1. List notifications
    res = list_candidate_notifications(current_user=user)
    assert res["status"] == "success"
    assert len(res["notifications"]) >= 1

    # 2. Mark single notification as read
    first_notif_id = res["notifications"][0]["id"]
    mark_res = mark_notification_read(notification_id=first_notif_id, current_user=user)
    assert mark_res["status"] == "success"

    # 3. Mark all as read
    all_res = mark_all_notifications_read(current_user=user)
    assert all_res["status"] == "success"

    # 4. Check unread count is 0
    res2 = list_candidate_notifications(current_user=user)
    assert res2["unread_count"] == 0
