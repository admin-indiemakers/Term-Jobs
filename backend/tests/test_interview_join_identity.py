import asyncio
from contextlib import nullcontext
from types import SimpleNamespace
from unittest.mock import MagicMock
import pytest
from fastapi import HTTPException
from starlette.requests import Request
from modules.interview import router


def test_calendar_owner_joins_as_interviewer_and_candidate_token_stays_candidate(monkeypatch):
    session = MagicMock()
    session.query.return_value.filter.return_value.first.return_value = SimpleNamespace(tenant_id='company', created_by='manager', interviewer_email='manager@example.com', interviewer_name='Manager', candidate_name='Candidate', interviewer_token='staff-token', candidate_token='candidate-token')
    monkeypatch.setattr(router, 'get_session', lambda: nullcontext(session))
    monkeypatch.setattr(router, 'get_current_user', lambda authorization, db: SimpleNamespace(id='manager', tenant_id='company', role='Hiring Manager', email='manager@example.com', name='Manager'))
    request = Request({'type': 'http', 'headers': [(b'authorization', b'Bearer jwt')]})
    assert asyncio.run(router.resolve_interview_join_identity('round', request, ''))['role'] == 'interviewer'
    guest = Request({'type': 'http', 'headers': []})
    assert asyncio.run(router.resolve_interview_join_identity('round', guest, 'candidate-token'))['role'] == 'candidate'
    with pytest.raises(HTTPException): asyncio.run(router.resolve_interview_join_identity('round', guest, ''))
    monkeypatch.setattr(router, 'get_current_user', lambda authorization, db: SimpleNamespace(id='other', tenant_id='foreign', role='Hiring Manager', email='other@example.com', name='Other'))
    with pytest.raises(HTTPException): asyncio.run(router.resolve_interview_join_identity('round', request, ''))
