"""Migration script: copies existing candidate_id to workorder_id across MongoDB and SQL database."""
import os
import sys

# Ensure backend root is on python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from modules.shared.db import db, get_session
from modules.identity.domain.models import User

def run_migration():
    print("[MIGRATION] Starting candidate_id -> workorder_id migration...")

    # 1. MongoDB Collections
    collections = [
        ("users", "candidate_id"),
        ("candidate_submissions", "candidate_id"),
        ("onboarding_checklists", "candidate_id"),
        ("work_orders", "candidate_id"),
        ("timesheets", "candidate_id"),
        ("attendance_sheets", "candidate_id"),
        ("expenses", "candidate_id"),
        ("notifications", "candidate_id"),
    ]

    for coll_name, field in collections:
        try:
            coll = db[coll_name]
            count = 0
            if coll_name == "candidate_submissions":
                # Ensure workorder_id is set
                cursor = coll.find({"$or": [{"workorder_id": {"$exists": False}}, {"workorder_id": ""}, {"workorder_id": None}]})
                for doc in cursor:
                    wo_id = doc.get("candidate_id") or doc.get("id") or ""
                    if wo_id:
                        coll.update_one({"_id": doc["_id"]}, {"$set": {"workorder_id": wo_id}})
                        count += 1
            else:
                cursor = coll.find({field: {"$exists": True, "$ne": ""}, "$or": [{"workorder_id": {"$exists": False}}, {"workorder_id": ""}, {"workorder_id": None}]})
                for doc in cursor:
                    wo_id = doc.get(field) or ""
                    if wo_id:
                        coll.update_one({"_id": doc["_id"]}, {"$set": {"workorder_id": wo_id}})
                        count += 1
            print(f"  - Mongo collection '{coll_name}': updated {count} documents with workorder_id")
        except Exception as e:
            print(f"  ! Error updating Mongo collection '{coll_name}': {e}")

    print("[MIGRATION] Completed candidate_id -> workorder_id migration.")

if __name__ == "__main__":
    run_migration()
