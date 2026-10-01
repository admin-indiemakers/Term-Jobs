"""Interactive Inline Keyboard Builders for Hiring Manager Telegram AI Bot."""
from typing import Dict, Any, List, Optional


def build_requisition_draft_keyboard(draft_data: Dict[str, Any]) -> Dict[str, Any]:
    """Create inline button options for a newly drafted job requisition."""
    title = (draft_data.get("title") or "Role")[:30]
    return {
        "inline_keyboard": [
            [
                {"text": "🚀 Send for Director Approval", "callback_data": f"submit_dir:{title}"}
            ],
            [
                {"text": "⚡ Publish Directly", "callback_data": f"pub_direct:{title}"}
            ],
            [
                {"text": "❌ Cancel Draft", "callback_data": "cancel_draft"}
            ]
        ]
    }


def build_candidate_action_keyboard(candidate_name: str, req_id: Optional[str] = None) -> Dict[str, Any]:
    """Action buttons for a shortlisted candidate."""
    cand_short = candidate_name[:25]
    return {
        "inline_keyboard": [
            [
                {"text": "📅 Schedule Interview", "callback_data": f"sched_int:{cand_short}"},
                {"text": "👤 Profile Details", "callback_data": f"view_prof:{cand_short}"}
            ],
            [
                {"text": "❌ Reject Candidate", "callback_data": f"rej_cand:{cand_short}"}
            ]
        ]
    }


def build_timesheet_approval_keyboard(timesheet_id: str, candidate_name: str) -> Dict[str, Any]:
    """Quick approval/rejection buttons for a timesheet."""
    return {
        "inline_keyboard": [
            [
                {"text": "✅ Approve Timesheet", "callback_data": f"appr_ts:{timesheet_id}"},
                {"text": "❌ Reject", "callback_data": f"rej_ts:{timesheet_id}"}
            ]
        ]
    }


def build_expense_approval_keyboard(expense_id: str, candidate_name: str) -> Dict[str, Any]:
    """Quick approval/rejection buttons for candidate expense claim."""
    return {
        "inline_keyboard": [
            [
                {"text": "✅ Approve Expense", "callback_data": f"appr_exp:{expense_id}"},
                {"text": "❌ Reject", "callback_data": f"rej_exp:{expense_id}"}
            ]
        ]
    }


def build_quick_menu_keyboard() -> Dict[str, Any]:
    """Persistent quick prompt menu."""
    return {
        "inline_keyboard": [
            [
                {"text": "📋 Live Requisitions", "callback_data": "menu:requisitions"},
                {"text": "👥 Shortlisted Candidates", "callback_data": "menu:candidates"}
            ],
            [
                {"text": "⏳ Pending Timesheets", "callback_data": "menu:timesheets"},
                {"text": "📊 Hiring Stats", "callback_data": "menu:stats"}
            ]
        ]
    }


def build_role_selection_keyboard(roles: Optional[List[str]] = None) -> Dict[str, Any]:
    """Create a grid of roles for 1-tap drafting in Telegram."""
    default_roles = [
        "DevOps Engineer",
        "Senior Backend Engineer",
        "Frontend Engineer (React / Next.js)",
        "Data Engineer",
        "Mobile Engineer (Flutter / React Native)",
        "UI/UX Designer",
        "Product Manager",
        "QA Automation Engineer",
        "DevSecOps Engineer"
    ]
    role_list = roles or default_roles
    keyboard = []
    # 2 buttons per row
    for i in range(0, len(role_list), 2):
        row = []
        r1 = role_list[i]
        row.append({"text": f"💼 {r1[:24]}", "callback_data": f"select_role:{r1[:30]}"})
        if i + 1 < len(role_list):
            r2 = role_list[i + 1]
            row.append({"text": f"💼 {r2[:24]}", "callback_data": f"select_role:{r2[:30]}"})
        keyboard.append(row)
    return {"inline_keyboard": keyboard}
