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


def build_candidates_selection_keyboard(cands: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Buttons for each candidate so tapping their name displays their full profile."""
    buttons = []
    row = []
    for c in cands:
        name = c.get("candidate_name") or c.get("name") or "Candidate"
        short_name = name[:20]
        row.append({"text": f"👤 {short_name}", "callback_data": f"view_prof:{short_name}"})
        if len(row) == 2:
            buttons.append(row)
            row = []
    if row:
        buttons.append(row)
    return {"inline_keyboard": buttons}


def build_profile_card_keyboard() -> Dict[str, Any]:
    """Clean back button for candidate profile card."""
    return {
        "inline_keyboard": [
            [
                {"text": "👥 Back to Candidates List", "callback_data": "menu:accepted_candidates"}
            ]
        ]
    }


def build_accepted_candidate_keyboard(candidate_name: str) -> Dict[str, Any]:
    """Deprecated: Clean profile card keyboard."""
    return build_profile_card_keyboard()


def build_onboarding_item_keyboard(candidate_name: str) -> Dict[str, Any]:
    """Action button for an onboarding candidate card."""
    cand_short = candidate_name[:25]
    return {
        "inline_keyboard": [
            [
                {"text": "👤 View Profile & Credentials", "callback_data": f"view_prof:{cand_short}"}
            ]
        ]
    }


def build_interview_proposal_keyboard(candidate_name: str) -> Dict[str, Any]:
    """Action buttons for an interview proposal."""
    cand_short = candidate_name[:20]
    return {
        "inline_keyboard": [
            [
                {"text": "✅ Confirm & Send Invite", "callback_data": f"conf_int:{cand_short}"},
                {"text": "❌ Cancel", "callback_data": "menu:candidates"}
            ]
        ]
    }


def build_pending_works_keyboard(data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Action buttons for pending works action center."""
    data = data or {}
    summary = data.get("summary", {})
    ts_cnt = summary.get("pending_timesheets_count", 0)
    exp_cnt = summary.get("pending_expenses_count", 0)
    
    keyboard = []
    row1 = []
    if ts_cnt > 0:
        row1.append({"text": f"⏳ Approve Timesheets ({ts_cnt})", "callback_data": "menu:timesheets"})
    if exp_cnt > 0:
        row1.append({"text": f"💳 Approve Expenses ({exp_cnt})", "callback_data": "menu:expenses"})
    if row1:
        keyboard.append(row1)

    keyboard.append([
        {"text": "👥 Shortlisted Pool", "callback_data": "menu:candidates"},
        {"text": "🚀 Onboarding Status", "callback_data": "menu:onboarding"}
    ])
    keyboard.append([
        {"text": "👷 Candidates Under Me", "callback_data": "menu:accepted_candidates"},
        {"text": "📊 Pipeline Stats", "callback_data": "menu:stats"}
    ])
    return {"inline_keyboard": keyboard}


def build_quick_menu_keyboard() -> Dict[str, Any]:
    """Persistent quick prompt menu."""
    return {
        "inline_keyboard": [
            [
                {"text": "⚡️ Pending Works", "callback_data": "menu:pending_works"},
                {"text": "👷 Candidates Under Me", "callback_data": "menu:accepted_candidates"}
            ],
            [
                {"text": "👥 Shortlisted Pool", "callback_data": "menu:candidates"},
                {"text": "🚀 Onboarding Pipeline", "callback_data": "menu:onboarding"}
            ],
            [
                {"text": "⏳ Timesheets", "callback_data": "menu:timesheets"},
                {"text": "💳 Expenses", "callback_data": "menu:expenses"}
            ],
            [
                {"text": "📋 Live Requisitions", "callback_data": "menu:requisitions"},
                {"text": "📊 Pipeline Stats", "callback_data": "menu:stats"}
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


def build_offboarding_proposal_keyboard(candidate_identifier: str) -> Dict[str, Any]:
    """Action buttons to confirm or cancel candidate offboarding initiation."""
    cand_safe = (candidate_identifier or "candidate")[:30]
    return {
        "inline_keyboard": [
            [
                {"text": "🚪 Confirm & Initiate Offboarding", "callback_data": f"conf_offb:{cand_safe}"},
                {"text": "❌ Cancel", "callback_data": "cancel_offb"}
            ]
        ]
    }


def build_upcoming_meetings_keyboard(meetings: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Action buttons for upcoming interviews and meetings."""
    buttons = []
    for m in meetings[:3]:
        name = (m.get("candidate_name") or "Candidate").split()[0]
        link = m.get("meeting_link") or "https://termjobs.in/interview/room"
        buttons.append([
            {"text": f"🎥 Join {name}'s Interview Room", "url": link}
        ])
    buttons.append([
        {"text": "➕ Schedule Interview", "callback_data": "menu:candidates"},
        {"text": "⚡ Quick Menu", "callback_data": "menu:help"}
    ])
    return {"inline_keyboard": buttons}


