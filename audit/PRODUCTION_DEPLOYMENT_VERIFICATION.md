# Production Deployment Verification Report

**Project**: TermJobs Platform  
**Target Environment**: Production Infrastructure  
**Date**: November 2026  

---

## 1. Domain, DNS & Network Topology

### 1.1 Canonical Domains & Resolution
- **Canonical Web Domain**: `https://termjobs.in`
  - **A Record**: `216.198.79.1`
  - **Nameservers**: `ns43.domaincontrol.com`, `ns44.domaincontrol.com`
  - **TLS Protocol**: TLS 1.3 with AES-256-GCM cipher suite.
  - **HTTP Status**: Live GET request verified returning **HTTP 200 OK**.
- **Backend API Origin**: `http://localhost:8000` (Local/Vercel serverless proxy targeting production Atlas database).
- **Public Interview Links**: `INTERVIEW_PUBLIC_DOMAIN=https://termjobs.in` verified for all outbound invite links.

---

## 2. CORS & Security Architecture

### 2.1 Origin Whitelisting (`backend/main.py`)
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://termjobs.in",
        "https://www.termjobs.in",
        "http://localhost:5173",
        "http://localhost:4173",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:4173",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With", "X-CSRF-Token", "Cache-Control"],
)
```

### 2.2 Security Headers
Production edge routing enforces:
- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`

---

## 3. Health Checks & Automated Rollback Procedures

### 3.1 Production Health Check Probes
- **Liveness Probe**: `GET /api/health`
  - Validates FastAPI event loop, process memory, and database connection.
  - Response payload:
    ```json
    {
      "status": "ok",
      "database": "connected",
      "database_cluster": "termjob.bnwy4et.mongodb.net",
      "active_cluster": "main",
      "database_error": null
    }
    ```
- **Readiness Probe**: `GET /health`
  - Verifies read/write availability on the `termjobs` MongoDB catalog.

### 3.2 Automated Deployment Rollback Runbook
If an automated health probe fails post-deployment:
1. **Frontend Rollback**:
   - CDN / Vercel: Promote the previous immutable deployment hash via `vercel rollback` or Cloudflare Pages Instant Rollback.
2. **Backend Rollback**:
   - Containerized / Systemd deployment: Revert container image tag to `termjobs-backend:v{previous}`.
   - Zero database migration rollbacks required: All schema changes across Stages 1–5 are non-destructive and backward compatible.
3. **Verification**: Confirm `GET /api/health` returns status `ok`.

