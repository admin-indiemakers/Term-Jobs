from types import SimpleNamespace
from unittest.mock import Mock

from fastapi import FastAPI
from fastapi.testclient import TestClient

from modules.requisition import superadmin_router
from modules.requisition.jd_parser import clean_source, parse_job_description


def test_extraction_cleans_input_and_discards_unverified_fields():
    text = clean_source("<p>Acme &amp; Co.</p><p>Python &amp; SQL required.</p><p>Build data reports.</p>"
                        "<p>Location: Kochi</p><div>Location: Delhi</div>")
    provider = Mock()
    provider.generate_structured.return_value = {
        "company_name": "Acme & Co.", "location": "Kochi", "salary": "₹10 lakh",
        "required_skills": ["Python", "python", "SQL", "Rust"], "preferred_skills": ["SQL"],
        "responsibilities": ["Build reporting for data.", "Manage a large engineering team."],
        "benefits": ["Health insurance"], "conflicting_fields": ["location"],
        "evidence": {"company_name": "Acme & Co.", "salary": "₹10 lakh",
                     "location": "Location: Kochi", "responsibilities.0": "Build data reports."},
    }
    job = parse_job_description(text, provider)
    assert job.company_name == "Acme & Co."
    assert job.salary == job.location == job.openings == ""
    assert job.required_skills == ["Python", "SQL"]
    assert job.preferred_skills == job.benefits == []
    assert job.responsibilities == ["Build reporting for data."]
    assert any("conflicting" in warning for warning in job.verification_warnings)


def test_parser_endpoint_is_super_admin_only_and_validates_provider_response(monkeypatch):
    app = FastAPI()
    app.include_router(superadmin_router.router)
    client = TestClient(app)
    path = "/api/superadmin/requisitions/parse-description"
    body = {"source": "<p>Job title: AI Engineer</p>"}
    assert client.post(path, json=body).status_code == 401
    app.dependency_overrides[superadmin_router.get_current_user] = lambda: SimpleNamespace(role="Admin")
    assert client.post(path, json=body).status_code == 403
    app.dependency_overrides[superadmin_router.get_current_user] = lambda: SimpleNamespace(role="Super Admin")

    provider = Mock(api_key="mock")
    monkeypatch.setattr(superadmin_router, "GroqClient", lambda: provider)
    provider.generate_structured.return_value = {"job_title": None}
    assert client.post(path, json=body).status_code == 502
    provider.generate_structured.return_value = {
        "job_title": "AI Engineer", "evidence": {"job_title": "Job title: AI Engineer"},
    }
    response = client.post(path, json=body)
    assert response.status_code == 200
    assert response.json()["job_title"] == "AI Engineer"
    assert response.json()["openings"] == ""
    assert "evidence" not in response.json()
