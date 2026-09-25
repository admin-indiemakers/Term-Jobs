"""Script to completely clear all resumes, candidate accounts, and Telegram bot links.

Performs:
1. Deletion of all candidate profile documents ('candidates').
2. Deletion of all candidate resume submissions and parsed resumes ('candidate_submissions').
3. Deletion of all candidate outreach records ('candidate_outreach').
4. Deletion of all Telegram bot candidate bindings ('telegram_links').
5. Deletion of candidate user login accounts ('users' where role is Candidate or candidate_id is set).
6. Deletion of candidate interview rounds, schedules, messages, and AI interview records.
7. Deletion of candidate notifications and expenses.
8. Deletion of uploaded resume PDF files from local storage.
9. Deletion of interview recordings and GridFS storage files.
10. Notification to connected Telegram users and reset of Telegram bot pending updates.
"""

import os
import sys
import glob
from pathlib import Path
import httpx

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from modules.shared.db import db
from modules.candidate.telegram_service import get_telegram_token, TELEGRAM_API_BASE


def clear_candidates_and_resumes():
    print("=" * 60)
    print("TERMJOBS CLEANUP: Clearing All Resumes & Candidate Accounts")
    print("=" * 60)

    # 1. Identify all connected Telegram chat IDs before clearing
    tg_chat_ids = set()
    for doc in db["telegram_links"].find({}, {"chat_id": 1}):
        if doc.get("chat_id"):
            tg_chat_ids.add(str(doc["chat_id"]))

    for doc in db["candidates"].find({}, {"telegram_chat_id": 1}):
        if doc.get("telegram_chat_id"):
            tg_chat_ids.add(str(doc["telegram_chat_id"]))

    for doc in db["candidate_outreach"].find({}, {"telegram_chat_id": 1}):
        if doc.get("telegram_chat_id"):
            tg_chat_ids.add(str(doc["telegram_chat_id"]))

    print(f"[1/6] Discovered {len(tg_chat_ids)} connected Telegram chat IDs: {tg_chat_ids}")

    # 2. Send polite reset notice to connected Telegram chats and drop pending updates
    token = get_telegram_token()
    if token and tg_chat_ids:
        reset_msg = (
            "ℹ️ *TermJobs Account Reset*\n\n"
            "All candidate profiles, uploaded resumes, and linked accounts have been cleared by administration.\n\n"
            "Your Telegram chat is now completely unlinked. If you wish to connect a new profile in the future, simply send `/start`."
        )
        for chat_id in tg_chat_ids:
            try:
                with httpx.Client(timeout=10.0) as client:
                    resp = client.post(
                        f"{TELEGRAM_API_BASE}/bot{token}/sendMessage",
                        json={
                            "chat_id": chat_id,
                            "text": reset_msg,
                            "parse_mode": "Markdown",
                        },
                    )
                    print(f"  -> Sent reset notice to Telegram chat_id={chat_id}: status={resp.status_code}")
            except Exception as e:
                print(f"  -> Notice send failed for chat_id={chat_id}: {e}")

    # Flush pending updates on Telegram server
    if token:
        try:
            with httpx.Client(timeout=10.0) as client:
                client.post(f"{TELEGRAM_API_BASE}/bot{token}/deleteWebhook", json={"drop_pending_updates": True})
                client.get(f"{TELEGRAM_API_BASE}/bot{token}/getUpdates", params={"offset": -1})
                print("  -> Telegram webhook and pending updates flushed successfully.")
        except Exception as e:
            print(f"  -> Telegram update flush warning: {e}")

    # 3. Purge MongoDB candidate & resume collections
    collections_to_wipe = [
        "candidates",
        "candidate_submissions",
        "candidate_outreach",
        "telegram_links",
        "candidate_notifications",
        "candidate_expenses",
        "interview_rounds",
        "interview_schedules",
        "interview_messages",
        "ai_interviews",
        "screening_cache",
    ]

    print("\n[2/6] Purging MongoDB candidate & resume collections:")
    for col in collections_to_wipe:
        count = db[col].count_documents({})
        res = db[col].delete_many({})
        print(f"  -> {col}: deleted {res.deleted_count} documents (was {count})")

    # 4. Delete candidate shortlisted / dispatched notifications
    notif_res = db["notifications"].delete_many(
        {"type": {"$in": ["candidate.shortlisted", "shortlist.dispatched"]}}
    )
    print(f"  -> notifications: deleted {notif_res.deleted_count} candidate shortlist notification items")

    # 5. Delete candidate user accounts from 'users'
    cand_users_query = {
        "$or": [
            {"role": {"$regex": r"^candidate$", "$options": "i"}},
            {"candidate_id": {"$exists": True, "$ne": ""}},
            {"email": {"$regex": r"@testcandidate\.com$", "$options": "i"}},
        ]
    }
    cand_users_count = db["users"].count_documents(cand_users_query)
    user_res = db["users"].delete_many(cand_users_query)
    print(f"  -> users: deleted {user_res.deleted_count} candidate accounts (was {cand_users_count})")

    # 6. Delete GridFS files (interview recordings / attachments)
    gridfs_files_count = db["fs.files"].count_documents({})
    db["fs.files"].delete_many({})
    db["fs.chunks"].delete_many({})
    print(f"  -> fs.files & fs.chunks: deleted {gridfs_files_count} GridFS files")

    # 7. Delete local uploaded resume PDFs and interview videos
    print("\n[3/6] Purging local uploaded resume files:")
    screening_uploads_dir = backend_dir / "modules" / "candidate_screening_agent" / "uploads"
    deleted_files = 0
    if screening_uploads_dir.exists():
        for file_path in screening_uploads_dir.glob("*.pdf"):
            try:
                file_path.unlink()
                print(f"  -> Deleted resume file: {file_path.name}")
                deleted_files += 1
            except Exception as e:
                print(f"  -> Failed to delete {file_path.name}: {e}")
        for file_path in screening_uploads_dir.glob("*.docx"):
            try:
                file_path.unlink()
                print(f"  -> Deleted docx file: {file_path.name}")
                deleted_files += 1
            except Exception as e:
                print(f"  -> Failed to delete {file_path.name}: {e}")

    interview_videos_dir = backend_dir / "uploads" / "interview_videos"
    if interview_videos_dir.exists():
        for vid in interview_videos_dir.glob("*.webm"):
            try:
                vid.unlink()
                print(f"  -> Deleted interview video: {vid.name}")
            except Exception as e:
                print(f"  -> Failed to delete {vid.name}: {e}")

    screening_tmp_dir = backend_dir / "uploads" / "screening"
    if screening_tmp_dir.exists():
        for f in screening_tmp_dir.glob("*"):
            if f.is_file():
                try:
                    f.unlink()
                    print(f"  -> Deleted screening temp file: {f.name}")
                except Exception as e:
                    print(f"  -> Failed to delete {f.name}: {e}")

    # 8. Verification
    print("\n[4/6] Verification check:")
    print(f"  -> candidates remaining: {db['candidates'].count_documents({})}")
    print(f"  -> candidate_submissions remaining: {db['candidate_submissions'].count_documents({})}")
    print(f"  -> candidate_outreach remaining: {db['candidate_outreach'].count_documents({})}")
    print(f"  -> telegram_links remaining: {db['telegram_links'].count_documents({})}")
    print(f"  -> candidate user accounts remaining: {db['users'].count_documents(cand_users_query)}")
    print(f"  -> interview_rounds remaining: {db['interview_rounds'].count_documents({})}")
    print(f"  -> ai_interviews remaining: {db['ai_interviews'].count_documents({})}")
    print(f"  -> remaining users in database: {db['users'].count_documents({})}")

    print("\n" + "=" * 60)
    print("SUCCESS: All resumes, candidate accounts, and Telegram bot connections have been cleared!")
    print("=" * 60)


if __name__ == "__main__":
    clear_candidates_and_resumes()
