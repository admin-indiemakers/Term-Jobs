from datetime import datetime, timezone
from modules.interview.domain.upcoming import upcoming_interviews


def row(identity, day, clock, zone='Asia/Kolkata'):
    return {'id': identity, 'candidate_submission_id': 'candidate', 'scheduled_date': day,
            'scheduled_time': clock, 'scheduled_timezone': zone}


def test_excludes_past_slots_and_returns_four_soonest_in_actual_time_order():
    now = datetime(2026, 10, 22, 8, tzinfo=timezone.utc)
    rows = [row('past', '2026-10-17', '12:30'), row('earlier-today', '2026-10-22', '13:00'),
            row('next', '2026-10-22', '02:00 PM'), row('later', '2026-10-22', '15:00'),
            row('tomorrow', '2026-10-23', '09:00'), row('fourth', '2026-10-24', '09:00'),
            row('fifth', '2026-10-25', '09:00'), row('invalid', 'bad-date', '09:00')]
    assert [r['id'] for r in upcoming_interviews(list(reversed(rows)), now)] == ['next', 'later', 'tomorrow', 'fourth']


def test_timezone_boundaries_and_invalid_or_unlinked_schedules():
    now = datetime(2026, 10, 22, 1, tzinfo=timezone.utc)
    rows = [row('west', '2026-10-21', '19:00', 'America/Los_Angeles'),
            row('india-past', '2026-10-22', '06:00'),
            row('invalid-zone', '2026-10-23', '12:00', 'Invalid/Zone'),
            {**row('unlinked', '2026-10-23', '12:00'), 'candidate_submission_id': None}]
    assert [r['id'] for r in upcoming_interviews(rows, now)] == ['west']
