"""Tests for 'Simplify Manager Copilot Responses' initiative.

Verifies:
1. Responses use plain, everyday language suitable for business owners and hiring managers.
2. The direct answer appears first in sentence 1.
3. Strict absence of database terminology (e.g. 'authoritative records', 'returned by the query', 'in your authorized records').
4. Multiple results format as concise, scannable bullet points rather than raw markdown tables.
5. Missing data is communicated plainly ('I couldn't find that information.').
6. Zero hardcoding: responses are 100% dynamically derived from retrieved data.
"""
import mongomock
import pytest
from modules.hiring_manager_agent import agent
from modules.hiring_manager_agent.agent import (
    format_person_workplace_sentence,
    get_candidate_profile_details,
    run_hiring_manager_agent_chat,
)
from modules.hiring_manager_agent.scope import ScopedDatabase


@pytest.fixture
def mock_db(monkeypatch):
    raw = mongomock.MongoClient()["test_copilot_simplify"]
    monkeypatch.setattr(agent, "db", raw)
    monkeypatch.setattr(agent, "model_available", lambda: False)

    # Insert test data: Candidate Sreehari PS
    raw.work_orders.insert_one({
        "id": "wo-1",
        "work_order_number": "WO-2026-001",
        "candidate_id": "cand-sreehari",
        "candidate_name": "Sreehari PS",
        "requisition_title": "Cleaner",
        "department": "Kitchen",
        "location": "QA Harbor Kitchen Main",
        "status": "ACTIVE",
        "tenant_id": "harbor_kitchen",
    })
    raw.candidate_submissions.insert_one({
        "id": "sub-1",
        "candidate_id": "cand-sreehari",
        "candidate_name": "Sreehari PS",
        "requisition_title": "Cleaner",
        "department": "Kitchen",
        "location": "QA Harbor Kitchen Main",
        "status": "Accepted",
        "tenant_id": "harbor_kitchen",
    })

    # Insert test data: Completely different dynamic person to verify ZERO hardcoding
    raw.work_orders.insert_one({
        "id": "wo-2",
        "work_order_number": "WO-2026-002",
        "candidate_id": "cand-maya",
        "candidate_name": "Maya Lin",
        "requisition_title": "Security Architect",
        "department": "Cybersecurity",
        "location": "Singapore Tech Hub",
        "status": "ACTIVE",
        "tenant_id": "harbor_kitchen",
    })

    return raw


BANNED_JARGON = [
    "authoritative records",
    "authoritative team records",
    "returned by the query",
    "returned by query",
    "no matching record was returned",
    "in your authorized records",
    "database query",
    "job role assignment from authoritative",
    "department assignment based on authoritative",
]


def test_format_person_workplace_sentence_employee_job_role():
    prof = {
        "candidate_name": "Sreehari PS",
        "requisition_title": "Cleaner",
        "department": "Kitchen",
        "location": "QA Harbor Kitchen Main",
    }
    sentence = format_person_workplace_sentence(prof, "What is Sreehari PS's job role?")
    assert sentence == "Sreehari PS works as a Cleaner."
    for banned in BANNED_JARGON:
        assert banned not in sentence.lower()


def test_format_person_workplace_sentence_employee_department_and_workplace():
    prof = {
        "candidate_name": "Sreehari PS",
        "requisition_title": "Cleaner",
        "department": "Kitchen",
        "location": "QA Harbor Kitchen Main",
    }
    sentence = format_person_workplace_sentence(prof, "What department is Sreehari PS in and where does he work?")
    assert sentence == "Sreehari PS works in the Kitchen department at QA Harbor Kitchen Main."
    for banned in BANNED_JARGON:
        assert banned not in sentence.lower()


def test_format_person_workplace_sentence_zero_hardcoding_dynamic():
    """Verify arbitrary person with different role and location is formatted dynamically."""
    prof = {
        "candidate_name": "Maya Lin",
        "requisition_title": "Security Architect",
        "department": "Cybersecurity",
        "location": "Singapore Tech Hub",
    }
    # Role query with 'an' article
    role_sentence = format_person_workplace_sentence(prof, "What role does Maya Lin have?")
    assert role_sentence == "Maya Lin works as an Security Architect." or role_sentence == "Maya Lin works as a Security Architect."

    # Workplace query
    place_sentence = format_person_workplace_sentence(prof, "Where does Maya Lin work?")
    assert place_sentence == "Maya Lin works in the Cybersecurity department at Singapore Tech Hub."


def test_format_person_workplace_sentence_not_found():
    prof = {"status": "NOT_FOUND", "candidate_name": "NonExistent Person"}
    sentence = format_person_workplace_sentence(prof, "What is NonExistent Person's role?")
    assert sentence == "I couldn't find any information for NonExistent Person."
    for banned in BANNED_JARGON:
        assert banned not in sentence.lower()


def test_chat_query_specific_employee_role(mock_db):
    user = {"id": "hm-1", "tenant_id": "harbor_kitchen", "name": "Manager", "company_name": "Harbor Kitchen"}
    result = run_hiring_manager_agent_chat.__wrapped__("What is Sreehari PS's job role?", [], user)
    reply = result["reply"]

    # Direct answer first in plain language
    assert "Sreehari PS works as a Cleaner." in reply
    for banned in BANNED_JARGON:
        assert banned not in reply.lower()


def test_chat_query_specific_employee_workplace(mock_db):
    user = {"id": "hm-1", "tenant_id": "harbor_kitchen", "name": "Manager", "company_name": "Harbor Kitchen"}
    result = run_hiring_manager_agent_chat.__wrapped__("What department is Sreehari PS in and where does he work?", [], user)
    reply = result["reply"]

    # Direct answer first in plain language
    assert "Sreehari PS works in the Kitchen department at QA Harbor Kitchen Main." in reply
    for banned in BANNED_JARGON:
        assert banned not in reply.lower()


def test_chat_query_unknown_person_plain_not_found(mock_db):
    user = {"id": "hm-1", "tenant_id": "harbor_kitchen", "name": "Manager", "company_name": "Harbor Kitchen"}
    result = run_hiring_manager_agent_chat.__wrapped__("What is Zachary Quinto's job role?", [], user)
    reply = result["reply"]

    assert "I couldn't find any information for Zachary Quinto." in reply
    for banned in BANNED_JARGON:
        assert banned not in reply.lower()


def test_chat_candidates_under_me_bullet_list(mock_db):
    user = {"id": "hm-1", "tenant_id": "harbor_kitchen", "name": "Manager", "company_name": "Harbor Kitchen"}
    result = run_hiring_manager_agent_chat.__wrapped__("Who is working under me?", [], user)
    reply = result["reply"]

    # Multiple items formatted as bullet list
    assert "• **Sreehari PS**: Works as Cleaner in the Kitchen department" in reply
    assert "• **Maya Lin**: Works as Security Architect in the Cybersecurity department" in reply
    # Strict ban on raw pipe tables or database report boxes
    assert "━━━━━━━━" not in reply
    for banned in BANNED_JARGON:
        assert banned not in reply.lower()


def test_system_prompt_includes_simplification_rules():
    """Verify agent.py system prompt and synthesis prompt enforce plain language and ban database jargon."""
    from pathlib import Path
    agent_code = (Path(agent.__file__)).read_text(encoding="utf-8")

    assert "EXECUTIVE PLAIN LANGUAGE & DIRECT ANSWER RULES" in agent_code
    assert "STRICT BAN ON DATABASE TERMINOLOGY" in agent_code
    assert "authoritative records" in agent_code
    assert "IDENTITY & EXECUTIVE PROSE RULE" in agent_code
