"""Public internship applications and the Super Admin application list."""

from datetime import datetime, timezone
import re

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator

from modules.identity.domain.models import User
from modules.identity.router import get_current_user
from modules.shared.db import db

router = APIRouter(tags=["Internship applications"])
PAGE_SIZE = 50


class InternshipApplication(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    name: str = Field(min_length=1, max_length=100)
    phone: str = Field(min_length=1, max_length=32)

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value: str) -> str:
        normalized = re.sub(r"[\s().-]", "", value)
        if not re.fullmatch(r"\+?[0-9]{7,15}", normalized):
            raise ValueError("Enter a phone number with 7 to 15 digits.")
        return normalized


@router.post("/api/public/internship/applications", status_code=201)
def submit_application(application: InternshipApplication):
    db["internship_applications"].insert_one({
        **application.model_dump(),
        "created_at": datetime.now(timezone.utc),
    })
    return {"status": "success"}


@router.get("/api/superadmin/internship/applications")
def list_applications(
    response: Response,
    current_user: User = Depends(get_current_user),
    cursor: str | None = Query(default=None, pattern=r"^[0-9a-f]{24}$"),
):
    if current_user.role != "Super Admin" or not current_user.is_active:
        raise HTTPException(403, "Only Super Admins can view internship applications.")

    response.headers["Cache-Control"] = "private, no-store"
    return application_page(cursor, include_submission_time=True)


@router.get("/api/public/internship/applications")
def list_public_applications(
    response: Response,
    cursor: str | None = Query(default=None, pattern=r"^[0-9a-f]{24}$"),
):
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Robots-Tag"] = "noindex"
    return application_page(cursor, include_submission_time=False)


def application_page(cursor: str | None, *, include_submission_time: bool):
    collection = db["internship_applications"]
    query = {"_id": {"$lt": ObjectId(cursor)}} if cursor else {}
    projection = {"name": 1, "phone": 1}
    if include_submission_time:
        projection["created_at"] = 1
    rows = list(
        collection.find(query, projection)
        .sort("_id", -1)
        .limit(PAGE_SIZE + 1)
    )
    page = rows[:PAGE_SIZE]
    return {
        "applications": [
            {
                "id": str(row["_id"]),
                "name": row["name"],
                "phone": row["phone"],
                **({"created_at": row["created_at"].replace(tzinfo=timezone.utc).isoformat()}
                   if include_submission_time else {}),
            }
            for row in page
        ],
        "next_cursor": str(page[-1]["_id"]) if len(rows) > PAGE_SIZE else None,
        "total": collection.count_documents({}),
    }
