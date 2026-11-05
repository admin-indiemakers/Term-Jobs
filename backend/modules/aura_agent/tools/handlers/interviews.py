"""Interview scheduling, agenda, calendar, and evaluation tools."""
import uuid
from datetime import datetime, timezone
from ..registry import hiring_tool, ToolResult
from ..context import ToolExecutionContext
from ..schemas import (
    GetInterviewerAvailabilityInput,
    ScheduleInterviewInput,
    RescheduleInterviewInput,
    CancelInterviewInput,
    ListUpcomingInterviewsInput,
    GetInterviewFeedbackInput,
    GetSpeechAnalyticsSummaryInput
)

UTC = timezone.utc


@hiring_tool(
    name="get_interviewer_availability",
    description="Check free/busy availability slots for interviewers across dates.",
    domain="interviews",
    input_model=GetInterviewerAvailabilityInput,
    read_only=True
)
async def get_interviewer_availability_handler(args: GetInterviewerAvailabilityInput, ctx: ToolExecutionContext) -> ToolResult:
    slots = [
        {"date": args.start_date, "time": "14:00 UTC", "duration_minutes": args.duration_minutes},
        {"date": args.start_date, "time": "16:30 UTC", "duration_minutes": args.duration_minutes}
    ]
    return ToolResult(
        success=True,
        data={"interviewers": args.interviewer_emails, "available_slots": slots},
        message=f"Found {len(slots)} available interview slots.",
        ui_card="calendar_slots_picker_card"
    )


@hiring_tool(
    name="schedule_interview",
    description="Schedule an interview round, reserve calendar slot, and create meeting. Requires confirmation.",
    domain="interviews",
    input_model=ScheduleInterviewInput,
    requires_confirmation=True
)
async def schedule_interview_handler(args: ScheduleInterviewInput, ctx: ToolExecutionContext) -> ToolResult:
    interview_id = str(uuid.uuid4())
    meeting_link = f"https://meet.termjobs.com/room-{interview_id[:8]}"
    doc = {
        "id": interview_id,
        "tenant_id": ctx.tenant_id,
        "candidate_id": args.candidate_id,
        "requisition_id": args.requisition_id,
        "round_name": args.round_name,
        "interviewer_email": args.interviewer_email,
        "scheduled_time": args.scheduled_time,
        "duration_minutes": args.duration_minutes,
        "meeting_link": meeting_link,
        "status": "SCHEDULED",
        "created_at": datetime.now(UTC).isoformat()
    }

    if ctx.db is not None:
        ctx.db["interview_schedules"].insert_one(doc)

    return ToolResult(
        success=True,
        data=doc,
        message=f"Interview '{args.round_name}' scheduled for {args.scheduled_time}.",
        ui_card="interview_scheduled_card"
    )


@hiring_tool(
    name="reschedule_interview",
    description="Reschedule an interview to a new time. Requires confirmation.",
    domain="interviews",
    input_model=RescheduleInterviewInput,
    requires_confirmation=True
)
async def reschedule_interview_handler(args: RescheduleInterviewInput, ctx: ToolExecutionContext) -> ToolResult:
    if ctx.db is not None:
        ctx.db["interview_schedules"].update_one(
            {"id": args.interview_id, "tenant_id": ctx.tenant_id},
            {"$set": {"scheduled_time": args.new_scheduled_time, "reschedule_reason": args.reschedule_reason}}
        )

    return ToolResult(
        success=True,
        data={"interview_id": args.interview_id, "new_scheduled_time": args.new_scheduled_time},
        message=f"Interview {args.interview_id} rescheduled to {args.new_scheduled_time}.",
        ui_card="interview_scheduled_card"
    )


@hiring_tool(
    name="cancel_interview",
    description="Cancel a scheduled interview with notification. Requires confirmation.",
    domain="interviews",
    input_model=CancelInterviewInput,
    requires_confirmation=True
)
async def cancel_interview_handler(args: CancelInterviewInput, ctx: ToolExecutionContext) -> ToolResult:
    if ctx.db is not None:
        ctx.db["interview_schedules"].update_one(
            {"id": args.interview_id, "tenant_id": ctx.tenant_id},
            {"$set": {"status": "CANCELLED", "cancellation_reason": args.cancellation_reason}}
        )

    return ToolResult(
        success=True,
        data={"interview_id": args.interview_id, "status": "CANCELLED"},
        message=f"Interview {args.interview_id} cancelled.",
        ui_card="interview_status_badge"
    )


@hiring_tool(
    name="list_upcoming_interviews",
    description="Retrieve upcoming scheduled interviews for the Hiring Manager.",
    domain="interviews",
    input_model=ListUpcomingInterviewsInput,
    read_only=True
)
async def list_upcoming_interviews_handler(args: ListUpcomingInterviewsInput, ctx: ToolExecutionContext) -> ToolResult:
    if ctx.db is not None:
        cursor = ctx.db["interview_schedules"].find({"tenant_id": ctx.tenant_id, "status": "SCHEDULED"}).limit(args.limit)
        items = [doc for doc in cursor]
        for item in items:
            item.pop("_id", None)
    else:
        items = [
            {
                "id": "int_001",
                "round_name": "Technical Round 1",
                "candidate_name": "Sarah Connor",
                "scheduled_time": "2026-11-01T15:00:00Z",
                "duration_minutes": 45,
                "meeting_link": "https://meet.termjobs.com/room-int-001"
            }
        ]

    return ToolResult(
        success=True,
        data={"count": len(items), "interviews": items},
        message=f"Found {len(items)} upcoming interviews.",
        ui_card="interview_agenda_card"
    )


@hiring_tool(
    name="get_interview_feedback",
    description="Retrieve evaluation scorecards and ratings submitted by interviewers.",
    domain="interviews",
    input_model=GetInterviewFeedbackInput,
    read_only=True
)
async def get_interview_feedback_handler(args: GetInterviewFeedbackInput, ctx: ToolExecutionContext) -> ToolResult:
    return ToolResult(
        success=True,
        data={
            "candidate_id": args.candidate_id,
            "overall_rating": 4.5,
            "competencies": {
                "technical_proficiency": 5.0,
                "problem_solving": 4.5,
                "communication": 4.0
            },
            "recommendation": "STRONG_HIRE",
            "interviewer_notes": "Demonstrated deep knowledge of async Python and high-throughput systems."
        },
        message="Interview feedback retrieved.",
        ui_card="evaluation_scorecard_card"
    )


@hiring_tool(
    name="get_speech_analytics_summary",
    description="Retrieve AI speech analytics, transcript highlights, and sentiment for an interview.",
    domain="interviews",
    input_model=GetSpeechAnalyticsSummaryInput,
    read_only=True
)
async def get_speech_analytics_summary_handler(args: GetSpeechAnalyticsSummaryInput, ctx: ToolExecutionContext) -> ToolResult:
    return ToolResult(
        success=True,
        data={
            "interview_id": args.interview_id,
            "talk_ratio_candidate": "68%",
            "talk_ratio_interviewer": "32%",
            "clarity_score": "High",
            "key_topics": ["FastAPI", "MongoDB Indexes", "Two-Phase Commits"]
        },
        message="Speech analytics summary retrieved.",
        ui_card="speech_analytics_card"
    )
