import pytest
from backend.modules.candidate.domain.models import Candidate, Submission, SubmissionStatus, Recommendation
from backend.modules.candidate.agent.graph import CandidateScreeningAgentGraph
from backend.modules.candidate.repository.decision_record import DecisionRecordRepository

def test_full_candidate_screening_agent_workflow():
    DecisionRecordRepository.clear()

    cand = Candidate(
        id="cand_100",
        tenant_id="tenant_acme",
        name="Rahul Sharma",
        email="rahul.sharma@example.com",
        phone="+919876543210",
        resume_text="Senior Backend Engineer with 5 years experience in Python, FastAPI, PostgreSQL, Docker, and LangGraph.",
        skills=["Python", "FastAPI", "PostgreSQL", "Docker", "LangGraph"]
    )

    sub = Submission(
        id="sub_100",
        candidate_id="cand_100",
        requisition_id="req_500",
        status=SubmissionStatus.SUBMITTED
    )

    req_data = {
        "title": "Senior Backend Engineer",
        "must_have_skills": ["Python", "FastAPI", "PostgreSQL", "Docker"],
        "nice_to_have_skills": ["LangGraph", "Redis"],
        "seniority": "Senior"
    }

    result = CandidateScreeningAgentGraph.run(
        candidate=cand,
        submission=sub,
        requisition_data=req_data
    )

    # 1. State machine check
    assert result["submission"].status == SubmissionStatus.SCREENED

    # 2. Output screening check
    output = result["screening_output"]
    assert output.overall_fit_score >= 80.0
    assert output.recommendation == Recommendation.SHORTLIST
    assert output.duplicate_flags.is_duplicate is False

    # 3. Decision record check
    dec_record = result["decision_record"]
    assert dec_record.submission_id == "sub_100"
    assert dec_record.status == "PENDING_HUMAN_REVIEW"
    assert result["status"] == "PAUSED_AT_HIRING_MANAGER_APPROVAL_QUEUE"

    # 4. Check repository persistence
    saved_record = DecisionRecordRepository.get_by_submission_id("sub_100")
    assert saved_record is not None
    assert saved_record.screening_output.overall_fit_score == output.overall_fit_score
