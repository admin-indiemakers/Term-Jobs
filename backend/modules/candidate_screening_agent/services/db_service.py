import os
import uuid
from datetime import datetime, timezone

UTC = timezone.utc
from typing import Any

from pymongo import MongoClient

try:
    from modules.shared.config import settings
    DEFAULT_DB_URL = getattr(settings, "mongodb_url", "mongodb://localhost:27017/")
    DEFAULT_DB_NAME = getattr(settings, "mongo_db_name", "termjobs")
except ImportError:
    DEFAULT_DB_URL = "mongodb://localhost:27017/"
    DEFAULT_DB_NAME = "termjobs"


def get_db():
    """Return the MongoDB database."""
    db_url = (
        os.getenv("MONGODB_URL")
        or os.getenv("MONGODB_URI")
        or os.getenv("MONGO_URI")
        or DEFAULT_DB_URL
    )
    db_name = os.getenv("MONGO_DB_NAME", DEFAULT_DB_NAME)
    client = MongoClient(db_url, serverSelectionTimeoutMS=5000, connectTimeoutMS=5000)
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


def _make_candidate_id(requisition_id: str | None = None) -> str:
    """Generate a candidate ID prefixed with company initials."""
    initials = "CND"
    if requisition_id:
        try:
            db = get_db()
            req = db["requisitions"].find_one({"id": requisition_id})
            if req and req.get("company_profile_id"):
                cp = db["company_profiles"].find_one({"id": req["company_profile_id"]})
                if cp and cp.get("name"):
                    initials = cp["name"][:4].upper()
        except Exception:
            pass
    return f"{initials}-{str(uuid.uuid4())[:8]}"


def save_candidate_submission(cand: dict[str, Any], requisition_id: str | None = None, vendor_name: str = "Vendor A", tenant_id: str | None = None) -> str:
    """Save or update candidate submission document in MongoDB."""
    init_db()
    submission_id = cand.get("submission_id") or _make_candidate_id(requisition_id)

    try:
        db = get_db()
        doc = {
            "id": submission_id,
            "requisition_id": requisition_id or cand.get("requisition_id"),
            "tenant_id": tenant_id or cand.get("tenant_id"),
            "candidate_name": cand["candidate_name"],
            "candidate_email": cand.get("candidate_email"),
            "vendor_name": vendor_name or cand.get("vendor_name", "Vendor A"),
            "filename": cand.get("filename"),
            "fingerprint": cand.get("fingerprint"),
            "resume_text": cand.get("resume_text"),
            "jd_text": cand.get("jd_text"),
            "match_score": cand.get("match_score"),
            "recommendation": cand.get("recommendation"),
            "status": cand.get("status", "Screened"),
            "summary": cand.get("summary"),
            "details": cand.get("details", {}),
            "matched_skills": cand.get("matched_skills", []),
            "missing_skills": cand.get("missing_skills", []),
            "resume_pdf": cand.get("resume_pdf") or cand.get("pdf_base64"),
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


def fetch_candidates_from_db(requisition_id: str | None = None, status: str | None = None, tenant_id: str | None = None, company_tenant_ids: list[str] | None = None) -> list[dict[str, Any]]:
    """Fetch stored candidate submissions from MongoDB sorted by match_score DESC."""
    init_db()
    try:
        db = get_db()
        query: dict[str, Any] = {}
        if requisition_id:
            query["requisition_id"] = requisition_id
        if status:
            query["status"] = status

        or_conditions = []
        if tenant_id:
            or_conditions.append({"tenant_id": tenant_id})
        if company_tenant_ids:
            or_conditions.append({"tenant_id": {"$in": company_tenant_ids}})

        if or_conditions:
            if len(or_conditions) == 1:
                query.update(or_conditions[0])
            else:
                query["$or"] = or_conditions

        cursor = db["candidate_submissions"].find(query).sort(
            [("match_score", -1), ("created_at", -1)]
        )

        req_ids = {doc.get("requisition_id") for doc in cursor}
        req_titles: dict[str, str] = {}
        if req_ids:
            for rd in db["requisitions"].find({"id": {"$in": list(req_ids)}}):
                req_titles[rd.get("id")] = rd.get("title") or "Untitled"

        cursor = db["candidate_submissions"].find(query).sort(
            [("match_score", -1), ("created_at", -1)]
        )
        results = []
        for doc in cursor:
            req_title = None
            comp_name = None
            req_id = doc.get("requisition_id")
            req_jd = None
            req_doc = None
            if req_id:
                req_doc = db["requisitions"].find_one({"id": req_id})
                if req_doc:
                    req_title = req_doc.get("title")
                    req_jd = req_doc.get("generated_jd_markdown")
                    comp_id = req_doc.get("company_id")
                    if comp_id:
                        comp_doc = db["company_profiles"].find_one({"id": comp_id})
                        if comp_doc:
                            comp_name = comp_doc.get("name")

            hm_name = (req_doc or {}).get("structured_role", {}).get("hiring_manager") if req_doc else ""
            results.append({
                "id": doc.get("id"),
                "submission_id": doc.get("id"),
                "requisition_id": req_id,
                "requisition_title": req_title or req_titles.get(req_id),
                "requisition_ref": f"REQ-{str(req_id)[:6].upper()}" if req_id else None,
                "company_name": comp_name,
                "hiring_manager_name": hm_name or "",
                "tenant_id": doc.get("tenant_id"),
                "candidate_name": doc.get("candidate_name"),
                "candidate_email": doc.get("candidate_email"),
                "vendor_name": doc.get("vendor_name") or "Vendor A",
                "filename": doc.get("filename"),
                "fingerprint": doc.get("fingerprint"),
                "resume_text": doc.get("resume_text"),
                "jd_text": doc.get("jd_text") or req_jd or "",
                "match_score": float(doc["match_score"]) if doc.get("match_score") is not None else 0.0,
                "recommendation": doc.get("recommendation"),
                "status": doc.get("status"),
                "summary": doc.get("summary"),
                "details": doc.get("details") or {},
                "matched_skills": doc.get("matched_skills") or [],
                "missing_skills": doc.get("missing_skills") or [],
                "hiring_manager_notes": doc.get("hiring_manager_notes"),
                "created_at": doc.get("created_at").isoformat() if hasattr(doc.get("created_at"), 'isoformat') else doc.get("created_at"),
            })
        return results
    except Exception as e:
        print(f"Error fetching candidate submissions from MongoDB: {e}")
        return []


INTERNAL_ROLE_KEYS = {
    "ceiling_internal",
    "rate_card_cap",
    "total_engagement_value",
    "cost_centre",
    "budget_approved",
    "budget_reference",
    "variance_approved",
}


def _vendor_role_text(structured_role: Any) -> str:
    """Serialise a structured role for vendor eyes without internal commercial fields.

    ``ceiling_internal`` and other restricted fields must never appear in the
    JD text surfaced to consultancies.
    """
    if not isinstance(structured_role, dict):
        return str(structured_role)
    visible = {k: v for k, v in structured_role.items() if k not in INTERNAL_ROLE_KEYS}
    return str(visible)


def fetch_published_requisitions(tenant_id: str | None = None, company_tenant_ids: list[str] | None = None) -> list[dict[str, Any]]:
    """Fetch published requisitions from MongoDB, optionally restricted to a tenant or set of company tenants."""
    try:
        db = get_db()
        query: dict[str, Any] = {"status": "Published"}
        if company_tenant_ids is not None:
            query["tenant_id"] = {"$in": company_tenant_ids}
        elif tenant_id:
            query["tenant_id"] = tenant_id
        cursor = db["requisitions"].find(query).sort("created_at", -1)
        results = []
        for doc in cursor:
            markdown_jd = doc.get("generated_jd_markdown")
            structured_role = doc.get("structured_role")

            jd_text = ""
            if markdown_jd:
                jd_text = markdown_jd
            elif structured_role:
                jd_text = _vendor_role_text(structured_role)

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


def fetch_requisition_by_id(req_id: str, tenant_id: str | None = None, company_tenant_ids: list[str] | None = None) -> dict[str, Any] | None:
    """Fetch a specific requisition by ID from MongoDB."""
    try:
        db = get_db()
        query: dict[str, Any] = {"id": req_id}
        if company_tenant_ids is not None:
            query["tenant_id"] = {"$in": company_tenant_ids}
        elif tenant_id:
            query["tenant_id"] = tenant_id
        doc = db["requisitions"].find_one(query)
        if not doc:
            return None

        markdown_jd = doc.get("generated_jd_markdown")
        structured_role = doc.get("structured_role")
        jd_text = markdown_jd if markdown_jd else (_vendor_role_text(structured_role) if structured_role else "")

        return {
            "id": doc.get("id"),
            "title": doc.get("title") or "Untitled Role",
            "status": doc.get("status"),
            "jd_text": jd_text,
        }
    except Exception as e:
        print(f"Error fetching requisition '{req_id}': {e}")
        return None
