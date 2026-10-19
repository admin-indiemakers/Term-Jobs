"""Optional form examples must never become saved requisition requirements."""
import pytest
from modules.requisition.domain.schemas import RoleIntent
from modules.requisition.services.requisition_service import _structured_role_from_prefill


@pytest.mark.parametrize('prefill,expected', [
    ({'experience_band': ''}, ''),
    ({}, ''),
    ({'experience_band': '2-4 yrs'}, '2-4 yrs'),
    ({'experience': '10+ years'}, '10+ years'),
    ({'experience_band': '', 'experience': '5-8 years'}, ''),
])
def test_experience_preserves_form_value(prefill, expected):
    result = _structured_role_from_prefill(RoleIntent(title='Engineer', description='Build APIs'), {'title': 'Engineer', **prefill})
    assert result['experience'] == expected


def test_empty_optional_fields_remain_empty():
    result = _structured_role_from_prefill(RoleIntent(title='Engineer', description='Build APIs'), {'title': 'Engineer', 'experience_band': '', 'work_mode': '', 'duration': '', 'submission_deadline': ''})
    for field in ('experience', 'work_mode', 'duration', 'contract_duration', 'submission_deadline'):
        assert result[field] == ''
