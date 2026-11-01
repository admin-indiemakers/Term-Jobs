import pytest

from modules.requisition.domain.required_details import missing_requisition_details


def test_requisition_is_blocked_until_required_details_are_confirmed():
    assert missing_requisition_details({
        "department": "Engineering",
        "location": "Remote",
        "experience_level": "Mid (2-5 yrs)",
        "hiring_model": "To be confirmed",
        "target_start_date": "To be confirmed",
        "submission_deadline": "2099-11-10",
        "work_mode": "On-site",
        "skills": ["To be confirmed"],
    }) == ["Hiring model", "Target start date", "Required skills"]


def test_complete_requisition_has_no_missing_fields():
    assert missing_requisition_details({
        "department": "Engineering",
        "location": "Remote",
        "experience_level": "Mid (2-5 yrs)",
        "hiring_model": "Remote",
        "target_start_date": "November 2026",
        "submission_deadline": "2099-11-10",
        "work_mode": "On-site",
        "skills": ["Python", "FastAPI"],
    }) == []


def test_application_due_date_must_be_confirmed():
    values = {
        "department": "Sales", "location": "Kozhikode", "experience_level": "Mid (3-5 yrs)",
        "hiring_model": "Direct Hiring", "work_mode": "On-site", "target_start_date": "Nov 15 2026", "skills": ["SEO"],
    }
    assert missing_requisition_details(values) == ["Application due date"]
    assert missing_requisition_details({**values, "submission_deadline": "2026-11-10"}) == []


@pytest.mark.parametrize('mode', ['', None, 'To be confirmed', 'Kozhikode', 'Direct Hiring'])
def test_missing_or_invalid_work_mode_blocks_submission(mode):
    assert 'Work mode (On-site, Hybrid, or Remote)' in missing_requisition_details({'work_mode': mode})


@pytest.mark.parametrize('mode', ['On-site', 'Hybrid', 'Remote'])
def test_explicit_work_mode_is_accepted(mode):
    assert 'Work mode (On-site, Hybrid, or Remote)' not in missing_requisition_details({'work_mode': mode})


def test_publish_rejects_missing_work_mode_before_writing():
    from contextlib import contextmanager
    from unittest.mock import Mock
    from modules.requisition.domain.models import Requisition
    from modules.requisition.services.requisition_service import RequisitionService
    req = Requisition(id='draft', status='Approved', structured_role={})
    session = Mock()
    session.get.return_value = req
    @contextmanager
    def factory():
        yield session
    with pytest.raises(ValueError, match='Choose a work mode'):
        RequisitionService(session_factory=factory).publish('draft')
    session.commit.assert_not_called()
