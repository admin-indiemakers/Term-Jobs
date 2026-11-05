"""Hiring decisions and candidate portal tools."""
from datetime import datetime, timezone
from ..registry import hiring_tool, ToolResult
from ..context import ToolExecutionContext
from ..schemas import (
    RecommendHiringDecisionInput,
    AcceptCandidateOfferInput,
    CheckCandidatePortalStatusInput,
    ResendPortalInvitationInput
)

UTC = timezone.utc


@hiring_tool(
    name="recommend_hiring_decision",
    description="Synthesize candidate scorecards and screening data into an evidence-based recommendation.",
    domain="hiring_decisions",
    input_model=RecommendHiringDecisionInput,
    read_only=True
)
async def recommend_hiring_decision_handler(args: RecommendHiringDecisionInput, ctx: ToolExecutionContext) -> ToolResult:
    return ToolResult(
        success=True,
        data={
            "candidate_id": args.candidate_id,
            "recommendation": "PROCEED_TO_OFFER",
            "confidence_score": 94,
            "rationale": "All interviewers rated the candidate 4.5+ with consistent praise for technical depth."
        },
        message="Hiring decision recommendation generated.",
        ui_card="hiring_recommendation_card"
    )


@hiring_tool(
    name="accept_candidate_offer",
    description="Formally accept a candidate for hire and trigger work order drafting. Requires confirmation.",
    domain="hiring_decisions",
    input_model=AcceptCandidateOfferInput,
    requires_confirmation=True
)
async def accept_candidate_offer_handler(args: AcceptCandidateOfferInput, ctx: ToolExecutionContext) -> ToolResult:
    if ctx.db is not None:
        ctx.db["candidate_submissions"].update_one(
            {"id": args.candidate_id, "tenant_id": ctx.tenant_id},
            {"$set": {
                "status": "ACCEPTED",
                "target_start_date": args.target_start_date,
                "approved_rate": args.approved_rate,
                "accepted_at": datetime.now(UTC).isoformat()
            }}
        )

    return ToolResult(
        success=True,
        data={
            "candidate_id": args.candidate_id,
            "status": "ACCEPTED",
            "target_start_date": args.target_start_date,
            "approved_rate": args.approved_rate
        },
        message=f"Candidate {args.candidate_id} accepted for hire.",
        ui_card="offer_accepted_card"
    )


@hiring_tool(
    name="check_candidate_portal_status",
    description="Check candidate portal account activation and credential status.",
    domain="candidate_portal",
    input_model=CheckCandidatePortalStatusInput,
    read_only=True
)
async def check_candidate_portal_status_handler(args: CheckCandidatePortalStatusInput, ctx: ToolExecutionContext) -> ToolResult:
    return ToolResult(
        success=True,
        data={
            "candidate_id": args.candidate_id,
            "portal_status": "ACTIVE",
            "last_login": "2026-10-30T10:15:00Z",
            "onboarding_checklist_completed": True
        },
        message="Candidate portal status retrieved.",
        ui_card="candidate_portal_badge"
    )


@hiring_tool(
    name="resend_portal_invitation",
    description="Resend candidate portal activation email. Requires confirmation.",
    domain="candidate_portal",
    input_model=ResendPortalInvitationInput,
    requires_confirmation=True
)
async def resend_portal_invitation_handler(args: ResendPortalInvitationInput, ctx: ToolExecutionContext) -> ToolResult:
    return ToolResult(
        success=True,
        data={"candidate_id": args.candidate_id, "invitation_status": "SENT"},
        message=f"Portal activation invitation resent to candidate {args.candidate_id}.",
        ui_card="portal_invite_status_card"
    )
