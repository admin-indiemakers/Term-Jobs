"""Workforce, timesheet, expense, issue desk, and KPI tools."""
from datetime import datetime, timezone
from typing import Any, Dict
from ..registry import hiring_tool, ToolResult
from ..context import ToolExecutionContext
from ..schemas import (
    GetOnboardingPipelineInput,
    GetOnboardingBlockersInput,
    ListActiveContractorsInput,
    ListPendingTimesheetsInput,
    ApproveTimesheetInput,
    RejectTimesheetInput,
    ListPendingExpensesInput,
    ApproveExpenseInput,
    RejectExpenseInput,
    ListContractorIssuesInput,
    ResolveContractorIssueInput,
    GetHiringManagerKPIsInput
)

UTC = timezone.utc


@hiring_tool(
    name="get_onboarding_pipeline",
    description="View accepted candidates progressing through pre-onboarding checks.",
    domain="onboarding",
    input_model=GetOnboardingPipelineInput,
    read_only=True
)
async def get_onboarding_pipeline_handler(args: GetOnboardingPipelineInput, ctx: ToolExecutionContext) -> ToolResult:
    pipeline = [
        {
            "candidate_id": "cand_001",
            "candidate_name": "Sarah Connor",
            "bgv_status": "COMPLETED",
            "equipment_status": "SHIPPED",
            "sow_status": "SIGNED",
            "start_date": "2026-11-15"
        }
    ]
    return ToolResult(
        success=True,
        data={"pipeline": pipeline},
        message=f"Found {len(pipeline)} candidates in pre-onboarding.",
        ui_card="onboarding_pipeline_card"
    )


@hiring_tool(
    name="get_onboarding_blockers",
    description="Identify blockers in background check, equipment, or contracts for accepted candidates.",
    domain="onboarding",
    input_model=GetOnboardingBlockersInput,
    read_only=True
)
async def get_onboarding_blockers_handler(args: GetOnboardingBlockersInput, ctx: ToolExecutionContext) -> ToolResult:
    return ToolResult(
        success=True,
        data={"blockers": [], "has_blockers": False},
        message="No active onboarding blockers detected.",
        ui_card="blockers_alert_card"
    )


@hiring_tool(
    name="list_active_contractors",
    description="List active contingent contractors reporting to the Hiring Manager's team.",
    domain="workforce",
    input_model=ListActiveContractorsInput,
    read_only=True
)
async def list_active_contractors_handler(args: ListActiveContractorsInput, ctx: ToolExecutionContext) -> ToolResult:
    contractors = [
        {
            "id": "contr_101",
            "name": "Alex Chen",
            "role": "Cloud DevOps Architect",
            "project": args.project or "Platform Modernization",
            "contract_end_date": "2026-12-31",
            "days_until_expiry": 61,
            "status": "ACTIVE"
        }
    ]
    return ToolResult(
        success=True,
        data={"count": len(contractors), "contractors": contractors},
        message=f"Found {len(contractors)} active contractors.",
        ui_card="contractor_roster_card"
    )


@hiring_tool(
    name="list_pending_timesheets",
    description="Retrieve submitted contractor weekly timesheets awaiting Hiring Manager approval.",
    domain="timesheets",
    input_model=ListPendingTimesheetsInput,
    read_only=True
)
async def list_pending_timesheets_handler(args: ListPendingTimesheetsInput, ctx: ToolExecutionContext) -> ToolResult:
    if ctx.db is not None:
        cursor = ctx.db["timesheets"].find({"tenant_id": ctx.tenant_id, "status": "SUBMITTED"}).limit(args.limit)
        items = []
        for doc in cursor:
            doc.pop("_id", None)
            hours = float(doc.get("total_hours", 0) or 0)
            items.append({
                "id": doc.get("id"),
                "contractor_name": doc.get("contractor_name") or doc.get("candidate_name") or "Contractor",
                "week_ending": doc.get("week_ending") or doc.get("week_start_date") or "Current Week",
                "total_hours": hours,
                "has_overtime": hours > 40.0,
                "project": doc.get("project") or doc.get("project_name") or "General Operations",
                "status": doc.get("status") or "SUBMITTED"
            })
    else:
        items = [
            {
                "id": "ts_wk_43",
                "contractor_name": "Alex Chen",
                "week_ending": "2026-10-25",
                "total_hours": 40.0,
                "has_overtime": False,
                "project": "Platform Modernization",
                "status": "SUBMITTED"
            }
        ]

    total_hours = sum(t.get("total_hours", 0) for t in items)
    return ToolResult(
        success=True,
        data={"count": len(items), "total_billable_hours": total_hours, "timesheets": items},
        message=f"Found {len(items)} timesheets awaiting approval ({total_hours} total billable hours).",
        ui_card="timesheet_review_list_card"
    )


@hiring_tool(
    name="approve_timesheet",
    description="Approve a contractor's weekly timesheet. Requires confirmation.",
    domain="timesheets",
    input_model=ApproveTimesheetInput,
    requires_confirmation=True
)
async def approve_timesheet_handler(args: ApproveTimesheetInput, ctx: ToolExecutionContext) -> ToolResult:
    if ctx.db is not None:
        ctx.db["timesheets"].update_one(
            {"id": args.timesheet_id, "tenant_id": ctx.tenant_id},
            {"$set": {"status": "APPROVED", "approved_at": datetime.now(UTC).isoformat(), "approval_note": args.approval_note}}
        )

    return ToolResult(
        success=True,
        data={"timesheet_id": args.timesheet_id, "status": "APPROVED"},
        message=f"Timesheet {args.timesheet_id} approved successfully.",
        ui_card="timesheet_status_badge"
    )


@hiring_tool(
    name="reject_timesheet",
    description="Reject a submitted timesheet with mandatory reason. Requires confirmation.",
    domain="timesheets",
    input_model=RejectTimesheetInput,
    requires_confirmation=True
)
async def reject_timesheet_handler(args: RejectTimesheetInput, ctx: ToolExecutionContext) -> ToolResult:
    if ctx.db is not None:
        ctx.db["timesheets"].update_one(
            {"id": args.timesheet_id, "tenant_id": ctx.tenant_id},
            {"$set": {"status": "REJECTED", "rejection_reason": args.rejection_reason, "rejected_at": datetime.now(UTC).isoformat()}}
        )

    return ToolResult(
        success=True,
        data={"timesheet_id": args.timesheet_id, "status": "REJECTED", "rejection_reason": args.rejection_reason},
        message=f"Timesheet {args.timesheet_id} rejected.",
        ui_card="timesheet_status_badge"
    )


@hiring_tool(
    name="list_pending_expenses",
    description="Retrieve submitted contractor expense claims awaiting review.",
    domain="expenses",
    input_model=ListPendingExpensesInput,
    read_only=True
)
async def list_pending_expenses_handler(args: ListPendingExpensesInput, ctx: ToolExecutionContext) -> ToolResult:
    expenses = [
        {
            "id": "exp_501",
            "contractor_name": "Alex Chen",
            "category": "Software License",
            "amount": 120.00,
            "currency": "USD",
            "receipt_url": "https://cdn.termjobs.com/receipts/exp_501.pdf",
            "status": "SUBMITTED"
        }
    ]
    return ToolResult(
        success=True,
        data={"count": len(expenses), "expenses": expenses},
        message=f"Found {len(expenses)} expense claims awaiting review.",
        ui_card="expense_review_list_card"
    )


@hiring_tool(
    name="approve_expense",
    description="Approve a contractor expense claim for reimbursement. Requires confirmation.",
    domain="expenses",
    input_model=ApproveExpenseInput,
    requires_confirmation=True
)
async def approve_expense_handler(args: ApproveExpenseInput, ctx: ToolExecutionContext) -> ToolResult:
    if ctx.db is not None:
        ctx.db["candidate_expenses"].update_one(
            {"id": args.expense_id, "tenant_id": ctx.tenant_id},
            {"$set": {"status": "APPROVED", "approved_at": datetime.now(UTC).isoformat()}}
        )

    return ToolResult(
        success=True,
        data={"expense_id": args.expense_id, "status": "APPROVED"},
        message=f"Expense claim {args.expense_id} approved.",
        ui_card="expense_status_badge"
    )


@hiring_tool(
    name="reject_expense",
    description="Reject a contractor expense claim with mandatory reason. Requires confirmation.",
    domain="expenses",
    input_model=RejectExpenseInput,
    requires_confirmation=True
)
async def reject_expense_handler(args: RejectExpenseInput, ctx: ToolExecutionContext) -> ToolResult:
    if ctx.db is not None:
        ctx.db["candidate_expenses"].update_one(
            {"id": args.expense_id, "tenant_id": ctx.tenant_id},
            {"$set": {"status": "REJECTED", "rejection_reason": args.rejection_reason, "rejected_at": datetime.now(UTC).isoformat()}}
        )

    return ToolResult(
        success=True,
        data={"expense_id": args.expense_id, "status": "REJECTED", "rejection_reason": args.rejection_reason},
        message=f"Expense claim {args.expense_id} rejected.",
        ui_card="expense_status_badge"
    )


@hiring_tool(
    name="list_contractor_issues",
    description="View active workplace issues or incident tickets logged regarding contractors.",
    domain="issues",
    input_model=ListContractorIssuesInput,
    read_only=True
)
async def list_contractor_issues_handler(args: ListContractorIssuesInput, ctx: ToolExecutionContext) -> ToolResult:
    issues = [
        {
            "id": "iss_901",
            "contractor_name": "Alex Chen",
            "title": "VPN Security Token De-synchronization",
            "severity": args.severity or "MEDIUM",
            "status": args.status or "OPEN"
        }
    ]
    return ToolResult(
        success=True,
        data={"count": len(issues), "issues": issues},
        message=f"Found {len(issues)} contractor issues.",
        ui_card="issues_desk_card"
    )


@hiring_tool(
    name="resolve_contractor_issue",
    description="Resolve and close an issue ticket with mandatory resolution documentation. Requires confirmation.",
    domain="issues",
    input_model=ResolveContractorIssueInput,
    requires_confirmation=True
)
async def resolve_contractor_issue_handler(args: ResolveContractorIssueInput, ctx: ToolExecutionContext) -> ToolResult:
    if ctx.db is not None:
        ctx.db["onboarding_issues"].update_one(
            {"id": args.issue_id, "tenant_id": ctx.tenant_id},
            {"$set": {"status": "RESOLVED", "resolution_notes": args.resolution_notes, "resolved_at": datetime.now(UTC).isoformat()}}
        )

    return ToolResult(
        success=True,
        data={"issue_id": args.issue_id, "status": "RESOLVED", "resolution_notes": args.resolution_notes},
        message=f"Issue {args.issue_id} marked as RESOLVED.",
        ui_card="issue_status_badge"
    )


@hiring_tool(
    name="get_hiring_manager_kpis",
    description="Retrieve executive snapshot KPI metrics for the Hiring Manager dashboard.",
    domain="analytics",
    input_model=GetHiringManagerKPIsInput,
    read_only=True
)
async def get_hiring_manager_kpis_handler(args: GetHiringManagerKPIsInput, ctx: ToolExecutionContext) -> ToolResult:
    return ToolResult(
        success=True,
        data={
            "open_requisitions_count": 3,
            "candidates_under_review_count": 7,
            "sla_at_risk_count": 0,
            "pending_timesheets_count": 2,
            "pending_expenses_count": 1,
            "active_contractors_count": 5
        },
        message="Hiring manager dashboard KPIs retrieved.",
        ui_card="hm_kpi_overview_card"
    )
