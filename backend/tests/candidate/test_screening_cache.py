import pytest
import asyncio
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException

from modules.shared.db import get_session, init_db
from modules.candidate.domain.models import Candidate, CandidateSubmission, ScreeningCache
from modules.requisition.domain.models import Requisition
from modules.identity.domain.models import User, Tenant
from modules.candidate.router import match_bulk_candidates, get_screening_cache, shortlist_candidate

@pytest.fixture
def setup_test_data():
    init_db()
    with get_session() as session:
        # Create test tenant
        tenant = Tenant(name="Test Screening Agency")
        session.add(tenant)
        session.commit()

        # Create test recruiter user
        user = User(
            email=f"recruiter_test_{datetime.now().timestamp()}@agency.com",
            role="Recruiter",
            tenant_id=tenant.id
        )
        session.add(user)

        # Create test requisition
        req = Requisition(
            title="Senior Python Backend Engineer",
            tenant_id=tenant.id,
            generated_jd_markdown="# Senior Python Backend Engineer\nMust-have skills: Python, FastAPI, Docker, PostgreSQL\nExperience: 4+ years"
        )
        session.add(req)

        # Create 3 test candidates in bank
        cand1 = Candidate(
            candidate_name="Alice Python",
            candidate_email="alice@test.com",
            candidate_title="Python Engineer",
            skills=["Python", "FastAPI", "PostgreSQL", "Docker"],
            summary="Experienced Python developer specializing in FastAPI microservices.",
            extracted_text="Alice Python | alice@test.com | Senior Python Engineer | github.com/alice-py",
            tenant_id=tenant.id,
        )
        cand2 = Candidate(
            candidate_name="Bob Data",
            candidate_email="bob@test.com",
            candidate_title="Data Engineer",
            skills=["Python", "SQL", "Spark", "Airflow"],
            summary="Data engineer with expertise in batch and streaming ETL.",
            extracted_text="Bob Data | bob@test.com | Data Engineer | github.com/bob-data",
            tenant_id=tenant.id,
        )
        cand3 = Candidate(
            candidate_name="Charlie Frontend",
            candidate_email="charlie@test.com",
            candidate_title="React Frontend Developer",
            skills=["React", "TypeScript", "TailwindCSS"],
            summary="Frontend engineer building responsive web applications.",
            extracted_text="Charlie Frontend | charlie@test.com | React Developer | github.com/charlie-dev",
            tenant_id=tenant.id,
        )
        session.add(cand1)
        session.add(cand2)
        session.add(cand3)
        session.commit()

        return {
            "tenant": tenant,
            "user": user,
            "req": req,
            "cand1": cand1,
            "cand2": cand2,
            "cand3": cand3,
        }

@pytest.mark.anyio
async def test_screening_cache_full_flow(setup_test_data):
    data = setup_test_data
    user = data["user"]
    req = data["req"]
    cand1 = data["cand1"]
    cand2 = data["cand2"]
    cand3 = data["cand3"]

    # 1. Page Load when NO cache exists
    empty_cache_res = get_screening_cache(req.id, current_user=user)
    assert empty_cache_res["status"] == "success"
    assert empty_cache_res["has_cache"] is False
    assert len(empty_cache_res["screened_candidates"]) == 0

    # 2. First Screening: [cand1, cand2] (Cache MISS -> AI screening runs -> Saved to cache)
    res1 = await match_bulk_candidates(
        body={"requisition_id": req.id, "candidate_ids": [cand1.id, cand2.id]},
        current_user=user
    )
    assert res1["status"] == "success"
    assert res1["cache_hit"] is False
    assert len(res1["screened_candidates"]) == 2

    # Verify screening_cache document in DB
    with get_session() as session:
        cached_doc = session.query(ScreeningCache).filter(
            ScreeningCache.recruiter_id == user.id,
            ScreeningCache.requisition_id == req.id
        ).first()
        assert cached_doc is not None
        assert cached_doc.expires_at is not None
        exp = cached_doc.expires_at
        is_future = (exp > datetime.now(timezone.utc)) if exp.tzinfo else (exp > datetime.utcnow())
        assert is_future
        # CRITICAL: Confirm resume_pdf is NOT stored in cache
        assert "resume_pdf" not in cached_doc.results[0]
        assert "pdf_base64" not in cached_doc.results[0]

    # 3. Exact Re-screening: [cand1, cand2] (Cache HIT -> 0 AI calls)
    res2 = await match_bulk_candidates(
        body={"requisition_id": req.id, "candidate_ids": [cand1.id, cand2.id]},
        current_user=user
    )
    assert res2["status"] == "success"
    assert res2["cache_hit"] is True
    assert res2["source"] == "cache"
    assert len(res2["screened_candidates"]) == 2
    # Verify scores match
    assert res2["screened_candidates"][0]["match_score"] == res1["screened_candidates"][0]["match_score"]

    # 4. Partial Cache Hit: [cand1, cand2, cand3] (Reuses cand1 & cand2, screens only cand3)
    res3 = await match_bulk_candidates(
        body={"requisition_id": req.id, "candidate_ids": [cand1.id, cand2.id, cand3.id]},
        current_user=user
    )
    assert res3["status"] == "success"
    assert res3["source"] == "hybrid"
    assert len(res3["screened_candidates"]) == 3

    # 5. Page Load / Refresh Retrieval
    page_load_res = get_screening_cache(req.id, current_user=user)
    assert page_load_res["status"] == "success"
    assert page_load_res["has_cache"] is True
    assert page_load_res["cache_hit"] is True
    assert len(page_load_res["screened_candidates"]) == 3

    # 6. Shortlisting a candidate does NOT delete the screening cache for others
    shortlist_res = shortlist_candidate(
        body={
            "requisition_id": req.id,
            "candidate_id": cand1.id,
            "candidate_name": cand1.candidate_name,
            "candidate_email": cand1.candidate_email,
            "match_score": 85.0,
            "vendor_name": "Test Agency",
            "filename": "alice.pdf"
        },
        current_user=user
    )
    assert shortlist_res["status"] == "success"

    # Verify permanent submission exists
    with get_session() as session:
        permanent_sub = session.query(CandidateSubmission).filter(
            CandidateSubmission.candidate_email == cand1.candidate_email
        ).first()
        assert permanent_sub is not None
        assert permanent_sub.status == "Shortlisted"

    # Verify screening cache is still valid and returned on page reload
    cache_after_shortlist = get_screening_cache(req.id, current_user=user)
    assert cache_after_shortlist["has_cache"] is True
    assert len(cache_after_shortlist["screened_candidates"]) >= 2
