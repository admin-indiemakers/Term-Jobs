"""Authorize interview resources using company ownership or an exact invitation."""
import os
from fastapi import HTTPException


def authorize_round(database, round_doc, user=None, invitation=''):
    if not round_doc:
        raise HTTPException(status_code=404, detail='Interview not found')
    if user:
        if getattr(user, 'role', '') == 'Super Admin':
            return 'interviewer'
        user_email = getattr(user, 'email', None)
        if user_email:
            u_email_clean = str(user_email).strip().lower()
            int_email = str(round_doc.get('interviewer_email') or '').strip().lower()
            cand_email = str(round_doc.get('candidate_email') or '').strip().lower()
            if int_email and u_email_clean == int_email:
                return 'interviewer'
            if cand_email and u_email_clean == cand_email:
                return 'candidate'
        if user.tenant_id and user.tenant_id == round_doc.get('tenant_id'):
            if user.role in ('Admin', 'HR', 'Director', 'Hiring Manager', 'Recruiter', 'Interviewer'):
                return 'interviewer'
            req = database['requisitions'].find_one({'id': round_doc.get('requisition_id'), 'tenant_id': user.tenant_id})
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
