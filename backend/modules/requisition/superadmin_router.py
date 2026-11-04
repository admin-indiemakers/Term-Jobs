"""Platform-managed requisitions posted on behalf of client companies."""
from typing import Literal
from uuid import NAMESPACE_URL, uuid5

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator
from pymongo.errors import DuplicateKeyError

from modules.identity.domain.models import User
from modules.identity.router import get_current_user
from modules.shared.cache import cache
from modules.shared.db import db, _utcnow
from .domain.deadline import normalize_start_date, validate_start_date, validate_submission_deadline
from .domain.models import Requisition


def require_superadmin(user: User = Depends(get_current_user)):
    if user.role != 'Super Admin':
        raise HTTPException(403, 'Super Admin access required.')
    return user


router = APIRouter(prefix='/api/superadmin/requisitions', tags=['Super Admin Requisitions'], dependencies=[Depends(require_superadmin)])
MANAGED = {'intake_meta.intake_mode': 'superadmin_post'}


class PostingDetails(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra='forbid')
    company_name: str = Field(min_length=1, max_length=200)
    title: str = Field(min_length=1, max_length=200)
    department: str = Field(min_length=1, max_length=100)
    location: str = Field(min_length=1, max_length=200)
    work_mode: Literal['On-site', 'Hybrid', 'Remote']
    experience: str = Field(min_length=1, max_length=100)
    duration: str = Field(min_length=1, max_length=200)
    headcount: int = Field(ge=1, le=10000)
    start_date: str = Field(min_length=1, max_length=100)
    submission_deadline: str = Field(min_length=1, max_length=10)
    skills: list[str] = Field(min_length=1, max_length=100)
    job_description: str = Field(min_length=1, max_length=30000)

    @field_validator('start_date')
    @classmethod
    def valid_start(cls, value):
        validate_start_date(value)
        return normalize_start_date(value)

    @field_validator('submission_deadline')
    @classmethod
    def valid_deadline(cls, value):
        validate_submission_deadline(value)
        return value

    @field_validator('skills')
    @classmethod
    def valid_skills(cls, values):
        values = list(dict.fromkeys(v.strip() for v in values if v.strip()))
        if not values:
            raise ValueError('Provide at least one required skill.')
        return values


class PostingIn(PostingDetails):
    client_request_id: str = Field(min_length=1, max_length=100)


def posting_role(body: PostingDetails):
    return {
        'title': body.title, 'department': body.department, 'location': body.location,
        'work_locations': [body.location], 'work_mode': body.work_mode,
        'experience': body.experience, 'experience_level': body.experience,
        'employment_type': 'Contract', 'engagement_type': 'Contract', 'hiring_model': 'Direct Hiring',
        'duration': body.duration, 'contract_duration': body.duration, 'headcount': body.headcount,
        'start_date': body.start_date, 'target_start_date': body.start_date,
        'submission_deadline': body.submission_deadline, 'must_have_skills': body.skills,
        'job_description': body.job_description,
    }


def posting_view(row):
    role = row.get('structured_role') or {}
    return {'id': row['id'], 'title': row.get('title'), 'company_name': row.get('company_name'),
            'status': row.get('status'), 'structured_role': role,
            'created_at': row.get('created_at'), 'applicants_count': db.candidate_submissions.count_documents({'requisition_id': row['id']})}


@router.get('')
def list_postings(user=Depends(require_superadmin)):
    rows = db.requisitions.find(MANAGED).sort('created_at', -1)
    return [posting_view(row) for row in rows]


@router.post('', status_code=201)
def post_requisition(body: PostingIn, user=Depends(require_superadmin)):
    if not user.tenant_id:
        raise HTTPException(400, 'The Super Admin account needs a platform tenant.')
    req_id = str(uuid5(NAMESPACE_URL, f'superadmin-post:{user.id}:{body.client_request_id}'))
    existing = db.requisitions.find_one({'id': req_id, **MANAGED})
    if existing:
        return posting_view(existing)
    now = _utcnow()
    profile_id = str(uuid5(NAMESPACE_URL, f'managed-company:{user.tenant_id}:{body.company_name.casefold()}'))
    db.company_profiles.update_one({'id': profile_id}, {'$setOnInsert': {
        'id': profile_id, 'tenant_id': user.tenant_id, 'name': body.company_name,
        'created_at': now, 'managed_by_superadmin': True,
    }}, upsert=True)
    role = posting_role(body)
    row = Requisition(id=req_id, tenant_id=user.tenant_id, company_profile_id=profile_id,
        created_by=user.id, title=body.title, status='Published', structured_role=role,
        generated_jd_markdown=body.job_description, intent={'title': body.title, 'description': body.job_description},
        intake_meta={'intake_mode': 'superadmin_post'}, approved_by=user.name or user.email,
        approved_at=now, created_at=now, updated_at=now).to_doc()
    row.update({'_id': req_id, 'company_name': body.company_name})
    try:
        db.requisitions.insert_one(row)
    except DuplicateKeyError:
        row = db.requisitions.find_one({'_id': req_id})
    cache.clear()
    return posting_view(row)


@router.put('/{requisition_id}')
def edit_posting(requisition_id: str, body: PostingDetails, user=Depends(require_superadmin)):
    query = {'id': requisition_id, **MANAGED}
    existing = db.requisitions.find_one(query)
    if not existing:
        raise HTTPException(404, 'Managed requisition not found.')
    now = _utcnow()
    profile_id = str(uuid5(NAMESPACE_URL, f"managed-company:{existing['tenant_id']}:{body.company_name.casefold()}"))
    db.company_profiles.update_one({'id': profile_id}, {'$setOnInsert': {
        'id': profile_id, 'tenant_id': existing['tenant_id'], 'name': body.company_name,
        'created_at': now, 'managed_by_superadmin': True,
    }}, upsert=True)
    changes = {
        'title': body.title, 'company_name': body.company_name, 'company_profile_id': profile_id,
        'generated_jd_markdown': body.job_description,
        'intent.title': body.title, 'intent.description': body.job_description,
        'updated_at': now,
    }
    changes.update({f'structured_role.{key}': value for key, value in posting_role(body).items()})
    db.requisitions.update_one(query, {'$set': changes})
    cache.clear()
    return posting_view(db.requisitions.find_one(query))


@router.get('/{requisition_id}/applicants')
def list_applicants(requisition_id: str, user=Depends(require_superadmin)):
    if not db.requisitions.find_one({'id': requisition_id, **MANAGED}, {'_id': 1}):
        raise HTTPException(404, 'Managed requisition not found.')
    query = {'requisition_id': requisition_id}
    resume_ids = {row.get('id') for row in db.candidate_submissions.find(
        {**query, 'resume_pdf': {'$exists': True, '$nin': [None, '']}}, {'id': 1})}
    rows = db.candidate_submissions.find(query, {'resume_pdf': 0, 'resume_text': 0}).sort('created_at', -1)
    result = []
    for row in rows:
        result.append({
            'id': row['id'], 'candidate_name': row.get('candidate_name') or 'Candidate',
            'candidate_email': row.get('candidate_email') or '',
            'candidate_phone': (row.get('details') or {}).get('candidate_phone') or '',
            'status': row.get('status') or 'Submitted', 'applied_at': row.get('created_at'),
            'skills': (row.get('details') or {}).get('skills') or row.get('matched_skills') or [],
            'has_resume': row.get('id') in resume_ids, 'filename': row.get('filename'),
        })
    return result


@router.post('/{requisition_id}/close')
def close_posting(requisition_id: str, user=Depends(require_superadmin)):
    result = db.requisitions.update_one({'id': requisition_id, **MANAGED}, {'$set': {'status': 'Closed', 'updated_at': _utcnow()}})
    if not result.matched_count:
        raise HTTPException(404, 'Managed requisition not found.')
    cache.clear()
    return {'id': requisition_id, 'status': 'Closed'}
