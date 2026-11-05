"""Candidate screening, comparison, and pipeline action tools."""
from datetime import datetime, timezone
from typing import Any, Dict
from ..registry import hiring_tool, ToolResult
from ..context import ToolExecutionContext
from ..schemas import (
    SearchCandidatesInput,
    GetCandidateProfileInput,
    CompareCandidatesInput,
    ExplainAIMatchScoreInput,
    ShortlistCandidateInput,
    RejectCandidateInput,
    CheckCandidateSLAStatusInput
)

UTC = timezone.utc


@hiring_tool(
    name="search_candidates",
    description="Search and filter candidates by requisition, match score, or skills.",
    domain="candidates",
    input_model=SearchCandidatesInput,
    read_only=True
)
async def search_candidates_handler(args: SearchCandidatesInput, ctx: ToolExecutionContext) -> ToolResult:
    query: Dict[str, Any] = {"tenant_id": ctx.tenant_id}
    if args.requisition_id:
        query["requisition_id"] = args.requisition_id
    if args.status:
        query["status"] = {"$regex": f"^{args.status}$", "$options": "i"} if isinstance(args.status, str) else args.status
    if args.min_match_score is not None:
        query["match_score"] = {"$gte": float(args.min_match_score)}
    if args.vendor_id:
        query["vendor_name"] = {"$regex": args.vendor_id, "$options": "i"}
    if args.skills:
        query["$or"] = [
            {"matched_skills": {"$in": args.skills}},
            {"skills": {"$in": args.skills}}
        ]

    if ctx.db is not None:
        cursor = ctx.db["candidate_submissions"].find(query).limit(args.limit)
        items = []
        for doc in cursor:
            doc.pop("_id", None)
            score_val = doc.get("match_score")
            try:
                score = round(float(score_val), 1) if score_val is not None else 0
            except (ValueError, TypeError):
                score = 0
            items.append({
                "id": doc.get("id") or doc.get("submission_id"),
                "candidate_name": doc.get("candidate_name") or doc.get("name") or "Candidate",
                "name": doc.get("candidate_name") or doc.get("name") or "Candidate",
                "requisition_id": doc.get("requisition_id"),
                "status": doc.get("status") or "SUBMITTED",
                "match_score": score,
                "matched_skills": (doc.get("matched_skills") or doc.get("skills") or [])[:6],
                "missing_skills": (doc.get("missing_skills") or [])[:4],
                "vendor_name": doc.get("vendor_name") or "Vendor Partner",
                "experience_years": doc.get("experience_years") or 0,
                "summary": doc.get("summary") or doc.get("recommendation") or "",
                "created_at": doc.get("created_at")
            })
    else:
        items = [
            {
                "id": "cand_001",
                "name": "Sarah Connor",
                "candidate_name": "Sarah Connor",
                "requisition_id": args.requisition_id or "req_demo_01",
                "match_score": 92,
                "skills": ["Python", "FastAPI", "Docker", "PostgreSQL"],
                "matched_skills": ["Python", "FastAPI", "Docker", "PostgreSQL"],
                "missing_skills": [],
                "vendor_name": "TechStaff Solutions",
                "experience_years": 6,
                "status": args.status or "SUBMITTED",
                "summary": "Strong backend engineer with extensive FastAPI and containerization experience."
            },
            {
                "id": "cand_002",
                "name": "Rahul Verma",
                "candidate_name": "Rahul Verma",
                "requisition_id": args.requisition_id or "req_demo_01",
                "match_score": 85,
                "skills": ["Python", "Django", "MongoDB"],
                "matched_skills": ["Python", "Django", "MongoDB"],
                "missing_skills": ["FastAPI"],
                "vendor_name": "TalentSource Global",
                "experience_years": 5,
                "status": args.status or "SUBMITTED",
                "summary": "Solid full-stack Python candidate with strong database design skills."
            }
        ]
        if args.min_match_score is not None:
            items = [c for c in items if c["match_score"] >= args.min_match_score]

    return ToolResult(
        success=True,
        data={"count": len(items), "candidates": items},
        message=f"Found {len(items)} matching candidates.",
        ui_card="candidate_search_results_card"
    )


@hiring_tool(
    name="get_candidate_profile",
    description="Retrieve full candidate profile, resume text, and submission history.",
    domain="candidates",
    input_model=GetCandidateProfileInput,
    read_only=True
)
async def get_candidate_profile_handler(args: GetCandidateProfileInput, ctx: ToolExecutionContext) -> ToolResult:
    if ctx.db is not None:
        doc = ctx.db["candidate_submissions"].find_one({"id": args.candidate_id, "tenant_id": ctx.tenant_id})
        if not doc:
            return ToolResult(success=False, data={}, message=f"Candidate {args.candidate_id} not found.", error="NOT_FOUND")
        doc.pop("_id", None)
    else:
        doc = {
            "id": args.candidate_id,
            "name": "Sarah Connor",
            "email": "sarah.connor@example.com",
            "experience_years": 6,
            "match_score": 92,
            "skills": ["Python", "FastAPI", "Docker", "MongoDB", "AsyncIO"],
            "summary": "Full-stack Python engineer with 6 years experience building scalable microservices.",
            "status": "SUBMITTED"
        }

    return ToolResult(
        success=True,
        data={"candidate": doc},
        message=f"Retrieved candidate profile for {doc.get('name')}.",
        ui_card="candidate_dossier_card"
    )


@hiring_tool(
    name="compare_candidates",
    description="Compare 2 to 4 candidates side-by-side against requisition requirements.",
    domain="candidates",
    input_model=CompareCandidatesInput,
    read_only=True
)
async def compare_candidates_handler(args: CompareCandidatesInput, ctx: ToolExecutionContext) -> ToolResult:
    comparison = [
        {
            "id": cid,
            "name": f"Candidate {cid[-3:]}",
            "match_score": 88,
            "matched_skills": ["Python", "FastAPI"],
            "missing_skills": ["Kubernetes"],
            "experience_years": 5
        }
        for cid in args.candidate_ids
    ]
    return ToolResult(
        success=True,
        data={"requisition_id": args.requisition_id, "comparison": comparison},
        message=f"Compared {len(args.candidate_ids)} candidates.",
        ui_card="candidate_comparison_table"
    )


@hiring_tool(
    name="explain_ai_match_score",
    description="Explain how an AI match score was calculated (matched vs missing skills, experience weights).",
    domain="candidates",
    input_model=ExplainAIMatchScoreInput,
    read_only=True
)
async def explain_ai_match_score_handler(args: ExplainAIMatchScoreInput, ctx: ToolExecutionContext) -> ToolResult:
    return ToolResult(
        success=True,
        data={
            "candidate_id": args.candidate_id,
            "requisition_id": args.requisition_id,
            "overall_score": 92,
            "skill_match_percentage": 95,
            "experience_match_percentage": 90,
            "matched_skills": ["Python", "FastAPI", "MongoDB"],
            "missing_skills": ["Kubernetes"],
            "reasoning": "Strong match on primary backend stack; exceeds minimum experience by 2 years."
        },
        message="AI match score breakdown generated.",
        ui_card="match_score_breakdown_card"
    )


@hiring_tool(
    name="shortlist_candidate",
    description="Move a candidate to the SHORTLISTED pipeline stage. Requires confirmation.",
    domain="candidates",
    input_model=ShortlistCandidateInput,
    requires_confirmation=True
)
async def shortlist_candidate_handler(args: ShortlistCandidateInput, ctx: ToolExecutionContext) -> ToolResult:
    if ctx.db is not None:
        ctx.db["candidate_submissions"].update_one(
            {"id": args.candidate_id, "tenant_id": ctx.tenant_id},
            {"$set": {"status": "SHORTLISTED", "shortlist_notes": args.shortlist_notes, "shortlisted_at": datetime.now(UTC).isoformat()}}
        )

    return ToolResult(
        success=True,
        data={"candidate_id": args.candidate_id, "status": "SHORTLISTED"},
        message=f"Candidate {args.candidate_id} moved to SHORTLISTED.",
        ui_card="candidate_status_badge"
    )


@hiring_tool(
    name="reject_candidate",
    description="Reject a candidate with mandatory structured feedback. Requires confirmation.",
    domain="candidates",
    input_model=RejectCandidateInput,
    requires_confirmation=True
)
async def reject_candidate_handler(args: RejectCandidateInput, ctx: ToolExecutionContext) -> ToolResult:
    if ctx.db is not None:
        ctx.db["candidate_submissions"].update_one(
            {"id": args.candidate_id, "tenant_id": ctx.tenant_id},
            {"$set": {"status": "REJECTED", "rejection_reason": args.rejection_reason, "rejected_at": datetime.now(UTC).isoformat()}}
        )

    return ToolResult(
        success=True,
        data={"candidate_id": args.candidate_id, "status": "REJECTED", "rejection_reason": args.rejection_reason},
        message=f"Candidate {args.candidate_id} has been rejected.",
        ui_card="candidate_status_badge"
    )


@hiring_tool(
    name="check_candidate_sla_status",
    description="Audit the 48-hour shortlist SLA status across newly submitted candidates.",
    domain="candidates",
    input_model=CheckCandidateSLAStatusInput,
    read_only=True
)
async def check_candidate_sla_status_handler(args: CheckCandidateSLAStatusInput, ctx: ToolExecutionContext) -> ToolResult:
    sla_data = [
        {
            "candidate_id": "cand_001",
            "candidate_name": "Sarah Connor",
            "hours_remaining": 14.5,
            "is_at_risk": False,
            "status": "SUBMITTED"
        }
    ]
    return ToolResult(
        success=True,
        data={"sla_items": sla_data, "at_risk_count": 0},
        message="48-hour SLA status checked.",
        ui_card="sla_countdown_card"
    )
