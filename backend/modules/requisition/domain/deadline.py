from datetime import date, datetime
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
