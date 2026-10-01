"""Update Handlers and Dispatcher for Hiring Manager Telegram AI Bot."""
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
    build_timesheet_approval_keyboard,
    build_quick_menu_keyboard,
    build_role_selection_keyboard
)
from .formatter import (
    sanitize_telegram_markdown,
    format_draft_preview,
    format_candidate_item,
    format_timesheet_item,
    format_stats_card
)

TELEGRAM_API_BASE = "https://api.telegram.org"


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

    # 1. Handle Built-in Commands
    if text.startswith("/start"):
        user_name = session["current_user"].get("name") or "Hiring Manager"
        welcome_msg = (
            f"👋 *Welcome, {user_name}!*\n\n"
            f"I am your *TermJobs Hiring Manager AI Assistant*.\n"
            f"You can talk to me naturally or tap any option below:\n\n"
            f"💡 *Examples of what you can say:*\n"
            f"• _\"hi, I need a devops engineer with 2 yrs experience\"_\n"
            f"• _\"Show shortlisted candidates for our engineering roles\"_\n"
            f"• _\"Any timesheets pending for my approval?\"_\n"
            f"• _\"Give me a quick hiring summary\"_\n\n"
            f"Ready whenever you are!"
        )
        await send_telegram_message(token, chat_id, welcome_msg, build_quick_menu_keyboard())
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
                await send_telegram_message(token, chat_id, "✅ All contractor timesheets are up to date! None pending review.")
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
        await send_telegram_message(
            token, chat_id,
            res.get("reply") or f"✅ *{title}* sent to Director for approval!",
            build_quick_menu_keyboard()
        )

    elif data.startswith("pub_direct:"):
        title = data.replace("pub_direct:", "").strip()
        last_draft = get_last_draft(chat_id) or {}
        await answer_callback_query(token, query_id, f"Publishing {title}...")
        await send_chat_action(token, chat_id, "typing")

        cmd = (
            f"CONFIRM_EXECUTE_REQUISITION: title=\"{last_draft.get('title') or title}\", "
            f"department=\"{last_draft.get('department', 'Engineering')}\", "
            f"location=\"{last_draft.get('location', 'Remote')}\", "
            f"employment_type=\"{last_draft.get('employment_type', 'Contract')}\", "
            f"experience_level=\"{last_draft.get('experience_level', 'Mid-Level')}\", "
            f"salary_range=\"{last_draft.get('salary_range', 'Competitive')}\", "
            f"skills=\"{last_draft.get('skills', 'Relevant Stack')}\", "
            f"job_description=\"{last_draft.get('job_description', '')}\""
        )
        res = run_hiring_manager_agent_chat(cmd, [], session["current_user"])
        await send_telegram_message(
            token, chat_id,
            res.get("reply") or f"🎉 *{title}* published live!",
            build_quick_menu_keyboard()
        )

    elif data == "cancel_draft":
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
            "requisitions": "Show all active live requisitions",
            "candidates": "Show shortlisted candidates",
            "timesheets": "Check pending timesheets requiring approval",
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
        cand_name = data.replace("view_prof:", "")
        await answer_callback_query(token, query_id)
        fake_msg = {"chat": {"id": chat_id}, "from": from_user, "text": f"Show full profile and skills for {cand_name}"}
        await handle_message(token, fake_msg)

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

    else:
        await answer_callback_query(token, query_id)
