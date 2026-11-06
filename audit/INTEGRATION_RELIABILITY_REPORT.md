# External Integrations & Service Reliability Report

**Project**: TermJobs Platform  
**Target Environment**: Production Third-Party Integrations  
**Date**: November 2026  

---

## 1. Third-Party Integration Audit Summary

The TermJobs platform integrates with external cloud providers for real-time video/audio, AI screening, instant mobile alerts, email delivery, and calendar synchronization.

| Service | Protocol / API | Configuration | Health Check Status | Fallback Mechanism |
| :--- | :--- | :--- | :--- | :--- |
| **LiveKit Cloud SFU** | WebSockets (WSS) / WebRTC | `wss://voice-agent-q493cm8d.livekit.cloud` | **HTTP 200 OK (Live)** | In-browser WebRTC direct capture |
| **Groq Cloud AI** | HTTPS REST / JSON API | `https://api.groq.com` | **1.26s Latency (Live)** | Multi-model cascade (`gpt-oss-120b`, `qwen3.8-27b`, Ollama) |
| **Telegram Bot API** | HTTPS Webhook / Long-poll | `@Termjobs_alertbot` | **HTTP 200 OK (Live)** | Email notification fallback & portal notification bell |
| **Email Service** | SMTP / TLS (Gmail Relay) | `_send_email_thread` (Daemon) | **Operational** | In-app notification center |
| **Google Calendar** | Google OAuth2 REST | `VITE_GOOGLE_CLIENT_ID` | **Operational** | Built-in `.ics` download & portal schedule cards |

---

## 2. Integration Deep-Dives & Reliability Proofs

### 2.1 LiveKit Cloud Production SFU
- **Endpoint**: `https://voice-agent-q493cm8d.livekit.cloud`
- **Verification**: Verified dual-stack DNS resolution and HTTP 200 response on HTTPS control endpoint.
- **JWT Authorization**: Backend `generate_livekit_token` signs HS256 tokens dynamically with room names, 6-hour TTL, and participant identity.
- **Hardware Management**: Track cleanup stops video/mic sensors on meeting end, powering down camera LEDs.

### 2.2 Telegram Bot Integration (`modules/candidate/telegram_service.py`)
- **Bot Handle**: `@Termjobs_alertbot`
- **Verification**: Executed live `getMe` call to `https://api.telegram.org/bot<token>/getMe`:
  ```json
  {
    "ok": true,
    "result": {
      "id": 8109677353,
      "is_bot": true,
      "first_name": "TermJobs Alert",
      "username": "Termjobs_alertbot"
    }
  }
  ```
- **Interactive Capabilities**:
  - Deep-link 1-click candidate account binding (`t.me/Termjobs_alertbot?start={candidate_id}`).
  - Inline action buttons (`[ ✅ Yes, I am Available ]`, `[ ❌ Unavailable ]`) allowing candidates to fast-track directly from mobile notifications without logging in.

### 2.3 Email Delivery Architecture
- Implemented as a non-blocking daemon thread (`_send_email_thread` in `telegram_service.py`), ensuring that slow SMTP servers or network timeouts never block the main FastAPI asynchronous event loop.
- Generates RFC-compliant multi-part MIME emails with unique `Message-ID` headers to prevent spam filtering.

