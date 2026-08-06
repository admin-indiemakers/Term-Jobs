import os
import uuid
from datetime import datetime, timezone

UTC = timezone.utc
from typing import Any

from pymongo import MongoClient

DEFAULT_DB_URL = "mongodb://localhost:27017/"
DEFAULT_DB_NAME = "termjobs"


def get_db():
    """Return the MongoDB database."""
    db_url = os.getenv("MONGODB_URL", DEFAULT_DB_URL)
    db_name = os.getenv("MONGO_DB_NAME", DEFAULT_DB_NAME)
    client = MongoClient(db_url, serverSelectionTimeoutMS=15000)
    return client[db_name]


def init_db():
    """Ensure indexes exist on candidate_submissions."""
    try:
        db = get_db()
        db["candidate_submissions"].create_index("requisition_id")
        db["candidate_submissions"].create_index("status")
    except Exception as e:
        print(f"Database init warning: {e}")


def _utcnow() -> datetime:
    return datetime.now(UTC)


def save_candidate_submission(cand: dict[str, Any], requisition_id: str | None = None, vendor_name: str = "Vendor A") -> str:
    """Save or update candidate submission document in MongoDB."""
    init_db()
    submission_id = cand.get("submission_id") or str(uuid.uuid4())[:8]

    try:
        db = get_db()
        doc = {
            "id": submission_id,
            "requisition_id": requisition_id or cand.get("requisition_id"),
            "candidate_name": cand["candidate_name"],
            "candidate_email": cand.get("candidate_email"),
            "vendor_name": vendor_name or cand.get("vendor_name", "Vendor A"),
            "filename": cand.get("filename"),
            "fingerprint": cand.get("fingerprint"),
            "match_score": cand.get("match_score"),
            "recommendation": cand.get("recommendation"),
            "status": cand.get("status", "Screened"),
            "summary": cand.get("summary"),
            "details": cand.get("details", {}),
            "matched_skills": cand.get("matched_skills", []),
            "missing_skills": cand.get("missing_skills", []),
            "updated_at": _utcnow(),
        }
        db["candidate_submissions"].replace_one(
            {"id": submission_id}, doc, upsert=True
        )
        return submission_id
    except Exception as e:
        print(f"Error saving candidate submission to MongoDB: {e}")
        return submission_id


def update_candidate_status_in_db(submission_id: str, status: str, notes: str | None = None) -> bool:
    """Update candidate state in MongoDB (Screened -> Shortlisted / Rejected / InterviewScheduled)."""
    try:
        db = get_db()
        db["candidate_submissions"].update_one(
            {"id": submission_id},
            {"$set": {"status": status, "hiring_manager_notes": notes or "", "updated_at": _utcnow()}},
        )
        return True
    except Exception as e:
        print(f"Error updating candidate status in MongoDB: {e}")
        return False


def fetch_candidates_from_db(requisition_id: str | None = None, status: str | None = None) -> list[dict[str, Any]]:
    """Fetch stored candidate submissions from MongoDB sorted by match_score DESC."""
    init_db()
    try:
        db = get_db()
        query: dict[str, Any] = {}
        if requisition_id:
            query["requisition_id"] = requisition_id
        if status:
            query["status"] = status

        cursor = db["candidate_submissions"].find(query).sort(
            [("match_score", -1), ("created_at", -1)]
        )
        results = []
        for doc in cursor:
            results.append({
                "submission_id": doc.get("id"),
                "requisition_id": doc.get("requisition_id"),
                "candidate_name": doc.get("candidate_name"),
                "candidate_email": doc.get("candidate_email"),
                "vendor_name": doc.get("vendor_name") or "Vendor A",
                "filename": doc.get("filename"),
                "fingerprint": doc.get("fingerprint"),
                "match_score": float(doc["match_score"]) if doc.get("match_score") is not None else 0.0,
                "recommendation": doc.get("recommendation"),
                "status": doc.get("status"),
                "summary": doc.get("summary"),
                "details": doc.get("details") or {},
                "matched_skills": doc.get("matched_skills") or [],
                "missing_skills": doc.get("missing_skills") or [],
                "hiring_manager_notes": doc.get("hiring_manager_notes"),
                "created_at": doc.get("created_at").isoformat() if doc.get("created_at") else None,
            })
        return results
    except Exception as e:
        print(f"Error fetching candidate submissions from MongoDB: {e}")
        return []


def fetch_published_requisitions() -> list[dict[str, Any]]:
    """Fetch all published requisitions from MongoDB."""
    try:
        db = get_db()
        cursor = db["requisitions"].find({}).sort("created_at", -1)
        results = []
        for doc in cursor:
            markdown_jd = doc.get("generated_jd_markdown")
            structured_role = doc.get("structured_role")

            jd_text = ""
            if markdown_jd:
                jd_text = markdown_jd
            elif structured_role:
                jd_text = str(structured_role)

            results.append({
                "id": doc.get("id"),
                "title": doc.get("title") or "Untitled Role",
                "status": doc.get("status"),
                "jd_text": jd_text,
                "created_at": doc.get("created_at").isoformat() if doc.get("created_at") else None,
            })
        return results
    except Exception as e:
        print(f"Error fetching requisitions from MongoDB: {e}")
        return []


def fetch_requisition_by_id(req_id: str) -> dict[str, Any] | None:
    """Fetch a specific requisition by ID from MongoDB."""
    try:
        db = get_db()
        doc = db["requisitions"].find_one({"id": req_id})
        if not doc:
            return None

        markdown_jd = doc.get("generated_jd_markdown")
        structured_role = doc.get("structured_role")
        jd_text = markdown_jd if markdown_jd else (str(structured_role) if structured_role else "")

        return {
            "id": doc.get("id"),
            "title": doc.get("title") or "Untitled Role",
            "status": doc.get("status"),
            "jd_text": jd_text,
        }
    except Exception as e:
        print(f"Error fetching requisition '{req_id}': {e}")
        return None
