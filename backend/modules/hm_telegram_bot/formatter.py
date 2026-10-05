"""Message Formatters for Hiring Manager Telegram AI Bot."""
import re
from typing import Dict, Any, List, Optional


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
        if line.startswith("|") and line.endswith("|") and i + 1 < len(lines) and re.match(r"^\|(\s*:?-+:?\s*\|)+$", lines[i+1].strip()):
            headers = [h.strip() for h in line.strip("|").split("|")]
            i += 2  # skip header and separator
            table_rows = []
            while i < len(lines) and lines[i].strip().startswith("|") and lines[i].strip().endswith("|"):
                row_cells = [c.strip() for c in lines[i].strip("|").split("|")]
                table_rows.append(row_cells)
                i += 1

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


def sanitize_telegram_markdown(text: str) -> str:
    """Ensure text is safe for Telegram Markdown parser."""
    if not text:
        return ""
    # 1. Convert pipe tables into clean emoji cards
    text = convert_markdown_tables_to_cards(text)

    # 2. Shorten UUIDs
    text = re.sub(
        r'["“\']?([0-9a-fA-F]{8})-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}["”\']?',
        r'`\1`',
        text
    )

    # 3. Replace markdown header hashtags (# Title) with *Title*
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
        f"✨ *Ready to send this requisition to the Director for approval?*"
    )


def format_candidate_item(c: Dict[str, Any]) -> str:
    """Format single candidate preview."""
    name = c.get("candidate_name") or c.get("name") or "Candidate"
    score_raw = c.get("match_score", "85%")
    score_str = f"{score_raw}" if str(score_raw).endswith("%") else f"{score_raw}%"
    role = c.get("requisition_title") or c.get("role") or "Engineering Role"
    status = c.get("status") or "Shortlisted"
    skills = c.get("skills") or c.get("top_skills") or ""
    if isinstance(skills, list):
        skills = ", ".join(skills[:4])

    return (
        f"👤 *{name}*  (🎯 *{score_str} Match*)\n"
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
    amt_str = f"₹{amt:,}" if isinstance(amt, (int, float)) else str(amt)

    return (
        f"⏳ *Timesheet Pending Review*\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"👤 *Contractor:* {cand}\n"
        f"📅 *Period:* {week}\n"
        f"⏱ *Hours Logged:* {hrs} hrs\n"
        f"💵 *Amount:* {amt_str}\n"
    )


def format_stats_card(stats: Dict[str, Any], company_name: str = "TermJobs") -> str:
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


def format_accepted_candidates_list(cands: List[Dict[str, Any]]) -> str:
    """Format a clean, concise list of all candidates and their positions."""
    if not cands:
        return "ℹ️ No candidates currently working under your requisitions."
    
    lines = [
        f"👥 *Candidates Working Under You ({len(cands)} Active):*",
        "━━━━━━━━━━━━━━━━━━━━"
    ]
    for idx, c in enumerate(cands, 1):
        name = c.get("candidate_name") or c.get("name") or "Candidate"
        role = c.get("role") or c.get("requisition_title") or "Contractor"
        lines.append(f"{idx}. *{name}* — `{role}`")
        
    lines.append("")
    lines.append("💬 _Tap any candidate below or type their name to view their full workforce profile, work order & timesheets._")
    return "\n".join(lines)


def format_accepted_candidate_card(c: Dict[str, Any]) -> str:
    """Format an accepted/hired candidate with login credentials and active work order."""
    name = c.get("candidate_name") or c.get("name") or "Candidate"
    role = c.get("requisition_title") or c.get("role") or "Engineering Role"
    email = c.get("email") or c.get("candidate_email") or "—"
    wo_id = c.get("work_order_id") or c.get("workorder_id") or "WO-ACTIVE"
    start_date = c.get("start_date") or "Active"
    rate = c.get("rate") or c.get("bill_rate") or "Standard Rate"
    total_hours = c.get("total_hours", 0)
    hours_info = f"{total_hours} hrs logged" if total_hours > 0 else "Active on project"
    work_arr = c.get("work_arrangement") or "Remote"

    return (
        f"👤 *{name}*\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"💼 *Role:* {role}\n"
        f"🟢 *Status:* Started Working (Active)\n"
        f"🔑 *Portal Login:* Active (Credentials Issued)\n"
        f"📧 *Email:* `{email}`\n"
        f"📋 *Work Order:* `{wo_id}`\n"
        f"📅 *Start Date:* {start_date}\n"
        f"⏱ *Timesheets:* {hours_info}\n"
        f"🏢 *Engagement:* {work_arr} | {rate}\n"
    )


def format_candidate_profile_card(p: Dict[str, Any]) -> str:
    """Format full workforce profile card for Telegram."""
    name = p.get("candidate_name") or p.get("name") or "Candidate"
    role = p.get("requisition_title") or "Contractor"
    email = p.get("email") or "—"
    status = p.get("status") or "Active"
    score = p.get("match_score") or "88%"
    vendor = p.get("vendor_name") or "Direct"
    
    wo = p.get("work_order", {})
    wo_id = wo.get("id") or "Active"
    start_date = wo.get("start_date") or "Active"
    client = wo.get("client") or "Company"
    rate = wo.get("bill_rate") or "Standard Rate"
    
    ts = p.get("timesheets", {})
    ts_hrs = ts.get("hours_logged", 0)
    ts_status = ts.get("status") or "Active"
    
    setup = p.get("onboarding_setup", [])
    setup_lines = []
    for s in setup[:5]:
        label = s.get("label", "")
        st = s.get("status", "Active")
        icon = "✅" if st in ("Active", "Granted", "Completed") else "⏳"
        setup_lines.append(f"{icon} *{label}:* `{st}`")
    setup_str = "\n".join(setup_lines) if setup_lines else "✅ All software access provisioned"

    notes = p.get("notes") or ""
    notes_snippet = f"\n📝 *Notes:* _{notes[:120]}_\n" if notes else ""

    return (
        f"👤 *WORKFORCE PROFILE: {name.upper()}*\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"💼 *Role:* {role}\n"
        f"📊 *Status:* `{status}`\n"
        f"📧 *Login / Email:* `{email}`\n"
        f"🎯 *Match Score:* {score} | *Source:* {vendor}\n\n"
        f"📋 *Contract & Work Order:*\n"
        f"• *WO Number:* `{wo_id}`\n"
        f"• *Start Date:* {start_date}\n"
        f"• *Rate:* {rate}\n"
        f"• *Client Entity:* {client}\n\n"
        f"⏱ *Timesheets & Hours:*\n"
        f"• *Logged:* {ts_hrs} hrs (`{ts_status}`)\n\n"
        f"🔑 *System Access & Credentials:*\n"
        f"{setup_str}\n"
        f"{notes_snippet}"
    )


def format_interview_proposal_card(sched: Dict[str, Any]) -> str:
    """Format interview proposal."""
    cand = sched.get("candidate") or "Candidate"
    role = sched.get("requisition_title") or "Engineering Role"
    dt = sched.get("proposed_date") or "Upcoming Date"
    tm = sched.get("proposed_time") or "Time TBD"
    typ = sched.get("interview_type") or "Technical Round"
    notes = sched.get("meeting_notes") or ""

    return (
        f"📅 *INTERVIEW PROPOSAL CREATED*\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"👤 *Candidate:* {cand}\n"
        f"💼 *Role:* {role}\n"
        f"🎯 *Round:* {typ}\n"
        f"📆 *Proposed Date:* {dt}\n"
        f"⏰ *Time Slot:* {tm}\n"
        f"📝 *Notes:* _{notes}_\n\n"
        f"✨ _Confirm below to notify the candidate and schedule calendar invites._"
    )


def format_expense_item(exp: Dict[str, Any]) -> str:
    """Format an expense item for review."""
    cand = exp.get("candidate_name") or "Contractor"
    amt = exp.get("amount") or "$0.00"
    cat = exp.get("category") or "Reimbursement Claim"
    dt = exp.get("submission_date") or "Recent"
    desc = exp.get("description") or "Travel & Work Equipment Claim"

    return (
        f"💸 *Pending Expense Claim*\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"👤 *Contractor:* {cand}\n"
        f"💵 *Amount Claimed:* {amt}\n"
        f"📂 *Category:* `{cat}`\n"
        f"📅 *Date Submitted:* {dt}\n"
        f"📝 *Description:* _{desc}_\n"
    )


def format_onboarding_issue_item(issue: Dict[str, Any]) -> str:
    """Format onboarding progress/issue card."""
    cand = issue.get("candidate_name") or issue.get("name") or "Candidate"
    role = issue.get("requisition_title") or "Contractor"
    status = issue.get("status") or "In Progress"
    title = issue.get("issue_title") or "Checklist Verification"
    action = issue.get("action_required") or "Complete setup"

    icon = "✅" if "completed" in status.lower() else "⏳"
    return (
        f"{icon} *{cand}* — `{role}`\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"📊 *Onboarding Status:* `{status}`\n"
        f"📌 *Milestone:* {title}\n"
        f"⚡️ *Action:* {action}\n"
    )


def format_requisitions_list(reqs: List[Dict[str, Any]], company_name: str = "TermJobs") -> str:
    """Format live and open job requisitions directory."""
    if not reqs:
        return f"📋 *No active job requisitions found for {company_name}.*\n\nType e.g. _\"I need a DevOps engineer\"_ to draft a new role!"

    lines = [
        f"📋 *Job Requisitions Directory ({company_name}):*",
        "━━━━━━━━━━━━━━━━━━━━"
    ]
    for idx, r in enumerate(reqs[:6], 1):
        title = r.get("title") or "Engineering Role"
        status = r.get("status") or "Open"
        dept = r.get("department") or "Engineering"
        st_icon = "🟢" if status.lower() in ("published", "open", "active") else "🟡"
        lines.append(f"{idx}. {st_icon} *{title}* ({dept}) — `{status}`")

    lines.append("")
    lines.append("💡 _Type e.g. 'I need a React engineer' to draft a requisition for Director approval._")
    return "\n".join(lines)


def format_pending_works_briefing(data: Dict[str, Any], company_name: str = "TermJobs") -> str:
    """Format comprehensive pending works executive briefing for Hiring Manager."""
    summary = data.get("summary", {})
    tss = data.get("pending_timesheets", [])
    exps = data.get("pending_expenses", [])
    shortlist = data.get("shortlisted_candidates", [])
    onboarding = data.get("onboarding_candidates", [])
    reqs = data.get("pending_requisitions", [])

    lines = [
        f"⚡️ *HIRING MANAGER ACTION CENTER*",
        f"🏢 *{company_name}* — _Pending Workflows & Approvals_",
        "━━━━━━━━━━━━━━━━━━━━"
    ]

    # 1. Timesheets section
    if tss:
        lines.append(f"\n⏳ *Timesheets Awaiting Your Approval ({len(tss)}):*")
        for idx, t in enumerate(tss[:3], 1):
            cand = t.get("candidate_name") or "Contractor"
            hrs = t.get("hours_logged") or t.get("total_hours") or 40
            amt = t.get("total_amount") or t.get("total_billed") or "Standard Rate"
            lines.append(f"  {idx}. *{cand}* — `{hrs} hrs` ({amt})")
    else:
        lines.append("\n⏳ *Timesheets:* ✅ All approved & up to date.")

    # 2. Expenses section
    if exps:
        lines.append(f"\n💳 *Expense Claims Awaiting Approval ({len(exps)}):*")
        for idx, e in enumerate(exps[:3], 1):
            cand = e.get("candidate_name") or "Contractor"
            amt = e.get("amount") or "$0.00"
            cat = e.get("category") or "Reimbursement"
            lines.append(f"  {idx}. *{cand}* — *{amt}* (`{cat}`)")
    else:
        lines.append("\n💳 *Expenses:* ✅ No pending reimbursement claims.")

    # 3. Shortlist section
    if shortlist:
        lines.append(f"\n👥 *Shortlisted Candidates for Review ({len(shortlist)}):*")
        for idx, s in enumerate(shortlist[:3], 1):
            c_name = s.get("candidate_name") or s.get("name") or "Candidate"
            role = s.get("requisition_title") or "Role"
            score = s.get("match_score") or "85%"
            lines.append(f"  {idx}. *{c_name}* — `{role}` (🎯 {score})")
    else:
        lines.append("\n👥 *Shortlisted Pool:* ℹ️ No candidates awaiting screening.")

    # 4. Onboarding section
    if onboarding:
        lines.append(f"\n🚀 *Candidates in Onboarding Verification ({len(onboarding)}):*")
        for idx, o in enumerate(onboarding[:3], 1):
            c_name = o.get("candidate_name") or o.get("name") or "Candidate"
            role = o.get("requisition_title") or "Contractor"
            st = o.get("status") or "In Progress"
            st_icon = "✅" if "completed" in st.lower() else "⏳"
            lines.append(f"  {idx}. {st_icon} *{c_name}* — `{role}` (`{st}`)")

    # 5. Requisitions section
    if reqs:
        lines.append(f"\n📋 *Draft Requisitions Pending Submission ({len(reqs)}):*")
        for idx, r in enumerate(reqs[:2], 1):
            r_title = r.get("title") or "Engineering Role"
            lines.append(f"  {idx}. 🟡 *{r_title}*")

    lines.append("\n━━━━━━━━━━━━━━━━━━━━")
    lines.append("💬 _Tap any button below to take action or approve immediately:_")
    return "\n".join(lines)


def format_offboarding_proposal_card(plan: Dict[str, Any]) -> str:
    """Format structured offboarding clearance proposal card for Telegram."""
    cand = plan.get("candidate_name") or "Candidate"
    role = plan.get("requisition_title") or "Contractor Role"
    company = plan.get("company_name") or "TermJobs"
    email = plan.get("candidate_email") or "—"
    wo_id = plan.get("work_order_id") or "WO-ACTIVE"
    laptop = plan.get("laptop_spec") or "Standard build"

    return (
        f"🚪 *CANDIDATE OFFBOARDING PROPOSAL*\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"👤 *Candidate:* {cand}\n"
        f"💼 *Role:* {role}\n"
        f"🏢 *Company:* {company}\n"
        f"📄 *Work Order:* `{wo_id}`\n"
        f"📬 *Candidate Email:* `{email}`\n\n"
        f"📦 *Asset Recovery Checklist:*\n"
        f"• 💻 *Laptop Return:* `{laptop}` (Courier / Drop-off return required)\n"
        f"• 🪪 *Security Badge:* Facility access badge return\n\n"
        f"🔐 *Access Revocation (48h Grace Window):*\n"
        f"• 🐙 *Code Repositories:* GitHub / GitLab access revocation\n"
        f"• ☁️ *Cloud Infra:* AWS / GCP / Azure production access removal\n"
        f"• 💬 *Workspace:* Slack, Jira & corporate Google Workspace deactivation\n\n"
        f"📋 *Handover & Clearances:*\n"
        f"• 🤝 Knowledge transfer session with engineering lead\n"
        f"• 🔏 Final NDA & intellectual property exit clearance\n"
        f"• ⏱️ Final timesheet submission & verification\n\n"
        f"⚠️ *Timesheet Policy:* Timesheet submissions will be frozen upon offboarding completion.\n\n"
        f"✨ _Confirm below to initiate offboarding, dispatch exit clearance to candidate, and notify IT/HR._"
    )


def format_offboarding_confirmed_card(res: Dict[str, Any]) -> str:
    """Format offboarding initiation confirmation card."""
    cand = res.get("candidate_name") or "Candidate"
    email = res.get("candidate_email") or "Candidate Email"
    role = res.get("requisition_title") or "Role"

    return (
        f"✅ *Candidate Offboarding Initiated!*\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"👤 *Candidate:* {cand}\n"
        f"💼 *Role:* {role}\n"
        f"📬 *Exit Clearance Notice Sent:* `{email}`\n"
        f"📋 *Status:* `in_progress`\n"
        f"⏱️ *Access Policy:* 48-hour grace window until full deactivation\n"
        f"🔒 *Timesheet Submissions:* Scheduled to freeze upon clearance completion\n\n"
        f"✨ _Official exit clearance checklist & handover link delivered via TermJobs Gmail SMTP._"
    )


def format_upcoming_meetings_list(meetings: List[Dict[str, Any]], company_name: str = "TermJobs") -> str:
    """Format upcoming interviews and meetings briefing for Telegram."""
    if not meetings:
        return (
            f"📅 *NO UPCOMING MEETINGS SCHEDULED*\n"
            f"🏢 *{company_name}*\n"
            f"━━━━━━━━━━━━━━━━━━━━\n"
            f"You have no interviews or meetings currently scheduled.\n\n"
            f"💡 _To schedule an interview, say:_ `Schedule interview with Arjun on Friday at 3pm`"
        )

    lines = [
        f"📅 *UPCOMING MEETINGS & SCHEDULED INTERVIEWS*",
        f"🏢 *{company_name}* — {len(meetings)} Scheduled Session(s)",
        "━━━━━━━━━━━━━━━━━━━━\n"
    ]

    for idx, m in enumerate(meetings, 1):
        c_name = m.get("candidate_name") or "Candidate"
        role = m.get("requisition_title") or "Engineering Role"
        round_name = m.get("round_name") or "Technical Round"
        dt = m.get("date") or "Upcoming Date"
        tm = m.get("time") or "Time TBD"
        link = m.get("meeting_link") or "https://termjobs.in/interview/room"
        code = m.get("passcode") or "TJ-INT-2026"
        status = m.get("status") or "Scheduled"

        lines.append(f"*{idx}. {c_name}* — `{role}`")
        lines.append(f"   🎯 *Round:* {round_name}")
        lines.append(f"   📆 *Date & Time:* {dt} at *{tm}*")
        lines.append(f"   🎥 *Room:* `{link}`")
        lines.append(f"   🔑 *Passcode:* `{code}` (`{status}`)\n")

    lines.append("━━━━━━━━━━━━━━━━━━━━")
    lines.append("💬 _Tap any button below to join the video room or schedule a new round:_")
    return "\n".join(lines)





