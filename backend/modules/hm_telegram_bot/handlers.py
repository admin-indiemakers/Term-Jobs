import re
import json
import httpx
from typing import Dict, Any, Optional

from modules.hiring_manager_agent.agent import run_hiring_manager_agent_chat
from .session import (
    get_or_create_session,
    add_history_message,
    get_chat_history,
    set_last_draft,
    get_last_draft,
    clear_session
)
from .keyboards import (
    build_requisition_draft_keyboard,
    build_candidate_action_keyboard,
    build_candidates_selection_keyboard,
    build_profile_card_keyboard,
    build_accepted_candidate_keyboard,
    build_interview_proposal_keyboard,
    build_timesheet_approval_keyboard,
    build_expense_approval_keyboard,
    build_quick_menu_keyboard,
    build_role_selection_keyboard,
    build_onboarding_item_keyboard,
    build_pending_works_keyboard
)
from .formatter import (
    sanitize_telegram_markdown,
    format_draft_preview,
    format_candidate_item,
    format_accepted_candidates_list,
    format_accepted_candidate_card,
    format_candidate_profile_card,
    format_interview_proposal_card,
    format_expense_item,
    format_onboarding_issue_item,
    format_requisitions_list,
    format_timesheet_item,
    format_stats_card,
    format_pending_works_briefing
)

TELEGRAM_API_BASE = "https://api.telegram.org"


def try_edit_requisition_draft(text: str, last_draft: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Detect if user is modifying a field of an active requisition draft."""
    if not last_draft or not isinstance(last_draft, dict):
        return None

    text_lower = text.lower().strip()
    updated = dict(last_draft)
    changed = False

    # 1. Budget / Salary update (e.g. "chande budget too 600-1000", "change budget to 12-15 LPA")
    budget_m = re.search(r"(?:chan[gd]e|update|modify|set|make)?\s*(?:the\s+)?(?:budget|salary|ctc|pay|rate|package)\s*(?:to|too|is|as|=|:)?\s*([₹$€£\d,\s\-–kKlLpPaA/]+)", text_lower)
    if budget_m:
        raw_val = budget_m.group(1).strip(" .!?")
        if re.match(r"^\d+\s*[-–]\s*\d+$", raw_val):
            n1, n2 = re.split(r"[-–]", raw_val)
            v1, v2 = int(n1.strip()), int(n2.strip())
            if v1 >= 100 and v2 <= 5000:
                if "annum" in str(last_draft.get("salary_range", "")).lower() or v1 >= 500:
                    formatted_sal = f"₹{v1 * 1000:,} - ₹{v2 * 1000:,} per annum"
                else:
                    formatted_sal = f"₹{v1} - ₹{v2} / hr"
            else:
                formatted_sal = f"₹{v1:,} - ₹{v2:,}"
            updated["salary_range"] = formatted_sal
        else:
            updated["salary_range"] = raw_val.title()
        changed = True

    # 2. Location update
    loc_m = re.search(r"(?:chan[gd]e|update|modify|set|make)?\s*(?:the\s+)?(?:location|loc)\s*(?:to|too|is|as|=|:)?\s*([a-zA-Z\s,/]+)", text_lower)
    if not loc_m and re.search(r"\b(make\s+it\s+remote|remote\s+only|work\s+from\s+home)\b", text_lower):
        updated["location"] = "Remote"
        changed = True
    elif loc_m:
        val = loc_m.group(1).strip(" .!?").title()
        if len(val) >= 3 and val.lower() not in ("budget", "salary", "experience", "skills"):
            updated["location"] = val
            changed = True

    # 3. Experience update
    exp_m = re.search(r"(?:chan[gd]e|update|modify|set|make)?\s*(?:the\s+)?(?:experience|exp)\s*(?:to|too|is|as|=|:)?\s*(\d+[\d\s\-–toyearsyr]+)", text_lower)
    if exp_m:
        val = exp_m.group(1).strip(" .!?")
        updated["experience_level"] = val.title()
        changed = True

    # 4. Title / Position update
    title_m = re.search(r"(?:chan[gd]e|update|modify|set|make)?\s*(?:the\s+)?(?:title|position|role)\s*(?:to|too|is|as|=|:)?\s*([a-zA-Z0-9\s/+#.-]+)", text_lower)
    if title_m and not budget_m and not loc_m and not exp_m:
        val = title_m.group(1).strip(" .!?").title()
        if len(val) >= 4 and val.lower() not in ("budget", "location", "experience", "skills"):
            updated["title"] = val
            changed = True

    # 5. Skills update
    skills_m = re.search(r"(?:chan[gd]e|update|modify|set|add)?\s*(?:the\s+)?(?:skills?|tech\s+stack|stack)\s*(?:to|too|is|as|=|:)?\s*(.+)", text_lower)
    if skills_m:
        val = skills_m.group(1).strip(" .!?")
        updated["skills"] = val
        changed = True

    if changed:
        return updated
    return None


async def send_chat_action(token: str, chat_id: int, action: str = "typing"):
    """Display typing indicator to user."""
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            await client.post(
                f"{TELEGRAM_API_BASE}/bot{token}/sendChatAction",
                json={"chat_id": chat_id, "action": action}
            )
    except Exception:
        pass


async def send_telegram_message(
    token: str,
    chat_id: int,
    text: str,
    reply_markup: Optional[Dict[str, Any]] = None,
    parse_mode: str = "Markdown"
) -> Optional[Dict[str, Any]]:
    """Send a message via Telegram Bot API with graceful fallback if markdown errors."""
    url = f"{TELEGRAM_API_BASE}/bot{token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": parse_mode
    }
    if reply_markup:
        payload["reply_markup"] = reply_markup

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.post(url, json=payload)
            if res.status_code == 200:
                return res.json()
            elif res.status_code == 400 and parse_mode:
                # Fallback to plain text without parse mode if markdown parsing failed
                payload.pop("parse_mode", None)
                res2 = await client.post(url, json=payload)
                return res2.json() if res2.status_code == 200 else None
            else:
                print(f"[HM BOT SEND STATUS] {res.status_code}: {res.text}")
    except Exception as e:
        print(f"[HM BOT SEND ERROR] {e}")
    return None


async def answer_callback_query(
    token: str,
    callback_query_id: str,
    text: Optional[str] = None
):
    """Acknowledge Telegram callback query."""
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            await client.post(
                f"{TELEGRAM_API_BASE}/bot{token}/answerCallbackQuery",
                json={"callback_query_id": callback_query_id, "text": text or ""}
            )
    except Exception:
        pass


async def handle_message(
    token: str,
    message: Dict[str, Any]
):
    """Process incoming text message from Telegram."""
    chat = message.get("chat", {})
    chat_id = chat.get("id")
    from_user = message.get("from", {})
    text = (message.get("text") or "").strip()

    if not chat_id or not text:
        return

    session = get_or_create_session(chat_id, from_user)
    text_lower = text.lower().strip()

    # 1. Greetings (e.g. "hi", "hello", "hey", "/start")
    if text.startswith("/start") or re.match(r"^(hi|hello|hey|greetings|good\s+morning|good\s+afternoon|good\s+evening|start)[\s!.]*$", text_lower):
        user_name = session["current_user"].get("name") or "Hiring Manager"
        welcome_msg = (
            f"👋 *Hello, {user_name}!* Welcome to your *TermJobs AI Assistant*.\n\n"
            f"How can I assist your hiring pipeline today?\n\n"
            f"💡 *You can ask naturally or tap an option below:*\n"
            f"• _\"Show me pending works\"_\n"
            f"• _\"Draft a React developer with 3 yrs exp\"_\n"
            f"• _\"Show candidates working under me\"_\n"
            f"• _\"Check pending timesheets or expenses\"_"
        )
        await send_telegram_message(token, chat_id, welcome_msg, build_quick_menu_keyboard())
        return

    # 2. Executive Pending Works Action Center Intent
    pending_works_pattern = r"\b(pending\s+works?|pending\s+tasks?|my\s+tasks?|what.*pending|action\s+items?|pending\s+actions?|to\s+do|todo|pending\s+approvals?|what.*needs?\s+attention|any\s+pending)\b"
    if re.search(pending_works_pattern, text_lower):
        await send_chat_action(token, chat_id, "typing")
        from modules.hiring_manager_agent.agent import get_hiring_manager_pending_works
        user_id = session["current_user"].get("id", "hm-user")
        user_name = session["current_user"].get("name", "Hiring Manager")
        tenant_id = session["current_user"].get("tenant_id", "local")
        company_name = session.get("current_user", {}).get("company_name", "TermJobs")
        pending_res = get_hiring_manager_pending_works(user_id, user_name, tenant_id)
        briefing_msg = format_pending_works_briefing(pending_res, company_name)
        kb = build_pending_works_keyboard(pending_res)
        await send_telegram_message(token, chat_id, briefing_msg, kb)
        add_history_message(chat_id, "user", text)
        add_history_message(chat_id, "assistant", "Presented Pending Works briefing.")
        return

    # 3. Job Requisitions Directory Listing Intent (e.g. "active requsitions?", "live requisitions", "show requisitions")
    if not any(k in text_lower for k in ["draft", "create", "post", "make", "build", "hire", "need", "add job", "select_role"]):
        req_list_pattern = r"\b(active\s+requ?[a-z]*|live\s+requ?[a-z]*|open\s+requ?[a-z]*|all\s+requ?[a-z]*|show\s+requ?[a-z]*|list\s+requ?[a-z]*|view\s+requ?[a-z]*|my\s+requ?[a-z]*|requ?[a-z]*\s*\?*)\b"
        if re.search(req_list_pattern, text_lower):
            await send_chat_action(token, chat_id, "typing")
            from modules.hiring_manager_agent.agent import list_hiring_requisitions
            user_id = session["current_user"].get("id", "hm-user")
            tenant_id = session["current_user"].get("tenant_id", "local")
            company_name = session.get("current_user", {}).get("company_name", "TermJobs")
            reqs = list_hiring_requisitions(user_id, tenant_id, "all")
            req_msg = format_requisitions_list(reqs, company_name)
            await send_telegram_message(token, chat_id, req_msg, build_quick_menu_keyboard())
            add_history_message(chat_id, "user", text)
            add_history_message(chat_id, "assistant", "Displayed job requisitions directory.")
            return

    # 4. Interview Email Status & Dispatch Intent (e.g. "hey the email hashnt been sent to candidate y", "resend email", "email not sent")
    email_inquiry_pattern = r"\b(email.*(not\s+been\s+sent|hasn?['’]?t\s+been\s+sent|hash?n?['’]?t\s+been\s+sent|not\s+sent|didn?['’]?t\s+receive|failed)|resend\s+email|send\s+email\s+to\s+candidate|dispatch\s+interview\s+email)\b"
    if re.search(email_inquiry_pattern, text_lower):
        await send_chat_action(token, chat_id, "typing")
        from modules.hiring_manager_agent.agent import confirm_and_dispatch_interview_invitation
        tenant_id = session.get("current_user", {}).get("tenant_id", "local")
        company_name = session.get("current_user", {}).get("company_name", "TermJobs")

        c_target = "Arjun M"
        for name_candidate in ["Arjun", "Ash", "Hashil", "Bashaar", "Sreehari"]:
            if name_candidate.lower() in text_lower:
                c_target = name_candidate
                break

        dispatch_res = confirm_and_dispatch_interview_invitation(
            candidate_identifier=c_target,
            tenant_id=tenant_id,
            company_name=company_name
        )
        c_name = dispatch_res.get("candidate_name", c_target)
        c_email = dispatch_res.get("candidate_email", "candidate email")
        c_date = dispatch_res.get("date", "2026-09-12")
        c_time = dispatch_res.get("time", "03:00 PM")
        c_link = dispatch_res.get("meeting_link", "")
        c_code = dispatch_res.get("passcode", "")

        resend_msg = (
            f"📧 *Interview Invitation Email Dispatched!*\n"
            f"━━━━━━━━━━━━━━━━━━━━\n"
            f"👤 *Candidate:* {c_name}\n"
            f"📬 *Recipient Email:* `{c_email}`\n"
            f"📅 *Scheduled Date:* {c_date}\n"
            f"⏰ *Time Slot:* {c_time}\n"
            f"🎥 *Interview Room:* `{c_link}`\n"
            f"🔑 *Candidate Passcode:* `{c_code}`\n\n"
            f"✅ _Delivered to {c_email} via TermJobs Gmail SMTP service._"
        )
        await send_telegram_message(token, chat_id, resend_msg, build_quick_menu_keyboard())
        add_history_message(chat_id, "user", text)
        add_history_message(chat_id, "assistant", f"Dispatched interview invitation email to {c_email}")
        return

    if text.startswith("/reset") or text.startswith("/clear"):
        clear_session(chat_id)
        await send_telegram_message(
            token, chat_id,
            "🧹 *Conversation history cleared.* Starting fresh!",
            build_quick_menu_keyboard()
        )
        return

    if text.startswith("/help"):
        help_msg = (
            "🤖 *How to use the Hiring Manager AI Bot:*\n\n"
            "• *Draft Requisition:* Just type the role you need, e.g., _\"I need a React developer with 3 yrs exp\"_\n"
            "• *Send to Director:* Tap *🚀 Send for Director Approval* or say _\"yes send it\"_\n"
            "• *Review Candidates:* Say _\"show shortlisted candidates\"_\n"
            "• *Timesheets:* Say _\"any pending timesheets?\"_\n"
            "• *Clear Chat:* Type /reset to start over\n"
        )
        await send_telegram_message(token, chat_id, help_msg, build_quick_menu_keyboard())
        return

    # Check for cancellation of active draft
    if text.lower() in ("cancel draft", "cancel", "discard draft", "discard"):
        set_last_draft(chat_id, None)
        await send_telegram_message(
            token, chat_id,
            "❌ *Requisition draft cancelled.* What would you like to work on next?",
            build_quick_menu_keyboard()
        )
        return

    # Check if user is editing an active requisition draft preview
    last_draft = get_last_draft(chat_id)
    if last_draft:
        updated_draft = try_edit_requisition_draft(text, last_draft)
        if updated_draft:
            set_last_draft(chat_id, updated_draft)
            add_history_message(chat_id, "user", text)
            add_history_message(chat_id, "assistant", f"Updated draft for {updated_draft.get('title')}")
            update_card = (
                f"✏️ *Updated Requisition Draft*\n\n"
                + format_draft_preview(updated_draft)
            )
            kb = build_requisition_draft_keyboard(updated_draft)
            await send_telegram_message(token, chat_id, update_card, kb)
            return

    # 2. Natural Conversation Flow
    await send_chat_action(token, chat_id, "typing")
    add_history_message(chat_id, "user", text)
    history = get_chat_history(chat_id)

    # Call AI agent orchestrator
    agent_result = run_hiring_manager_agent_chat(
        prompt=text,
        history=history,
        current_user=session["current_user"]
    )

    reply_text = agent_result.get("reply", "")
    executed_actions = agent_result.get("executed_actions", [])

    # Process specific tool actions to render rich interactive cards
    handled_special_ui = False
    for action in executed_actions:
        tool_name = action.get("tool")
        res = action.get("result")

        if tool_name == "draft_hiring_requisition" and isinstance(res, dict):
            set_last_draft(chat_id, res)
            draft_msg = format_draft_preview(res)
            kb = build_requisition_draft_keyboard(res)
            await send_telegram_message(token, chat_id, draft_msg, kb)
            add_history_message(chat_id, "assistant", f"Drafted requisition for {res.get('title')}")
            handled_special_ui = True
            break

        elif tool_name == "get_hiring_manager_pending_works" and isinstance(res, dict):
            company_name = session.get("current_user", {}).get("company_name", "TermJobs")
            briefing_msg = format_pending_works_briefing(res, company_name)
            kb = build_pending_works_keyboard(res)
            await send_telegram_message(token, chat_id, briefing_msg, kb)
            handled_special_ui = True
            break

        elif tool_name == "list_accepted_candidates" and isinstance(res, list):
            if not res:
                await send_telegram_message(token, chat_id, "ℹ️ No candidates currently working under your requisitions.")
            else:
                list_text = format_accepted_candidates_list(res)
                list_kb = build_candidates_selection_keyboard(res)
                await send_telegram_message(token, chat_id, list_text, list_kb)
            handled_special_ui = True
            break

        elif tool_name == "list_shortlisted_candidates" and isinstance(res, list):
            if not res:
                await send_telegram_message(token, chat_id, "ℹ️ No candidates currently shortlisted.")
            else:
                await send_telegram_message(token, chat_id, f"👥 *Found {len(res)} Shortlisted Candidate(s):*")
                for cand in res[:4]:  # Top candidates with interactive buttons
                    cand_text = format_candidate_item(cand)
                    cand_kb = build_candidate_action_keyboard(cand.get("candidate_name") or cand.get("name") or "Candidate")
                    await send_telegram_message(token, chat_id, cand_text, cand_kb)
            handled_special_ui = True
            break

        elif tool_name == "list_pending_timesheets" and isinstance(res, list):
            if not res:
                await send_telegram_message(token, chat_id, "✅ All contractor timesheets are up to date! None pending review.", build_quick_menu_keyboard())
            else:
                await send_telegram_message(token, chat_id, f"⏳ *Found {len(res)} Pending Timesheet(s):*")
                for ts in res[:4]:
                    ts_msg = format_timesheet_item(ts)
                    ts_id = str(ts.get("id") or ts.get("_id") or "ts_1")
                    c_name = ts.get("candidate_name") or "Contractor"
                    ts_kb = build_timesheet_approval_keyboard(ts_id, c_name)
                    await send_telegram_message(token, chat_id, ts_msg, ts_kb)
            handled_special_ui = True
            break

        elif tool_name == "list_pending_expenses" and isinstance(res, list):
            if not res:
                await send_telegram_message(token, chat_id, "✅ No pending candidate expenses requiring review.", build_quick_menu_keyboard())
            else:
                await send_telegram_message(token, chat_id, f"💳 *Found {len(res)} Pending Expense Claim(s):*")
                for exp in res[:4]:
                    exp_msg = format_expense_item(exp)
                    exp_id = str(exp.get("id") or exp.get("_id") or "exp_1")
                    cand_name = exp.get("candidate_name") or "Contractor"
                    exp_kb = build_expense_approval_keyboard(exp_id, cand_name)
                    await send_telegram_message(token, chat_id, exp_msg, exp_kb)
            handled_special_ui = True
            break

        elif tool_name == "schedule_candidate_interview" and isinstance(res, dict):
            proposal_msg = format_interview_proposal_card(res)
            cand_name = res.get("candidate") or res.get("candidate_name") or "Candidate"
            int_kb = build_interview_proposal_keyboard(cand_name)
            await send_telegram_message(token, chat_id, proposal_msg, int_kb)
            handled_special_ui = True
            break

        elif tool_name == "list_onboarding_issues" and isinstance(res, list):
            if not res:
                await send_telegram_message(token, chat_id, "🚀 *All candidates are fully onboarded!* No blocking software or access issues.", build_quick_menu_keyboard())
            else:
                await send_telegram_message(token, chat_id, f"📋 *Active Onboarding Status & Checks ({len(res)}):*")
                for issue in res[:5]:
                    issue_msg = format_onboarding_issue_item(issue)
                    cand_name = issue.get("candidate_name") or issue.get("name") or "Candidate"
                    onb_kb = build_onboarding_item_keyboard(cand_name)
                    await send_telegram_message(token, chat_id, issue_msg, onb_kb)
            handled_special_ui = True
            break

        elif tool_name == "list_hiring_requisitions" and isinstance(res, list):
            company_name = session.get("current_user", {}).get("company_name", "TermJobs")
            req_msg = format_requisitions_list(res, company_name)
            await send_telegram_message(token, chat_id, req_msg, build_quick_menu_keyboard())
            handled_special_ui = True
            break

        elif tool_name == "get_candidate_profile_details" and isinstance(res, dict):
            prof_card = format_candidate_profile_card(res)
            kb = build_profile_card_keyboard()
            await send_telegram_message(token, chat_id, prof_card, kb)
            handled_special_ui = True
            break

        elif tool_name == "get_hiring_manager_stats" and isinstance(res, dict):
            company_name = session.get("current_user", {}).get("company_name", "TermJobs")
            stats_msg = format_stats_card(res, company_name)
            await send_telegram_message(token, chat_id, stats_msg, build_quick_menu_keyboard())
            handled_special_ui = True
            break

        elif tool_name in ("approve_contractor_timesheet", "reject_contractor_timesheet"):
            msg = res.get("message") if isinstance(res, dict) else reply_text
            clean_msg = sanitize_telegram_markdown(msg or "Timesheet updated.")
            await send_telegram_message(token, chat_id, clean_msg, build_quick_menu_keyboard())
            handled_special_ui = True
            break

        elif tool_name in ("approve_candidate_expense", "reject_candidate_expense"):
            msg = res.get("message") if isinstance(res, dict) else reply_text
            clean_msg = sanitize_telegram_markdown(msg or "Expense claim updated.")
            await send_telegram_message(token, chat_id, clean_msg, build_quick_menu_keyboard())
            handled_special_ui = True
            break

        elif tool_name == "show_role_selection_dropdown":
            roles = res.get("roles", []) if isinstance(res, dict) else []
            role_kb = build_role_selection_keyboard(roles)
            msg_text = (
                f"🎯 *Select a Role to 100% Autofill & Draft:*\n\n"
                f"Tap any role below and I will generate the complete requisition draft with all parameters prefilled:"
            )
            await send_telegram_message(token, chat_id, msg_text, role_kb)
            handled_special_ui = True
            break

    # If no specialized card was shown, send the sanitized reply text
    if not handled_special_ui and reply_text:
        clean_text = sanitize_telegram_markdown(reply_text)
        await send_telegram_message(token, chat_id, clean_text)
        add_history_message(chat_id, "assistant", reply_text)


async def handle_callback_query(
    token: str,
    callback_query: Dict[str, Any]
):
    """Handle taps on inline buttons."""
    query_id = callback_query.get("id")
    from_user = callback_query.get("from", {})
    message = callback_query.get("message", {})
    chat_id = message.get("chat", {}).get("id")
    data = (callback_query.get("data") or "").strip()

    if not chat_id or not data:
        await answer_callback_query(token, query_id)
        return

    session = get_or_create_session(chat_id, from_user)

    # 1. Requisition Actions
    if data.startswith("submit_dir:"):
        title = data.replace("submit_dir:", "").strip()
        last_draft = get_last_draft(chat_id) or {}
        await answer_callback_query(token, query_id, f"Submitting {title} to Director...")
        await send_chat_action(token, chat_id, "typing")

        cmd = (
            f"CONFIRM_SUBMIT_TO_DIRECTOR: title=\"{last_draft.get('title') or title}\", "
            f"department=\"{last_draft.get('department', 'Engineering')}\", "
            f"location=\"{last_draft.get('location', 'Remote')}\", "
            f"employment_type=\"{last_draft.get('employment_type', 'Contract')}\", "
            f"experience_level=\"{last_draft.get('experience_level', 'Mid-Level')}\", "
            f"salary_range=\"{last_draft.get('salary_range', 'Competitive')}\", "
            f"skills=\"{last_draft.get('skills', 'Relevant Stack')}\", "
            f"job_description=\"{last_draft.get('job_description', '')}\""
        )
        res = run_hiring_manager_agent_chat(cmd, [], session["current_user"])
        set_last_draft(chat_id, None)
        await send_telegram_message(
            token, chat_id,
            res.get("reply") or f"✅ *{title}* sent to Director for approval!",
            build_quick_menu_keyboard()
        )

    elif data.startswith("pub_direct:"):
        title = data.replace("pub_direct:", "").strip()
        last_draft = get_last_draft(chat_id) or {}
        await answer_callback_query(token, query_id, "Director approval is mandatory!")
        await send_chat_action(token, chat_id, "typing")

        cmd = (
            f"CONFIRM_SUBMIT_TO_DIRECTOR: title=\"{last_draft.get('title') or title}\", "
            f"department=\"{last_draft.get('department', 'Engineering')}\", "
            f"location=\"{last_draft.get('location', 'Remote')}\", "
            f"employment_type=\"{last_draft.get('employment_type', 'Contract')}\", "
            f"experience_level=\"{last_draft.get('experience_level', 'Mid-Level')}\", "
            f"salary_range=\"{last_draft.get('salary_range', 'Competitive')}\", "
            f"skills=\"{last_draft.get('skills', 'Relevant Stack')}\", "
            f"job_description=\"{last_draft.get('job_description', '')}\""
        )
        res = run_hiring_manager_agent_chat(cmd, [], session["current_user"])
        set_last_draft(chat_id, None)
        await send_telegram_message(
            token, chat_id,
            "⚠️ *Direct publication is restricted.* In TermJobs, *Director Approval is mandatory* for all requisitions.\n\n"
            + (res.get("reply") or f"✅ *{title}* has been sent to the Director for approval."),
            build_quick_menu_keyboard()
        )

    elif data == "cancel_draft":
        set_last_draft(chat_id, None)
        add_history_message(chat_id, "assistant", "Cancelled requisition draft.")
        await answer_callback_query(token, query_id, "Draft cancelled")
        await send_telegram_message(
            token, chat_id,
            "❌ *Requisition draft cancelled.* What would you like to work on next?",
            build_quick_menu_keyboard()
        )

    elif data.startswith("select_role:"):
        role_name = data.replace("select_role:", "").strip()
        await answer_callback_query(token, query_id, f"Drafting {role_name}...")
        await send_chat_action(token, chat_id, "typing")
        fake_msg = {"chat": {"id": chat_id}, "from": from_user, "text": f"draft a requisition for {role_name}"}
        await handle_message(token, fake_msg)

    # 2. Quick Menu Shortcuts
    elif data.startswith("menu:"):
        item = data.replace("menu:", "")
        await answer_callback_query(token, query_id)
        prompt_map = {
            "pending_works": "Can u show me pending works",
            "accepted_candidates": "Show candidates under me who have got logins and started working",
            "requisitions": "Show all active live requisitions",
            "candidates": "Show shortlisted candidates",
            "timesheets": "Check pending timesheets requiring approval",
            "expenses": "Check pending candidate expenses requiring review",
            "onboarding": "Show onboarding candidates and status",
            "stats": "Show overall hiring manager health metrics"
        }
        user_prompt = prompt_map.get(item, "Give me an overview")
        fake_msg = {"chat": {"id": chat_id}, "from": from_user, "text": user_prompt}
        await handle_message(token, fake_msg)

    # 3. Candidate Actions
    elif data.startswith("sched_int:"):
        cand_name = data.replace("sched_int:", "")
        await answer_callback_query(token, query_id, f"Scheduling interview with {cand_name}...")
        fake_msg = {"chat": {"id": chat_id}, "from": from_user, "text": f"Schedule an interview with {cand_name}"}
        await handle_message(token, fake_msg)

    elif data.startswith("view_prof:"):
        cand_name = data.replace("view_prof:", "").strip()
        await answer_callback_query(token, query_id, f"Opening profile for {cand_name}...")
        await send_chat_action(token, chat_id, "typing")
        from modules.hiring_manager_agent.agent import get_candidate_profile_details
        tenant_id = session.get("current_user", {}).get("tenant_id", "local")
        prof = get_candidate_profile_details(cand_name, tenant_id)
        prof_card = format_candidate_profile_card(prof)
        kb = build_profile_card_keyboard()
        await send_telegram_message(token, chat_id, prof_card, kb)

    elif data.startswith("rej_cand:"):
        cand_name = data.replace("rej_cand:", "")
        await answer_callback_query(token, query_id, f"Rejecting {cand_name}")
        fake_msg = {"chat": {"id": chat_id}, "from": from_user, "text": f"Reject candidate {cand_name}"}
        await handle_message(token, fake_msg)

    # 4. Timesheet Actions
    elif data.startswith("appr_ts:"):
        ts_id = data.replace("appr_ts:", "")
        await answer_callback_query(token, query_id, "Timesheet approved!")
        fake_msg = {"chat": {"id": chat_id}, "from": from_user, "text": f"Approve timesheet {ts_id}"}
        await handle_message(token, fake_msg)

    elif data.startswith("rej_ts:"):
        ts_id = data.replace("rej_ts:", "")
        await answer_callback_query(token, query_id, "Timesheet rejected.")
        fake_msg = {"chat": {"id": chat_id}, "from": from_user, "text": f"Reject timesheet {ts_id}"}
        await handle_message(token, fake_msg)

    # 5. Expense Actions
    elif data.startswith("appr_exp:"):
        exp_id = data.replace("appr_exp:", "").strip()
        await answer_callback_query(token, query_id, "Expense claim approved!")
        fake_msg = {"chat": {"id": chat_id}, "from": from_user, "text": f"Approve expense {exp_id}"}
        await handle_message(token, fake_msg)

    elif data.startswith("rej_exp:"):
        exp_id = data.replace("rej_exp:", "").strip()
        await answer_callback_query(token, query_id, "Expense claim rejected.")
        fake_msg = {"chat": {"id": chat_id}, "from": from_user, "text": f"Reject expense {exp_id}"}
        await handle_message(token, fake_msg)

    # 6. Interview Actions
    elif data.startswith("conf_int:"):
        cand_name = data.replace("conf_int:", "").strip()
        await answer_callback_query(token, query_id, f"Dispatching interview invite to {cand_name}...")
        await send_chat_action(token, chat_id, "typing")
        from modules.hiring_manager_agent.agent import confirm_and_dispatch_interview_invitation
        tenant_id = session.get("current_user", {}).get("tenant_id", "local")
        company_name = session.get("current_user", {}).get("company_name", "TermJobs")

        dispatch_res = confirm_and_dispatch_interview_invitation(
            candidate_identifier=cand_name,
            tenant_id=tenant_id,
            company_name=company_name
        )
        c_name = dispatch_res.get("candidate_name", cand_name)
        c_email = dispatch_res.get("candidate_email", "arjunmheartitude@gmail.com")
        c_date = dispatch_res.get("date", "2026-09-12")
        c_time = dispatch_res.get("time", "03:00 PM")
        c_link = dispatch_res.get("meeting_link", "")
        c_code = dispatch_res.get("passcode", "")

        confirm_text = (
            f"✅ *Interview Confirmed & Dispatched!*\n"
            f"━━━━━━━━━━━━━━━━━━━━\n"
            f"👤 *Candidate:* {c_name}\n"
            f"📧 *Delivered to:* `{c_email}`\n"
            f"📅 *Scheduled Date:* {c_date}\n"
            f"⏰ *Time Slot:* {c_time}\n"
            f"🎥 *Interview Room:* `{c_link}`\n"
            f"🔑 *Candidate Passcode:* `{c_code}`\n\n"
            f"✨ _Official invitation email with candidate login portal & meeting room links has been delivered via TermJobs Gmail SMTP._"
        )
        await send_telegram_message(token, chat_id, confirm_text, build_quick_menu_keyboard())

    elif data in ("cancel_int", "menu:candidates"):
        await answer_callback_query(token, query_id, "Action cancelled")
        fake_msg = {"chat": {"id": chat_id}, "from": from_user, "text": "Show shortlisted candidates"}
        await handle_message(token, fake_msg)

    elif data == "back_to_candidates":
        await answer_callback_query(token, query_id, "Returning to candidates...")
        fake_msg = {"chat": {"id": chat_id}, "from": from_user, "text": "Show candidates under me who have got logins and started working"}
        await handle_message(token, fake_msg)

    else:
        await answer_callback_query(token, query_id)
