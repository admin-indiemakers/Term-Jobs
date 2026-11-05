"""Requisition management tool handlers."""
import uuid
from datetime import datetime, timezone
from typing import Any, Dict
from ..registry import hiring_tool, ToolResult
from ..context import ToolExecutionContext
from ..schemas import (
    ListRequisitionsInput,
    GetRequisitionDetailsInput,
    CreateRequisitionDraftInput,
    UpdateRequisitionDraftInput,
    SubmitRequisitionForApprovalInput,
    CloseRequisitionInput
)

UTC = timezone.utc


@hiring_tool(
    name="list_requisitions",
    description="List requisitions owned by or accessible to the Hiring Manager.",
    domain="requisitions",
    input_model=ListRequisitionsInput,
    read_only=True
)
async def list_requisitions_handler(args: ListRequisitionsInput, ctx: ToolExecutionContext) -> ToolResult:
    query: Dict[str, Any] = {"tenant_id": ctx.tenant_id}
    if args.status:
        st = str(args.status).strip().upper()
        if st in ("OPEN", "PUBLISHED", "ACTIVE"):
            query["status"] = {"$in": ["Published", "OPEN", "Active", "published", "open", "active"]}
        elif st in ("CLOSED", "FILLED"):
            query["status"] = {"$in": ["Closed", "CLOSED", "closed", "Filled", "FILLED", "filled"]}
        elif st in ("DRAFT", "STRUCTURING"):
            query["status"] = {"$in": ["Draft", "DRAFT", "draft", "Structuring", "structuring"]}
        elif st in ("PENDING", "PENDING_APPROVAL", "PENDING APPROVAL"):
            query["status"] = {"$in": ["Pending Approval", "PENDING_APPROVAL", "Pending", "pending"]}
        else:
            query["status"] = {"$regex": f"^{args.status}$", "$options": "i"}
    if args.department:
        query["department"] = {"$regex": args.department, "$options": "i"}
    if args.has_shortlisted_candidates is True:
        query["shortlist_candidate_count"] = {"$gt": 0}
    if getattr(args, "has_candidates", None) is True:
        # Handled via post-filter or candidate_submissions count
        pass
    if args.search_term:
        query["$or"] = [
            {"title": {"$regex": args.search_term, "$options": "i"}},
            {"skills": {"$regex": args.search_term, "$options": "i"}},
            {"primary_skills": {"$regex": args.search_term, "$options": "i"}}
        ]

    if ctx.db is not None:
        cursor = ctx.db["requisitions"].find(query).limit(args.limit)
        items = []
        for doc in cursor:
            doc.pop("_id", None)
            req_id = doc.get("id")
            sub_count = 0
            if ctx.db is not None and req_id:
                try:
                    sub_count = ctx.db["candidate_submissions"].count_documents({"requisition_id": req_id})
                except Exception:
                    sub_count = 0
            shortlist_cnt = doc.get("shortlist_candidate_count", 0) or 0
            cand_cnt = max(sub_count, shortlist_cnt)
            items.append({
                "id": req_id,
                "title": doc.get("title") or "Untitled Requisition",
                "department": doc.get("department") or doc.get("company_name") or "Engineering",
                "status": doc.get("status") or "DRAFT",
                "headcount": doc.get("headcount") or 1,
                "candidate_count": cand_cnt,
                "applicants_count": cand_cnt,
                "shortlist_candidate_count": shortlist_cnt,
                "director_approved": doc.get("director_approved", False),
                "primary_skills": (doc.get("skills") or doc.get("primary_skills") or [])[:5],
                "created_at": doc.get("created_at")
            })
        if getattr(args, "has_candidates", None) is True:
            items = [r for r in items if (r.get("candidate_count", 0) > 0 or r.get("shortlist_candidate_count", 0) > 0)]
    else:
        # Test / offline fallback
        items = [
            {
                "id": "req_demo_01",
                "tenant_id": ctx.tenant_id,
                "title": "Senior Python Backend Engineer",
                "department": args.department or "Engineering",
                "status": args.status or "OPEN",
                "headcount": 2,
                "shortlist_candidate_count": 1 if args.has_shortlisted_candidates else 0,
                "director_approved": True,
                "primary_skills": ["Python", "FastAPI", "MongoDB"],
                "created_by": ctx.user_id
            }
        ]
        if args.has_shortlisted_candidates:
            items = [r for r in items if r.get("shortlist_candidate_count", 0) > 0]

    return ToolResult(
        success=True,
        data={"count": len(items), "requisitions": items},
        message=f"Found {len(items)} requisitions.",
        ui_card="requisition_list_card"
    )


@hiring_tool(
    name="get_requisition_details",
    description="Retrieve full specifications and requirements for a specific requisition ID.",
    domain="requisitions",
    input_model=GetRequisitionDetailsInput,
    read_only=True
)
async def get_requisition_details_handler(args: GetRequisitionDetailsInput, ctx: ToolExecutionContext) -> ToolResult:
    if ctx.db is not None:
        doc = ctx.db["requisitions"].find_one({"id": args.requisition_id, "tenant_id": ctx.tenant_id})
        if not doc:
            return ToolResult(success=False, data={}, message=f"Requisition {args.requisition_id} not found.", error="NOT_FOUND")
        doc.pop("_id", None)
    else:
        doc = {
            "id": args.requisition_id,
            "tenant_id": ctx.tenant_id,
            "title": "Senior Python Backend Engineer",
            "department": "Engineering",
            "status": "OPEN",
            "headcount": 2,
            "primary_skills": ["Python", "FastAPI", "MongoDB"],
            "secondary_skills": ["Docker", "Kubernetes"],
            "budget_max": 85.0,
            "work_mode": "Remote",
            "location": "Bangalore, India",
            "created_by": ctx.user_id
        }

    return ToolResult(
        success=True,
        data={"requisition": doc},
        message=f"Retrieved requisition details for {doc.get('title')}.",
        ui_card="requisition_detail_card"
    )


@hiring_tool(
    name="create_requisition_draft",
    description="Create a new draft job requisition in DRAFT status for review before submitting for Director approval.",
    domain="requisitions",
    input_model=CreateRequisitionDraftInput,
    requires_confirmation=False
)
async def create_requisition_draft_handler(args: CreateRequisitionDraftInput, ctx: ToolExecutionContext) -> ToolResult:
    req_id = str(uuid.uuid4())
    req_doc = {
        "id": req_id,
        "tenant_id": ctx.tenant_id,
        "created_by": ctx.user_id,
        "status": "DRAFT",
        "title": args.title,
        "department": args.department,
        "headcount": args.headcount,
        "primary_skills": args.primary_skills,
        "secondary_skills": args.secondary_skills or [],
        "min_experience_years": args.min_experience_years,
        "budget_max": args.budget_max,
        "work_mode": args.work_mode,
        "location": args.location,
        "description": args.description or "",
        "created_at": datetime.now(UTC).isoformat()
    }

    if ctx.db is not None:
        ctx.db["requisitions"].insert_one(req_doc)

    return ToolResult(
        success=True,
        data={"requisition_id": req_id, "title": args.title, "status": "DRAFT"},
        message=f"Draft requisition '{args.title}' created successfully.",
        ui_card="requisition_draft_card"
    )


@hiring_tool(
    name="update_requisition_draft",
    description="Update fields on an existing DRAFT requisition.",
    domain="requisitions",
    input_model=UpdateRequisitionDraftInput,
    requires_confirmation=False
)
async def update_requisition_draft_handler(args: UpdateRequisitionDraftInput, ctx: ToolExecutionContext) -> ToolResult:
    if ctx.db is not None:
        res = ctx.db["requisitions"].update_one(
            {"id": args.requisition_id, "tenant_id": ctx.tenant_id, "status": "DRAFT"},
            {"$set": args.updates}
        )
        if res.matched_count == 0:
            return ToolResult(success=False, data={}, message="Draft requisition not found or not in DRAFT status.", error="UPDATE_FAILED")

    return ToolResult(
        success=True,
        data={"requisition_id": args.requisition_id, "updated_fields": list(args.updates.keys())},
        message=f"Requisition {args.requisition_id} updated successfully.",
        ui_card="requisition_draft_card"
    )


@hiring_tool(
    name="submit_requisition_for_approval",
    description="Formally submit a finalized draft requisition to the Director for approval. Requires confirmation.",
    domain="requisitions",
    input_model=SubmitRequisitionForApprovalInput,
    requires_confirmation=True
)
async def submit_requisition_for_approval_handler(args: SubmitRequisitionForApprovalInput, ctx: ToolExecutionContext) -> ToolResult:
    if ctx.db is not None:
        ctx.db["requisitions"].update_one(
            {"id": args.requisition_id, "tenant_id": ctx.tenant_id},
            {"$set": {"status": "PENDING_APPROVAL", "submitted_at": datetime.now(UTC).isoformat()}}
        )

    return ToolResult(
        success=True,
        data={"requisition_id": args.requisition_id, "status": "PENDING_APPROVAL"},
        message="Requisition submitted for Director approval.",
        ui_card="requisition_status_badge"
    )


@hiring_tool(
    name="close_requisition",
    description="Close an active or draft requisition. Requires confirmation.",
    domain="requisitions",
    input_model=CloseRequisitionInput,
    requires_confirmation=True
)
async def close_requisition_handler(args: CloseRequisitionInput, ctx: ToolExecutionContext) -> ToolResult:
    if ctx.db is not None:
        ctx.db["requisitions"].update_one(
            {"id": args.requisition_id, "tenant_id": ctx.tenant_id},
            {"$set": {"status": "CLOSED", "closure_reason": args.closure_reason, "closed_at": datetime.now(UTC).isoformat()}}
        )

    return ToolResult(
        success=True,
        data={"requisition_id": args.requisition_id, "status": "CLOSED", "closure_reason": args.closure_reason},
        message=f"Requisition {args.requisition_id} closed with reason: {args.closure_reason}.",
        ui_card="requisition_status_badge"
    )
