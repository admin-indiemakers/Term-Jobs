"""Zoho Cliq Event Handlers.

Coordinates between Zoho Cliq webhook events (Message Handler, Action Handler,
Button clicks) and the Hiring Manager AI Agent & Database.
"""
import re
import httpx
from typing import Dict, Any, Optional

from modules.shared.config import settings
from modules.shared.db import db
from modules.hiring_manager_agent.agent import (
    run_hiring_manager_agent_chat,
    schedule_candidate_interview,
    confirm_and_dispatch_interview_invitation,
    reject_shortlisted_candidate,
    get_candidate_profile_details,
    list_shortlisted_candidates,
    list_pending_timesheets,
    list_pending_expenses,
    list_accepted_candidates,
    list_onboarding_issues,
    list_hiring_requisitions,
    get_hiring_manager_pending_works,
    get_hiring_manager_stats,
    approve_contractor_timesheet,
    reject_contractor_timesheet,
    approve_candidate_expense,
    reject_candidate_expense,
    submit_requisition_for_director_approval
)
from modules.hm_zoho_cliq.formatter import (
    format_cliq_welcome,
    format_cliq_pending_works,
    format_cliq_shortlisted_candidate,
    format_cliq_interview_proposal,
    format_cliq_interview_confirmed,
    format_cliq_candidate_rejected,
    format_cliq_candidate_profile,
    format_cliq_draft_preview,
    format_cliq_timesheet,
    format_cliq_expense,
    format_cliq_stats,
    format_cliq_quick_menu,
    build_cliq_button
)

CLIQ_INCOMING_WEBHOOK = "https://cliq.zoho.in/api/v2/bots/hiringmanagerterm/incoming"

# Chat session memory for Zoho Cliq users with MongoDB persistence
_CLIQ_SESSIONS: Dict[str, Dict[str, Any]] = {}


def get_cliq_session(user_id: str, user_name: str = "Hiring Manager", user_email: str = "") -> Dict[str, Any]:
    """Retrieve or initialize session for a Zoho Cliq user with MongoDB persistence."""
    try:
        doc = db["cliq_sessions"].find_one({"user_id": user_id})
        if doc:
            doc.pop("_id", None)
            # Update user name/email if freshly provided
            if user_name and user_name != "Hiring Manager":
                doc.setdefault("current_user", {})["name"] = user_name
            if user_email:
                doc.setdefault("current_user", {})["email"] = user_email
            _CLIQ_SESSIONS[user_id] = doc
            return doc
    except Exception as e:
        print("[CLIQ DB SESSION LOAD ERROR]", e)

    if user_id in _CLIQ_SESSIONS:
        return _CLIQ_SESSIONS[user_id]

    session = {
        "user_id": user_id,
        "current_user": {
            "id": user_id,
            "name": user_name or "Hiring Manager",
            "email": user_email or "hiring.manager@termjobs.in",
            "role": "HIRING_MANAGER",
            "tenant_id": "local",
            "company_name": "Client Workspace"
        },
        "history": [],
        "last_draft": None
    }
    _CLIQ_SESSIONS[user_id] = session
    try:
        db["cliq_sessions"].update_one(
            {"user_id": user_id},
            {"$set": session},
            upsert=True
        )
    except Exception:
        pass
    return session


def save_cliq_session(session: Dict[str, Any]):
    """Persist session history and active draft to MongoDB."""
    user_id = session.get("user_id") or session.get("current_user", {}).get("id")
    if not user_id:
        return
    _CLIQ_SESSIONS[str(user_id)] = session
    try:
        db["cliq_sessions"].update_one(
            {"user_id": str(user_id)},
            {"$set": {
                "history": session.get("history", [])[-24:],
                "last_draft": session.get("last_draft"),
                "current_user": session.get("current_user")
            }},
            upsert=True
        )
    except Exception as e:
        print("[CLIQ DB SESSION SAVE ERROR]", e)


async def dispatch_cliq_incoming_message(message_payload: Dict[str, Any]) -> bool:
    """Proactively send a message to Zoho Cliq via the Incoming Webhook Endpoint."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(CLIQ_INCOMING_WEBHOOK, json=message_payload)
            return resp.status_code == 200
    except Exception as e:
        print(f"[CLIQ INCOMING ERROR] Failed to send push message: {e}")
        return False


async def process_cliq_request(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Process incoming request from Zoho Cliq Message Handler or Button Handler."""
    # 1. Extract user information
    user_info = payload.get("user") or {}
    user_id = str(user_info.get("id") or user_info.get("zuid") or "cliq_user")
    user_name = user_info.get("name") or user_info.get("first_name") or "Hiring Manager"
    user_email = user_info.get("email") or ""
    session = get_cliq_session(user_id, user_name, user_email)

    # 2. Extract action key (button click) or message text
    # In Cliq, button clicks send `action`, `button.id`, `key`, or `arguments`
    action_key = (
        payload.get("action") or
        payload.get("key") or
        (payload.get("arguments", {}).get("key") if isinstance(payload.get("arguments"), dict) else None) or
        (payload.get("button", {}).get("key") if isinstance(payload.get("button"), dict) else None) or
        (payload.get("button", {}).get("id") if isinstance(payload.get("button"), dict) else None) or
        (payload.get("button", {}).get("name") if isinstance(payload.get("button"), dict) else None) or
        ""
    )
    if not isinstance(action_key, str):
        action_key = str(action_key or "")
    action_key = action_key.strip()

    raw_text = (
        payload.get("message") or
        payload.get("text") or
        payload.get("command") or
        ""
    ).strip()

    # Conversational shortcuts if no button action key was passed
    clean_text = raw_text.lower().strip()
    if not action_key:
        if clean_text in ("/start", "/help", "hi", "hello", "hey", "menu", "start", "help"):
            action_key = "menu:welcome"
        elif clean_text in ("pending", "pending works", "pending work", "actions", "pending actions", "pending action", "tasks"):
            action_key = "menu:pending_works"
        elif clean_text in ("candidate", "candidates", "shortlist", "shortlisted", "show candidates", "list candidates", "view candidates", "candidates list"):
            action_key = "menu:candidates"
        elif clean_text in ("working hires", "hires", "contractors", "working", "team", "active hires", "accepted candidates"):
            action_key = "menu:accepted_candidates"
        elif clean_text in ("timesheet", "timesheets", "pending timesheets", "review timesheets"):
            action_key = "menu:timesheets"
        elif clean_text in ("expense", "expenses", "pending expenses", "review expenses"):
            action_key = "menu:expenses"
        elif clean_text in ("requisition", "requisitions", "jobs", "open roles", "open jobs", "open requisitions", "active roles"):
            action_key = "menu:requisitions"
        elif clean_text in ("stats", "pipeline", "pipeline stats", "analytics", "metrics"):
            action_key = "menu:stats"

    # Determine intent
    key_to_process = action_key or raw_text

    # -------------------------------------------------------------
    # 3. Handle Interactive Button Actions
    # -------------------------------------------------------------
    if action_key.startswith("sched_int:"):
        cand_name = action_key.replace("sched_int:", "").strip()
        if not cand_name or cand_name.lower() in ("termjobs", "term jobs", "test", "candidate"):
            cand_name = "Arjun M"

        # Lookup candidate details from DB to find exact requisition/role
        req_title = "Senior Full Stack Developer"
        cand_doc = None
        try:
            cand_doc = db["candidate_submissions"].find_one({
                "$or": [
                    {"candidate_name": {"$regex": f"^{re.escape(cand_name)}$", "$options": "i"}},
                    {"name": {"$regex": f"^{re.escape(cand_name)}$", "$options": "i"}}
                ]
            })
            if not cand_doc:
                cand_doc = db["candidates"].find_one({
                    "$or": [
                        {"candidate_name": {"$regex": f"^{re.escape(cand_name)}$", "$options": "i"}},
                        {"name": {"$regex": f"^{re.escape(cand_name)}$", "$options": "i"}}
                    ]
                })
        except Exception as e:
            print("[CLIQ DB LOOKUP ERROR]", e)
        if cand_doc:
            req_title = cand_doc.get("requisition_title") or cand_doc.get("role") or req_title
            real_name = cand_doc.get("candidate_name") or cand_doc.get("name")
            if real_name and real_name.lower().strip() not in ("termjobs", "term jobs", "test"):
                cand_name = real_name

        proposal_res = schedule_candidate_interview(
            candidate_identifier=cand_name,
            req_title=req_title,
            proposed_date="2026-09-12",
            proposed_time="02:00 PM EST",
            interview_type="Technical Round",
            meeting_notes="Technical evaluation focusing on system design & backend APIs."
        )
        return format_cliq_interview_proposal(proposal_res)

    elif action_key.startswith("conf_int:"):
        cand_name = action_key.replace("conf_int:", "").strip()
        tenant_id = session["current_user"].get("tenant_id", "local")
        company_name = session["current_user"].get("company_name", "TermJobs")

        dispatch_res = confirm_and_dispatch_interview_invitation(
            candidate_identifier=cand_name,
            tenant_id=tenant_id,
            company_name=company_name
        )
        return format_cliq_interview_confirmed(dispatch_res)

    elif action_key.startswith("view_prof:"):
        cand_name = action_key.replace("view_prof:", "").strip()
        tenant_id = session["current_user"].get("tenant_id", "local")
        prof = get_candidate_profile_details(cand_name, tenant_id)
        return format_cliq_candidate_profile(prof)

    elif action_key.startswith("rej_cand:"):
        cand_name = action_key.replace("rej_cand:", "").strip()
        user_id_val = session["current_user"].get("id", "")
        tenant_id = session["current_user"].get("tenant_id", "local")

        res = reject_shortlisted_candidate(
            candidate_identifier=cand_name,
            reason="Not aligned with requisition requirements.",
            user_id=user_id_val,
            user_name=user_name,
            tenant_id=tenant_id
        )
        return format_cliq_candidate_rejected(res)

    elif action_key.startswith("appr_ts:"):
        ts_id = action_key.replace("appr_ts:", "").strip()
        tenant_id = session["current_user"].get("tenant_id", "local")
        res = approve_contractor_timesheet(ts_id, user_name, tenant_id)
        return {
            "text": f"✅ *Timesheet Approved*\n{res.get('message', 'Timesheet marked as Approved.')}",
            "card": {"title": "Timesheet Approval", "theme": "modern-inline"},
            "buttons": format_cliq_quick_menu()
        }

    elif action_key.startswith("rej_ts:"):
        ts_id = action_key.replace("rej_ts:", "").strip()
        tenant_id = session["current_user"].get("tenant_id", "local")
        res = reject_contractor_timesheet(ts_id, "Hours require correction.", user_name, tenant_id)
        return {
            "text": f"🚫 *Timesheet Rejected*\n{res.get('message', 'Timesheet marked as Rejected.')}",
            "card": {"title": "Timesheet Rejection", "theme": "modern-inline"},
            "buttons": format_cliq_quick_menu()
        }

    elif action_key.startswith("appr_exp:"):
        exp_id = action_key.replace("appr_exp:", "").strip()
        tenant_id = session["current_user"].get("tenant_id", "local")
        res = approve_candidate_expense(exp_id, user_name, tenant_id)
        return {
            "text": f"✅ *Expense Approved*\n{res.get('message', 'Expense marked as Approved.')}",
            "card": {"title": "Expense Approval", "theme": "modern-inline"},
            "buttons": format_cliq_quick_menu()
        }

    elif action_key.startswith("rej_exp:"):
        exp_id = action_key.replace("rej_exp:", "").strip()
        tenant_id = session["current_user"].get("tenant_id", "local")
        res = reject_candidate_expense(exp_id, "Claim requires valid receipt.", user_name, tenant_id)
        return {
            "text": f"🚫 *Expense Rejected*\n{res.get('message', 'Expense marked as Rejected.')}",
            "card": {"title": "Expense Rejection", "theme": "modern-inline"},
            "buttons": format_cliq_quick_menu()
        }

    elif action_key == "submit_draft":
        last_draft = session.get("last_draft")
        if not last_draft:
            return {"text": "⚠️ No active requisition draft found to submit.", "buttons": format_cliq_quick_menu()}
        res = submit_requisition_for_director_approval(
            title=last_draft.get("title", "Software Engineer"),
            department=last_draft.get("department", "Engineering & Product"),
            user_id=session["current_user"].get("id", ""),
            user_name=user_name,
            tenant_id=session["current_user"].get("tenant_id", "local")
        )
        session["last_draft"] = None
        return {
            "text": f"🚀 *Submitted for Director Approval!*\n\n{res.get('message', 'Requisition submitted.')}",
            "card": {"title": "Director Notification Sent", "theme": "modern-inline"},
            "buttons": format_cliq_quick_menu()
        }

    elif action_key == "cancel_draft":
        session["last_draft"] = None
        return {
            "text": "❌ *Requisition draft cancelled.* What would you like to work on next?",
            "buttons": format_cliq_quick_menu()
        }

    # -------------------------------------------------------------
    # 4. Handle Menu Shortcuts
    # -------------------------------------------------------------
    if action_key.startswith("menu:") or raw_text.lower() in ("/start", "/help", "hi", "hello", "menu"):
        menu_item = action_key.replace("menu:", "") if action_key.startswith("menu:") else "welcome"
        user_id_val = session["current_user"].get("id", "")
        tenant_id = session["current_user"].get("tenant_id", "local")
        company_name = session["current_user"].get("company_name", "TermJobs")

        if menu_item == "welcome" or raw_text.lower() in ("/start", "/help", "hi", "hello"):
            return format_cliq_welcome()

        elif menu_item == "pending_works":
            res = get_hiring_manager_pending_works(user_id_val, user_name, tenant_id)
            return format_cliq_pending_works(res, company_name)

        elif menu_item == "candidates":
            cand_list = list_shortlisted_candidates(user_id_val, user_name, tenant_id)
            if not cand_list:
                return {
                    "text": "ℹ️ *No candidates currently shortlisted.* You are all caught up!",
                    "buttons": format_cliq_quick_menu()
                }
            # Return top candidate with full actions
            top_cand = cand_list[0]
            card = format_cliq_shortlisted_candidate(top_cand)
            if len(cand_list) > 1:
                card["text"] = f"👥 *Found {len(cand_list)} Shortlisted Candidates:*\n\n" + card["text"]
            return card

        elif menu_item == "accepted_candidates":
            res = list_accepted_candidates(user_id_val, user_name, tenant_id)
            if not res:
                return {"text": "ℹ️ No candidates currently working under your requisitions.", "buttons": format_cliq_quick_menu()}
            lines = ["👷 *CANDIDATES WORKING UNDER YOU:*", "━━━━━━━━━━━━━━━━━━━━━━━━━━"]
            for c in res[:5]:
                c_name = c.get("name") or c.get("candidate_name") or "Contractor"
                role = c.get("role") or c.get("requisition_title") or "Engineer"
                st = c.get("status") or "Active"
                lines.append(f"• *{c_name}* — {role} (`{st}`)")
            return {"text": "\n".join(lines), "card": {"title": "Active Team", "theme": "modern-inline"}, "buttons": format_cliq_quick_menu()}

        elif menu_item == "timesheets":
            ts_list = list_pending_timesheets(user_id_val, user_name, tenant_id)
            if not ts_list:
                return {"text": "✅ *All contractor timesheets are reviewed!* None pending.", "buttons": format_cliq_quick_menu()}
            return format_cliq_timesheet(ts_list[0])

        elif menu_item == "expenses":
            exp_list = list_pending_expenses(user_id_val, user_name, tenant_id)
            if not exp_list:
                return {"text": "✅ *All expense claims are reviewed!* None pending.", "buttons": format_cliq_quick_menu()}
            return format_cliq_expense(exp_list[0])

        elif menu_item == "onboarding":
            issues = list_onboarding_issues(user_id_val, user_name, tenant_id)
            if not issues:
                return {"text": "🚀 *All candidates fully onboarded!* No blocking access issues.", "buttons": format_cliq_quick_menu()}
            lines = [f"📋 *ACTIVE ONBOARDING CHECKS ({len(issues)}):*", "━━━━━━━━━━━━━━━━━━━━━━━━━━"]
            for iss in issues[:5]:
                c_name = iss.get("candidate_name") or iss.get("name") or "Candidate"
                status = iss.get("status") or "In Progress"
                step = iss.get("step") or iss.get("issue") or "Provisioning IT hardware & email"
                lines.append(f"• *{c_name}*: {step} (`{status}`)")
            return {"text": "\n".join(lines), "card": {"title": "Onboarding Pipeline", "theme": "modern-inline"}, "buttons": format_cliq_quick_menu()}

        elif menu_item == "requisitions":
            reqs = list_hiring_requisitions(user_id_val, tenant_id)
            lines = [f"📋 *LIVE REQUISITIONS DIRECTORY — {company_name}:*", "━━━━━━━━━━━━━━━━━━━━━━━━━━"]
            for r in reqs[:6]:
                r_title = r.get("title") or "Engineer"
                r_st = r.get("status") or "Published"
                r_dept = r.get("department") or "Engineering"
                lines.append(f"• *{r_title}* ({r_dept}) — `{r_st}`")
            return {"text": "\n".join(lines), "card": {"title": "Requisitions", "theme": "modern-inline"}, "buttons": format_cliq_quick_menu()}

        elif menu_item == "stats":
            st = get_hiring_manager_stats(user_id_val, tenant_id, user_name)
            return format_cliq_stats(st, company_name)

    # -------------------------------------------------------------
    # 5. Direct Natural Language Regex (Instant Cards)
    # -------------------------------------------------------------
    sched_match = re.search(r"\b(schedule|set\s*up)\s+(an\s+)?interview(\s+with\s+([a-zA-Z0-9_\s\.\-]+))?", raw_text, re.IGNORECASE)
    if sched_match:
        cand_name = (sched_match.group(4) or "").strip()
        cand_name = re.split(r"\s+(on|at|for|tomorrow|next)\b", cand_name, flags=re.IGNORECASE)[0].strip()
        if not cand_name or cand_name.lower() in ("termjobs", "candidate", "someone"):
            cand_name = "Arjun M"

        proposal_res = schedule_candidate_interview(
            candidate_identifier=cand_name,
            req_title="Senior Full Stack Developer",
            proposed_date="2026-09-12",
            proposed_time="02:00 PM EST",
            interview_type="Technical Round",
            meeting_notes="Technical evaluation focusing on system design & backend APIs."
        )
        return format_cliq_interview_proposal(proposal_res)

    rej_match = re.search(r"\b(reject|disqualify)\s+(candidate\s+)?([a-zA-Z0-9_\s\.\-]+)", raw_text, re.IGNORECASE)
    if rej_match and not any(w in raw_text.lower() for w in ["timesheet", "expense", "draft"]):
        cand_name = rej_match.group(3).strip()
        cand_name = re.split(r"\s+(because|for|due\s+to|as)\b", cand_name, flags=re.IGNORECASE)[0].strip()
        if not cand_name:
            cand_name = "Arjun M"

        user_id_val = session["current_user"].get("id", "")
        tenant_id = session["current_user"].get("tenant_id", "local")
        res = reject_shortlisted_candidate(
            candidate_identifier=cand_name,
            reason="Not aligned with requisition requirements.",
            user_id=user_id_val,
            user_name=user_name,
            tenant_id=tenant_id
        )
        return format_cliq_candidate_rejected(res)

    # -------------------------------------------------------------
    # 6. Full AI Agent Orchestrator (Groq LLM + System Tools)
    # -------------------------------------------------------------
    agent_result = run_hiring_manager_agent_chat(
        prompt=raw_text,
        history=session["history"],
        current_user=session["current_user"]
    )

    # Save user message to history
    session["history"].append({"sender": "user", "text": raw_text})
    if len(session["history"]) > 24:
        session["history"] = session["history"][-24:]

    reply_text = agent_result.get("reply", "")
    executed_actions = agent_result.get("executed_actions", [])

    def respond_and_save(resp: Dict[str, Any]) -> Dict[str, Any]:
        resp_text = resp.get("text") or reply_text or ""
        session["history"].append({"sender": "assistant", "text": resp_text})
        if len(session["history"]) > 24:
            session["history"] = session["history"][-24:]
        save_cliq_session(session)
        return resp

    for action in executed_actions:
        tool_name = action.get("tool")
        res = action.get("result")

        if tool_name == "draft_hiring_requisition" and isinstance(res, dict):
            session["last_draft"] = res
            return respond_and_save(format_cliq_draft_preview(res))

        elif tool_name == "schedule_candidate_interview" and isinstance(res, dict):
            # If agent already produced a conversational proposal reply, prioritize that
            if reply_text:
                return respond_and_save({
                    "text": reply_text,
                    "card": {"title": "📅 Interview Proposal", "theme": "modern-inline"}
                })
            return respond_and_save(format_cliq_interview_proposal(res))

        elif tool_name == "reject_shortlisted_candidate" and isinstance(res, dict):
            return respond_and_save(format_cliq_candidate_rejected(res))

        elif tool_name == "list_shortlisted_candidates" and isinstance(res, list) and res:
            # Return agentic conversational reply without broken deluge buttons
            if reply_text:
                return respond_and_save({
                    "text": reply_text,
                    "card": {"title": "👥 Shortlisted Candidates", "theme": "modern-inline"}
                })
            return respond_and_save(format_cliq_shortlisted_candidate(res[0]))

        elif tool_name == "get_hiring_manager_pending_works" and isinstance(res, dict):
            company_name = session["current_user"].get("company_name", "Client Workspace")
            return respond_and_save(format_cliq_pending_works(res, company_name))

        elif tool_name == "get_candidate_profile_details" and isinstance(res, dict):
            return respond_and_save(format_cliq_candidate_profile(res))

        elif tool_name == "list_accepted_candidates" and isinstance(res, list):
            company_name = session["current_user"].get("company_name", "Client Workspace")
            if not res:
                return respond_and_save({
                    "text": f"ℹ️ No active contractors or candidates are currently working under your requisitions for **{company_name}**.",
                    "card": {"title": "Active Working Team", "theme": "modern-inline"}
                })
            lines = [f"👷 *CANDIDATES WORKING UNDER YOU — {company_name.upper()} ({len(res)} Active):*", "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"]
            for c in res[:6]:
                c_name = c.get("candidate_name") or c.get("name") or "Contractor"
                c_role = c.get("role") or c.get("requisition_title") or "Engineer"
                c_st = c.get("status") or "Active"
                c_hrs = c.get("total_hours", 0)
                lines.append(f"• *{c_name}* — {c_role} (`{c_st}` | ⏱ {c_hrs}h logged)")
            return respond_and_save({
                "text": "\n".join(lines),
                "card": {"title": "Active Working Team", "theme": "modern-inline"}
            })

        elif tool_name == "get_hiring_manager_stats" and isinstance(res, dict):
            # Only return dedicated stats card if user explicitly asked for stats/metrics
            if any(w in raw_text.lower() for w in ["stat", "pipeline", "kpi", "metric", "overview"]) or action_key == "menu:stats":
                company_name = session["current_user"].get("company_name", "Client Workspace")
                return respond_and_save(format_cliq_stats(res, company_name))

    # Conversational agentic reply: persist in MongoDB and return clean response without broken buttons
    return respond_and_save({
        "text": reply_text or "How can I assist you with your hiring pipeline today?",
        "card": {
            "title": "⚡ TermJobs Hiring Assistant",
            "theme": "modern-inline"
        }
    })
