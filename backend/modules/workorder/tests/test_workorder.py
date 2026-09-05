import pytest
from modules.workorder.agent.workorder_agent import generate_autofill_workorder
from modules.workorder.domain.models import WorkOrder, WorkOrderCreate


def test_workorder_agent_autofill():
    candidate_data = {
        "id": "BEAR-12345678",
        "candidate_name": "Adarsh Sharma",
        "candidate_email": "adarsh@example.com",
        "vendor_name": "BridgeOn Solutions",
        "match_score": 92.0,
        "requisition_id": "REQ-100200300",
        "requisition_title": "Senior DevOps Engineer",
    }
    
    requisition_data = {
        "id": "REQ-100200300",
        "title": "Senior DevOps Engineer",
        "vendor_visible_floor": 130000,
        "vendor_visible_cap": 190000,
        "duration_months": 6,
        "location": "Remote",
        "company_name": "Acme Corp",
        "generated_jd_markdown": "# Senior DevOps Engineer\nResponsible for Kubernetes and CI/CD pipelines.",
    }

    result = generate_autofill_workorder(candidate_data, requisition_data)

    assert result["candidate_name"] == "Adarsh Sharma"
    assert result["vendor_name"] == "BridgeOn Solutions"
    assert result["job_title"] == "Senior DevOps Engineer"
    assert result["vendor_visible_floor"] == 130000.0
    assert result["vendor_visible_cap"] == 190000.0
    # Rate should be calculated between floor and cap
    assert 130000.0 <= result["billing_rate"] <= 190000.0
    assert result["ai_generated"] is True
    assert "AI Agent analyzed candidate" in result["ai_reasoning"]


def test_workorder_schema_validation():
    wo_create = WorkOrderCreate(
        requisition_id="REQ-001",
        candidate_id="BEAR-001",
        candidate_name="Test Candidate",
        vendor_name="Test Vendor",
        job_title="Frontend Engineer",
        billing_rate=150000.0,
        vendor_visible_floor=120000.0,
        vendor_visible_cap=180000.0,
    )
    assert wo_create.billing_rate == 150000.0
    assert wo_create.contract_duration_months == 6
