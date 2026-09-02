"""Flush all candidate, requisition, onboarding, timesheet, expense, and work order collections for a fresh start.
"""
from modules.shared.db import db, get_session
from modules.requisition.domain.models import Requisition, DecisionRecord
from modules.candidate.domain.models import CandidateSubmission

def flush_all_hiring_data():
    # 1. Clear Relational DB (Requisitions, Candidate Submissions, Decision Records)
    with get_session() as session:
        session.query(DecisionRecord).delete()
        session.query(CandidateSubmission).delete()
        session.query(Requisition).delete()
        session.commit()

    # 2. Clear Mongo Collections
    collections_to_clear = [
        "requisitions",
        "candidate_submissions",
        "onboarding_checklists",
        "onboarding_issues",
        "work_orders",
        "timesheets",
        "attendance_sheets",
        "candidate_expenses",
        "candidate_notifications"
    ]
    
    deleted_counts = {}
    for coll_name in collections_to_clear:
        res = db[coll_name].delete_many({})
        deleted_counts[coll_name] = res.deleted_count

    print("Database flushed successfully:")
    print(deleted_counts)

if __name__ == "__main__":
    flush_all_hiring_data()
