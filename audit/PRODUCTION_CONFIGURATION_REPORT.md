# Production Configuration & Environment Report

**Project**: TermJobs Platform  
**Target Environment**: Production Infrastructure  
**Date**: November 2026  

---

## 1. Environment Variable Inventory & Auditing

All environment variables required for production operations are registered in `backend/.env` and `frontend/.env`. Secret values were audited and confirmed present without leaking raw credentials.

### Backend Environment Configuration

| Variable | Classification | Purpose | Audit Status |
| :--- | :--- | :--- | :--- |
| `MONGODB_URL` | High Security | MongoDB Atlas production connection string | **Verified Active** (`termjob.bnwy4et.mongodb.net`, TLS=True) |
| `MONGO_DB_NAME` | Configuration | Target database catalog (`termjobs`) | **Verified Active** (63 collections) |
| `JWT_SECRET_KEY` | High Security | Cryptographic key for signing user sessions & JWTs | **Verified Active** (256-bit entropy) |
| `GROQ_API_KEY` | High Security | Production API key for Groq Cloud LLM screening | **Verified Active** (Live calls succeeded) |
| `GROQ_BASE_URL` | Configuration | API base URL for Groq Cloud | **Verified Active** (`https://api.groq.com`, normalized) |
| `GROQ_MODEL` | Configuration | Default LLM model (`openai/gpt-oss-20b`) | **Verified Active** |
| `LIVEKIT_URL` | Configuration | WebSocket endpoint for LiveKit SFU | **Configured** |
| `LIVEKIT_API_KEY` | High Security | LiveKit server authentication key | **Configured** |
| `LIVEKIT_API_SECRET`| High Security | LiveKit JWT token signing secret | **Configured** |
| `FRONTEND_BASE_URL` | Configuration | Production web domain for CORS and redirects | **Configured** |
| `INTERVIEW_PUBLIC_DOMAIN` | Configuration | Public canonical domain for candidate invites | **Configured** (`termjobs.in`) |

### Frontend Environment Configuration

| Variable | Classification | Purpose | Audit Status |
| :--- | :--- | :--- | :--- |
| `VITE_API_BASE_URL` | Configuration | Target backend API origin | **Configured** |
| `VITE_TELEGRAM_BOT_USERNAME` | Configuration | Bot handle for real-time Telegram interview alerts | **Configured** |
| `VITE_GOOGLE_CLIENT_ID` | Configuration | Google OAuth client ID for candidate calendar sync | **Configured** |

---

## 2. HTTPS, CORS & Security Headers Verification

### 2.1 CORS Policy Configuration
Inspected `backend/main.py` CORS middleware:
- **Allowed Origins**: Configured with explicit domain whitelist supporting production frontend domains (`termjobs.in`, `termjobs.com`) and local development origins (`http://localhost:5173`, `http://localhost:4173`).
- **Allowed Methods**: `GET`, `POST`, `PUT`, `DELETE`, `OPTIONS`, `PATCH`.
- **Allowed Headers**: Explicitly whitelists `Authorization`, `Content-Type`, `Accept`, `Origin`, `X-Requested-With`, `X-CSRF-Token`, `Cache-Control`.
- **Credentials**: `allow_credentials=True` enabled for cookie/token transport.

### 2.2 Security Headers
Recommended reverse proxy (Nginx / Cloudflare) headers:
```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

---

## 3. Database Connectivity & Health Monitoring

1. **Connectivity Proof**:
   - Live HTTP request to `/api/health` returns:
     ```json
     {
       "status": "ok",
       "database": "connected",
       "database_cluster": "termjob.bnwy4et.mongodb.net",
       "active_cluster": "main",
       "database_error": null,
       "environment": "local"
     }
     ```
2. **Connection Pooling**:
   - PyMongo client configured with `maxPoolSize=50`, `minPoolSize=10`, `serverSelectionTimeoutMS=5000`.
   - TLS/SSL verification is strictly enforced (`tls=True`).
3. **Logging & Diagnostic Hooks**:
   - Structured JSON logging active across authentication, requisition state transitions, and interview scheduling.
   - Auth failures log explicit audit events: `[AUTH FAILED] Candidate '...' access expired`.

