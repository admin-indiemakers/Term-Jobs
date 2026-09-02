"""Shared pytest fixtures.

Tests run against an in-memory MongoDB mock (mongomock) and a deterministic
MockLLM, so the whole suite is offline. Integration against MongoDB Atlas +
Groq is covered by @pytest.mark.groq tests and the golden eval harness.
"""
import mongomock
import pytest

from modules.requisition.domain import models
from modules.requisition.llm.mock import MockLLM
from modules.shared.db import Session


@pytest.fixture
def session_factory():
    database = mongomock.MongoClient()["test"]
    return lambda: Session(database)


@pytest.fixture
def mock_llm():
    return MockLLM()


@pytest.fixture
def service(session_factory, mock_llm):
    from modules.requisition.services.requisition_service import RequisitionService

    return RequisitionService(llm=mock_llm, session_factory=session_factory)


@pytest.fixture
def company_profile(session_factory):
    def _make(tech_stack=None):
        with session_factory() as s:
            prof = models.CompanyProfile(
                name="Acme Corp",
                industry="Fintech",
                location="Bangalore",
                tech_stack=tech_stack or ["Python", "Django", "Postgres", "React"],
            )
            s.add(prof)
            s.commit()
            return prof.id

    return _make


@pytest.fixture
def run_flow(service):
    """Drive a requisition to approval + publish. Returns the requisition id."""
    from modules.requisition.domain.schemas import RoleIntent

    def _run(profile_id, intent, answers):
        req = service.create(profile_id, RoleIntent(**intent))
        _, interrupt = service.start_intake(req.id)
        answer_queue = list(answers)
        while isinstance(interrupt, str):
            _, interrupt = service.answer(req.id, answer_queue.pop(0))
        assert isinstance(interrupt, dict) and interrupt.get("checkpoint") == "approval"
        service.approve(req.id, reviewer="mgr")
        service.publish(req.id, by="mgr")
        return req.id

    return _run
