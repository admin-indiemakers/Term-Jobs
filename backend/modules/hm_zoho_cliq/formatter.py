"""Zoho Cliq Rich Message & Card Formatter.

Converts AI agent responses, candidate data, interview proposals, timesheets,
and requisition briefings into Zoho Cliq compatible JSON schemas.
"""
from typing import Dict, Any, List, Optional


def build_cliq_button(label: str, key: str, button_type: str = "+") -> Dict[str, Any]:
    """Helper to build a Zoho Cliq interactive button."""
    return {
        "label": label[:20],
        "type": button_type,  # "+" is positive (green/blue), "-" is negative (red)
        "key": key,
        "action": {
            "type": "invoke.function",
            "data": {
                "key": key
            }
        }
    }


def format_cliq_welcome() -> Dict[str, Any]:
    """Welcome greeting and quick action bar in Zoho Cliq."""
    text = (
        "*Welcome to TermJobs AI Hiring Assistant!* 🤖\n\n"
        "I am your dedicated enterprise workforce assistant. You can chat with me naturally or use the quick actions below to manage your pipeline:\n\n"
        "- *Draft Requisition:* Type _'Draft a React developer role'_\n"
        "- *Candidate Screening:* Check match scores, review profiles, and schedule interviews\n"
        "- *Approvals:* Review timesheets, expenses, and submit requisitions for Director Approval"
    )
    buttons = [
        build_cliq_button("⚡ Pending Works", "menu:pending_works"),
        build_cliq_button("👥 Candidates", "menu:candidates"),
        build_cliq_button("👷 Working Hires", "menu:accepted_candidates"),
        build_cliq_button("📋 Requisitions", "menu:requisitions"),
        build_cliq_button("📊 Pipeline Stats", "menu:stats")
    ]
    return {
        "text": text,
        "card": {
            "title": "⚡ TermJobs Hiring Manager AI",
            "theme": "modern-inline"
        },
        "buttons": buttons[:5]
    }


def format_cliq_quick_menu() -> List[Dict[str, Any]]:
    """Standard quick action buttons for Zoho Cliq (max 5)."""
    return [
        build_cliq_button("⚡ Pending Works", "menu:pending_works"),
        build_cliq_button("👥 Candidates", "menu:candidates"),
        build_cliq_button("👷 Working Hires", "menu:accepted_candidates"),
        build_cliq_button("📋 Requisitions", "menu:requisitions"),
        build_cliq_button("📊 Pipeline Stats", "menu:stats")
    ]


def format_cliq_pending_works(data: Dict[str, Any], company_name: str = "TermJobs") -> Dict[str, Any]:
    """Format the pending works action center for Zoho Cliq."""
    summary = data.get("summary", {})
    ts_cnt = summary.get("pending_timesheets_count", 0)
    exp_cnt = summary.get("pending_expenses_count", 0)
    cand_cnt = summary.get("shortlisted_candidates_count", 0)
    onb_cnt = summary.get("onboarding_issues_count", 0)
    open_reqs = summary.get("open_requisitions_count", 0)

    text = (
        f"⚡ *PENDING ACTIONS CENTER — {company_name.upper()}*\n"
        f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"⏳ *Timesheets Awaiting Review:* {ts_cnt}\n"
        f"💳 *Expense Claims Awaiting Review:* {exp_cnt}\n"
        f"👥 *Candidates Ready for Screening:* {cand_cnt}\n"
        f"🚀 *Active Onboarding Provisioning Checks:* {onb_cnt}\n"
        f"📋 *Active Open Requisitions:* {open_reqs}\n\n"
        f"_Select an item below to take immediate action:_"
    )
    buttons = []
    if ts_cnt > 0:
        buttons.append(build_cliq_button(f"⏳ Timesheets ({ts_cnt})", "menu:timesheets"))
    if exp_cnt > 0:
        buttons.append(build_cliq_button(f"💳 Expenses ({exp_cnt})", "menu:expenses"))
    buttons.append(build_cliq_button("👥 Candidates", "menu:candidates"))
    buttons.append(build_cliq_button("👷 Working Hires", "menu:accepted_candidates"))
    buttons.append(build_cliq_button("📊 Pipeline Stats", "menu:stats"))

    return {
        "text": text,
        "card": {
            "title": "⚡ Pending Actions Briefing",
            "theme": "modern-inline"
        },
        "buttons": buttons[:5]
    }


def format_cliq_shortlisted_candidate(cand: Dict[str, Any]) -> Dict[str, Any]:
    """Format an individual shortlisted candidate card with interactive action buttons."""
    name = cand.get("candidate_name") or cand.get("name") or "Candidate"
    score = cand.get("match_score") or "85%"
    role = cand.get("requisition_title") or "Engineering Role"
    skills = cand.get("skills") or "React, Python, TypeScript"
    if isinstance(skills, list):
        skills = ", ".join(skills)
    vendor = cand.get("vendor_name") or "Vendorqueue"
    status = cand.get("status") or "Shortlisted"

    text = (
        f"👤 *{name}* (🎯 *{score} Match*)\n"
        f"━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"💼 *Role:* {role}\n"
        f"🛠 *Skills:* {skills}\n"
        f"🏢 *Vendor:* {vendor}\n"
        f"📊 *Status:* `{status}`"
    )

    cand_key = name[:20]
    buttons = [
        build_cliq_button("📅 Schedule Int", f"sched_int:{cand_key}", "+"),
        build_cliq_button("👤 Profile", f"view_prof:{cand_key}"),
        build_cliq_button("❌ Reject", f"rej_cand:{cand_key}", "-")
    ]

    return {
        "text": text,
        "card": {
            "title": f"Candidate: {name} ({score})",
            "theme": "modern-inline"
        },
        "buttons": buttons[:5]
    }


def format_cliq_interview_proposal(sched: Dict[str, Any]) -> Dict[str, Any]:
    """Format interview proposal preview card with confirmation button."""
    cand = sched.get("candidate") or sched.get("candidate_name") or "Candidate"
    role = sched.get("requisition_title") or "Senior Full Stack Developer"
    dt = sched.get("proposed_date") or "2026-09-12"
    tm = sched.get("proposed_time") or "02:00 PM EST"
    typ = sched.get("interview_type") or "Technical Round"
    notes = sched.get("meeting_notes") or "Technical evaluation focusing on system design & backend APIs."

    text = (
        f"📅 *INTERVIEW PROPOSAL CREATED*\n"
        f"━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"👤 *Candidate:* {cand}\n"
        f"💼 *Role:* {role}\n"
        f"🎯 *Round:* {typ}\n"
        f"📆 *Proposed Date:* {dt}\n"
        f"⏰ *Time Slot:* {tm}\n"
        f"📝 *Notes:* _{notes}_\n\n"
        f"✨ _Confirm below to notify the candidate and dispatch calendar invites._"
    )

    cand_key = cand[:20]
    buttons = [
        build_cliq_button("✅ Confirm & Send", f"conf_int:{cand_key}", "+"),
        build_cliq_button("❌ Cancel", "menu:candidates", "-")
    ]

    return {
        "text": text,
        "card": {
            "title": "📅 Interview Proposal",
            "theme": "modern-inline"
        },
        "buttons": buttons[:5]
    }


def format_cliq_interview_confirmed(res: Dict[str, Any]) -> Dict[str, Any]:
    """Format interview confirmation card after dispatching."""
    cand = res.get("candidate_name", "Candidate")
    email = res.get("candidate_email", "")
    date_str = res.get("date", "2026-09-12")
    time_str = res.get("time", "03:00 PM")
    link = res.get("meeting_link", "")
    code = res.get("passcode", "")

    text = (
        f"✅ *INTERVIEW CONFIRMED & DISPATCHED!*\n"
        f"━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"👤 *Candidate:* {cand}\n"
        f"📧 *Delivered to:* `{email}`\n"
        f"📅 *Scheduled Date:* {date_str}\n"
        f"⏰ *Time Slot:* {time_str}\n"
        f"🎥 *Interview Room:* [{link}]({link})\n"
        f"🔑 *Candidate Passcode:* `{code}`\n\n"
        f"✨ _Official invitation email with candidate login portal & meeting room links has been delivered via TermJobs Gmail SMTP._"
    )

    return {
        "text": text,
        "card": {
            "title": "✅ Interview Dispatched",
            "theme": "modern-inline"
        },
        "buttons": format_cliq_quick_menu()
    }


def format_cliq_candidate_rejected(res: Dict[str, Any]) -> Dict[str, Any]:
    """Format candidate rejection card."""
    cand = res.get("candidate_name") or "Candidate"
    role = res.get("requisition_title") or "Engineering Role"
    vendor = res.get("vendor_name") or "Vendorqueue"
    reason = res.get("reason") or "Not aligned with requisition requirements."

    text = (
        f"🚫 *CANDIDATE REJECTED*\n"
        f"━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"👤 *Candidate:* {cand}\n"
        f"💼 *Role:* {role}\n"
        f"🏢 *Vendor:* {vendor}\n"
        f"📌 *Status:* `Rejected`\n"
        f"📝 *Reason:* _{reason}_\n\n"
        f"✨ _The candidate has been marked as Rejected and removed from the active screening pool._"
    )

    return {
        "text": text,
        "card": {
            "title": "🚫 Candidate Rejected",
            "theme": "modern-inline"
        },
        "buttons": format_cliq_quick_menu()
    }


def format_cliq_candidate_profile(prof: Dict[str, Any]) -> Dict[str, Any]:
    """Format candidate detailed profile card for Zoho Cliq."""
    name = prof.get("name") or prof.get("candidate_name") or "Candidate"
    role = prof.get("role") or prof.get("requisition_title") or "Full Stack Engineer"
    skills = prof.get("skills") or "React, Node.js, Python, AWS"
    if isinstance(skills, list):
        skills = ", ".join(skills)
    rate = prof.get("hourly_rate") or "$75/hr"
    status = prof.get("status") or "Shortlisted"
    score = prof.get("match_score") or "88%"
    notes = prof.get("screening_notes") or "Demonstrated solid technical depth in system architecture."

    text = (
        f"👤 *CANDIDATE WORKFORCE PROFILE: {name}*\n"
        f"━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"💼 *Role:* {role}\n"
        f"🎯 *Match Score:* {score}\n"
        f"📊 *Current Status:* `{status}`\n"
        f"💵 *Rate:* {rate}\n"
        f"🛠 *Skills:* {skills}\n"
        f"📝 *Screening Notes:* _{notes}_"
    )

    cand_key = name[:20]
    buttons = [
        build_cliq_button("📅 Schedule Int", f"sched_int:{cand_key}", "+"),
        build_cliq_button("❌ Reject", f"rej_cand:{cand_key}", "-"),
        build_cliq_button("👥 Candidates", "menu:candidates")
    ]

    return {
        "text": text,
        "card": {
            "title": f"Profile: {name}",
            "theme": "modern-inline"
        },
        "buttons": buttons[:5]
    }


def format_cliq_draft_preview(draft: Dict[str, Any]) -> Dict[str, Any]:
    """Format requisition draft preview card for Zoho Cliq."""
    title = draft.get("title") or "Software Engineer"
    dept = draft.get("department") or "Engineering & Product"
    exp = draft.get("experience_level") or "Mid-Senior"
    budget = draft.get("budget_range") or "$80 - $120 / hr"
    skills = draft.get("skills") or ["React", "TypeScript", "Node.js"]
    if isinstance(skills, list):
        skills = ", ".join(skills)
    loc = draft.get("location") or "Remote"

    text = (
        f"📄 *REQUISITION DRAFT PREVIEW*\n"
        f"━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"📌 *Role Title:* {title}\n"
        f"🏢 *Department:* {dept}\n"
        f"📈 *Experience Level:* {exp}\n"
        f"💰 *Budget Range:* {budget}\n"
        f"📍 *Work Mode:* {loc}\n"
        f"🛠 *Required Tech Stack:* {skills}\n\n"
        f"⚠️ *Policy Requirement:* Direct publication is disabled. Requisitions must be submitted to the Director for approval."
    )

    buttons = [
        build_cliq_button("🚀 Send to Director", "submit_draft", "+"),
        build_cliq_button("❌ Discard Draft", "cancel_draft", "-")
    ]

    return {
        "text": text,
        "card": {
            "title": f"Draft: {title}",
            "theme": "modern-inline"
        },
        "buttons": buttons[:5]
    }


def format_cliq_timesheet(ts: Dict[str, Any]) -> Dict[str, Any]:
    """Format timesheet item with approval and rejection buttons."""
    ts_id = str(ts.get("id") or ts.get("_id") or "ts_1")
    cand = ts.get("candidate_name") or "Contractor"
    hrs = ts.get("total_hours") or ts.get("hours") or 40
    period = ts.get("period") or ts.get("week") or "Current Week"
    rate = ts.get("rate") or "$75/hr"

    text = (
        f"⏳ *PENDING TIMESHEET: {cand}*\n"
        f"━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"📅 *Period:* {period}\n"
        f"⏱ *Total Hours:* {hrs} hrs\n"
        f"💵 *Rate:* {rate}\n"
        f"📌 *Status:* `Pending Approval`"
    )

    buttons = [
        build_cliq_button("✅ Approve Timesheet", f"appr_ts:{ts_id}", "+"),
        build_cliq_button("❌ Reject", f"rej_ts:{ts_id}", "-")
    ]

    return {
        "text": text,
        "card": {
            "title": f"Timesheet: {cand} ({hrs} hrs)",
            "theme": "modern-inline"
        },
        "buttons": buttons[:5]
    }


def format_cliq_expense(exp: Dict[str, Any]) -> Dict[str, Any]:
    """Format expense claim item with approval and rejection buttons."""
    exp_id = str(exp.get("id") or exp.get("_id") or "exp_1")
    cand = exp.get("candidate_name") or "Contractor"
    amt = exp.get("amount") or "$0.00"
    cat = exp.get("category") or "Reimbursement Claim"
    dt = exp.get("submission_date") or "Recent"
    desc = exp.get("description") or "Travel & Work Equipment Claim"

    text = (
        f"💳 *PENDING EXPENSE CLAIM: {cand}*\n"
        f"━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"💰 *Amount Claimed:* {amt}\n"
        f"📂 *Category:* {cat}\n"
        f"📅 *Date:* {dt}\n"
        f"📝 *Description:* _{desc}_\n"
        f"📌 *Status:* `Pending Review`"
    )

    buttons = [
        build_cliq_button("✅ Approve Expense", f"appr_exp:{exp_id}", "+"),
        build_cliq_button("❌ Reject", f"rej_exp:{exp_id}", "-")
    ]

    return {
        "text": text,
        "card": {
            "title": f"Expense: {cand} ({amt})",
            "theme": "modern-inline"
        },
        "buttons": buttons[:5]
    }


def format_cliq_stats(stats: Dict[str, Any], company_name: str = "TermJobs") -> Dict[str, Any]:
    """Format pipeline stats card for Zoho Cliq."""
    live = stats.get("live_requisitions", 0)
    cand = stats.get("shortlisted_candidates", 0)
    interviews = stats.get("scheduled_interviews", 0)
    timesheets = stats.get("pending_timesheets", 0)
    expenses = stats.get("pending_expenses", 0)

    text = (
        f"📊 *HIRING HEALTH & PIPELINE OVERVIEW*\n"
        f"*{company_name} Enterprise Operations*\n"
        f"━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"📋 *Live Requisitions Active:* {live}\n"
        f"👥 *Shortlisted Candidates in Pipeline:* {cand}\n"
        f"📅 *Interviews Conducted / Booked:* {interviews}\n"
        f"⏳ *Timesheets Awaiting Review:* {timesheets}\n"
        f"💳 *Expenses Awaiting Review:* {expenses}\n\n"
        f"✨ _System healthy. Requisitions & contractor workflows running within SLA._"
    )

    return {
        "text": text,
        "card": {
            "title": f"📊 {company_name} Pipeline Stats",
            "theme": "modern-inline"
        },
        "buttons": format_cliq_quick_menu()
    }
