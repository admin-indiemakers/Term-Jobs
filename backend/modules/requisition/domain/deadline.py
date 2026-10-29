from datetime import date, datetime
import re
from zoneinfo import ZoneInfo


def validate_submission_deadline(value, today: date | None = None) -> None:
    """Validate supplied deadlines using the application's Indian calendar day."""
    if value is None or value == "":
        return
    try:
        if not isinstance(value, str) or len(value) != 10:
            raise ValueError
        deadline = date.fromisoformat(value)
    except ValueError:
        raise ValueError("Submission Deadline must be a valid date in YYYY-MM-DD format.") from None
    today = today or datetime.now(ZoneInfo("Asia/Kolkata")).date()
    if deadline < today:
        raise ValueError("Submission Deadline cannot be in the past. Choose today or a future date.")


def submission_deadline_passed(role: dict | None, today: date | None = None) -> bool:
    """A date-only deadline includes that entire calendar day in India."""
    today = today or datetime.now(ZoneInfo('Asia/Kolkata')).date()
    value = (role or {}).get('submission_deadline')
    if not value:
        return False
    try:
        return date.fromisoformat(str(value)[:10]) < today
    except (ValueError, TypeError):
        return False


def validate_start_date(value, today: date | None = None) -> None:
    """New requisitions may start today or later in the application timezone."""
    month_value = None
    if isinstance(value, str):
        normalized = value.strip()
        if re.fullmatch(r"\d{4}-\d{2}", normalized):
            year, month = map(int, normalized.split("-"))
            month_value = (year, month)
        else:
            for fmt in ("%B %Y", "%b %Y"):
                try:
                    parsed = datetime.strptime(normalized, fmt)
                    month_value = (parsed.year, parsed.month)
                    break
                except ValueError:
                    continue
    if month_value:
        year, month = month_value
        try:
            start_month = date(year, month, 1)
        except ValueError:
            raise ValueError("Start Date must be a valid date or month and year.") from None
        today = today or datetime.now(ZoneInfo("Asia/Kolkata")).date()
        if (start_month.year, start_month.month) < (today.year, today.month):
            raise ValueError("Start Date cannot be in the past. Choose the current or a future month.")
        return
    try:
        validate_submission_deadline(value, today=today)
    except ValueError as error:
        raise ValueError(str(error).replace("Submission Deadline", "Start Date")) from None
