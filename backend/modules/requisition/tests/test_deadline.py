from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
from pydantic import ValidationError

from modules.requisition.domain.deadline import validate_submission_deadline
from modules.requisition.domain.schemas import RoleIntent


@pytest.mark.parametrize("value", ["2026-10-13", "2025-01-01", "2026-02-30", "yesterday"])
def test_invalid_deadlines(value):
    with pytest.raises(ValueError):
        validate_submission_deadline(value, date(2026, 10, 14))


@pytest.mark.parametrize("value", ["2026-10-14", "2026-10-15", "", None])
def test_allowed_deadlines(value):
    validate_submission_deadline(value, date(2026, 10, 14))


@pytest.mark.parametrize("model_name,field", [
    ("RequisitionIn", "prefill"),
    ("ApproveIn", "edited_role"),
    ("UpdateRequisitionRoleIn", "structured_role"),
])
def test_api_payloads_reject_past_deadlines(model_name, field):
    import main
    yesterday = (datetime.now(ZoneInfo("Asia/Kolkata")).date() - timedelta(days=1)).isoformat()
    with pytest.raises(ValidationError, match="cannot be in the past"):
        getattr(main, model_name)(**{field: {"submission_deadline": yesterday}})


def test_service_rejects_past_deadline_before_persistence(service, company_profile, session_factory):
    from modules.requisition.domain.models import Requisition
    profile_id = company_profile()
    with pytest.raises(ValueError, match="cannot be in the past"):
        service.create(profile_id, RoleIntent(title="Engineer"), intake_meta={"prefill": {"submission_deadline": "2000-01-01"}})
    with session_factory() as session:
        assert session.query(Requisition).all() == []
