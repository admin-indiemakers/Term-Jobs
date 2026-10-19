"""
Tests for candidate schedule conflict detection and overlapping rounds prevention.
"""
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import Mock, patch

from modules.interview.domain.models import InterviewRound
from modules.interview.services.interviewer_availability import (
    parse_round_time_window,
    check_intervals_overlap,
    find_candidate_conflicts,
    validate_candidate_availability,
    get_candidate_booked_slots,
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
    def __init__(self, rounds=None):
        self.rounds = rounds or []

    def query(self, model):
        return MockQuery(self.rounds)

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        pass


class CandidateScheduleConflictTests(TestCase):
    def setUp(self):
        self.existing_round = SimpleNamespace(
            id="rnd-101",
            round_name="Technical Interview",
            candidate_submission_id="sub-123",
            candidate_name="John Doe",
            candidate_email="john.doe@example.com",
            requisition_id="req-456",
            requisition_title="Frontend Developer",
            scheduled_date="2026-10-20",
            scheduled_time="10:00 AM",
            duration_minutes=45,
            scheduled_timezone="Asia/Kolkata",
            interviewer_name="Alice Interviewer",
            interviewer_email="alice@company.com",
            tenant_id="tenant-1",
            created_by="usr-hm",
            status="Scheduled",
        )

    def test_find_candidate_conflicts_detects_exact_same_slot(self):
        session = MockSession(rounds=[self.existing_round])
        conflicts = find_candidate_conflicts(
            candidate_submission_id="sub-123",
            candidate_email="john.doe@example.com",
            scheduled_date="2026-10-20",
            scheduled_time="10:00 AM",
            duration_minutes=45,
            session=session,
        )
        self.assertEqual(len(conflicts), 1)
        self.assertEqual(conflicts[0]["round_name"], "Technical Interview")

    def test_find_candidate_conflicts_detects_overlapping_slot(self):
        session = MockSession(rounds=[self.existing_round])
        # 10:30 AM starts before 10:45 AM (end of existing round) -> Overlap!
        conflicts = find_candidate_conflicts(
            candidate_submission_id="sub-123",
            candidate_email="john.doe@example.com",
            scheduled_date="2026-10-20",
            scheduled_time="10:30 AM",
            duration_minutes=45,
            session=session,
        )
        self.assertEqual(len(conflicts), 1)

    def test_find_candidate_conflicts_allows_non_overlapping_slot(self):
        session = MockSession(rounds=[self.existing_round])
        # 11:00 AM starts after 10:45 AM -> No overlap!
        conflicts = find_candidate_conflicts(
            candidate_submission_id="sub-123",
            candidate_email="john.doe@example.com",
            scheduled_date="2026-10-20",
            scheduled_time="11:00 AM",
            duration_minutes=45,
            session=session,
        )
        self.assertEqual(len(conflicts), 0)

    def test_find_candidate_conflicts_allows_different_date(self):
        session = MockSession(rounds=[self.existing_round])
        conflicts = find_candidate_conflicts(
            candidate_submission_id="sub-123",
            candidate_email="john.doe@example.com",
            scheduled_date="2026-10-21",
            scheduled_time="10:00 AM",
            duration_minutes=45,
            session=session,
        )
        self.assertEqual(len(conflicts), 0)

    def test_find_candidate_conflicts_excludes_current_round(self):
        session = MockSession(rounds=[self.existing_round])
        # Rescheduling rnd-101 to same or overlapping slot should not conflict with itself
        conflicts = find_candidate_conflicts(
            candidate_submission_id="sub-123",
            candidate_email="john.doe@example.com",
            scheduled_date="2026-10-20",
            scheduled_time="10:00 AM",
            duration_minutes=45,
            exclude_round_id="rnd-101",
            session=session,
        )
        self.assertEqual(len(conflicts), 0)

    def test_validate_candidate_availability_raises_on_conflict(self):
        session = MockSession(rounds=[self.existing_round])
        with self.assertRaises(ValueError) as ctx:
            validate_candidate_availability(
                candidate_submission_id="sub-123",
                candidate_email="john.doe@example.com",
                scheduled_date="2026-10-20",
                scheduled_time="10:00 AM",
                duration_minutes=45,
                session=session,
            )
        self.assertIn("already has an interview round", str(ctx.exception))
        self.assertIn("Technical Interview", str(ctx.exception))

    def test_validate_candidate_availability_passes_when_free(self):
        session = MockSession(rounds=[self.existing_round])
        # Should not raise
        validate_candidate_availability(
            candidate_submission_id="sub-123",
            candidate_email="john.doe@example.com",
            scheduled_date="2026-10-20",
            scheduled_time="02:00 PM",
            duration_minutes=45,
            session=session,
        )

    def test_get_candidate_booked_slots(self):
        session = MockSession(rounds=[self.existing_round])
        slots = get_candidate_booked_slots(
            candidate_submission_id="sub-123",
            session=session,
        )
        self.assertEqual(len(slots), 1)
        self.assertEqual(slots[0]["scheduled_date"], "2026-10-20")
        self.assertEqual(slots[0]["scheduled_time"], "10:00 AM")

    def test_cross_requisition_candidate_conflict_detected(self):
        # Candidate has an interview round in Requisition A
        round_req_a = SimpleNamespace(
            id="rnd-req-a",
            round_name="Initial HR Round",
            candidate_submission_id="sub-cross-1",
            candidate_name="Jane Doe",
            candidate_email="jane.doe@example.com",
            requisition_id="req-backend-lead",
            requisition_title="Backend Lead",
            scheduled_date="2026-10-22",
            scheduled_time="03:00 PM",
            duration_minutes=45,
            scheduled_timezone="Asia/Kolkata",
            interviewer_name="Recruiter Bob",
            interviewer_email="bob@company.com",
            status="Scheduled",
        )
        session = MockSession(rounds=[round_req_a])

        # Attempt to schedule an interview round for the same candidate under Requisition B at overlapping time 03:30 PM
        with self.assertRaises(ValueError) as ctx:
            validate_candidate_availability(
                candidate_submission_id="sub-cross-2",
                candidate_email="jane.doe@example.com",
                scheduled_date="2026-10-22",
                scheduled_time="03:30 PM",
                duration_minutes=45,
                candidate_name="Jane Doe",
                session=session,
            )
        self.assertIn("already has an interview round", str(ctx.exception))
        self.assertIn("Initial HR Round", str(ctx.exception))
        self.assertIn("Backend Lead", str(ctx.exception))

    def test_save_company_interview_blocks_overlapping_candidate_booking(self):
        from modules.interview.services.company_schedule import save_company_interview
        user = SimpleNamespace(id="usr-hm", tenant_id="tenant-1", role="Hiring Manager", name="Hiring Manager", email="hm@company.com")
        
        # When candidate already has an interview on 2026-10-20 at 10:00 AM
        data = {
            "candidate_identifier": "sub-123",
            "candidate_submission_id": "sub-123",
            "candidate_email": "john.doe@example.com",
            "candidate_name": "John Doe",
            "requisition_id": "req-456",
            "round_name": "HR Interview",
            "round_type": "HR",
            "scheduled_date": "2026-10-20",
            "scheduled_time": "10:30",
            "scheduled_timezone": "Asia/Kolkata",
            "duration_minutes": 45,
            "interviewer_name": "Carol HR",
            "interviewer_email": "carol@company.com",
        }

        with patch("modules.interview.services.company_schedule.get_session", return_value=MockSession(rounds=[self.existing_round])):
            with self.assertRaises(ValueError) as ctx:
                save_company_interview(user, data)
            self.assertIn("already has an interview round", str(ctx.exception))
            self.assertIn("Technical Interview", str(ctx.exception))

