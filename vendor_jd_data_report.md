# Database Verification & Vendor JD Exposure Analysis Report

This report presents the findings from verifying the MongoDB database (`termjobs` database, `requisitions` collection) and analyzing how Job Descriptions (JDs) are transmitted to vendor recruiters.

---

## 1. Summary of Published Requisitions in Database

There are currently **two (2) published requisitions** in the database. Below is the detailed breakdown of the values stored in the database for each requisition.

### Requisition 1: Senior Frontend Engineer
* **Requisition ID:** `6d9aee14-5d51-4033-911e-7b713b194519` (MongoDB `_id`: `66bc7f0367eb7422941b2123`)
* **Status:** `Published`
* **Created By:** `admin`
* **Company Profile ID:** `fb671192-35db-44bc-9a10-21a4153ca266`
* **Structured Commercials:**
  * **Vendor-Visible Range:** `$90,000 - $110,000` (`[90000, 110000]`)
  * **Internal Budget Ceiling (Confidential):** `$120,000` (`120000`)
* **Generated JD Markdown:**
  ```markdown
  # Senior Frontend Engineer

  ## Overview
  We are looking for a Senior Frontend Engineer to join our team. The ideal candidate will have 5+ years of experience building responsive, performant user interfaces using React, TypeScript, and TailwindCSS.

  ## Details
  - **Role Type**: Contractor
  - **Location**: Remote (Office: Bangalore)
  - **Target Hire Date**: 2026-09-01
  - **Submission Deadline**: 2026-08-31

  ## Requirements
  ### Must Have
  - React
  - TypeScript
  - TailwindCSS

  ### Nice to Have
  - Next.js
  - GraphQL
  - Testing Library

  ## Benefits
  - BYOD Laptop Policy with $1000 allowance

  ## Rate
  - $90,000 - $110,000 per year
  ```

---

### Requisition 2: Senior Python Developer
* **Requisition ID:** `7f8a9b1c-2d3e-4f5a-6b7c-8d9e0f1a2b3c` (MongoDB `_id`: `66bc7f3e67eb7422941b2128`)
* **Status:** `Published`
* **Created By:** `admin`
* **Company Profile ID:** `fb671192-35db-44bc-9a10-21a4153ca266`
* **Structured Commercials:**
  * **Vendor-Visible Range:** `$120,000 - $140,000` (`[120000, 140000]`)
  * **Internal Budget Ceiling (Confidential):** `$150,000` (`150000`)
* **Generated JD Markdown:**
  ```markdown
  # Senior Python Developer

  ## Overview
  We are looking for a Senior Python Developer with 7+ years of experience. The ideal candidate will have strong expertise in building APIs using FastAPI and working with PostgreSQL databases.

  ## Details
  - **Role Type**: Contractor
  - **Location**: Hybrid (Office: Bangalore)
  - **Target Hire Date**: 2026-09-15
  - **Submission Deadline**: 2026-09-10

  ## Requirements
  ### Must Have
  - Python
  - FastAPI
  - PostgreSQL

  ### Nice to Have
  - Docker
  - AWS
  - Redis

  ## Benefits
  - Company Provided Laptop

  ## Rate
  - $120,000 - $140,000 per year
  ```

---

## 2. Critical Analysis: What the Vendor *Actually* Receives

### ⚠️ Security Vulnerability / Data Leak Detected
While the `generated_jd_markdown` only displays the vendor-visible rate band, the **FastAPI backend API is leaking the internal budget ceiling (`ceiling_internal`) to the vendor**.

Here is why:

1. **Dead Code:** In `backend/main.py` (lines 172-180), a helper function `_strip_internal_role` and `INTERNAL_ROLE_KEYS` are defined:
   ```python
   INTERNAL_ROLE_KEYS = {
       "ceiling_internal",
       "rate_card_cap",
       "total_engagement_value",
       "cost_centre",
       "budget_approved",
       "budget_reference",
       "variance_approved",
   }

   def _strip_internal_role(role: Any) -> Any:
       if not isinstance(role, dict):
           return role
       return {k: v for k, v in role.items() if k not in INTERNAL_ROLE_KEYS}
   ```
   However, this helper function is **never called** in any of the route handlers.
2. **Raw Database Expsoure:** The route handlers `GET /requisitions` (lines 612-655) and `GET /requisitions/{requisition_id}` (lines 658-666) serialize and return the database documents directly:
   ```python
   # inside list_requisitions:
   return [
       {
           ...
           "structured_role": r.structured_role,
           ...
       }
       for r in rows
   ]
   ```
   Because `_strip_internal_role` is omitted, the entire `structured_role` JSON block is returned to the client.
3. **Double Bug (Nested Property bypass):** Even if `_strip_internal_role` were called on `structured_role`, it would check keys at the top level of `structured_role`. But `ceiling_internal` is a nested key under `structured_role.commercials.ceiling_internal`. Since the helper function only checks top-level keys, it wouldn't strip it anyway unless it was modified to recurse or target `commercials`.

### Direct Impact
* A vendor logged in with a `"Recruiter"` role can view the internal budget/ceiling (e.g. `$120,000` or `$150,000`) by calling the requisition details endpoint and inspecting the API response payload under `structured_role.commercials.ceiling_internal`.
* This exposes the client's upper negotiation bounds to the consultancy, giving them a commercial advantage.

---

## 3. Recommended Remediation Plan

To fix this security vulnerability, the FastAPI application should correctly strip internal keys before returning responses.

### Target: `backend/main.py`

Modify `_strip_internal_role` (or replace how responses are filtered) so that it recursively sanitizes nested structures:

```python
def sanitize_vendor_facing_role(structured_role: dict | None) -> dict | None:
    if not structured_role or not isinstance(structured_role, dict):
        return structured_role
    
    # Deep copy to avoid mutating cache / session object
    import copy
    clean_role = copy.deepcopy(structured_role)
    
    # Clean commercials sub-dictionary
    if "commercials" in clean_role and isinstance(clean_role["commercials"], dict):
        for key in list(clean_role["commercials"].keys()):
            if key in INTERNAL_ROLE_KEYS:
                del clean_role["commercials"][key]
                
    # Clean any other top-level or sub-level internal keys
    for key in list(clean_role.keys()):
        if key in INTERNAL_ROLE_KEYS:
            del clean_role[key]
            
    return clean_role
```

Then, apply this sanitization in `_requisition_dict` and `list_requisitions` when the request is made by a vendor (`for_vendor=True`):

```python
# In _requisition_dict:
"structured_role": sanitize_vendor_facing_role(req.structured_role) if for_vendor else req.structured_role,
```
