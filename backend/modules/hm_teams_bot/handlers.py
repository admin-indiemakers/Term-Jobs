"""Activity and Intent Handlers for Microsoft Teams Bot.

Processes:
- ConversationUpdate (Welcome on chat open)
- Message activities with natural language or card submissions
- Adaptive Card Action.Submit data
- Agent LLM routing for role drafting and intelligent workflows
"""
import re
import time
import datetime
from typing import Dict, Any, List, Optional

from modules.shared.db import db
from modules.hiring_manager_agent.agent import (
    run_hiring_manager_agent_chat,
    get_hiring_manager_pending_works,
    list_scheduled_interviews,
    list_shortlisted_candidates,
    list_hiring_requisitions,
    list_pending_timesheets,
    list_pending_expenses
)
from .session import (
    get_or_create_teams_session,
    add_teams_history_message,
    get_teams_chat_history,
    invalidate_teams_session
)
from .cards import (
    build_welcome_card,
    build_account_linked_card,
    build_profile_card,
    build_pending_works_card,
    build_requisition_draft_card,
    build_upcoming_meetings_card,
    build_candidate_action_card,
    build_timesheet_review_card,
    build_teams_adaptive_card_attachment
)


async def handle_teams_activity(
    activity: Dict[str, Any],
    tenant_id: Optional[str] = None
) -> Dict[str, Any]:
    """Universal handler for Bot Framework Activities from Microsoft Teams."""
    act_type = activity.get("type", "message")
    from_user = activity.get("from", {})
    user_id = str(from_user.get("id") or from_user.get("aadObjectId") or "teams_user")
    user_name = str(from_user.get("name") or "Hiring Manager")
    aad_id = from_user.get("aadObjectId")

    # 1. Handle ConversationUpdate (user added bot or opened 1-on-1 chat)
    if act_type == "conversationUpdate":
        members_added = activity.get("membersAdded", [])
        recipient = activity.get("recipient", {})
        bot_id = recipient.get("id")

        # If bot or a new user was added, send welcome card
        for member in members_added:
            if member.get("id") != bot_id:
                session = get_or_create_teams_session(from_user, tenant_id=tenant_id, aad_object_id=aad_id)
                comp = session.get("current_user", {}).get("company_name", "TermJobs")
                return {
                    "type": "message",
                    "attachments": [build_welcome_card(user_name, comp)]
                }

    # 2. Handle Message Activity
    if act_type == "message":
        # Check if this message was triggered by an Adaptive Card Action.Submit
        value_data = activity.get("value")
        if isinstance(value_data, dict) and value_data:
            return await handle_teams_card_submit(value_data, from_user, tenant_id, aad_id)

        text = (activity.get("text") or "").strip()
        # Clean any Teams mention tags (e.g. <at>BotName</at>)
        text_clean = re.sub(r"<at[^>]*>.*?</at>", "", text).strip()
        text_lower = text_clean.lower()

        # Check for 1-Click Dashboard Pairing Link: /start link_<token> or link_<token>
        if "link_" in text_clean:
            m = re.search(r"link_([a-zA-Z0-9_\-]+)", text_clean)
            if m:
                pair_token = m.group(1).strip()
                now = time.time()
                u_filter = {
                    "bot_pairing_token": pair_token,
                    "bot_pairing_token_expires_at": {"$gt": now}
                }
                if tenant_id and tenant_id != "local":
                    u_filter["tenant_id"] = tenant_id

                target_user = None
                try:
                    target_user = db["users"].find_one(u_filter)
                except Exception as e:
                    print(f"[MS TEAMS PAIRING LOOKUP ERROR] {e}")

                if target_user:
                    db["users"].update_one(
                        {"_id": target_user["_id"]},
                        {"$set": {
                            "ms_teams_user_id": user_id,
                            "ms_teams_aad_id": aad_id or "",
                            "ms_teams_linked_at": datetime.datetime.utcnow().isoformat(),
                            "bot_pairing_token": None,
                            "bot_pairing_token_expires_at": None
                        }}
                    )
                    invalidate_teams_session(user_id, tenant_id)
                    session = get_or_create_teams_session(from_user, tenant_id=tenant_id, aad_object_id=aad_id)
                    u_display = target_user.get("name") or user_name
                    comp = session.get("current_user", {}).get("company_name", "TermJobs")
                    return {
                        "type": "message",
                        "attachments": [build_account_linked_card(u_display, comp)]
                    }
                else:
                    return {
                        "type": "message",
                        "text": "⚠️ **Expired or Invalid Pairing Link**\n\nThis connection code has expired or has already been used. Please return to your TermJobs Dashboard and generate a fresh link."
                    }

        session = get_or_create_teams_session(from_user, tenant_id=tenant_id, aad_object_id=aad_id)
        current_user = session["current_user"]
        comp = current_user.get("company_name", "TermJobs")

        # 2.1 Greeting / Help
        if not text_clean or text_lower in ("hi", "hello", "hey", "help", "start", "/start", "menu"):
            return {
                "type": "message",
                "attachments": [build_welcome_card(current_user.get("name") or user_name, comp)]
            }

        # 2.2 Profile & Identity Inquiry
        if re.search(r"\b(who\s+am\s+i|what\s+is\s+my\s+name|my\s+profile|my\s+account|who\s+are\s+you\s+talking\s+to)\b", text_lower):
            return {
                "type": "message",
                "attachments": [build_profile_card(
                    user_name=current_user.get("name", user_name),
                    company_name=comp,
                    email=current_user.get("email", ""),
                    role=current_user.get("role", "Hiring Manager")
                )]
            }

        # 2.3 Executive Pending Works Action Center
        if re.search(r"\b(pending\s+works?|pending\s+tasks?|my\s+tasks?|action\s+items?|pending\s+approvals?|todo)\b", text_lower):
            pending_res = get_hiring_manager_pending_works(
                user_id=current_user.get("id", user_id),
                user_name=current_user.get("name", user_name),
                tenant_id=current_user.get("tenant_id", "local")
            )
            return {
                "type": "message",
                "attachments": [build_pending_works_card(pending_res, comp)]
            }

        # 2.4 Upcoming Meetings & Scheduled Interviews
        if re.search(r"\b(upcoming\s+meetings?|upcoming\s+interviews?|my\s+meetings?|interview\s+schedule|calendar)\b", text_lower):
            meetings = list_scheduled_interviews(
                user_id=current_user.get("id", user_id),
                user_name=current_user.get("name", user_name),
                tenant_id=current_user.get("tenant_id", "local")
            )
            return {
                "type": "message",
                "attachments": [build_upcoming_meetings_card(meetings, comp)]
            }

        # 2.5 Shortlisted Candidates
        if re.search(r"\b(shortlist|shortlisted\s+candidates?|candidate\s+submissions?|review\s+candidates?)\b", text_lower):
            cands = list_shortlisted_candidates(
                user_id=current_user.get("id", user_id),
                tenant_id=current_user.get("tenant_id", "local")
            )
            if not cands:
                return {
                    "type": "message",
                    "text": "ℹ️ **No candidates currently shortlisted.** Your active job requisitions have no unreviewed submissions."
                }
            top_cand = cands[0]
            return {
                "type": "message",
                "attachments": [build_candidate_action_card(top_cand)]
            }

        # 2.6 Live Requisitions Directory
        if re.search(r"\b(active\s+requ?[a-z]*|live\s+requ?[a-z]*|open\s+requ?[a-z]*|all\s+requ?[a-z]*|list\s+requ?[a-z]*)\b", text_lower):
            reqs = list_hiring_requisitions(
                user_id=current_user.get("id", user_id),
                tenant_id=current_user.get("tenant_id", "local")
            )
            if not reqs:
                return {
                    "type": "message",
                    "text": f"📋 **No active requisitions found** for {comp}."
                }
            lines = [f"📋 **Active Requisitions for {comp}:**\n"]
            for r in reqs[:5]:
                t = r.get("title", "Role")
                d = r.get("department", "Engineering")
                s = r.get("status", "Active")
                lines.append(f"• **{t}** ({d}) — `{s}`")
            return {"type": "message", "text": "\n".join(lines)}

        # 2.7 Timesheet & Expense Claim Approvals
        if re.search(r"\b(timesheets?|expenses?|claims?|hours?\s+approval)\b", text_lower):
            ts = list_pending_timesheets(
                user_id=current_user.get("id", user_id),
                tenant_id=current_user.get("tenant_id", "local")
            )
            ex = list_pending_expenses(
                user_id=current_user.get("id", user_id),
                tenant_id=current_user.get("tenant_id", "local")
            )
            return {
                "type": "message",
                "attachments": [build_timesheet_review_card(ts, ex)]
            }

        # 2.8 General Conversational Flow via Hiring Manager AI Agent
        add_teams_history_message(user_id, "user", text_clean, tenant_id=tenant_id)
        history = get_teams_chat_history(user_id, tenant_id=tenant_id)

        agent_result = run_hiring_manager_agent_chat(
            prompt=text_clean,
            history=history,
            current_user=current_user
        )

        reply_text = agent_result.get("reply", "")
        executed_actions = agent_result.get("executed_actions", [])

        # Check if agent drafted a requisition
        for action in executed_actions:
            tool_name = action.get("tool")
            res = action.get("result")
            if tool_name == "draft_hiring_requisition" and isinstance(res, dict):
                add_teams_history_message(user_id, "assistant", f"Drafted requisition for {res.get('title')}", tenant_id)
                return {
                    "type": "message",
                    "attachments": [build_requisition_draft_card(res)]
                }
            elif tool_name == "get_hiring_manager_pending_works" and isinstance(res, dict):
                return {
                    "type": "message",
                    "attachments": [build_pending_works_card(res, comp)]
                }
            elif tool_name == "list_scheduled_interviews" and isinstance(res, list):
                return {
                    "type": "message",
                    "attachments": [build_upcoming_meetings_card(res, comp)]
                }

        add_teams_history_message(user_id, "assistant", reply_text, tenant_id=tenant_id)
        return {
            "type": "message",
            "text": reply_text or "How else can I assist your hiring pipeline?"
        }

    return {"type": "message", "text": "Activity received."}


async def handle_teams_card_submit(
    value_data: Dict[str, Any],
    from_user: Dict[str, Any],
    tenant_id: Optional[str] = None,
    aad_id: Optional[str] = None
) -> Dict[str, Any]:
    """Process button clicks on Adaptive Cards."""
    action = value_data.get("action")
    session = get_or_create_teams_session(from_user, tenant_id=tenant_id, aad_object_id=aad_id)
    current_user = session["current_user"]
    comp = current_user.get("company_name", "TermJobs")
    user_id = str(from_user.get("id") or aad_id or "teams_user")
    user_name = str(from_user.get("name") or "Hiring Manager")

    if action == "pending_works":
        pending_res = get_hiring_manager_pending_works(
            user_id=current_user.get("id", user_id),
            user_name=current_user.get("name", user_name),
            tenant_id=current_user.get("tenant_id", "local")
        )
        return {"type": "message", "attachments": [build_pending_works_card(pending_res, comp)]}

    elif action == "upcoming_meetings":
        meetings = list_scheduled_interviews(
            user_id=current_user.get("id", user_id),
            user_name=current_user.get("name", user_name),
            tenant_id=current_user.get("tenant_id", "local")
        )
        return {"type": "message", "attachments": [build_upcoming_meetings_card(meetings, comp)]}

    elif action == "shortlisted_candidates":
        cands = list_shortlisted_candidates(
            user_id=current_user.get("id", user_id),
            tenant_id=current_user.get("tenant_id", "local")
        )
        if not cands:
            return {"type": "message", "text": "ℹ️ **No candidates currently shortlisted.**"}
        return {"type": "message", "attachments": [build_candidate_action_card(cands[0])]}

    elif action == "review_timesheets":
        ts = list_pending_timesheets(
            user_id=current_user.get("id", user_id),
            tenant_id=current_user.get("tenant_id", "local")
        )
        ex = list_pending_expenses(
            user_id=current_user.get("id", user_id),
            tenant_id=current_user.get("tenant_id", "local")
        )
        return {"type": "message", "attachments": [build_timesheet_review_card(ts, ex)]}

    elif action == "submit_to_director":
        title = value_data.get("title", "Engineering Role")
        cmd = (
            f"CONFIRM_SUBMIT_TO_DIRECTOR: title=\"{title}\", "
            f"department=\"{value_data.get('department', 'Engineering')}\", "
            f"location=\"{value_data.get('location', 'Remote')}\", "
            f"employment_type=\"{value_data.get('employment_type', 'Contract')}\", "
            f"experience_level=\"{value_data.get('experience_level', 'Mid-Level')}\", "
            f"salary_range=\"{value_data.get('salary_range', 'Competitive')}\", "
            f"skills=\"{value_data.get('skills', 'Engineering')}\", "
            f"job_description=\"{value_data.get('job_description', '')}\""
        )
        res = run_hiring_manager_agent_chat(cmd, [], current_user)
        return {
            "type": "message",
            "text": res.get("reply") or f"✅ **{title}** has been submitted to your Director for formal approval!"
        }

    elif action == "approve_timesheet":
        ts_id = value_data.get("timesheet_id", "")
        c_name = value_data.get("candidate_name", "Contractor")
        from modules.hiring_manager_agent.agent import approve_contractor_timesheet
        res = approve_contractor_timesheet(
            timesheet_id=ts_id,
            user_id=current_user.get("id", user_id),
            user_name=current_user.get("name", user_name),
            tenant_id=current_user.get("tenant_id", "local")
        )
        return {
            "type": "message",
            "text": f"✅ **Timesheet for {c_name} approved successfully!** Recorded in billing ledger."
        }

    return {
        "type": "message",
        "text": f"Action `{action}` received and recorded."
    }
