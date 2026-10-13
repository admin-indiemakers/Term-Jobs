"""Ground-truth calendar replies; no model call is needed to answer today's schedule."""
import re
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from types import SimpleNamespace
from urllib.parse import urlparse
from .google_calendar import connection_status, list_calendar_events, check_availability, CalendarUnavailable


def calendar_range(user, timeframe='upcoming', now=None):
    status = connection_status(user)
    zone = ZoneInfo(status['timezone'])
    now = (now or datetime.now(zone)).astimezone(zone)
    midnight = now.replace(hour=0, minute=0, second=0, microsecond=0)
    if timeframe == 'today': return midnight, midnight + timedelta(days=1), status
    if timeframe == 'tomorrow': return midnight + timedelta(days=1), midnight + timedelta(days=2), status
    if re.fullmatch(r'\d{4}-\d{2}-\d{2}', timeframe):
        start = datetime.strptime(timeframe, '%Y-%m-%d').replace(tzinfo=zone)
        return start, start + timedelta(days=1), status
    return now, now + timedelta(days=7), status


def normalized_events(user, timeframe='upcoming', interviews_only=False, now=None):
    start, end, status = calendar_range(user, timeframe, now)
    rows = []
    for event in list_calendar_events(user, start, end):
        is_interview = bool((event.get('extendedProperties') or {}).get('private', {}).get('termjobs_round_id')) or '/interview/' in event.get('location', '') or 'interview' in event.get('summary', '').lower()
        if interviews_only and not is_interview: continue
        begin = event.get('start') or {}
        instant = begin.get('dateTime')
        timestamp = datetime.fromisoformat(instant.replace('Z', '+00:00')).astimezone(start.tzinfo) if instant else None
        location = event.get('location') or ''
        link = location if urlparse(location).scheme == 'https' else event.get('htmlLink') or ''
        rows.append({'id': event['id'], 'title': event.get('summary') or 'Untitled meeting',
                     'date': timestamp.date().isoformat() if timestamp else begin.get('date'),
                     'time': timestamp.strftime('%H:%M') if timestamp else 'All day',
                     'timezone': status['timezone'], 'meeting_link': link, 'status': event.get('status') or 'confirmed'})
    return rows, status


def schedule_reply(user, timeframe='upcoming', interviews_only=False, now=None):
    label = 'interviews' if interviews_only else 'meetings'
    period = 'in the next 7 days' if timeframe == 'upcoming' else timeframe
    try:
        rows, status = normalized_events(user, timeframe, interviews_only, now)
    except ValueError as exc:
        return {'reply': str(exc), 'executed_actions': []}
    if not rows:
        reply = f"No {label} found for {period} in your connected Google Calendar ({status['email']}, {status['timezone']})."
    else:
        reply = f"Your {label} for {period} — Google Calendar, {status['timezone']}:\n\n| Meeting | Date | Time |\n|---|---|---|\n"
        for row in rows:
            title = row['title'].replace('|', '\\|').replace('\n', ' ')
            reply += f"| {title} | {row['date']} | {row['time']} |\n"
    return {'reply': reply, 'executed_actions': [{'tool': 'list_scheduled_interviews', 'result': rows}]}


def contextual_candidate(prompt, user, history):
    """Resolve names only among applications to the actor's authorized requisitions."""
    from modules.shared.db import db, get_session
    from modules.requisition.domain.models import Requisition
    with get_session() as session:
        query = session.query(Requisition).filter(Requisition.tenant_id == user.tenant_id)
        if user.role == 'Hiring Manager':
            query = query.filter(Requisition.created_by == user.id)
        ids = [req.id for req in query.all()]
    candidates = list(db['candidate_submissions'].find({'requisition_id': {'$in': ids}}))
    explicit = re.search(r'\b(?:with|for)\s+(.+?)(?=\s+(?:today|tomorrow|on|at|for\s+\d+)\b|[?!]|$)', prompt, re.I)
    requested = explicit.group(1).strip() if explicit else ''
    contexts = [prompt]
    if not requested or requested.lower() in ('him', 'her', 'them', 'this candidate'):
        contexts.extend(str(item.get('text') or item.get('content') or '') for item in reversed(history or []) if isinstance(item, dict))
    for context in contexts:
        matches = [c for c in candidates if c.get('candidate_name') and re.search(r'(?<!\w)' + re.escape(c['candidate_name']) + r'(?!\w)', context, re.I)]
        if len(matches) == 1:
            return matches[0]
        if len(matches) > 1:
            return None
    if requested and requested.lower() not in ('him', 'her', 'them', 'this candidate'):
        matches = [c for c in candidates if requested.casefold() in (str(c.get('id') or '').casefold(), str(c.get('candidate_email') or '').casefold()) or (c.get('candidate_name') and c['candidate_name'].casefold().startswith(requested.casefold() + ' '))]
        if len(matches) == 1:
            return matches[0]
        if len(matches) > 1:
            return None
        # A draft may refer to a named portal prospect before an application exists.
        # Dispatch still validates the application and requisition on the server.
        return {'candidate_name': requested, 'application_required': True}
    if not requested or requested.lower() in ('him', 'her', 'them', 'this candidate'):
        for item in reversed(history or []):
            if not isinstance(item, dict) or item.get('role') != 'user':
                continue
            previous = str(item.get('content') or item.get('text') or '')
            if re.search(r'\binterview\b', previous, re.I):
                named = re.search(r'\b(?:with|for)\s+(.+?)(?=\s+(?:today|tomorrow|on|at)\b|[?!]|$)', previous, re.I)
                if named and named.group(1).strip().lower() not in ('him', 'her', 'them', 'this candidate'):
                    return {'candidate_name': named.group(1).strip(), 'application_required': True}
    return None


def interview_proposal(prompt, user, history):
    candidate = contextual_candidate(prompt, user, history)
    if not candidate:
        return {'reply': 'Please specify one candidate name or application before scheduling the interview.', 'executed_actions': []}
    status = connection_status(user)
    text = prompt.lower()
    now = datetime.now(ZoneInfo(status['timezone']))
    date = re.search(r'\b\d{4}-\d{2}-\d{2}\b', text)
    day = date.group() if date else (now + timedelta(days=1)).date().isoformat() if 'tomorrow' in text else now.date().isoformat() if 'today' in text else ''
    clock = re.search(r'\b(1[0-2]|[1-9])(?::([0-5]\d))?\s*(am|pm)\b', text)
    military = re.search(r'\b(?:[01]\d|2[0-3]):[0-5]\d\b', text)
    time_value = f"{int(clock.group(1)) % 12 + (12 if clock.group(3) == 'pm' else 0):02d}:{clock.group(2) or '00'}" if clock else military.group() if military else ''
    duration = re.search(r'(\d+)\s*(?:minutes|mins)', text)
    minutes = int(duration.group(1)) if duration else 45
    proposal = {'candidate': candidate['candidate_name'], 'candidate_submission_id': candidate.get('id') or candidate.get('submission_id'),
                'requisition_id': candidate.get('requisition_id'), 'proposed_date': day, 'proposed_time': time_value,
                'scheduled_timezone': status['timezone'], 'duration_minutes': minutes, 'interview_type': 'Technical Round'}
    reply = 'Review the interview details below, then dispatch the invitation.'
    if candidate.get('application_required'):
        reply += ' This candidate must have an application in your requisitions before the invitation can be dispatched.'
    if day and time_value:
        try:
            availability = check_availability(user, day, time_value, status['timezone'], minutes)
            reply = ('The requested slot is free. ' if availability['available'] else 'The requested slot conflicts with another meeting. Choose a different time. ') + reply
        except ValueError as exc:
            reply = str(exc) + ' Your requested details are preserved below; no interview has been booked.'
    return {'reply': reply, 'executed_actions': [{'tool': 'schedule_candidate_interview', 'result': proposal}]}


def handle_calendar_query(prompt, user, history=None):
    text = prompt.lower()
    if re.search(r'\b(set\s*up|setup|schedule|arrange|create)\b', text) and re.search(r'\binterview\b', text) and not re.search(r'\b(reschedule|show|list)\b', text):
        return interview_proposal(prompt, user, history)
    # Booking proposals continue through the explicit scheduling workflow.
    if re.search(r'\b(book|lock|reserve|dispatch)\b', text):
        candidate = re.search(r'\b(?:with|for)\s+(.+?)\s+(?=today\b|tomorrow\b|on\b|\d{4}-\d{2}-\d{2}\b)', prompt, re.I)
        if candidate:
            try:
                return book_from_chat(prompt, user, {'candidate_identifier': candidate.group(1).strip()})
            except ValueError as exc:
                return {'reply': str(exc), 'executed_actions': []}
        return None
    if re.search(r'\breschedule\b', text): return None
    if re.search(r'\b(availability|available|free|conflict|busy)\b', text):
        date = re.search(r'\b\d{4}-\d{2}-\d{2}\b', text)
        time_value = re.search(r'\b(?:[01]\d|2[0-3]):[0-5]\d\b', text)
        if not date or not time_value:
            return {'reply': 'Give the date and time to check, for example: check availability on 2026-10-14 at 15:30 for 45 minutes.', 'executed_actions': []}
        duration = re.search(r'(\d+)\s*(?:minutes|mins)', text)
        try:
            status = connection_status(user)
            result = check_availability(user, date.group(), time_value.group(), status['timezone'], int(duration.group(1)) if duration else 45)
            reply = 'That slot is free in your primary Google Calendar.' if result['available'] else 'That slot overlaps another Google Calendar meeting. Choose a different time.'
            return {'reply': reply, 'executed_actions': [{'tool': 'check_calendar_availability', 'result': result}]}
        except ValueError as exc: return {'reply': str(exc), 'executed_actions': []}
    query = re.search(r'\b(calendar|meetings?|interviews?)\b', text) and re.search(r'\b(today|tomorrow|upcoming|scheduled|have|show|list|my|week)\b', text)
    if not query or re.search(r'\b(schedule|create)\s+(?:an?\s+)?interview\b', text): return None
    timeframe = 'today' if 'today' in text else 'tomorrow' if 'tomorrow' in text else 'upcoming'
    date = re.search(r'\b\d{4}-\d{2}-\d{2}\b', text)
    return schedule_reply(user, date.group() if date else timeframe, interviews_only='interview' in text and 'meeting' not in text)


def book_from_chat(prompt, user, arguments):
    """The model may select a tool, but cannot invent the user's booking instructions."""
    text = prompt.lower()
    if not re.search(r'\b(book|lock|reserve|confirm|dispatch)\b', text):
        raise ValueError('Choose and confirm the slot in the interview card before booking.')
    status = connection_status(user)
    now = datetime.now(ZoneInfo(status['timezone']))
    date = re.search(r'\b\d{4}-\d{2}-\d{2}\b', text)
    requested_date = date.group() if date else (now + timedelta(days=1)).date().isoformat() if 'tomorrow' in text else now.date().isoformat() if 'today' in text else None
    time24 = re.search(r'\b(?:[01]\d|2[0-3]):[0-5]\d\b', text)
    time12 = re.search(r'\b(1[0-2]|[1-9])(?::([0-5]\d))?\s*(am|pm)\b', text)
    requested_time = time24.group() if time24 else f"{int(time12.group(1)) % 12 + (12 if time12.group(3) == 'pm' else 0):02d}:{time12.group(2) or '00'}" if time12 else None
    if not requested_date or not requested_time:
        raise ValueError('Specify a date and time to reserve, for example: book an interview with Don Binoy tomorrow at 3pm.')
    identifier = str(arguments.get('candidate_identifier') or '')
    if not identifier or identifier.lower() not in text:
        raise ValueError('Include the candidate name, email or application ID in the booking request.')
    duration = re.search(r'(\d+)\s*(?:minutes|mins)', text)
    minutes = int(duration.group(1)) if duration else 45
    requested_zone = re.search(r'\b[A-Za-z_]+/[A-Za-z_]+(?:/[A-Za-z_]+)?\b', prompt)
    zone = requested_zone.group() if requested_zone else status['timezone']
    from modules.interview.services.company_schedule import save_company_interview
    result = save_company_interview(user, {'candidate_identifier': identifier,
        'scheduled_date': requested_date, 'scheduled_time': requested_time, 'scheduled_timezone': zone,
        'duration_minutes': minutes, 'round_name': arguments.get('round_name') or 'Technical Round'})
    reminder_status = (result.get('reminders') or {}).get('status')
    reply = (f"Company interview saved for {result['candidate_name']} on {result['scheduled_date']} at {result['scheduled_time']} "
             f"({zone}), {minutes} minutes. Google Calendar: {result['calendar_sync']['status']}. "
             f"Invitation email: {result['email_delivery']['status']}. Candidate reminders: "
             + ('scheduled for 60 and 10 minutes before the interview.' if reminder_status == 'scheduled' else 'pending until Google Calendar sync succeeds.'))
    return {'reply': reply, 'executed_actions': [{'tool': 'book_company_interview', 'result': result}]}
