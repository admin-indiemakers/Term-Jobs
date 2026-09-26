"""Telegram Bot Integration Service for TermJobs Candidate Talent Matching & 1-Click Outreach.

Provides:
- 1-Click Candidate Account Linking via deep-link: t.me/Termjobs_alertbot?start={candidate_id}
- Rich interactive Telegram Requisition Alerts with Inline Buttons:
    [ ✅ Yes, I am Available & Interested ]
    [ ❌ No Longer Available / Placed Elsewhere ]
- Callback query processing that automatically updates MongoDB, fast-tracks candidates,
  and updates candidate availability.
- Automatic long-polling background worker so local development works immediately
  without requiring a public domain / ngrok.
"""

import asyncio
import os
import re
import uuid
import secrets
from datetime import datetime, timezone
import httpx
from modules.shared.config import settings
from modules.shared.db import db

TELEGRAM_API_BASE = "https://api.telegram.org"


def get_telegram_token() -> str:
    """Return the configured Telegram Bot Token."""
    return settings.telegram_bot_token or os.getenv("TELEGRAM_BOT_TOKEN", "").strip()


def get_telegram_bot_username() -> str:
    """Return the configured Telegram Bot Username."""
    return settings.telegram_bot_username or os.getenv("TELEGRAM_BOT_USERNAME", "Termjobs_alertbot").strip().lstrip("@")


async def get_bot_info() -> dict:
    """Check Telegram connection and retrieve bot profile."""
    token = get_telegram_token()
    if not token:
        return {"ok": False, "error": "TELEGRAM_BOT_TOKEN is not configured."}
    
    url = f"{TELEGRAM_API_BASE}/bot{token}/getMe"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get(url)
            return res.json()
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


async def send_candidate_requisition_alert(
    chat_id: int | str,
    requisition: dict,
    candidate: dict,
    outreach_token: str,
    match_score: float = 90.0,
    match_reasons: list = None
) -> dict:
    """Send a rich Telegram message with 1-click interactive RSVP buttons."""
    token = get_telegram_token()
    if not token or not chat_id:
        return {"ok": False, "error": "Missing token or chat_id."}

    req_title = requisition.get("title") or "Open Position"
    company_name = requisition.get("company_name") or "Enterprise Partner"
    cand_name = candidate.get("candidate_name") or candidate.get("name") or "there"

    # Format skills
    skills_list = requisition.get("skills") or []
    if isinstance(skills_list, list):
        skills_text = ", ".join(skills_list[:6])
    else:
        skills_text = str(skills_list)

    reasons_text = ""
    if match_reasons and len(match_reasons) > 0:
        reasons_text = f"\n💡 *Why you matched:* {match_reasons[0]}"

    message_text = (
        f"💼 *NEW MATCH: {req_title}*\n"
        f"🏢 *Organization:* {company_name}\n"
        f"⭐ *Match Fit:* {int(match_score)}% Score\n"
        f"🎯 *Key Requirements:* {skills_text}\n"
        f"{reasons_text}\n\n"
        f"Hi *{cand_name}*! Our AI talent engine ranked your profile among the *Top 20 best-fit candidates* for this requisition.\n\n"
        f"Because availability changes, please confirm with 1 tap below:"
    )

    inline_keyboard = [
        [
            {
                "text": "✅ Yes, I am Available & Interested",
                "callback_data": f"rsvp:{outreach_token}:interested"
            }
        ],
        [
            {
                "text": "❌ No Longer Available / Placed",
                "callback_data": f"rsvp:{outreach_token}:unavailable"
            }
        ]
    ]

    payload = {
        "chat_id": chat_id,
        "text": message_text,
        "parse_mode": "Markdown",
        "reply_markup": {
            "inline_keyboard": inline_keyboard
        }
    }

    url = f"{TELEGRAM_API_BASE}/bot{token}/sendMessage"
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.post(url, json=payload)
            data = res.json()
            if data.get("ok"):
                print(f"[TELEGRAM ALERT SENT] Successfully sent to chat_id={chat_id} for req={requisition.get('id')}")
                try:
                    cand_email = (candidate.get("candidate_email") or candidate.get("email") or "").lower()
                    now_iso = datetime.now(timezone.utc).isoformat()
                    db["candidate_outreach"].update_one(
                        {"token": outreach_token},
                        {"$set": {
                            "token": outreach_token,
                            "requisition_id": requisition.get("id", ""),
                            "requisition_title": req_title,
                            "company_name": company_name,
                            "candidate_id": candidate.get("id", ""),
                            "candidate_name": cand_name,
                            "candidate_email": cand_email,
                            "match_score": match_score,
                            "matched_skills": skills_list[:5] if isinstance(skills_list, list) else [],
                            "telegram_chat_id": str(chat_id),
                            "telegram_sent": True,
                            "status": "sent",
                            "created_at": now_iso
                        }},
                        upsert=True
                    )
                except Exception as out_err:
                    print(f"[TELEGRAM OUTREACH RECORD WARNING] {out_err}")
            else:
                print(f"[TELEGRAM ALERT FAILED] chat_id={chat_id}, err={data.get('description')}")
            return data
    except Exception as exc:
        print(f"[TELEGRAM SEND ERROR] {exc}")
        return {"ok": False, "error": str(exc)}


async def send_candidate_interview_scheduled_alert(
    chat_id: int | str,
    candidate_name: str,
    requisition_title: str,
    company_name: str,
    round_name: str,
    scheduled_date: str,
    scheduled_time: str,
    duration_minutes: int,
    meeting_link: str,
    passcode: str,
) -> dict:
    """Send an instant Telegram alert to the candidate with their hosted interview room link and passcode."""
    token = get_telegram_token()
    if not token or not chat_id:
        return {"ok": False, "error": "Missing token or chat_id."}

    text = (
        f"📅 *INTERVIEW SCHEDULED: {round_name}*\n"
        f"🏢 *Company:* {company_name}\n"
        f"💼 *Position:* {requisition_title}\n"
        f"🗓️ *Date:* {scheduled_date or 'As Scheduled'}\n"
        f"⏰ *Time:* {scheduled_time or 'TBD'} ({duration_minutes} mins)\n"
        f"🔑 *Your Passcode:* `{passcode}`\n\n"
        f"Hi *{candidate_name}*, your interview has been confirmed on TermJobs!\n\n"
        f"Tap the button below to join your live video room:"
    )

    inline_keyboard = [
        [
            {
                "text": "🎥 Join Video Interview Room",
                "url": meeting_link
            }
        ]
    ]

    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "Markdown",
        "reply_markup": {
            "inline_keyboard": inline_keyboard
        }
    }

    url = f"{TELEGRAM_API_BASE}/bot{token}/sendMessage"
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.post(url, json=payload)
            return res.json()
    except Exception as exc:
        print(f"[TELEGRAM INTERVIEW ALERT ERROR] {exc}")
        return {"ok": False, "error": str(exc)}


async def process_telegram_update(update: dict) -> None:
    """Process incoming webhook or polled Telegram update."""
    token = get_telegram_token()
    if not token:
        return

    # Handle incoming messages
    if "message" in update:
        msg = update["message"]
        chat = msg.get("chat", {})
        chat_id = chat.get("id")
        text = (msg.get("text") or "").strip()
        from_user = msg.get("from", {})
        username = from_user.get("username") or from_user.get("first_name") or ""
        first_name = from_user.get("first_name") or "Candidate"

        if not chat_id:
            return

        now_iso = datetime.now(timezone.utc).isoformat()

        # Check for email inside the message text
        email_match = re.search(r'[\w\.-]+@[\w\.-]+\.\w+', text)
        extracted_email = email_match.group(0).lower() if email_match else ""

        candidate_param = ""
        if text.startswith("/start"):
            parts = text.split(" ", 1)
            candidate_param = parts[1].strip() if len(parts) > 1 else ""

        target_email = extracted_email or (candidate_param if "@" in candidate_param else "")
        target_id = candidate_param if not target_email else ""

        # Test command: /test or /alert or test
        if text.lower() in ["/test", "test", "/alert", "alert"]:
            req = db["requisitions"].find_one({"status": {"$in": ["Published", "Active", "Open"]}}) or db["requisitions"].find_one({})
            if req:
                cand_info = db["candidates"].find_one({"telegram_chat_id": str(chat_id)}) or {
                    "candidate_name": first_name,
                    "candidate_email": target_email or "candidate@termjobs.in",
                    "id": str(uuid.uuid4())
                }
                await send_candidate_requisition_alert(
                    chat_id=chat_id,
                    requisition=req,
                    candidate=cand_info,
                    outreach_token=secrets.token_urlsafe(24),
                    match_score=95.0,
                    match_reasons=["Direct test verification", "Telegram alerts active & connected"]
                )
            else:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    await client.post(
                        f"{TELEGRAM_API_BASE}/bot{token}/sendMessage",
                        json={
                            "chat_id": chat_id,
                            "text": "✅ *Telegram Alerts Active!*\n\nYour chat is connected and ready to receive real-time talent matches and interview invitations.",
                            "parse_mode": "Markdown"
                        }
                    )
            return

        # If email or candidate_param was provided:
        if target_email or target_id:
            lookup = {"$or": []}
            if target_email:
                lookup["$or"].append({"candidate_email": target_email})
                lookup["$or"].append({"email": target_email})
            if target_id:
                lookup["$or"].append({"id": target_id})
                lookup["$or"].append({"candidate_id": target_id})
                lookup["$or"].append({"submission_id": target_id})
                lookup["$or"].append({"details.token": target_id})

            cand = db["candidates"].find_one(lookup)
            cand_name = first_name
            if cand:
                cand_name = cand.get("candidate_name") or cand.get("name") or first_name
                db["candidates"].update_one(
                    {"_id": cand["_id"]},
                    {
                        "$set": {
                            "telegram_chat_id": str(chat_id),
                            "telegram_username": username,
                            "telegram_connected_at": now_iso,
                            "availability": "available"
                        }
                    }
                )
            
            # Also check candidate_submissions
            sub_lookup = []
            if target_email:
                sub_lookup.append({"candidate_email": target_email})
            if target_id:
                sub_lookup.append({"candidate_id": target_id})
                sub_lookup.append({"id": target_id})
                sub_lookup.append({"submission_id": target_id})
            sub = db["candidate_submissions"].find_one({"$or": sub_lookup}) if sub_lookup else None
            if sub:
                cand_name = cand_name or sub.get("candidate_name") or first_name
                db["candidate_submissions"].update_one(
                    {"_id": sub["_id"]},
                    {"$set": {"telegram_chat_id": str(chat_id), "telegram_username": username}}
                )

            # Create or ensure candidate record in candidates collection
            cand_id = (cand.get("id") if cand else None) or (sub.get("candidate_id") or sub.get("id") if sub else None) or str(uuid.uuid4())
            cand_email = target_email or (cand.get("candidate_email") if cand else "") or (sub.get("candidate_email") if sub else f"user_{chat_id}@telegram.termjobs.in")
            cand_doc = {
                "id": cand_id,
                "candidate_name": cand_name,
                "candidate_email": cand_email,
                "candidate_title": (cand.get("candidate_title") if cand else "") or "Software Professional",
                "telegram_chat_id": str(chat_id),
                "telegram_username": username,
                "telegram_connected_at": now_iso,
                "availability": "available",
                "source": "Telegram Bot Self-Link",
                "created_at": now_iso,
            }
            db["candidates"].update_one(
                {"candidate_email": cand_email},
                {"$set": cand_doc},
                upsert=True
            )

            # Store in telegram_links
            db["telegram_links"].update_one(
                {"chat_id": str(chat_id)},
                {
                    "$set": {
                        "chat_id": str(chat_id),
                        "candidate_email": cand_email,
                        "candidate_id": cand_id,
                        "username": username,
                        "connected_at": now_iso
                    }
                },
                upsert=True
            )

            role_mention = ""
            if sub and sub.get("requisition_title"):
                role_mention = f" for *{sub.get('requisition_title')}*"

            welcome_msg = (
                f"🎉 *Congratulations, {cand_name}!*\n\n"
                f"Your Telegram account is now successfully linked to your TermJobs profile{role_mention}.\n\n"
                f"⚡ *What happens next?*\n"
                f"• Direct alerts whenever hiring partners evaluate your application\n"
                f"• 1-Tap RSVP buttons (*Available & Interested* / *Placed*)\n"
                f"• Direct access links and passcodes to video interview rooms\n\n"
                f"Sending you a test job match alert below to confirm live connectivity! 👇"
            )

            async with httpx.AsyncClient(timeout=10.0) as client:
                await client.post(
                    f"{TELEGRAM_API_BASE}/bot{token}/sendMessage",
                    json={
                        "chat_id": chat_id,
                        "text": welcome_msg,
                        "parse_mode": "Markdown"
                    }
                )

            # Immediately trigger a live sample alert (preferring the one they applied to)
            req = None
            if sub and sub.get("requisition_id"):
                req = db["requisitions"].find_one({"id": sub["requisition_id"]})
            if not req:
                req = db["requisitions"].find_one({"status": {"$in": ["Published", "Active", "Open"]}}) or db["requisitions"].find_one({})
            if req:
                await send_candidate_requisition_alert(
                    chat_id=chat_id,
                    requisition=req,
                    candidate={"candidate_name": cand_name, "candidate_email": cand_email, "id": cand_id},
                    outreach_token=secrets.token_urlsafe(24),
                    match_score=94.0,
                    match_reasons=["Direct application profile verified", "Availability confirmed via Telegram"]
                )
            return

        # If user sent /start or hi without email or param:
        # Check if username matches an existing candidate
        cand_by_user = None
        if username:
            cand_by_user = db["candidates"].find_one({"telegram_username": {"$regex": f"^{username}$", "$options": "i"}})
        if cand_by_user:
            db["candidates"].update_one({"_id": cand_by_user["_id"]}, {"$set": {"telegram_chat_id": str(chat_id), "telegram_connected_at": now_iso}})
            db["telegram_links"].update_one(
                {"chat_id": str(chat_id)},
                {"$set": {"chat_id": str(chat_id), "candidate_email": cand_by_user.get("candidate_email", ""), "username": username, "connected_at": now_iso}},
                upsert=True
            )
            msg_text = (
                f"🎉 *Welcome back, {cand_by_user.get('candidate_name', 'Candidate')}!*\n\n"
                f"We recognized your Telegram username (@{username}) and re-linked your chat.\n\n"
                f"You are all set to receive 1-click career match alerts! Type /test to test anytime."
            )
        else:
            msg_text = (
                "👋 *Welcome to TermJobs Career Alerts!*\n\n"
                "To connect your profile and receive **instant 1-tap job matches and video interview links**, please **reply with your email address**:\n\n"
                "*(For example: `termjobsofficial@gmail.com`)*"
            )

        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.post(
                f"{TELEGRAM_API_BASE}/bot{token}/sendMessage",
                json={
                    "chat_id": chat_id,
                    "text": msg_text,
                    "parse_mode": "Markdown"
                }
            )
        return

    # Handle inline button RSVP taps
    if "callback_query" in update:
        cb = update["callback_query"]
        cb_id = cb.get("id")
        data = cb.get("data", "")
        message = cb.get("message", {})
        chat_id = message.get("chat", {}).get("id")
        message_id = message.get("message_id")
        from_user = cb.get("from", {})
        sender_name = from_user.get("first_name", "Candidate")

        # Format: rsvp:{token}:{action}
        if data.startswith("rsvp:"):
            parts = data.split(":")
            if len(parts) >= 3:
                outreach_token = parts[1]
                action = parts[2]

                # 1. Immediately acknowledge callback query to stop Telegram button spinner instantly (<150ms)
                initial_toast = "⚡ Fast-Tracking your profile & generating link…" if action == "interested" else "Updating your profile status…"
                try:
                    async with httpx.AsyncClient(timeout=4.0) as quick_client:
                        await quick_client.post(
                            f"{TELEGRAM_API_BASE}/bot{token}/answerCallbackQuery",
                            json={"callback_query_id": cb_id, "text": initial_toast, "show_alert": False}
                        )
                except Exception as ack_err:
                    print(f"[TELEGRAM ACK ERROR] {ack_err}")

                # 2. Process RSVP on worker thread to avoid blocking asyncio event loop
                from modules.candidate.outreach_service import handle_candidate_rsvp
                rsvp_result = await asyncio.to_thread(handle_candidate_rsvp, outreach_token, action)

                cand_name = rsvp_result.get("candidate_name") or sender_name
                req_title = rsvp_result.get("requisition_title") or "the position"
                company = rsvp_result.get("company_name") or "our client"
                meeting_link = rsvp_result.get("meeting_link")
                portal_link = rsvp_result.get("candidate_portal_link")
                passcode = rsvp_result.get("candidate_passcode") or "TJ-FAST-TRACK"

                reply_markup = None
                if action == "interested":
                    interview_section = ""
                    if meeting_link:
                        interview_section = (
                            f"\n\n🎥 *Your Live Interview Room:*\n"
                            f"🔗 {meeting_link}\n\n"
                            f"🔑 *Candidate Passcode:* `{passcode}`\n\n"
                            f"_You can enter your interview room immediately or at your scheduled convenience._"
                        )

                    updated_text = (
                        f"✅ *STATUS CONFIRMED: AVAILABLE & INTERESTED*\n\n"
                        f"Awesome, *{cand_name}*! Your profile has been fast-tracked for:\n"
                        f"📌 *{req_title}* at *{company}*"
                        f"{interview_section}"
                    )

                    if meeting_link:
                        keyboard_buttons = [
                            [{"text": "🎥 Enter Video Interview Room", "url": meeting_link}]
                        ]
                        if portal_link:
                            keyboard_buttons.append([{"text": "🚀 Candidate Portal Login", "url": portal_link}])
                        reply_markup = {"inline_keyboard": keyboard_buttons}
                else:
                    updated_text = (
                        f"❌ *STATUS CONFIRMED: PLACED ELSEWHERE / UNAVAILABLE*\n\n"
                        f"Thank you for letting us know, *{cand_name}*!\n\n"
                        f"We have updated your profile so recruiters will not disturb you while you are unavailable. "
                        f"Best of luck in your current role!"
                    )

                # 3. Dispatch message edit and direct interview link concurrently in parallel
                async with httpx.AsyncClient(timeout=8.0) as client:
                    tasks = []

                    if chat_id and message_id:
                        edit_payload = {
                            "chat_id": chat_id,
                            "message_id": message_id,
                            "text": updated_text,
                            "parse_mode": "Markdown"
                        }
                        if reply_markup:
                            edit_payload["reply_markup"] = reply_markup
                        tasks.append(client.post(
                            f"{TELEGRAM_API_BASE}/bot{token}/editMessageText",
                            json=edit_payload
                        ))

                    if action == "interested" and chat_id and meeting_link:
                        new_msg = (
                            f"🎉 *Here is your Live Interview Room Link!*\n\n"
                            f"💼 *Position:* {req_title}\n"
                            f"🏢 *Company:* {company}\n"
                            f"🔑 *Passcode:* `{passcode}`\n\n"
                            f"🎥 *Meeting Room:*\n{meeting_link}\n\n"
                            f"Tap below to join the live video room:"
                        )
                        tasks.append(client.post(
                            f"{TELEGRAM_API_BASE}/bot{token}/sendMessage",
                            json={
                                "chat_id": chat_id,
                                "text": new_msg,
                                "parse_mode": "Markdown",
                                "reply_markup": reply_markup
                            }
                        ))

                    if tasks:
                        await asyncio.gather(*tasks, return_exceptions=True)

                print(f"[TELEGRAM RSVP PROCESSED] Token={outreach_token} Action={action} Candidate={cand_name} MeetingLink={meeting_link}")
                return


# --- Long Polling Background Worker ---
_polling_task = None
_is_polling = False


async def telegram_polling_loop():
    """Continuous long-polling runner to process updates without requiring public webhooks."""
    global _is_polling
    _is_polling = True
    offset = 0
    print("[TELEGRAM WORKER] Starting Telegram long-polling worker...")

    # Ensure webhook is cleared so long-polling can start cleanly without 409 webhook conflict
    token = get_telegram_token()
    if token:
        try:
            async with httpx.AsyncClient(timeout=10.0) as init_client:
                del_resp = await init_client.post(
                    f"{TELEGRAM_API_BASE}/bot{token}/deleteWebhook",
                    json={"drop_pending_updates": True}
                )
                if del_resp.status_code == 200 and del_resp.json().get("ok"):
                    print("[TELEGRAM WORKER] Verified webhook is cleared for long-polling.")
        except Exception as e:
            print(f"[TELEGRAM WORKER] Note on webhook reset: {e}")

    while _is_polling:
        token = get_telegram_token()
        if not token:
            await asyncio.sleep(5)
            continue

        try:
            url = f"{TELEGRAM_API_BASE}/bot{token}/getUpdates"
            params = {"offset": offset, "timeout": 25}

            async with httpx.AsyncClient(timeout=35.0) as client:
                res = await client.get(url, params=params)
                if res.status_code == 200:
                    data = res.json()
                    updates = data.get("result", [])
                    for update in updates:
                        offset = max(offset, update["update_id"] + 1)
                        try:
                            asyncio.create_task(process_telegram_update(update))
                        except Exception as update_err:
                            print(f"[TELEGRAM UPDATE PROCESS ERROR] {update_err}")
                elif res.status_code == 409:
                    # Conflict: another polling instance or webhook is active
                    err_msg = ""
                    try:
                        err_payload = res.json()
                        err_msg = err_payload.get("description", res.text)
                    except Exception:
                        err_msg = res.text

                    if "webhook" in err_msg.lower():
                        print(f"[TELEGRAM WORKER 409] Active webhook conflict ({err_msg}). Clearing webhook...")
                        try:
                            await client.post(
                                f"{TELEGRAM_API_BASE}/bot{token}/deleteWebhook",
                                json={"drop_pending_updates": False}
                            )
                        except Exception:
                            pass
                    else:
                        print(f"[TELEGRAM WORKER 409] Conflict: {err_msg}. Another uvicorn or bot instance is currently running with the same token.")
                    await asyncio.sleep(10)
                else:
                    await asyncio.sleep(3)
        except asyncio.CancelledError:
            print("[TELEGRAM WORKER] Polling task cancelled.")
            break
        except Exception as err:
            # Network hiccup or timeout, wait briefly and retry
            await asyncio.sleep(4)


def start_telegram_polling():
    """Start polling loop in background event loop."""
    global _polling_task
    if _polling_task is None or _polling_task.done():
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                _polling_task = loop.create_task(telegram_polling_loop())
            else:
                print("[TELEGRAM WORKER] Event loop not running yet.")
        except RuntimeError:
            pass


def stop_telegram_polling():
    """Stop the polling loop."""
    global _is_polling, _polling_task
    _is_polling = False
    if _polling_task and not _polling_task.done():
        _polling_task.cancel()
