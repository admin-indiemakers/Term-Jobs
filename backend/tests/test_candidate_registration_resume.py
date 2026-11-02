import asyncio
from io import BytesIO
from unittest.mock import Mock
import pytest
from fastapi import HTTPException, UploadFile
from modules.candidate_profile import router


@pytest.mark.parametrize('resume', [None, UploadFile(filename='', file=BytesIO(b'')), UploadFile(filename='resume.pdf', file=BytesIO(b''))])
def test_registration_rejects_missing_or_empty_resume_before_writing(monkeypatch, resume):
    db = Mock()
    db.__getitem__ = Mock(return_value=Mock(find_one=Mock(return_value=None)))
    monkeypatch.setattr(router, 'db', db)
    monkeypatch.setattr(router, 'check_candidate_email_allowed', lambda *args, **kwargs: None)
    with pytest.raises(HTTPException) as error:
        asyncio.run(router.candidate_register(name='Candidate', email='candidate@gmail.com', password='password', phone='', resume=resume))
    assert error.value.status_code == 400
    assert 'resume' in error.value.detail.lower()
    if resume and resume.filename:
        db['candidates'].insert_one.assert_not_called()
