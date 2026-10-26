"""Validated public waiting-list submissions to the configured Google Sheet webhook."""
import os
import base64
from datetime import datetime, timezone
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from typing import Annotated

router = APIRouter(prefix='/api/waitlist', tags=['Waiting list'])

# Public web-app endpoint; ship it with the backend so deployments do not depend
# on the ignored local .env file. Hosting configuration can override it.
DEFAULT_GOOGLE_SCRIPT_URL = (
    'https://script.google.com/macros/s/'
    'AKfycbxBtc2pKgJ-_NVoE5EqEYyGSgSLF_ahylsh2dc85C5q7-GJsGhlLoNf7DMYm_PLqa7UCg/exec'
)


class WaitlistEntry(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra='forbid')
    name: str = Field(min_length=1, max_length=100)
    company_name: str = Field(default='', max_length=160)
    email: EmailStr = Field(max_length=254)
    phone_number: str = Field(default='', max_length=40)
    requirements: str = Field(default='', max_length=2000)
    referral_source: str = Field(default='', max_length=160)


@router.post('')
def join_waitlist(entry: WaitlistEntry):
    # Keep new details in the legacy message column until the sheet script is updated.
    message = [entry.phone_number] if entry.phone_number else []
    if entry.requirements:
        message.append('Requirements: ' + entry.requirements)
    if entry.referral_source:
        message.append('How did you find us?: ' + entry.referral_source)
    return submit_to_sheet({
        **entry.model_dump(mode='json'),
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'formType': 'Waitlist',
        'topic': entry.company_name,
        'message': '\n'.join(message),
    })


def submit_to_sheet(payload):
    endpoint = os.getenv('WAITLIST_GOOGLE_SCRIPT_URL', '').strip() or DEFAULT_GOOGLE_SCRIPT_URL
    parsed = urlparse(endpoint)
    if parsed.scheme != 'https' or parsed.hostname != 'script.google.com' or not parsed.path.endswith('/exec'):
        raise HTTPException(503, 'Submissions are temporarily unavailable. Please try again later.')
    try:
        # Do not retry: Sheets may already have accepted a timed-out request.
        response = httpx.post(endpoint, json=payload, timeout=12, follow_redirects=True)
        response.raise_for_status()
        result = response.json()
        if result.get('status') != 'success' or result.get('error'):
            raise ValueError('Sheet did not acknowledge the submission')
    except (httpx.HTTPError, ValueError, TypeError, AttributeError):
        raise HTTPException(502, 'We could not confirm your submission. Please try again shortly.') from None
    return {'status': 'success'}


@router.post('/talent-pool')
async def join_talent_pool(
    name: Annotated[str, Form(min_length=1, max_length=100)],
    email: Annotated[EmailStr, Form(max_length=254)],
    resume: Annotated[UploadFile, File()],
):
    name = name.strip()
    if not name:
        raise HTTPException(422, 'Please enter your name.')
    filename = (resume.filename or '').replace('\\', '/').rsplit('/', 1)[-1]
    extension = filename.rsplit('.', 1)[-1].lower()
    mime_types = {
        'pdf': 'application/pdf',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    }
    try:
        if extension not in mime_types:
            raise HTTPException(422, 'Please upload a PDF, DOC or DOCX résumé.')
        contents = await resume.read(2 * 1024 * 1024 + 1)
        if not contents:
            raise HTTPException(422, 'Please upload your résumé.')
        if len(contents) > 2 * 1024 * 1024:
            raise HTTPException(413, 'Please choose a résumé smaller than 2 MB.')
    finally:
        await resume.close()
    payload = {
        'name': name, 'email': str(email),
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'formType': 'Talent Network',
        'resumeBase64': 'data:' + mime_types[extension] + ';base64,' + base64.b64encode(contents).decode('ascii'),
        'resumeMimeType': mime_types[extension],
        'resumeName': filename,
    }
    # The Google request is blocking; keep it off the async event loop.
    from starlette.concurrency import run_in_threadpool
    return await run_in_threadpool(submit_to_sheet, payload)
