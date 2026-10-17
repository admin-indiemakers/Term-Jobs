"""
Tests for interviewer availability detection and schedule conflict validation.
"""
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import Mock, patch

from modules.interview.domain.models import InterviewRound
from modules.interview.services.interviewer_availability import (
    parse_round_time_window,
    check_intervals_overlap,
    find_interviewer_conflicts,
    validate_interviewer_availability,
    get_all_interviewers_with_availability,
)


class MockQuery:
    def __init__(self, items):
        self.items = items

    def filter(self, *args, **kwargs):
        return self

    def all(self):
        return self.items

    def first(self):
        return self.items[0] if self.items else None


class MockSession:
    def __init__(self, rounds=None, users=None):
        self.rounds = rounds or []
        self.users = users or []

    def query(self, model):
        if getattr(model, "__tablename__", "") == "interview_rounds" or model == InterviewRound:
            return MockQuery(self.rounds)
        return MockQuery(self.users)

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        pass


class InterviewerAvailabilityTests(TestCase):
    def test_parse_round_time_window_24h_and_12h(self):
        start1, end1 = parse_round_time_window("2026-10-20", "14:30", "Asia/Kolkata", 45)
        self.assertIsNotNone(start1)
        self.assertIsNotNone(end1)
        self.assertEqual(int((end1 - start1).total_seconds() / 60), 45)

        start2, end2 = parse_round_time_window("2026-10-20", "02:30 PM", "Asia/Kolkata", 45)
        self.assertEqual(start1, start2)
        self.assertEqual(end1, end2)

    def test_parse_round_time_window_on_demand_returns_none(self):
        start, end = parse_round_time_window("2026-10-20", "Immediate / On-Demand")
        self.assertIsNone(start)
        self.assertIsNone(end)

    def test_check_intervals_overlap(self):
        s1, e1 = parse_round_time_window("2026-10-20", "10:00", duration_minutes=60)
        # Overlapping slot (10:30 to 11:30)
        s2, e2 = parse_round_time_window("2026-10-20", "10:30", duration_minutes=60)
        self.assertTrue(check_intervals_overlap(s1, e1, s2, e2))

        # Adjacent slot (11:00 to 12:00) does not overlap
        s3, e3 = parse_round_time_window("2026-10-20", "11:00", duration_minutes=60)
        self.assertFalse(check_intervals_overlap(s1, e1, s3, e3))

    def test_find_interviewer_conflicts_detects_overlap(self):
        round_1 = SimpleNamespace(
            id="rnd-1",
            round_name="Technical Round 1",
            candidate_name="Alice Smith",
            candidate_email="alice@example.com",
            requisition_id="req-backend",
            requisition_title="Senior Backend Engineer",
            scheduled_date="2026-10-20",
            scheduled_time="10:00 AM",
            duration_minutes=45,
            scheduled_timezone="Asia/Kolkata",
            interviewer_name="Sarah Connor",
            interviewer_email="sarah@example.com",
            status="Scheduled",
        )
        mock_session = MockSession(rounds=[round_1])

        # Overlapping attempt: 10:30 AM (overlapping with 10:00 - 10:45)
        conflicts = find_interviewer_conflicts(
            interviewer_email="sarah@example.com",
            scheduled_date="2026-10-20",
            scheduled_time="10:30 AM",
            scheduled_timezone="Asia/Kolkata",
            duration_minutes=45,
            session=mock_session,
        )
        self.assertEqual(len(conflicts), 1)
        self.assertEqual(conflicts[0]["round_id"], "rnd-1")
        self.assertEqual(conflicts[0]["candidate_name"], "Alice Smith")
        self.assertEqual(conflicts[0]["requisition_title"], "Senior Backend Engineer")

    def test_find_interviewer_conflicts_ignores_different_time_or_date(self):
        round_1 = SimpleNamespace(
            id="rnd-1",
            round_name="Technical Round 1",
            candidate_name="Alice Smith",
            candidate_email="alice@example.com",
            requisition_id="req-backend",
            requisition_title="Senior Backend Engineer",
            scheduled_date="2026-10-20",
            scheduled_time="10:00 AM",
            duration_minutes=45,
            scheduled_timezone="Asia/Kolkata",
            interviewer_name="Sarah Connor",
            interviewer_email="sarah@example.com",
            status="Scheduled",
        )
        mock_session = MockSession(rounds=[round_1])

        # Non-overlapping: 11:00 AM
        conflicts = find_interviewer_conflicts(
            interviewer_email="sarah@example.com",
            scheduled_date="2026-10-20",
            scheduled_time="11:00 AM",
            scheduled_timezone="Asia/Kolkata",
            duration_minutes=45,
            session=mock_session,
        )
        self.assertEqual(len(conflicts), 0)

    def test_validate_interviewer_availability_raises_on_conflict(self):
        round_1 = SimpleNamespace(
            id="rnd-1",
            round_name="Technical Round 1",
            candidate_name="Alice Smith",
            candidate_email="alice@example.com",
            requisition_id="req-backend",
            requisition_title="Senior Backend Engineer",
            scheduled_date="2026-10-20",
            scheduled_time="10:00 AM",
            duration_minutes=45,
            scheduled_timezone="Asia/Kolkata",
            interviewer_name="Sarah Connor",
            interviewer_email="sarah@example.com",
            status="Scheduled",
        )
        mock_session = MockSession(rounds=[round_1])

        with self.assertRaises(ValueError) as ctx:
            validate_interviewer_availability(
                interviewer_email="sarah@example.com",
                scheduled_date="2026-10-20",
                scheduled_time="10:15 AM",
                duration_minutes=45,
                interviewer_name="Sarah Connor",
                session=mock_session,
            )
        self.assertIn("already booked for another interview", str(ctx.exception))
        self.assertIn("Alice Smith", str(ctx.exception))
        self.assertIn("Senior Backend Engineer", str(ctx.exception))

    def test_validate_interviewer_availability_allows_rescheduling_same_round(self):
        round_1 = SimpleNamespace(
            id="rnd-1",
            round_name="Technical Round 1",
            candidate_name="Alice Smith",
            candidate_email="alice@example.com",
            requisition_id="req-backend",
            requisition_title="Senior Backend Engineer",
            scheduled_date="2026-10-20",
            scheduled_time="10:00 AM",
            duration_minutes=45,
            scheduled_timezone="Asia/Kolkata",
            interviewer_name="Sarah Connor",
            interviewer_email="sarah@example.com",
            status="Scheduled",
        )
        mock_session = MockSession(rounds=[round_1])

        # When exclude_round_id is rnd-1, it should NOT trigger conflict on itself
        validate_interviewer_availability(
            interviewer_email="sarah@example.com",
            scheduled_date="2026-10-20",
            scheduled_time="10:00 AM",
            duration_minutes=45,
            exclude_round_id="rnd-1",
            interviewer_name="Sarah Connor",
            session=mock_session,
        )

    def test_cross_requisition_conflict_detected_and_rejected(self):
        # Interviewer is booked for Candidate A in Requisition A
        round_req_a = SimpleNamespace(
            id="rnd-req-a",
            round_name="Architecture Review",
            candidate_name="Candidate A",
            candidate_email="cand.a@example.com",
            requisition_id="req-101",
            requisition_title="DevOps Lead",
            scheduled_date="2026-10-22",
            scheduled_time="14:00",
            duration_minutes=60,
            scheduled_timezone="Asia/Kolkata",
            interviewer_name="Alex Tech",
            interviewer_email="alex@company.com",
            status="Scheduled",
        )
        mock_session = MockSession(rounds=[round_req_a])

        # Attempt to book same interviewer for Candidate B in Requisition B at overlapping time 14:30
        with self.assertRaises(ValueError) as ctx:
            validate_interviewer_availability(
                interviewer_email="alex@company.com",
                scheduled_date="2026-10-22",
                scheduled_time="14:30",
                duration_minutes=45,
                interviewer_name="Alex Tech",
                session=mock_session,
            )
        self.assertIn("already booked for another interview", str(ctx.exception))
        self.assertIn("Architecture Review", str(ctx.exception))
        self.assertIn("Candidate A", str(ctx.exception))
        self.assertIn("DevOps Lead", str(ctx.exception))

    def test_cancelled_and_completed_rounds_do_not_block_booking(self):
        round_cancelled = SimpleNamespace(
            id="rnd-cancelled",
            round_name="Technical Round 1",
            candidate_name="Cancelled Candidate",
            candidate_email="canc@example.com",
            requisition_id="req-102",
            requisition_title="Frontend Engineer",
            scheduled_date="2026-10-22",
            scheduled_time="14:00",
            duration_minutes=60,
            scheduled_timezone="Asia/Kolkata",
            interviewer_name="Alex Tech",
            interviewer_email="alex@company.com",
            status="Cancelled",
        )
        round_completed = SimpleNamespace(
            id="rnd-completed",
            round_name="Technical Round 1",
            candidate_name="Past Candidate",
            candidate_email="past@example.com",
            requisition_id="req-103",
            requisition_title="Frontend Engineer",
            scheduled_date="2026-10-22",
            scheduled_time="14:00",
            duration_minutes=60,
            scheduled_timezone="Asia/Kolkata",
            interviewer_name="Alex Tech",
            interviewer_email="alex@company.com",
            status="Completed",
        )
        mock_session = MockSession(rounds=[round_cancelled, round_completed])

        # Should NOT raise any error because previous rounds are Cancelled / Completed
        validate_interviewer_availability(
            interviewer_email="alex@company.com",
            scheduled_date="2026-10-22",
            scheduled_time="14:00",
            duration_minutes=60,
            interviewer_name="Alex Tech",
            session=mock_session,
        )


if __name__ == "__main__":
    import unittest
    unittest.main()
