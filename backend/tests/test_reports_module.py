"""
Tests for TermJobs Reports & Growth Management module.
Uses mongomock for fast, isolated, offline verification.
Verifies:
1. Creating and updating reports with duplicate prevention.
2. Business metrics, marketing activities, observations, and action items persistence.
3. Audit trail updates on edits and status changes.
4. Live growth analytics calculation, conversion funnel math, drop-off distribution,
   and marketing channel ROI metrics.
5. FastAPI router endpoints (/reports, /reports/by-date, /reports/analytics).
"""
import pytest
import mongomock
from datetime import datetime, timezone, timedelta
from fastapi import FastAPI
from fastapi.testclient import TestClient

from modules.shared import Session, db as shared_db
from modules.reports import service
from modules.reports.router import router as reports_router


@pytest.fixture(autouse=True)
def mock_mongo(monkeypatch):
    """Isolate tests in an in-memory mock MongoDB database."""
    mock_db = mongomock.MongoClient().termjobs_test_db
    monkeypatch.setattr(service, "db", mock_db)
    monkeypatch.setattr(service, "get_session", lambda: Session(database=mock_db))
    return mock_db


@pytest.fixture
def api_client():
    app = FastAPI()
    app.include_router(reports_router, prefix="/api")
    return TestClient(app)


def test_create_and_update_report_duplicate_prevention():
    test_date = "2026-11-12"
    
    # 1. Create initial draft report
    initial_data = {
        "report_type": "daily",
        "report_date": test_date,
        "status": "draft",
        "author_id": "tester_1",
        "author_name": "Test Operator",
        "metrics": {
            "companies_onboarded": 5,
            "website_visitors": 3482,
            "new_registrations": 412,
            "job_applications": 268,
            "candidates_shortlisted": 55,
            "interviews_conducted": 30,
            "candidates_hired": 12,
            "new_vacancies_posted": 8,
            "profile_completions": 380,
        },
        "marketing_activities": [
            {
                "id": "act-test-1",
                "platform": "Instagram",
                "content_type": "Post (Boosted)",
                "title": "Job tips - Boosted for 2 days",
                "spend": 1500,
                "reach": 24680,
                "clicks": 1240,
                "registrations": 144,
                "applications": 92,
            }
        ],
        "observations": {
            "what_went_well": "Good response for the Instagram boosted post.",
            "issues_faced": "144 candidates registered but did not apply.",
        },
        "action_items": [
            {
                "id": "1",
                "task": "Follow up with company leads",
                "assignee": "Sales Team",
                "priority": "High",
                "status": "Pending",
                "completed": False,
            }
        ]
    }

    report1 = service.save_or_update_report(initial_data, user={"id": "tester_1", "name": "Test Operator"})
    assert report1 is not None
    assert report1["report_date"] == test_date
    assert report1["metrics"]["companies_onboarded"] == 5
    assert report1["metrics"]["new_registrations"] == 412
    assert report1["status"] == "draft"
    assert len(report1["marketing_activities"]) == 1

    # 2. Saving again for the same date and type should UPDATE the existing document (preventing duplicates)
    update_data = {
        "report_type": "daily",
        "report_date": test_date,
        "status": "submitted",
        "metrics": {
            "companies_onboarded": 7,
            "website_visitors": 3900,
            "new_registrations": 450,
            "job_applications": 290,
        },
        "marketing_activities": report1["marketing_activities"],
        "observations": report1["observations"],
        "action_items": report1["action_items"],
    }

    report2 = service.save_or_update_report(update_data, user={"id": "tester_1", "name": "Test Operator"})
    assert report2["id"] == report1["id"]  # Must be the exact same document ID
    assert report2["status"] == "submitted"
    assert report2["metrics"]["companies_onboarded"] == 7
    assert len(report2["audit_trail"]) >= 2  # Audit trail tracks history

    # 3. Retrieve by date
    fetched = service.get_report_by_date_and_type(test_date, "daily")
    assert fetched is not None
    assert fetched["id"] == report1["id"]
    assert fetched["metrics"]["companies_onboarded"] == 7


def test_growth_analytics_calculation():
    analytics = service.calculate_growth_analytics(period="30d")
    
    assert "kpis" in analytics
    assert "growth_trends" in analytics
    assert "conversion_funnel" in analytics
    assert "drop_off_reasons" in analytics
    assert "marketing_channels" in analytics
    assert "ai_insights" in analytics
    
    # Verify KPI calculations
    kpis = analytics["kpis"]
    assert kpis["companies_onboarded"]["value"] > 0
    assert kpis["website_visitors"]["value"] > 0
    assert kpis["registrations"]["value"] > 0
    assert kpis["job_applications"]["value"] > 0

    # Verify Conversion Funnel
    funnel = analytics["conversion_funnel"]
    assert len(funnel) >= 5
    assert funnel[0]["stage"] == "Website Visitors"
    assert funnel[0]["percentage"] == 100.0

    # Verify Drop-Off Reasons
    reasons = analytics["drop_off_reasons"]
    assert len(reasons) >= 4
    total_pct = sum(r["percentage"] for r in reasons)
    assert 95 <= total_pct <= 105

    # Verify Marketing Channel metrics
    channels = analytics["marketing_channels"]
    assert len(channels) >= 4
    for ch in channels:
        assert "channel" in ch
        assert "spend" in ch
        assert "cpr" in ch

    # Verify AI Insights
    insights = analytics["ai_insights"]
    assert len(insights) >= 3
    has_ai_rec = any(i.get("is_ai_generated") for i in insights)
    assert has_ai_rec is True


def test_reports_api_endpoints(api_client):
    # 1. Post a new report via API
    payload = {
        "report_type": "daily",
        "report_date": "2026-11-13",
        "status": "submitted",
        "metrics": {
            "companies_onboarded": 8,
            "website_visitors": 4100,
            "new_registrations": 520,
            "job_applications": 340,
        },
        "marketing_activities": [
            {
                "id": "act-api-1",
                "platform": "LinkedIn",
                "content_type": "Post",
                "title": "Hiring Announcement",
                "spend": 500,
                "reach": 5000,
                "clicks": 300,
                "registrations": 45,
            }
        ],
        "observations": {
            "what_went_well": "Excellent client conversion today.",
        },
    }

    res = api_client.post("/api/reports", json=payload)
    assert res.status_code == 200
    res_data = res.json()
    assert "report" in res_data
    report_id = res_data["report"]["id"]

    # 2. Get by date
    res_date = api_client.get("/api/reports/by-date?date=2026-11-13&report_type=daily")
    assert res_date.status_code == 200
    assert res_date.json()["report"]["id"] == report_id

    # 3. Get single by ID
    res_single = api_client.get(f"/api/reports/{report_id}")
    assert res_single.status_code == 200
    assert res_single.json()["report"]["id"] == report_id

    # 4. Get analytics
    res_analytics = api_client.get("/api/reports/analytics?period=30d")
    assert res_analytics.status_code == 200
    analytics_data = res_analytics.json()
    assert "kpis" in analytics_data
    assert "growth_trends" in analytics_data
    assert "conversion_funnel" in analytics_data

    # 5. List reports
    res_list = api_client.get("/api/reports")
    assert res_list.status_code == 200
    assert len(res_list.json()["reports"]) >= 1
