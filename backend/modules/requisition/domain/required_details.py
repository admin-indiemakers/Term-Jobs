"""Required company details for publishing a hiring requisition."""

REQUIRED_REQUISITION_DETAILS = (
    ("department", "Department"),
    ("location", "Work location"),
    ("experience_level", "Required experience"),
    ("hiring_model", "Hiring model"),
    ("target_start_date", "Target start date"),
    ("skills", "Required skills"),
    ("submission_deadline", "Application due date"),
    ("work_mode", "Work mode (On-site, Hybrid, or Remote)"),
)


def missing_requisition_details(values: dict | None) -> list[str]:
    values = values or {}
    missing = []
    for key, label in REQUIRED_REQUISITION_DETAILS:
        value = values.get(key)
        if isinstance(value, (list, tuple, set)):
            present = any(str(item).strip() and str(item).strip().lower() not in {"to be confirmed", "tbd"} for item in value)
        else:
            present = bool(str(value or "").strip()) and str(value).strip().lower() not in {"to be confirmed", "tbd", "n/a", "none"}
        if key == "work_mode":
            present = valid_work_mode(value)
        if not present:
            missing.append(label)
    return missing


def valid_work_mode(value) -> bool:
    return isinstance(value, str) and value.strip().lower() in {"on-site", "on site", "onsite", "hybrid", "remote"}
