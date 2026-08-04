import pytest
from backend.modules.candidate.domain.models import Candidate, Submission, SubmissionStatus
from backend.modules.candidate.tools.duplicate_detector import DuplicateDetector

def test_duplicate_detector_email_match():
    cand1 = Candidate(
        id="cand_1",
        tenant_id="tenant_a",
        name="Rahul Sharma",
        email="rahul@example.com",
        phone="+919876543210",
        resume_text="Python developer"
    )
    sub1 = Submission(
        id="sub_1",
        candidate_id="cand_1",
        requisition_id="req_101",
        status=SubmissionStatus.SCREENED
    )

    new_cand = Candidate(
        id="cand_2",
        tenant_id="tenant_a",
        name="Rahul S.",
        email="rahul@example.com",  # Duplicate email
        phone="+910000000000",
        resume_text="Python dev"
    )

    res = DuplicateDetector.check_duplicate(new_cand, [cand1], [sub1], "req_101")
    assert res.is_duplicate is True
    assert res.matched_submission_id == "sub_1"
    assert "email match" in res.reason.lower()

def test_duplicate_detector_phone_match():
    cand1 = Candidate(
        id="cand_1",
        tenant_id="tenant_a",
        name="Rahul Sharma",
        email="rahul1@example.com",
        phone="+91-98765-43210",
        resume_text="Python developer"
    )
    sub1 = Submission(
        id="sub_1",
        candidate_id="cand_1",
        requisition_id="req_101",
        status=SubmissionStatus.SCREENED
    )

    new_cand = Candidate(
        id="cand_2",
        tenant_id="tenant_a",
        name="R. Sharma",
        email="rahul2@example.com",
        phone="9876543210",  # Duplicate phone (normalized digits)
        resume_text="Python dev"
    )

    res = DuplicateDetector.check_duplicate(new_cand, [cand1], [sub1], "req_101")
    assert res.is_duplicate is True
    assert res.matched_submission_id == "sub_1"
    assert "phone number match" in res.reason.lower()

def test_duplicate_detector_no_match():
    cand1 = Candidate(
        id="cand_1",
        tenant_id="tenant_a",
        name="Rahul Sharma",
        email="rahul@example.com",
        phone="+919876543210",
        resume_text="Python developer"
    )
    sub1 = Submission(
        id="sub_1",
        candidate_id="cand_1",
        requisition_id="req_101",
        status=SubmissionStatus.SCREENED
    )

    new_cand = Candidate(
        id="cand_2",
        tenant_id="tenant_a",
        name="Priya Patel",
        email="priya@example.com",
        phone="+919999988888",
        resume_text="Java developer"
    )

    res = DuplicateDetector.check_duplicate(new_cand, [cand1], [sub1], "req_101")
    assert res.is_duplicate is False
    assert res.matched_submission_id is None
