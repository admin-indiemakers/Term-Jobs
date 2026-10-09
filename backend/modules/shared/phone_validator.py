"""
Shared mobile phone validation utility for TermJob backend.
Validates:
- Non-empty requirement if required=True
- Only allowed characters (+, digits, spaces, -, (, ), .)
- Digits count:
    - Domestic / no '+': exactly 10 digits
    - International / with '+': between 10 and 15 digits
"""
import re


def validate_phone_number(phone: str | None, required: bool = True) -> str | None:
    """
    Validates mobile phone number.
    Returns error message string if invalid, or None if valid.
    """
    if not phone or not str(phone).strip():
        if required:
            return "Phone number is required."
        return None

    cleaned = str(phone).strip()

    if not re.match(r"^\+?[0-9\s\-().]+$", cleaned):
        return "Please enter a valid mobile number (digits and standard formatting only)."

    digits = re.sub(r"\D", "", cleaned)

    if cleaned.startswith("+"):
        if len(digits) < 10:
            return "Mobile number must be at least 10 digits."
        if len(digits) > 15:
            return "Mobile number cannot exceed 15 digits."
    else:
        if len(digits) < 10:
            return "Mobile number must be at least 10 digits."
        if len(digits) > 10:
            return "Mobile number cannot exceed 10 digits (use + for country code)."

    return None
