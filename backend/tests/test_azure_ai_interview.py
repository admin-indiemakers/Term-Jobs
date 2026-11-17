"""Tests for Azure OpenAI (gpt-6-luna) Real AI Interview Engine in Term-Jobs."""

import pytest
from unittest.mock import patch, MagicMock
from modules.interview.services import azure_ai_interview


def test_azure_config_present():
    cfg = azure_ai_interview.get_azure_config()
    assert "endpoint" in cfg
    assert "key" in cfg
    assert "deployment" in cfg
    assert cfg["deployment"] == "gpt-6-luna"
    assert azure_ai_interview.azure_configured() is True


def test_extract_resume_facts_fallback():
    profile = azure_ai_interview.extract_resume_facts("", candidate_name="Test Candidate")
    assert profile["name"] == "Test Candidate"
    # Empty resume must never fabricate fake skills, experience or projects
    assert profile["skills"] == []
    assert profile["experience"] == []
    assert profile["projects"] == []


def test_generate_custom_interview_plan_fallback():
    job = {
        "title": "Senior AI Engineer",
        "company": "TermJobs Tech",
        "seniority": "senior",
        "description": "Build high-throughput LLM pipelines and autonomous agents.",
    }
    profile = {
        "name": "Jane Doe",
        "skills": ["Python", "FastAPI", "Azure OpenAI", "LangChain"],
        "experience": [{"title": "AI Engineer", "company": "Tech Corp", "highlights": ["Built speech agents"]}],
        "projects": [{"name": "Voice AI Interviewer", "description": "Adaptive interviewing with STT", "technologies": ["Python", "Web Speech"]}],
        "education": ["BS Computer Science"],
    }

    result = azure_ai_interview.generate_custom_interview_plan(job, profile)
    assert "match" in result
    assert "questions" in result
    questions = result["questions"]
    assert len(questions) >= 4
    for q in questions:
        assert "prompt" in q
        assert "competency" in q
        assert "expected_evidence" in q
        assert "scoring_criteria" in q
        assert q["question_style_version"] == "azure-gpt-6-luna-v1"


def test_process_interview_turn_fallback():
    round_obj = MagicMock()
    round_obj.id = "round-123"
    round_obj.candidate_name = "Candidate Hashil"
    round_obj.requisition_title = "Full Stack Engineer"
    round_obj.transcript = []

    session = MagicMock()

    question = {
        "id": "q1",
        "prompt": "Tell me about an agentic workflow you designed and how you tested it.",
        "competency": "technical_delivery",
        "expected_evidence": ["Architecture", "Metrics"],
        "scoring_criteria": {"0": "None", "1": "Vague", "2": "Sound", "3": "Exceptional"},
    }

    # Short answer should trigger a follow up when follow_ups_used == 0
    with patch.object(azure_ai_interview, "call_azure_gpt", side_effect=Exception("API timeout")):
        turn = azure_ai_interview.process_interview_turn(
            round_obj=round_obj,
            session=session,
            question=question,
            candidate_answer="I built a voice bot for booking.",
            follow_ups_used=0,
            max_follow_ups=1,
            previous_turns=[],
        )

        assert turn["next_action"] == "follow_up"
        assert bool(turn["follow_up"]) is True
        assert len(round_obj.transcript) == 2


def test_evaluate_interview_session_auditable_score():
    round_obj = MagicMock()
    round_obj.id = "round-999"
    round_obj.requisition_id = "req-1"
    round_obj.requisition_title = "Full Stack Engineer"
    round_obj.company_name = "Acme"
    round_obj.candidate_name = "Alex"
    round_obj.interview_questions = [
        {"id": "q1", "prompt": "Question 1", "competency": "technical_delivery"},
        {"id": "q2", "prompt": "Question 2", "competency": "problem_solving"},
        {"id": "q3", "prompt": "Question 3", "competency": "collaboration"},
        {"id": "q4", "prompt": "Question 4", "competency": "ownership"},
    ]
    round_obj.transcript = [
        {"speaker": "candidate", "text": "I architected a distributed data pipeline using Kafka and FastAPI with 99.9% uptime."},
        {"speaker": "interviewer", "text": "Thank you. Let's move on."},
        {"speaker": "candidate", "text": "We diagnosed a memory leak using memory-profiler and reduced heap usage by 40%."},
        {"speaker": "interviewer", "text": "Understood."},
    ]
    round_obj.evaluation = {}

    session = MagicMock()
    session.query().filter().first.return_value = None

    with patch.object(azure_ai_interview, "call_azure_gpt", side_effect=Exception("Offline")):
        scorecard = azure_ai_interview.evaluate_interview_session(round_obj, session)

        assert scorecard["status"] == "scored"
        assert scorecard["rubric_version"] == "azure-gpt-6-luna-scorecard-v1"
        assert 0 <= scorecard["overall_score"] <= 100
        assert len(scorecard["competencies"]) == 4

        # Validate weights sum exactly to 1.0
        total_weight = sum(c["weight"] for c in scorecard["competencies"])
        assert abs(total_weight - 1.0) < 0.0001

        # Validate auditable formula: overall_score == round(sum((rating - 1) / 4 * weight * 100))
        computed_score = round(sum(((c["rating"] - 1) / 4.0) * c["weight"] * 100 for c in scorecard["competencies"]))
        assert scorecard["overall_score"] == computed_score

        # Validate round status updated
        assert round_obj.status == "Completed"


def test_transcribe_candidate_audio():
    # Empty audio or tiny noise chunk should return empty string gracefully
    assert azure_ai_interview.transcribe_candidate_audio(b"") == ""
    assert azure_ai_interview.transcribe_candidate_audio(b"123") == ""

    # Mocked Whisper call
    with patch("groq.Groq") as mock_groq:
        mock_client = MagicMock()
        mock_groq.return_value = mock_client
        mock_client.audio.transcriptions.create.return_value = MagicMock(text="I built a responsive web application.")

        transcript = azure_ai_interview.transcribe_candidate_audio(b"fake_audio_bytes" * 50, filename="audio.webm")
        assert transcript == "I built a responsive web application."


