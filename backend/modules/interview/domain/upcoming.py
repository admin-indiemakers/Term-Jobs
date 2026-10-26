"""Select upcoming persisted interview schedules using their local timezone."""
from datetime import datetime, time
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


def upcoming_interviews(rows, now, limit=4):
    scheduled = []
    for row in rows:
        if not row.get('id') or not row.get('candidate_submission_id'):
            continue
        try:
            zone = ZoneInfo(row.get('scheduled_timezone') or 'Asia/Kolkata')
            day = datetime.fromisoformat(str(row.get('scheduled_date') or '')[:10]).date()
            raw_time = str(row.get('scheduled_time') or '').strip()
            if raw_time:
                try:
                    clock = time.fromisoformat(raw_time)
                except ValueError:
                    clock = datetime.strptime(raw_time.upper(), '%I:%M %p').time()
                starts = datetime.combine(day, clock, zone)
                if starts < now:
                    continue
            else:
                if day < now.astimezone(zone).date():
                    continue
                starts = datetime.combine(day, time.min, zone)
        except (ValueError, TypeError, ZoneInfoNotFoundError):
            continue
        scheduled.append((starts, str(row['id']), row))
    scheduled.sort(key=lambda item: (item[0], item[1]))
    return [row for _, _, row in scheduled[:limit]]
