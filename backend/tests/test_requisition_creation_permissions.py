from types import SimpleNamespace
import pytest
from fastapi import HTTPException
from modules.requisition.permissions import require_requisition_creator


@pytest.mark.parametrize('role', ['Procurement', 'Procurement Team', 'Employee', 'Finance', 'Candidate', 'Recruiter', 'Director'])
def test_operational_roles_cannot_create_requisitions(role):
    with pytest.raises(HTTPException) as error:
        require_requisition_creator(SimpleNamespace(role=role))
    assert error.value.status_code == 403


@pytest.mark.parametrize('role', ['Hiring Manager', 'HR', 'Admin', 'Company Admin', 'Super Admin'])
def test_hiring_roles_can_create_requisitions(role):
    require_requisition_creator(SimpleNamespace(role=role))
