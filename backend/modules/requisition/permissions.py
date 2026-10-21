"""Permissions for initiating the hiring requisition workflow."""
from fastapi import HTTPException

REQUISITION_CREATORS = {'Hiring Manager', 'HR', 'Admin', 'Company Admin', 'Super Admin'}


def require_requisition_creator(user):
    if user.role not in REQUISITION_CREATORS:
        raise HTTPException(403, 'Your role cannot create requisitions. Procurement prepares billing agreements and submits them for Director approval.')
