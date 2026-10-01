"""Message Formatters for Hiring Manager Telegram AI Bot."""
import re
from typing import Dict, Any, List, Optional


def sanitize_telegram_markdown(text: str) -> str:
    """Ensure text is safe for Telegram Markdown parser."""
    if not text:
        return ""
    # Strip double asterisks if redundant, or retain standard bold
    # Telegram Markdown supports *bold*, _italic_, `inline code`, ```pre```
    # Replace markdown header hashtags (# Title) with *Title*
    lines = []
    for line in text.split("\n"):
        header_match = re.match(r"^#{1,6}\s*(.+)$", line)
        if header_match:
            lines.append(f"*{header_match.group(1).strip()}*")
        else:
            lines.append(line)
    return "\n".join(lines)


def format_draft_preview(draft: Dict[str, Any]) -> str:
    """Format a requisition draft into a sleek, structured Telegram card."""
    title = draft.get("title") or "Job Requisition"
    dept = draft.get("department") or "Engineering & Infrastructure"
    loc = draft.get("location") or "Bengaluru / Hybrid"
    emp_type = draft.get("employment_type") or "Contract"
    exp = draft.get("experience_level") or "Mid-Level"
    salary = draft.get("salary_range") or "Competitive Market Rate"
    skills = draft.get("skills") or "N/A"
    jd = draft.get("job_description") or ""

    jd_snippet = (jd[:220] + "...") if len(jd) > 220 else jd

    return (
        f"📋 *REQUISITION DRAFT PREVIEW*\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"💼 *Position:* {title}\n"
        f"🏢 *Department:* {dept}\n"
        f"📍 *Location:* {loc}\n"
        f"⏳ *Engagement:* {emp_type}\n"
        f"🎯 *Experience:* {exp}\n"
        f"💰 *Budget:* {salary}\n"
        f"🛠 *Skills:* `{skills}`\n\n"
        f"📝 *Summary:*\n_{jd_snippet}_\n\n"
        f"✨ *Ready to send for Director approval or publish directly?*"
    )


def format_candidate_item(c: Dict[str, Any]) -> str:
    """Format single candidate preview."""
    name = c.get("candidate_name") or c.get("name") or "Candidate"
    score = c.get("match_score", 0)
    role = c.get("requisition_title") or c.get("role") or "Engineering Role"
    status = c.get("status") or "Shortlisted"
    skills = c.get("skills") or c.get("top_skills") or ""
    if isinstance(skills, list):
        skills = ", ".join(skills[:4])

    return (
        f"👤 *{name}*  (🎯 *{score}% Match*)\n"
        f"💼 *Role:* {role}\n"
        f"🛠 *Skills:* `{skills or 'Relevant Stack'}`\n"
        f"📊 *Status:* `{status}`\n"
    )


def format_timesheet_item(ts: Dict[str, Any]) -> str:
    """Format timesheet for quick review."""
    cand = ts.get("candidate_name") or ts.get("worker_name") or "Contractor"
    week = ts.get("week_period") or ts.get("period") or "Current Period"
    hrs = ts.get("hours_logged") or ts.get("total_hours") or 40
    amt = ts.get("total_amount") or ts.get("amount") or "—"

    return (
        f"⏳ *Timesheet Pending Review*\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"👤 *Contractor:* {cand}\n"
        f"📅 *Period:* {week}\n"
        f"⏱ *Hours Logged:* {hrs} hrs\n"
        f"💵 *Amount:* ₹{amt:,}" if isinstance(amt, (int, float)) else f"💵 *Amount:* {amt}\n"
    )


def format_stats_card(stats: Dict[str, Any], company_name: str) -> str:
    """Format hiring health overview."""
    live_reqs = stats.get("live_requisitions", 0)
    shortlisted = stats.get("shortlisted_candidates", 0)
    interviews = stats.get("scheduled_interviews", 0)
    timesheets = stats.get("pending_timesheets", 0)
    expenses = stats.get("pending_expenses", 0)

    return (
        f"📊 *HIRING HEALTH OVERVIEW*\n"
        f"🏢 *{company_name}*\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"📋 Live Requisitions: *{live_reqs}*\n"
        f"👥 Shortlisted Candidates: *{shortlisted}*\n"
        f"📅 Scheduled Interviews: *{interviews}*\n"
        f"⏳ Pending Timesheets: *{timesheets}*\n"
        f"💸 Pending Expenses: *{expenses}*\n\n"
        f"💬 _Ask me anytime: 'Show shortlisted' or 'Draft a role'_"
    )
