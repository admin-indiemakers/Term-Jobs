import pytest

from modules.requisition.domain.required_details import missing_requisition_details


def test_requisition_is_blocked_until_required_details_are_confirmed():
    assert missing_requisition_details({
        "department": "Engineering",
        "location": "Remote",
        "experience_level": "Mid (2-5 yrs)",
        "hiring_model": "To be confirmed",
        "target_start_date": "To be confirmed",
        "skills": ["To be confirmed"],
    }) == ["Hiring model", "Target start date", "Required skills"]


def test_complete_requisition_has_no_missing_fields():
    assert missing_requisition_details({
        "department": "Engineering",
        "location": "Remote",
        "experience_level": "Mid (2-5 yrs)",
        "hiring_model": "Remote",
        "target_start_date": "November 2026",
        "skills": ["Python", "FastAPI"],
    }) == []
