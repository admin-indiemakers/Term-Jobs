import pytest
import uuid
from unittest.mock import patch, MagicMock
from datetime import datetime, timezone
from modules.interview.domain.models import InterviewRound
from modules.interview.services.interview_service import (
    record_focus_monitoring_consent,
    record_focus_monitoring_event,
    get_focus_monitoring_events,
    get_round_communication_analysis,
)


class MockSession:
    def __init__(self, rounds_dict):
        self.rounds_dict = rounds_dict

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        pass

    def query(self, model_class):
        this = self
        class QueryMock:
            def filter(self, *args, **kwargs):
                return self
            def first(self):
                # Return the mock round
                for r in this.rounds_dict.values():
                    return r
                return None
        return QueryMock()

    def add(self, obj):
        pass

    def _track(self, obj):
        pass

    def commit(self):
        pass


@pytest.fixture
def mock_round():
    round_id = f"test_round_{uuid.uuid4().hex[:8]}"
    token = f"cand_token_{uuid.uuid4().hex[:8]}"
    r = InterviewRound(
        id=round_id,
        tenant_id="tenant_acme_123",
        requisition_id="req_999",
        candidate_submission_id="sub_888",
        candidate_name="Alex Candidate",
        candidate_email="alex@example.com",
        candidate_token=token,
        requisition_title="Senior Frontend Engineer",
        status="Scheduled",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    return r


def test_focus_monitoring_consent(mock_round):
    round_id = mock_round.id
    token = mock_round.candidate_token
    session_mock = MockSession({round_id: mock_round})

    with patch("modules.interview.services.interview_service.get_session", return_value=session_mock):
        consent = record_focus_monitoring_consent(
            round_id=round_id,
            consent=True,
            candidate_token=token,
            ip_address="127.0.0.1",
        )
        assert consent is not None
        assert consent["consent_given"] is True
        assert consent["candidate_name"] == "Alex Candidate"

        events_data = get_focus_monitoring_events(round_id)
        assert events_data["consent"]["consent_given"] is True
        assert events_data["summary"]["consent_given"] is True


def test_focus_monitoring_event_progression_and_dedup(mock_round):
    round_id = mock_round.id
    token = mock_round.candidate_token
    session_mock = MockSession({round_id: mock_round})

    with patch("modules.interview.services.interview_service.get_session", return_value=session_mock):
        # Incident 1: Tab Hidden (warning level)
        evt1 = record_focus_monitoring_event(
            round_id=round_id,
            event_data={
                "client_event_id": "client_evt_001",
                "event_type": "tab_hidden",
                "incident_sequence": 1,
                "question_number": 1,
                "start_time": "2026-11-07T00:00:00Z",
                "end_time": "2026-11-07T00:00:05Z",
                "duration_seconds": 5.0,
            },
            candidate_token=token,
        )
        assert evt1["status"] == "recorded"
        assert evt1["incident"]["violation_level"] == "warning"
        assert evt1["summary"]["total_incidents"] == 1
        assert evt1["summary"]["flagged_for_review"] is False

        # Attempt duplicate of Incident 1
        dup_evt = record_focus_monitoring_event(
            round_id=round_id,
            event_data={
                "client_event_id": "client_evt_001",
                "event_type": "tab_hidden",
                "incident_sequence": 1,
                "question_number": 1,
                "start_time": "2026-11-07T00:00:00Z",
                "end_time": "2026-11-07T00:00:05Z",
                "duration_seconds": 5.0,
            },
            candidate_token=token,
        )
        assert dup_evt["status"] == "deduplicated"
        assert dup_evt["total_incidents"] == 1

        # Incident 2: Window Blur (strong warning, flagged for review)
        evt2 = record_focus_monitoring_event(
            round_id=round_id,
            event_data={
                "client_event_id": "client_evt_002",
                "event_type": "window_blur",
                "incident_sequence": 2,
                "question_number": 2,
                "start_time": "2026-11-07T00:05:00Z",
                "end_time": "2026-11-07T00:05:08Z",
                "duration_seconds": 8.0,
            },
            candidate_token=token,
        )
        assert evt2["status"] == "recorded"
        assert evt2["incident"]["violation_level"] == "strong_warning"
        assert evt2["summary"]["total_incidents"] == 2
        assert evt2["summary"]["total_lost_duration_seconds"] == 13.0
        assert evt2["summary"]["flagged_for_review"] is True

        # Retrieve via get_round_communication_analysis
        with patch("modules.interview.services.interview_service._reconcile_completed_round"):
            analysis = get_round_communication_analysis(round_id)
            assert analysis is not None
            assert analysis["focus_monitoring_summary"]["total_incidents"] == 2
            assert analysis["focus_monitoring_summary"]["flagged_for_review"] is True
            assert len(analysis["focus_monitoring_events"]) == 2
