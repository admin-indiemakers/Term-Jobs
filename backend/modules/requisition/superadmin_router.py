"""Platform-managed requisitions posted on behalf of client companies."""
from typing import Literal
from datetime import timezone
from uuid import NAMESPACE_URL, uuid5

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field, HttpUrl, TypeAdapter, field_validator
from pymongo.errors import DuplicateKeyError

from modules.identity.domain.models import User
from modules.identity.router import get_current_user
from modules.shared.cache import cache
from modules.shared.db import db, _utcnow
from .domain.deadline import normalize_start_date, validate_start_date, validate_submission_deadline, submission_deadline_passed
from .domain.models import Requisition


def require_superadmin(user: User = Depends(get_current_user)):
    if user.role != 'Super Admin':
        raise HTTPException(403, 'Super Admin access required.')
    return user


router = APIRouter(prefix='/api/superadmin/requisitions', tags=['Super Admin Requisitions'], dependencies=[Depends(require_superadmin)])
public_views_router = APIRouter(prefix='/api/public/requisitions', tags=['Role views'])
MANAGED = {'intake_meta.intake_mode': 'superadmin_post'}


@public_views_router.get('/page')
def public_roles_page(page: int = Query(1, ge=1, le=100000), page_size: int = Query(8, ge=1, le=50),
                      q: str = Query('', max_length=200), work_mode: str = Query('', max_length=100),
                      family: str = Query('', max_length=200), location: str = Query('', max_length=200),
                      category: str = Query('', max_length=200)):
    from .public_listing import public_listing
    return public_listing(page, page_size, q, work_mode, family, location, category)


class RoleViewIn(BaseModel):
    model_config = ConfigDict(extra='forbid')
    visitor_id: str = Field(pattern=r'^[a-zA-Z0-9-]{1,100}$')


async def optional_viewer(authorization: str | None = Header(None)):
    if not authorization:
        return None
    from modules.candidate_profile.router import get_current_candidate
    return await get_current_candidate(authorization)


@public_views_router.post('/{requisition_id}/views', status_code=204)
def record_role_view(requisition_id: str, body: RoleViewIn, candidate=Depends(optional_viewer)):
    row = db.requisitions.find_one({'id': requisition_id, 'status': 'Published'}, {'structured_role': 1})
    if not row or submission_deadline_passed(row.get('structured_role') or {}):
        raise HTTPException(404, 'Published job requisition not found.')
    email = (candidate.get('candidate_email') or '').strip().lower() if candidate else ''
    identity = f'candidate:{email}' if email else f'anonymous:{body.visitor_id}'
    view_id = str(uuid5(NAMESPACE_URL, f'role-view:{requisition_id}:{identity}'))
    now = _utcnow()
    # Deterministic primary key prevents refreshes/concurrent opens from adding viewers.
    db.requisition_views.update_one({'_id': view_id}, {
        '$setOnInsert': {'requisition_id': requisition_id, 'first_viewed_at': now},
        '$set': {'last_viewed_at': now, 'candidate_id': candidate.get('id') if candidate else None,
                 'candidate_email': email, 'candidate_name': (candidate.get('candidate_name') or 'Candidate') if candidate else ''},
    }, upsert=True)


@router.get('/{requisition_id}/viewers')
def list_viewers(requisition_id: str, page: int = Query(1, ge=1), user=Depends(require_superadmin)):
    if not db.requisitions.find_one({'id': requisition_id, **MANAGED}, {'_id': 1}):
        raise HTTPException(404, 'Managed requisition not found.')
    query = {'requisition_id': requisition_id}
    total = db.requisition_views.count_documents(query)
    anonymous = db.requisition_views.count_documents({**query, 'candidate_email': ''})
    applied = {str(row.get('candidate_email') or '').strip().lower() for row in
               db.candidate_submissions.find(query, {'candidate_email': 1})}
    page_size = 50
    rows = db.requisition_views.find(query).sort([('last_viewed_at', -1), ('_id', 1)]).skip((page - 1) * page_size).limit(page_size)
    return {'total': total, 'anonymous_count': anonymous, 'identified_count': total - anonymous,
            'page': page, 'page_size': page_size, 'has_more': page * page_size < total,
            'viewers': [{'id': row['_id'], 'candidate_name': row.get('candidate_name') or 'Anonymous visitor',
                         'candidate_email': row.get('candidate_email') or '',
                         'first_viewed_at': row['first_viewed_at'].replace(tzinfo=timezone.utc).isoformat(),
                         'last_viewed_at': row['last_viewed_at'].replace(tzinfo=timezone.utc).isoformat(),
                         'has_applied': bool(row.get('candidate_email') and row['candidate_email'] in applied)} for row in rows]}


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
    internal_link: str = Field(default='', max_length=2048)

    @field_validator('internal_link')
    @classmethod
    def valid_internal_link(cls, value):
        if not value:
            return ''
        return str(TypeAdapter(HttpUrl).validate_python(value))

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
    private = db.requisition_internal_links.find_one({'_id': row['id']}) or {}
    return {'id': row['id'], 'title': row.get('title'), 'company_name': row.get('company_name'),
            'status': row.get('status'), 'structured_role': role, 'internal_link': private.get('url', ''),
            'created_at': row.get('created_at'), 'applicants_count': db.candidate_submissions.count_documents({'requisition_id': row['id']}),
            'viewers_count': db.requisition_views.count_documents({'requisition_id': row['id']})}


@router.get('')
def list_postings(user=Depends(require_superadmin)):
    rows = list(db.requisitions.find(MANAGED).sort('created_at', -1))
    for row in rows:
        role = row.get('structured_role') or {}
        if row.get('status') == 'Published' and submission_deadline_passed(role):
            result = db.requisitions.update_one({
                'id': row['id'], **MANAGED, 'status': 'Published',
                'structured_role.submission_deadline': role.get('submission_deadline'),
            }, {'$set': {'status': 'Closed', 'updated_at': _utcnow()}})
            if result.modified_count:
                cache.clear()
            row.update(db.requisitions.find_one({'id': row['id'], **MANAGED}) or {})
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
    db.requisition_internal_links.update_one({'_id': req_id}, {'$setOnInsert': {'url': body.internal_link}}, upsert=True)
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
    db.requisition_internal_links.update_one({'_id': requisition_id}, {'$set': {'url': body.internal_link}}, upsert=True)
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
