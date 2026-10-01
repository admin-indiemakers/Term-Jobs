"""Telegram Long-Polling Background Service for TermJobs Hiring Manager AI Assistant."""
import asyncio
import os
import httpx
from typing import Optional

from modules.shared.config import settings
from .handlers import handle_message, handle_callback_query

TELEGRAM_API_BASE = "https://api.telegram.org"

_polling_task: Optional[asyncio.Task] = None
_is_polling = False
_logged_token_missing = False


def get_hm_bot_token() -> str:
    """Retrieve configured Hiring Manager bot token."""
    return getattr(settings, "hm_telegram_bot_token", "") or os.getenv("HM_TELEGRAM_BOT_TOKEN", "").strip()


async def hm_bot_polling_loop():
    """Continuous async long-polling runner for HM Telegram Bot."""
    global _is_polling, _logged_token_missing
    _is_polling = True
    offset = 0
    print("[HM TELEGRAM BOT] Starting long-polling service...")

    while _is_polling:
        token = get_hm_bot_token()
        if not token:
            if not _logged_token_missing:
                print("[HM TELEGRAM BOT] HM_TELEGRAM_BOT_TOKEN is not configured yet. Polling will resume automatically once set in .env.")
                _logged_token_missing = True
            await asyncio.sleep(5)
            continue
        else:
            _logged_token_missing = False

        # Ensure webhook is cleared
        try:
            async with httpx.AsyncClient(timeout=10.0) as init_client:
                del_resp = await init_client.post(
                    f"{TELEGRAM_API_BASE}/bot{token}/deleteWebhook",
                    json={"drop_pending_updates": False}
                )
                if del_resp.status_code == 200:
                    print("[HM TELEGRAM BOT] Webhook verified cleared for long polling.")
        except Exception as e:
            print(f"[HM TELEGRAM BOT] Note on webhook reset: {e}")

        # Polling updates
        while _is_polling:
            token = get_hm_bot_token()
            if not token:
                break

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
                            if "message" in update:
                                asyncio.create_task(handle_message(token, update["message"]))
                            elif "callback_query" in update:
                                asyncio.create_task(handle_callback_query(token, update["callback_query"]))

                    elif res.status_code == 409:
                        # Another instance polling or token conflict
                        print("[HM TELEGRAM BOT 409] getUpdates conflict. Retrying in 10s...")
                        await asyncio.sleep(10)
                    elif res.status_code == 401:
                        print("[HM TELEGRAM BOT 401] Invalid bot token provided. Please verify HM_TELEGRAM_BOT_TOKEN.")
                        await asyncio.sleep(15)
                    else:
                        await asyncio.sleep(3)

            except asyncio.CancelledError:
                print("[HM TELEGRAM BOT] Polling cancelled.")
                return
            except Exception as err:
                await asyncio.sleep(4)


def start_hm_bot_polling():
    """Start background polling worker for HM Telegram Bot."""
    global _polling_task
    if _polling_task is None or _polling_task.done():
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                _polling_task = loop.create_task(hm_bot_polling_loop())
            else:
                print("[HM TELEGRAM BOT] Event loop is not running yet.")
        except RuntimeError:
            pass


def stop_hm_bot_polling():
    """Gracefully terminate HM Telegram Bot polling worker."""
    global _is_polling, _polling_task
    _is_polling = False
    if _polling_task and not _polling_task.done():
        _polling_task.cancel()


if __name__ == "__main__":
    try:
        asyncio.run(hm_bot_polling_loop())
    except KeyboardInterrupt:
        print("[HM TELEGRAM BOT] Stopped.")
