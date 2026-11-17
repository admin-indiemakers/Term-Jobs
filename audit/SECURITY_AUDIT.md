# Security & Authorization Audit

**Project**: TermJobs Platform  
**Target Environment**: Production Hardening  
**Audit Role**: Application Security Engineer  
**Date**: November 2026  

---

## 1. Authentication & Role-Based Access Control (RBAC)

The TermJobs platform enforces strict role-based authorization at the API layer. Frontend navigation guards are treated purely as UX enhancements; every privileged endpoint independently verifies the authenticated caller's identity and role via JWT tokens.

### Role Hierarchy & Access Matrix

| Role | Permitted Route Scope | Authorization Enforcement Mechanism |
| :--- | :--- | :--- |
| **Anonymous / Public** | Public landing, job discovery, role details, candidate sign-in/up | Public endpoints; non-privileged read-only filters |
| **Candidate** | Candidate portal, profile, timesheets, attendance, assigned interviews | `get_current_user` + `role == "Candidate"` + candidate identity binding |
| **Hiring Manager** | Requisition intake, candidate review, feedback, manager interviews | `get_current_user` + `role == "Hiring Manager"` + tenant scoping |
| **Director** | Requisition approval, rate exception sign-off, workforce overview | `get_current_user` + `role in ("Director", "Admin")` |
| **Recruiter / Agency** | Candidate bank, resume uploading, bulk AI matching, submission | `get_current_user` + `role == "Recruiter"` + agency tenant isolation |
| **Super Admin** | Platform requisitions, contract issuance, tenant provisioning | `require_superadmin` dependency (`user.role == "Super Admin"`) |

---

## 2. Multi-Tenant Scoping & IDOR Prevention

### 2.1 Requisition & Candidate Isolation
- All MongoDB queries on `requisitions`, `candidate_submissions`, and `work_orders` strictly include `{ "tenant_id": current_user.tenant_id }` unless the caller possesses verified `Super Admin` privileges.
- Requisition viewing by external vendors/recruiter agencies filters candidates by `vendor_company_name` or requisition association, preventing horizontal privilege escalation across competitors.

### 2.2 Candidate Portal Work Order Isolation
In `modules/candidate_portal/router.py`:
```python
cand_id = current_user.workorder_id or current_user.candidate_id or ""
exact_conditions = [{key: cand_id} for key in ("workorder_id", "candidate_id", "id", "work_order_number")]
exact = list(wo_coll.find({**tenant_filter, "$or": exact_conditions}))
```
- Candidates cannot inspect other candidates' work orders, pay rates, or timesheets.
- Direct IDOR queries with modified candidate IDs return `HTTP 403 Forbidden` or `HTTP 404 Not Found`.

---

## 3. Offboarding & Account Expiration Security

The candidate offboarding lifecycle enforces automated account termination:
1. **48-Hour Grace Period**: When offboarding is initiated or completed, an `access_expires_at` timestamp is set to `now + 48 hours`.
2. **Immediate Timesheet Freezing**: `timesheet_frozen: True` is enforced upon offboarding completion. Any draft creation or submission attempt raises `HTTP 400 Bad Request` ("Timesheet is frozen").
3. **Automated Expiration Lockout**: Upon expiration, `login_user` evaluates the timestamp:
   ```python
   if access_expires_at and datetime.fromisoformat(access_expires_at) < now:
       raise HTTPException(status_code=403, detail="Candidate access has expired.")
   ```
4. **Email Archival & Contract Gate on Re-Provisioning**:
   - The offboarded account's email is archived (`offboarded_<timestamp>_<email>`), freeing the corporate email address.
   - Re-provisioning an account with the same email address requires a signed contract issued by the Super Admin (`require_issued_contract`); unauthorized reactivation is blocked with `HTTP 409 Conflict`.

---

## 4. Media & Hardware Permission Privacy

1. **Hardware LED Deactivation**:
   - In `useInterviewMedia.js`, when a participant leaves an interview or toggles the camera off, `track.stop()` is explicitly called on all local video tracks. This physically powers down the camera sensor and extinguishes device hardware indicator LEDs.
2. **Separate Consent**:
   - Microphone and camera permissions are requested independently. Candidates may complete audio-only evaluations without granting webcam access.
3. **No Unintentional Media Streaming**:
   - LiveKit tokens are generated on-demand with restricted room-name claims and 2-hour TTLs, preventing room hijacking or replay attacks.

---

## 5. Security Recommendations for Production
1. **JWT Secret Rotation**: Rotate `JWT_SECRET` via KMS/secret manager every 90 days.
2. **Rate Limiting**: Enforce nginx/Cloudflare rate-limiting on `/api/auth/token` and `/candidate/login` (max 5 failed attempts per IP per 15 minutes) to protect against credential stuffing.
3. **CORS Policy**: Restrict `allow_origins` in `main.py` to production domains before public deployment.

