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
        "skills": ["Python", "FastAPI"],
    }) == []


def test_application_due_date_must_be_confirmed():
    values = {
        "department": "Sales", "location": "Kozhikode", "experience_level": "Mid (3-5 yrs)",
        "hiring_model": "Direct Hiring", "target_start_date": "Nov 15 2026", "skills": ["SEO"],
    }
    assert missing_requisition_details(values) == ["Application due date"]
    assert missing_requisition_details({**values, "submission_deadline": "2026-11-10"}) == []
