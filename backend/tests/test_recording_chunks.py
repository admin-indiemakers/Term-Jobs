import asyncio
import importlib
from contextlib import nullcontext
from io import BytesIO
from types import SimpleNamespace
from unittest.mock import MagicMock
import mongomock
import pytest
from fastapi import HTTPException, UploadFile
from modules.interview import router

UPLOAD = '058fa8ab-440c-49e0-968e-f18b40e05b24'

@pytest.fixture
def store(monkeypatch):
    db = mongomock.MongoClient()['chunks']
    monkeypatch.setattr(importlib.import_module('modules.shared.db'), 'db', db)
    session = MagicMock()
    session.query.return_value.filter.return_value.first.return_value = SimpleNamespace(candidate_token='secret', interviewer_token='staff')
    monkeypatch.setattr(router, 'get_session', lambda: nullcontext(session))
    return db


def test_chunks_are_idempotent_and_reassembled_in_order(store, monkeypatch):
    for index, data in [(1, b'last'), (0, b'first'), (0, b'first')]:
        router.upload_recording_chunk('round', UPLOAD, index, 'secret', UploadFile(filename='chunk', file=BytesIO(data)))
    assert store.interview_recording_chunks.count_documents({}) == 2
    saved = []
    monkeypatch.setattr(router, 'save_round_recording', lambda *args: saved.append(args) or {'recording_url': 'saved', 'recording_metadata': {}})
    result = router.complete_recording_upload('round', UPLOAD, 'secret', 2, 30, 'video/webm')
    assert saved[0][1] == b'firstlast'
    assert result['status'] == 'success'
    assert store.interview_recording_chunks.count_documents({}) == 0


def test_missing_chunks_do_not_save_video(store, monkeypatch):
    saver = MagicMock()
    monkeypatch.setattr(router, 'save_round_recording', saver)
    with pytest.raises(HTTPException) as exc:
        router.complete_recording_upload('round', UPLOAD, 'secret', 2, 30, 'video/webm')
    assert exc.value.status_code == 409
    saver.assert_not_called()
