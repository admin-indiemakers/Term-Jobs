"""Required company details for publishing a hiring requisition."""

REQUIRED_REQUISITION_DETAILS = (
    ("department", "Department"),
    ("location", "Work location"),
    ("experience_level", "Required experience"),
    ("hiring_model", "Hiring model"),
    ("target_start_date", "Target start date"),
    ("skills", "Required skills"),
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
        if not present:
            missing.append(label)
    return missing
