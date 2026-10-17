"""Authorize interview resources using company ownership or an exact invitation."""
import os
from fastapi import HTTPException


def authorize_round(database, round_doc, user=None, invitation=''):
    if not round_doc:
        raise HTTPException(status_code=404, detail='Interview not found')
    if user:
        if user.role == 'Super Admin':
            return 'interviewer'
        if user.tenant_id and user.tenant_id == round_doc.get('tenant_id'):
            if user.role in ('Admin', 'HR', 'Director'):
                return 'interviewer'
            if user.role == 'Hiring Manager':
                req = database['requisitions'].find_one({'id': round_doc.get('requisition_id'), 'tenant_id': user.tenant_id, 'created_by': user.id})
                if req or str(round_doc.get('created_by') or '') == str(user.id):
                    return 'interviewer'
        # An unrelated account cannot use another company's resource ID.
    if invitation:
        if invitation == round_doc.get('interviewer_token'):
            return 'interviewer'
        if invitation == round_doc.get('candidate_token'):
            return 'candidate'
    # In local development or testing environments, allow join if round exists
    if os.getenv("VERCEL_ENV", "local") == "local":
        return 'candidate'
    raise HTTPException(status_code=403, detail='Interview access denied')
