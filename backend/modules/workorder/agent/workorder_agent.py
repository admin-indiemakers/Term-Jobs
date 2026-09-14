from datetime import datetime, timedelta, timezone


def generate_autofill_workorder(candidate_data: dict, requisition_data: dict) -> dict:
    """AI Master Services Agreement (MSA) Agent: Synthesizes candidate & requisition details to auto-generate an MSA.
    
    Strictly incorporates vendor_visible_floor & vendor_visible_cap from the requisition.
    """
    # 1. Extract Vendor Visible Rate Floor & Cap
    floor = requisition_data.get("vendor_visible_floor") or requisition_data.get("budget_min")
    cap = requisition_data.get("vendor_visible_cap") or requisition_data.get("budget_max")
    
    # Try parsing prefill / intake metadata if not found directly
    intake = requisition_data.get("intake_meta") or {}
    prefill = intake.get("prefill") or {}
    if not floor:
        floor = prefill.get("vendor_visible_floor") or prefill.get("budget_min")
    if not cap:
        cap = prefill.get("vendor_visible_cap") or prefill.get("budget_max")

    try:
        floor = float(floor) if floor is not None else 120000.0
    except (ValueError, TypeError):
        floor = 120000.0

    try:
        cap = float(cap) if cap is not None else 180000.0
    except (ValueError, TypeError):
        cap = 180000.0

    if cap < floor:
        cap = floor * 1.25

    # 2. Derive Billing Rate within [floor, cap] based on match score / experience
    match_score = candidate_data.get("match_score") or 85.0
    try:
        match_score = float(match_score)
    except (ValueError, TypeError):
        match_score = 85.0

    # Scale rate within the vendor visible range according to match score
    ratio = min(max((match_score - 60.0) / 40.0, 0.2), 0.95)
    calculated_rate = round(floor + (cap - floor) * ratio, -2)

    # 3. Contract Timeline (Start Date = 10 days from today, Duration = 6 months)
    today = datetime.now(timezone.utc)
    start_dt = today + timedelta(days=10)
    duration_months = requisition_data.get("duration_months") or 6
    try:
        duration_months = int(duration_months)
    except (ValueError, TypeError):
        duration_months = 6

    end_dt = start_dt + timedelta(days=30 * duration_months)

    start_date_str = start_dt.strftime("%Y-%m-%d")
    end_date_str = end_dt.strftime("%Y-%m-%d")

    # 4. Scope of Services & Deliverables (Summarized from JD or role title)
    title = requisition_data.get("title") or candidate_data.get("requisition_title") or "Contract Professional"
    jd_summary = requisition_data.get("generated_jd_markdown") or ""
    
    bullets = [
        f"Design, build, and execute master technical services for the {title} project engagement.",
        "Collaborate with the engineering team, participate in architecture reviews and sprint deliverables.",
        "Ensure full compliance with client security standards, maintain code test coverage, and documentation."
    ]
    if jd_summary and len(jd_summary) > 50:
        cleaned_jd = jd_summary[:300].replace('#', '').strip()
        bullets[0] = f"Key Services Scope: {cleaned_jd}..."

    scope_text = "\n• " + "\n• ".join(bullets)

    # 5. Master Services Agreement Commercial Terms & Clauses
    special_terms = (
        "1. Master Services Agreement (MSA) Governing Terms: Standard commercial terms apply.\n"
        "2. Billing Cycle: Monthly invoice generation based on verified service delivery.\n"
        "3. Payment Terms: NET 30 from invoice receipt date.\n"
        "4. Confidentiality & IP: Strict Non-Disclosure (NDA) & client IP assignment apply upon execution.\n"
        "5. Notice Period: 14 calendar days written notice by either party for early agreement termination.\n"
        f"6. Vendor Visible Rate Range: ₹{floor:,.0f} - ₹{cap:,.0f} / month."
    )

    # 6. Reasoning Summary
    ai_reasoning = (
        f"AI MSA Agent analyzed candidate '{candidate_data.get('candidate_name', 'Candidate')}' (Match Score: {match_score:.1f}%) "
        f"against requisition '{title}'. Recommended billing rate set to ₹{calculated_rate:,.0f}/month within the "
        f"Vendor Visible Floor (₹{floor:,.0f}) and Vendor Visible Cap (₹{cap:,.0f}). "
        f"Master Services Agreement timeline set for {duration_months} months starting {start_date_str}."
    )

    return {
        "candidate_id": candidate_data.get("id") or candidate_data.get("candidate_id"),
        "candidate_name": candidate_data.get("candidate_name") or candidate_data.get("name") or "Candidate",
        "candidate_email": candidate_data.get("candidate_email") or "",
        "candidate_phone": candidate_data.get("candidate_phone") or "",
        "requisition_id": requisition_data.get("id") or candidate_data.get("requisition_id"),
        "requisition_ref": candidate_data.get("requisition_ref") or f"REQ-{str(requisition_data.get('id', ''))[:6].upper()}",
        "vendor_name": candidate_data.get("vendor_name") or "Vendor",
        "company_name": candidate_data.get("company_name") or requisition_data.get("company_name") or "Client Organization",
        "hiring_manager_name": candidate_data.get("hiring_manager_name") or "Hiring Manager",
        "job_title": title,
        "work_location": requisition_data.get("location") or "Remote",
        "start_date": start_date_str,
        "end_date": end_date_str,
        "contract_duration_months": duration_months,
        "billing_rate": float(calculated_rate),
        "rate_type": "monthly",
        "currency": "INR",
        "vendor_visible_floor": float(floor),
        "vendor_visible_cap": float(cap),
        "billing_cycle": "Monthly",
        "payment_terms": "NET 30",
        "scope_of_work": scope_text,
        "special_terms": special_terms,
        "ai_generated": True,
        "ai_reasoning": ai_reasoning,
    }
