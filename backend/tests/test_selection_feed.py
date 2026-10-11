"""Regression tests for duplicate candidate selection feed records."""
import sys
from pathlib import Path
from unittest import TestCase


sys.path.insert(0, str(Path(__file__).parents[1]))
from modules.notifications.services.selection_feed import deduplicate_selections


class SelectionFeedTests(TestCase):
    def test_record_and_accepted_submission_count_as_one_selection(self):
        record = {
            "id": "selection-1", "submission_id": "submission-1", "requisition_id": "req-1",
            "candidate_name": "SREEHARI PS", "candidate_email": "sreehari@example.com",
            "hiring_manager_name": "doe", "notes": "", "match_score": 78,
        }
        submission = {
            "id": "submission-1", "submission_id": "submission-1", "requisition_id": "req-1",
            "candidate_name": "SREEHARI PS", "candidate_email": "sreehari@example.com",
            "hiring_manager_name": "Hiring Manager", "notes": "Manager note", "match_score": None,
        }
        result = deduplicate_selections([record, submission])
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["id"], "selection-1")
        self.assertEqual(result[0]["hiring_manager_name"], "doe")
        self.assertEqual(result[0]["notes"], "Manager note")

    def test_legacy_record_without_submission_id_merges_by_requisition_and_name(self):
        record = {"id": "selection-1", "requisition_id": "req-1", "candidate_name": "SREEHARI PS"}
        submission = {"id": "submission-1", "submission_id": "submission-1", "requisition_id": "req-1", "candidate_name": "Sreehari  PS"}
        self.assertEqual(len(deduplicate_selections([record, submission])), 1)

    def test_repeated_stored_events_do_not_inflate_count(self):
        entries = [
            {"id": "first", "requisition_id": "req-1", "candidate_name": "SREEHARI PS", "candidate_email": "sreehari@example.com"},
            {"id": "second", "requisition_id": "req-1", "candidate_name": "SREEHARI PS", "candidate_email": "sreehari@example.com"},
        ]
        self.assertEqual(len(deduplicate_selections(entries)), 1)

    def test_different_requisitions_or_candidate_emails_stay_separate(self):
        entries = [
            {"id": "a", "requisition_id": "req-1", "candidate_name": "Alex Lee", "candidate_email": "one@example.com"},
            {"id": "b", "requisition_id": "req-1", "candidate_name": "Alex Lee", "candidate_email": "two@example.com"},
            {"id": "c", "requisition_id": "req-2", "candidate_name": "Alex Lee", "candidate_email": "one@example.com"},
        ]
        self.assertEqual(len(deduplicate_selections(entries)), 3)
