"""Keep emailed interview credentials on the deployment that owns the record."""
import os
import re
from urllib.parse import urlsplit

from fastapi import HTTPException

from modules.shared.config import is_dev_qa_environment


def _origin(value):
    try:
        parsed = urlsplit(value or '')
        if parsed.username or parsed.password or not parsed.hostname:
            return None
        local = parsed.hostname in ('localhost', '127.0.0.1', '::1')
        if parsed.scheme != 'https' and not (local and parsed.scheme == 'http'):
            return None
        return f'{parsed.scheme}://{parsed.netloc.lower()}'
    except ValueError:
        return None


def resolve_admin_invitation_origin(request_origin=None):
    from modules.interview.services.interview_service import _resolve_interview_domain

    if not is_dev_qa_environment():
        return _resolve_interview_domain()

    # Production is never a fallback for a record saved in the isolated QA database.
    def nonproduction(value):
        origin = _origin(value)
        if not origin or urlsplit(origin).hostname in ('termjobs.in', 'www.termjobs.in', 'termjobs.vercel.app'):
            return None
        if os.getenv('VERCEL') and urlsplit(origin).hostname in ('localhost', '127.0.0.1', '::1'):
            return None
        return origin

    configured = [nonproduction(os.getenv(name)) for name in ('INTERVIEW_PUBLIC_DOMAIN', 'FRONTEND_BASE_URL')]
    trusted = [value for value in configured if value]
    requested = nonproduction(request_origin)
    # These preview frontend aliases also support calendar OAuth return URLs.
    owned_preview = requested and bool(re.fullmatch(
        r'https://(?:term-jobs|termjobs)(?:-git-(?:qa|dev)-[a-z0-9-]+|-(?:qa|dev))\.vercel\.app', requested,
    ))
    local_frontend = requested and not os.getenv('VERCEL') and urlsplit(requested).hostname in ('localhost', '127.0.0.1', '::1')
    if requested and (requested in trusted or owned_preview or local_frontend):
        return requested
    # VERCEL_URL belongs to the backend project in this repository. It cannot
    # serve the React interview page, so it must never be used as a frontend URL.
    if trusted:
        return trusted[0]
    raise HTTPException(409, 'No public interview URL is configured for this environment. Set FRONTEND_BASE_URL to this deployment’s frontend URL and resend the invitation.')
