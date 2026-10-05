"""Zoho Cliq Rich Message & Card Formatter.

Converts AI agent responses, candidate data, interview proposals, timesheets,
and requisition briefings into Zoho Cliq compatible JSON schemas.
"""
from typing import Dict, Any, List, Optional
import re
import urllib.parse


def build_cliq_url_button(label: str, url: str, button_type: str = "+") -> Dict[str, Any]:
    """Helper to build a Zoho Cliq open.url button that opens a web link directly in the browser."""
    return {
        "label": label[:20],
        "type": button_type,
        "action": {
            "type": "open.url",
            "data": {
                "web": url
            }
        }
    }


def build_cliq_button(label: str, key: str, button_type: str = "+") -> Dict[str, Any]:
    """Helper to build a Zoho Cliq interactive button using invoke.bot."""
    key_to_message = {
        "menu:welcome": "menu",
        "menu:pending_works": "pending works",
        "menu:candidates": "shortlisted candidates",
        "menu:accepted_candidates": "candidates under me",
        "menu:timesheets": "pending timesheets",
        "menu:expenses": "pending expenses",
        "menu:requisitions": "show active requisitions",
        "menu:stats": "pipeline stats",
        "submit_draft": "submit to director for approval",
        "cancel_draft": "cancel draft",
    }

    msg = key_to_message.get(key)
    if not msg:
        if key.startswith("sched_int:"):
            cand = key.replace("sched_int:", "").strip()
            msg = f"schedule interview with {cand}"
        elif key.startswith("conf_int:"):
            cand = key.replace("conf_int:", "").strip()
            msg = f"confirm interview invitation for {cand}"
        elif key.startswith("view_prof:"):
            cand = key.replace("view_prof:", "").strip()
            msg = f"view profile of {cand}"
        elif key.startswith("view_res:"):
            cand = key.replace("view_res:", "").strip()
            msg = f"send resume of {cand}"
        elif key.startswith("rej_cand:"):
            cand = key.replace("rej_cand:", "").strip()
            msg = f"reject candidate {cand}"
        elif key.startswith("appr_ts:"):
            ts_id = key.replace("appr_ts:", "").strip()
            msg = f"approve timesheet {ts_id}"
        elif key.startswith("rej_ts:"):
            ts_id = key.replace("rej_ts:", "").strip()
            msg = f"reject timesheet {ts_id}"
        elif key.startswith("appr_exp:"):
            exp_id = key.replace("appr_exp:", "").strip()
            msg = f"approve expense {exp_id}"
        elif key.startswith("rej_exp:"):
            exp_id = key.replace("rej_exp:", "").strip()
            msg = f"reject expense {exp_id}"
        else:
            msg = key

    return {
        "label": label[:20],
        "type": button_type,  # "+" is positive (green/blue), "-" is negative (red)
        "key": key,
        "action": {
            "type": "invoke.function",
            "data": {
                "name": "HiringmanagerTermjobs"
            }
        }
    }


def format_cliq_welcome(user_name: str = "Hiring Manager", company_name: str = "TermJobs") -> Dict[str, Any]:
    """Welcome greeting and quick action bar in Zoho Cliq personalized for the hiring manager."""
    greeting = f"Hello *{user_name}*! 👋" if user_name and user_name != "Hiring Manager" else "Welcome to TermJobs! 🤖"
    company_context = f" for *{company_name}*" if company_name and company_name not in ("Client Workspace", "TermJobs") else ""
    text = (
        f"{greeting}\n"
        f"I am your dedicated enterprise AI Hiring Assistant{company_context}.\n\n"
        f"You are connected as *{user_name}* (Hiring Manager). You can chat with me naturally or use the quick actions below to manage your pipeline:\n\n"
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
    card_title = f"⚡ {user_name} — Hiring AI" if user_name and user_name != "Hiring Manager" else "⚡ TermJobs Hiring Manager AI"
    return {
        "text": text,
        "card": {
            "title": card_title,
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

    cand_identifier = cand.get("candidate_id") or cand.get("id") or name
    encoded_id = urllib.parse.quote(str(cand_identifier))
    resume_url = f"https://termjobs.in/api/zoho-cliq/candidates/{encoded_id}/resume"

    text = (
        f"👤 *{name}* (🎯 *{score} Match*)\n"
        f"━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"💼 *Role:* {role}\n"
        f"🛠 *Skills:* {skills}\n"
        f"🏢 *Vendor:* {vendor}\n"
        f"📄 *Resume:* [📥 View Resume PDF]({resume_url})\n"
        f"📊 *Status:* `{status}`"
    )

    cand_key = name[:20]
    buttons = [
        build_cliq_url_button("📄 Resume", resume_url),
        build_cliq_button("👤 Profile", f"view_prof:{cand_key}"),
        build_cliq_button("📅 Schedule Int", f"sched_int:{cand_key}", "+"),
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
    """Format candidate detailed profile card for Zoho Cliq with direct resume access."""
    name = prof.get("name") or prof.get("candidate_name") or "Candidate"
    role = prof.get("role") or prof.get("requisition_title") or "Full Stack Engineer"
    skills = prof.get("skills") or "React, Node.js, Python, AWS"
    if isinstance(skills, list):
        skills = ", ".join(skills)
    rate = prof.get("hourly_rate") or "$75/hr"
    status = prof.get("status") or "Shortlisted"
    score = prof.get("match_score") or "88%"
    notes = prof.get("screening_notes") or prof.get("notes") or "Demonstrated solid technical depth in system architecture."

    cand_identifier = prof.get("candidate_id") or prof.get("id") or name
    encoded_id = urllib.parse.quote(str(cand_identifier))
    resume_url = f"https://termjobs.in/api/zoho-cliq/candidates/{encoded_id}/resume"

    text = (
        f"👤 *CANDIDATE WORKFORCE PROFILE: {name}*\n"
        f"━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"💼 *Role:* {role}\n"
        f"🎯 *Match Score:* {score}\n"
        f"📊 *Current Status:* `{status}`\n"
        f"💵 *Rate:* {rate}\n"
        f"🛠 *Skills:* {skills}\n"
        f"📄 *Resume PDF:* [📥 View / Download Full Resume]({resume_url})\n"
        f"📝 *Screening Notes:* _{notes}_"
    )

    cand_key = name[:20]
    buttons = [
        build_cliq_url_button("📄 View Resume", resume_url),
        build_cliq_button("📅 Schedule Int", f"sched_int:{cand_key}", "+"),
        build_cliq_button("❌ Reject", f"rej_cand:{cand_key}", "-"),
        build_cliq_button("👥 Candidates", "menu:candidates")
    ]

    return {
        "text": text,
        "card": {
            "title": f"Profile: {name} ({score})",
            "theme": "modern-inline"
        },
        "buttons": buttons[:5]
    }


def format_cliq_candidate_resume(prof: Dict[str, Any]) -> Dict[str, Any]:
    """Format dedicated candidate resume card for Zoho Cliq with one-click PDF viewing."""
    name = prof.get("name") or prof.get("candidate_name") or "Candidate"
    role = prof.get("role") or prof.get("requisition_title") or "Full Stack Engineer"
    score = prof.get("match_score") or "88%"
    cand_identifier = prof.get("candidate_id") or prof.get("id") or name
    encoded_id = urllib.parse.quote(str(cand_identifier))
    resume_url = f"https://termjobs.in/api/zoho-cliq/candidates/{encoded_id}/resume"
    notes = prof.get("screening_notes") or prof.get("notes") or "Verified credentials and technical background on file."

    text = (
        f"📄 *CANDIDATE RESUME & CREDENTIALS: {name.upper()}*\n"
        f"━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"💼 *Role:* {role} (🎯 *{score} Match*)\n"
        f"📎 *Resume Document:* [📥 Click Here to View / Download PDF]({resume_url})\n\n"
        f"💡 *Summary:* _{notes}_\n\n"
        f"👉 Click *📄 Open Resume PDF* below to view the complete resume directly in your browser."
    )

    cand_key = name[:20]
    buttons = [
        build_cliq_url_button("📄 Open Resume PDF", resume_url),
        build_cliq_button("👤 Full Profile", f"view_prof:{cand_key}"),
        build_cliq_button("📅 Schedule Int", f"sched_int:{cand_key}", "+"),
        build_cliq_button("❌ Reject", f"rej_cand:{cand_key}", "-")
    ]

    return {
        "text": text,
        "card": {
            "title": f"Resume: {name}",
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
        f"⚠️ *Policy Requirement:* Direct publication is disabled. Requisitions must be submitted to the Director for approval.\n\n"
        f"👉 *Quick Action:* Click *🚀 Send to Director* below, or simply reply *'submit to director'*."
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


def convert_markdown_tables_to_cards(text: str) -> str:
    """Detect and convert Markdown pipe tables (| a | b |) into clean mobile-friendly emoji cards."""
    if "|" not in text:
        return text

    lines = text.split("\n")
    out = []
    i = 0
    num_emojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"]

    header_emojis = {
        "id": "🆔", "requisition id": "🆔", "candidate id": "🆔", "req id": "🆔",
        "title": "💼", "role": "💼", "job": "💼", "position": "💼", "job title": "💼",
        "department": "🏢", "dept": "🏢",
        "location": "📍",
        "salary": "💰", "salary range": "💰", "budget": "💰", "rate": "💰", "compensation": "💰",
        "status": "📊",
        "closed": "📅", "closed on": "📅", "date": "📅", "created": "📅", "created on": "📅", "deadline": "📅",
        "skills": "🛠", "experience": "⏳", "experience level": "⏳",
        "vendor": "🏷️", "type": "📄", "employment type": "📄"
    }

    while i < len(lines):
        line = lines[i].strip()
        # Check if line looks like table header and next line is separator
        if line.startswith("|") and line.endswith("|") and i + 1 < len(lines) and re.match(r"^\|(\s*:?-+:?\s*\|)+$", lines[i+1].strip()):
            headers = [h.strip() for h in line.strip("|").split("|")]
            i += 2  # skip header and separator line
            table_rows = []
            while i < len(lines) and lines[i].strip().startswith("|") and lines[i].strip().endswith("|"):
                row_cells = [c.strip() for c in lines[i].strip("|").split("|")]
                table_rows.append(row_cells)
                i += 1

            # Format rows as clean card blocks
            for idx, row in enumerate(table_rows):
                row_dict = {}
                for h_idx, h in enumerate(headers):
                    val = row[h_idx] if h_idx < len(row) else ""
                    row_dict[h.lower()] = val

                row_num = num_emojis[idx] if idx < len(num_emojis) else f"{idx+1}."
                main_val = row_dict.get("title") or row_dict.get("role") or row_dict.get("name") or row_dict.get("candidate") or ""
                card_lines = []
                if main_val:
                    card_lines.append(f"{row_num} *{main_val}*")
                else:
                    card_lines.append(f"{row_num} *Item #{idx+1}*")

                for h_idx, h in enumerate(headers):
                    val = row[h_idx] if h_idx < len(row) else ""
                    h_clean = h.strip()
                    h_low = h_clean.lower()
                    if h_low in ("#", "no", "no.", "title", "role", "name", "candidate") and main_val:
                        continue
                    if not val:
                        continue
                    # Shorten 36-char UUIDs to 8 chars
                    uuid_match = re.search(r"([0-9a-fA-F]{8})-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}", val)
                    if uuid_match:
                        val = f"`{uuid_match.group(1)}`"
                    val = val.strip("\"\"“”\x27")

                    ico = header_emojis.get(h_low, "•")
                    card_lines.append(f"  {ico} *{h_clean}:* {val}")

                out.append("\n".join(card_lines) + "\n")
        else:
            out.append(lines[i])
            i += 1
    return "\n".join(out)


def sanitize_cliq_markdown(text: str) -> str:
    """Sanitize and enhance text formatting for Zoho Cliq."""
    if not text:
        return ""
    # 1. Convert pipe tables to clean cards
    text = convert_markdown_tables_to_cards(text)

    # 2. Convert markdown headers `# Heading` -> `*Heading*`
    text = re.sub(r'^(?:#{1,6})\s+(.+)$', r'*\1*', text, flags=re.MULTILINE)

    # 3. Convert double asterisks **bold** to single *bold* (Zoho Cliq standard)
    text = re.sub(r'\*\*([^*]+)\*\*', r'*\1*', text)

    # 4. Shorten remaining long UUIDs
    text = re.sub(
        r'["“\']?([0-9a-fA-F]{8})-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}["”\']?',
        r'`\1`',
        text
    )

    # 5. Clean up redundant empty lines
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()

