# Codebase Fixes & Hardening Changes

**Project**: TermJobs Platform  
**Target Environment**: Stage 3 Hardening  
**Date**: November 2026  

---

## 1. Candidate Portal & Attendance Endpoint Hardening

### File: `backend/modules/candidate_portal/router.py`

#### 1.1 Direct Function Call Parameter Handling in Attendance
- **Issue**: Direct Python calls to `get_candidate_attendance(current_user=user)` without FastAPI dependency injection passed `month: Query(None)` as an instance of `fastapi.params.Query`, triggering a `TypeError` when evaluated by regex.
- **Fix**: Replaced raw truthiness check with type-aware string validation:
```python
# Before:
target_month = month or current_month_str

# After:
target_month = month if isinstance(month, str) and month else current_month_str
```

#### 1.2 Work Order Sanitization
- **Issue**: Dashboard consumers and tests expected explicit `"status": "ACTIVE"` in the sanitized work order dictionary.
- **Fix**: Enforced that `status` and `is_active` are consistently populated in `_sanitize_work_order_for_candidate`:
```python
"status": "ACTIVE" if is_active else (curr_status or "Pending Director Approval"),
"agreement_status": ag_status or ("Approved" if is_active else "Pending Director Approval"),
"is_active": is_active,
```

---

## 2. Requisition Publishing Mock LLM Gate

### File: `backend/modules/requisition/llm/mock.py`
- **Issue**: Requisition publishing service strictly requires `work_mode` (`On-site`, `Hybrid`, `Remote`). In mock/offline LLM environments, `MockLLM._structured_role` omitted `work_mode`, causing 8 backend test failures.
- **Fix**: Added automated extraction and fallback in `_structured_role`:
```python
# Resolve work_mode from raw text or fallback to Hybrid
work_mode = "Hybrid"
if re.search(r"\b(remote|work from home)\b", text, re.I):
    work_mode = "Remote"
elif re.search(r"\b(on-?site|in-?office)\b", text, re.I):
    work_mode = "On-site"
data["work_mode"] = work_mode
```

---

## 3. Frontend Interview Test & Regex Hardening

### File: `frontend/tests/interview-speech.test.mjs`
- **Issue**: Source code stripping regex `import .*?;\n` failed on Windows environments with CRLF line endings (`\r\n`), throwing `SyntaxError: Cannot use import statement outside a module`.
- **Fix**: Updated regex to match multiline imports with optional carriage returns:
```javascript
// Before:
cleanCode = cleanCode.replace(/^import .*?;\n/gm, '');

// After:
cleanCode = cleanCode.replace(/import\s+[\s\S]*?;\r?\n/g, '');
```

---

## 4. Upcoming Interviews Filter Robustness

### File: `frontend/src/interview/utils/upcomingInterviews.js`
- **Issue**: `hasReqFilter` checked `requisitions.length > 0`. When an empty company requisition array (`[]`) was passed, the filter was bypassed, erroneously returning rounds from other companies.
- **Fix**: Updated to `Array.isArray(requisitions)` so an empty company list correctly filters out all requisitions.

---

## 5. Interview Recording Integrity Check

### File: `frontend/src/interview/utils/recording.js`
- **Issue**: `finalizeRecording` lacked an explicit guard against zero-length recording blobs, allowing corrupted or empty WebM recordings to pass as valid submissions.
- **Fix**: Re-established explicit rejection when `!blob.size` is encountered, while preserving the graceful user fallback in `AiInterviewStage.jsx`.

---

## 6. Candidate Fixtures & Contract Requirement Seeding

### Files: `backend/tests/candidate/test_candidate_portal.py` & `test_offboarding_workflow.py`
- **Issue**: Test fixtures inserted work orders, onboarding checklists, and timesheets without `tenant_id`, causing tenant-scoped queries to return empty lists. Furthermore, email re-use tests lacked Super Admin contract prerequisites.
- **Fix**:
  - Bound all fixture records to `tenant.id`.
  - Added timesheet cleanup in test fixtures to eliminate state pollution across runs.
  - Dynamically resolved expense dates relative to current UTC time.
  - Seeded Super Admin requisition, submission, and offer letter in `test_offboarding_workflow.py` to satisfy `require_issued_contract`.

