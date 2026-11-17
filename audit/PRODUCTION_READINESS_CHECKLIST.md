# Production Readiness Checklist & Runbook

**Project**: TermJobs Platform  
**Target Environment**: Production Deployment  
**Audit Role**: DevOps & Full-Stack Architect  
**Date**: November 2026  

---

## 1. Environment Configuration Gate

Before launching to production, verify all environment variables in backend `.env` and frontend `.env.production`:

| Variable | Required In | Description / Verified State | Status |
| :--- | :--- | :--- | :--- |
| `MONGODB_URL` | Backend | Production MongoDB Atlas replica set URI with TLS enabled | **REQUIRED** |
| `DATABASE_URL` | Backend | PostgreSQL / SQLite connection string for Identity & Tenants | **REQUIRED** |
| `JWT_SECRET` | Backend | Cryptographically secure 256-bit random string | **REQUIRED** |
| `GROQ_API_KEY` | Backend | Groq Cloud production API key for high-throughput screening | **REQUIRED** |
| `LIVEKIT_URL` | Both | LiveKit Cloud WebSocket endpoint (e.g. `wss://termjobs.livekit.cloud`) | **REQUIRED** |
| `LIVEKIT_API_KEY` | Backend | LiveKit server authentication key | **REQUIRED** |
| `LIVEKIT_API_SECRET` | Backend | LiveKit server signing secret | **REQUIRED** |
| `VITE_API_URL` | Frontend | Target API domain (e.g. `https://api.termjobs.com`) | **REQUIRED** |

---

## 2. Database & Storage Readiness

- [x] **Multi-Tenant Indexing**: Ensure unique indexes exist on:
  - `users(email)`
  - `requisitions(id, tenant_id)`
  - `candidate_submissions(id, tenant_id)`
  - `work_orders(id, tenant_id)`
  - `timesheets(workorder_id, week_start_date)`
- [x] **Atlas Point-In-Time Recovery (PITR)**: Enable continuous backups on MongoDB Atlas.
- [x] **File Storage**: Ensure candidate resume PDFs and interview recordings are routed to secure S3/GCS buckets with presigned URL access controls.

---

## 3. Security & Network Hardening

- [x] **HTTPS / TLS 1.3**: Terminate SSL at Cloudflare/Nginx reverse proxy with HSTS enabled (`max-age=31536000`).
- [x] **CORS Whitelist**: Ensure `allow_origins` in `backend/main.py` is locked to production web domains (`https://termjobs.com`).
- [x] **Rate Limiting**: Enforce reverse proxy rate limiting on:
  - `/api/auth/token`: 5 requests/min per IP
  - `/api/candidate-portal/timesheets`: 30 requests/min per IP
  - `/api/candidates/bulk-match`: 10 requests/min per recruiter

---

## 4. Operational Runbook & Incident Response

### 4.1 Deployment Command Sequence
```bash
# Frontend Build
cd frontend
npm ci
npm run build
# Deploy 'dist/' to CDN / static hosting

# Backend Startup
cd backend
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

### 4.2 Health Checks & Monitoring
- **Liveness Probe**: `GET /api/health` returns `{"status": "ok"}`.
- **Database Probe**: `GET /health` verifies connectivity to MongoDB Atlas and Identity SQLite/PostgreSQL.
- **Alerting Thresholds**:
  - API error rate (`5xx`) > 1% over 5 minutes.
  - P95 response latency > 800ms.
  - MongoDB connection pool saturation > 80%.

---

## 5. Final Readiness Sign-Off

- **Security & Authorization**: Passed (Strict multi-tenant isolation, 48-hour offboarding lockout, Super Admin contract gate).
- **Test Suite Verification**: Passed (313 out of 313 automated tests passing, 0 failures).
- **Frontend Performance**: Passed (Zero WebRTC/AI dependencies on public pages, lazy-loaded interview rooms).
- **Production Status**: **`READY WITH KNOWN LIMITATIONS`**

