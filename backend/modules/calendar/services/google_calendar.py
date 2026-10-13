"""Per-user Google Calendar connections and company interview events."""
import hashlib
import secrets
import time
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode, urlparse
from zoneinfo import ZoneInfo

import httpx
from contextlib import contextmanager
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from modules.calendar.services import oauth
from modules.shared.config import settings


def collections():
    from modules.shared.db import db
    return db['google_calendar_connections'], db['calendar_oauth_states']


def connection_status(user):
    connections, _ = collections()
    record = connections.find_one({'user_id': str(user.id), 'tenant_id': user.tenant_id}) or {}
    return {'configured': oauth.is_configured('google'), 'connected': record.get('status') == 'connected',
            'email': record.get('email'), 'timezone': record.get('timezone') or 'Asia/Kolkata',
            'calendar_id': 'primary', 'provider': 'google'}


def begin_connection(user, return_origin=None):
    if not oauth.is_configured('google'):
        raise ValueError('Google Calendar is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and the registered calendar callback URL.')
    provider = oauth.get_provider('google')
    state = secrets.token_urlsafe(32)
    configured_origin = '{0.scheme}://{0.netloc}'.format(urlparse(settings.calendar_frontend_url))
    target = return_origin if return_origin in ('https://termjobs.in', 'https://www.termjobs.in', 'http://localhost:5173', 'http://127.0.0.1:5173') else configured_origin
    _, states = collections()
    states.insert_one({'state': state, 'user_id': str(user.id), 'tenant_id': user.tenant_id,
                       'return_origin': target, 'expires_at': datetime.now(timezone.utc) + timedelta(minutes=10)})
    return provider.auth_url + '?' + urlencode({'client_id': provider.client_id, 'response_type': 'code',
        'redirect_uri': oauth.build_redirect_uri(provider), 'scope': ' '.join(provider.scopes), 'state': state,
        'access_type': 'offline', 'prompt': 'consent', 'include_granted_scopes': 'true'})


def finish_connection(state, code, error=None):
    connections, states = collections()
    pending = states.find_one_and_delete({'state': state, 'expires_at': {'$gt': datetime.now(timezone.utc)}})
    if not pending:
        raise ValueError('Calendar connection expired or was already used. Please connect again.')
    result = 'cancelled' if error else 'connected'
    if not error:
        try:
            tokens = oauth.exchange_code('google', code)
            if 'https://www.googleapis.com/auth/calendar.events' not in str(tokens.get('scope') or '').split():
                raise ValueError('Google Calendar event permission was not granted.')
            email = oauth.fetch_user_email('google', tokens['access_token'])
            identity = {'user_id': pending['user_id'], 'tenant_id': pending['tenant_id']}
            previous = connections.find_one(identity) or {}
            refresh_token = tokens.get('refresh_token') or previous.get('refresh_token')
            if not refresh_token:
                raise ValueError('Google did not grant offline calendar access.')
            calendar_timezone = 'Asia/Kolkata'
            with httpx.Client(timeout=20) as client:
                response = client.get('https://www.googleapis.com/calendar/v3/users/me/calendarList/primary',
                                      headers={'Authorization': f"Bearer {tokens['access_token']}"})
                if response.is_success:
                    calendar_timezone = response.json().get('timeZone') or calendar_timezone
            connections.update_one(identity, {'$set': {**identity, 'status': 'connected', 'email': email,
                'access_token': tokens['access_token'], 'refresh_token': refresh_token,
                'expires_at': oauth.token_expiry_epoch(tokens), 'timezone': calendar_timezone}}, upsert=True)
        except Exception:
            result = 'failed'
    return pending['return_origin'] + '/dashboard/hiring-manager?calendar=' + result


def schedule_window(date, time_value, timezone_name, duration_minutes, now=None):
    if not 15 <= duration_minutes <= 240:
        raise ValueError('Interview duration must be between 15 and 240 minutes.')
    try:
        start = datetime.strptime(f'{date} {time_value}', '%Y-%m-%d %H:%M').replace(tzinfo=ZoneInfo(timezone_name))
    except Exception as exc:
        raise ValueError('Choose a valid date, time and IANA timezone (for example Asia/Kolkata).') from exc
    if start <= (now or datetime.now(timezone.utc)):
        raise ValueError('Choose a future interview date and time.')
    return start, start + timedelta(minutes=duration_minutes)


class CalendarUnavailable(ValueError):
    pass


def access_credentials(user):
    connections, _ = collections()
    identity = {'user_id': str(user.id), 'tenant_id': user.tenant_id}
    connection = connections.find_one(identity)
    if not connection or connection.get('status') != 'connected':
        raise CalendarUnavailable('Connect Google Calendar before checking or reserving a meeting slot.')
    try:
        token = connection['access_token']
        if (connection.get('expires_at') or 0) <= time.time() + 60:
            tokens = oauth.refresh_access_token('google', connection['refresh_token'])
            token = tokens['access_token']
            connections.update_one(identity, {'$set': {'access_token': token, 'expires_at': oauth.token_expiry_epoch(tokens)}})
        return connection, token
    except Exception as exc:
        raise CalendarUnavailable('Google Calendar access has expired. Reconnect your calendar.') from exc


def list_calendar_events(user, start, end):
    connection, token = access_credentials(user)
    params = {'timeMin': start.isoformat(), 'timeMax': end.isoformat(), 'singleEvents': 'true',
              'orderBy': 'startTime', 'showDeleted': 'false', 'maxResults': 250, 'timeZone': connection.get('timezone') or 'Asia/Kolkata'}
    events = []
    try:
        with httpx.Client(timeout=20) as client:
            while True:
                response = client.get('https://www.googleapis.com/calendar/v3/calendars/primary/events',
                                      headers={'Authorization': f'Bearer {token}'}, params=params)
                response.raise_for_status()
                page = response.json()
                events.extend(event for event in page.get('items', []) if event.get('status') != 'cancelled')
                if not page.get('nextPageToken'): break
                params['pageToken'] = page['nextPageToken']
        return events
    except httpx.HTTPStatusError as exc:
        try:
            error = exc.response.json().get('error', {})
            reasons = {item.get('reason') for item in error.get('errors', []) + error.get('details', [])}
        except (ValueError, AttributeError, TypeError):
            reasons = set()
        if reasons & {'accessNotConfigured', 'SERVICE_DISABLED'}:
            message = 'Google Calendar API is disabled in the Google Cloud project used by TermJobs. Ask the administrator to enable Google Calendar API, then retry. Reconnecting alone will not fix this.'
        elif exc.response.status_code == 401 or reasons & {'authError', 'invalidCredentials'}:
            message = 'Google Calendar authorization is no longer valid. Reconnect your calendar and grant access.'
        elif reasons & {'insufficientPermissions', 'ACCESS_TOKEN_SCOPE_INSUFFICIENT'}:
            message = 'Google Calendar permission is missing. Reconnect your calendar and grant permission to read and edit calendar events.'
        elif exc.response.status_code == 429 or reasons & {'rateLimitExceeded', 'userRateLimitExceeded'}:
            message = 'Google Calendar is temporarily rate limited. Retry shortly.'
        else:
            message = 'Google Calendar rejected the calendar read. Ask the administrator to check calendar access, then retry.'
        raise CalendarUnavailable(message + ' No slot has been assumed free.') from exc
    except Exception as exc:
        raise CalendarUnavailable('Unable to read Google Calendar. No slot has been assumed free; reconnect or retry.') from exc


def event_blocks_slot(event, start, end, exclude_event_id=None):
    if (exclude_event_id and event.get('id') == exclude_event_id) or event.get('status') == 'cancelled' or event.get('transparency') == 'transparent':
        return False
    if any(person.get('self') and person.get('responseStatus') == 'declined' for person in event.get('attendees', [])):
        return False
    zone = start.tzinfo
    def parse(part):
        if part.get('dateTime'):
            value = datetime.fromisoformat(part['dateTime'].replace('Z', '+00:00'))
            return value if value.tzinfo else value.replace(tzinfo=zone)
        return datetime.fromisoformat(part['date']).replace(tzinfo=zone)
    try:
        return parse(event['start']) < end and parse(event['end']) > start
    except Exception as exc:
        raise CalendarUnavailable('A calendar event has unreadable times. Availability could not be verified.') from exc


def check_availability(user, date, time_value, zone, duration, exclude_event_id=None):
    start, end = schedule_window(date, time_value, zone, duration)
    conflicts = [event for event in list_calendar_events(user, start, end) if event_blocks_slot(event, start, end, exclude_event_id)]
    return {'available': not conflicts, 'start': start.isoformat(), 'end': end.isoformat(), 'timezone': zone,
            'conflicts': [{'title': event.get('summary') or 'Busy', 'start': event.get('start'), 'end': event.get('end')} for event in conflicts]}


@contextmanager
def booking_lock(user):
    from modules.shared.db import db
    locks = db['calendar_booking_locks']
    identity = f'{user.tenant_id}:{user.id}'
    owner = secrets.token_hex(16)
    now = datetime.now(timezone.utc)
    try:
        locks.find_one_and_update({'_id': identity, 'expires_at': {'$lte': now}},
            {'$set': {'owner': owner, 'expires_at': now + timedelta(minutes=5)}}, upsert=True, return_document=ReturnDocument.AFTER)
    except DuplicateKeyError as exc:
        raise ValueError('Another meeting reservation is being processed. Retry in a moment.') from exc
    try:
        yield
    finally:
        locks.delete_one({'_id': identity, 'owner': owner})


def sync_interview_event(user, interview):
    connections, _ = collections()
    identity = {'user_id': str(user.id), 'tenant_id': user.tenant_id}
    connection = connections.find_one(identity)
    if not connection or connection.get('status') != 'connected':
        return {'status': 'not_connected', 'message': 'Interview saved. Connect Google Calendar to sync the event.'}
    try:
        access_token = connection['access_token']
        if (connection.get('expires_at') or 0) <= time.time() + 60:
            tokens = oauth.refresh_access_token('google', connection['refresh_token'])
            access_token = tokens['access_token']
            connections.update_one(identity, {'$set': {'access_token': access_token, 'expires_at': oauth.token_expiry_epoch(tokens)}})
        start, end = schedule_window(interview['scheduled_date'], interview['scheduled_time'], interview['scheduled_timezone'], interview['duration_minutes'])
        event_id = interview.get('google_event_id') or hashlib.sha256(interview['id'].encode()).hexdigest()[:32]
        event = {'summary': f"{interview['round_name']} · {interview['candidate_name']}",
            'description': f"Company interview for {interview['requisition_title']}.\nJoin the TermJobs LiveKit interview: https://termjobs.in/interview/room/{interview['id']}",
            'location': f"https://termjobs.in/interview/room/{interview['id']}?role=interviewer",
            'start': {'dateTime': start.isoformat(), 'timeZone': interview['scheduled_timezone']},
            'end': {'dateTime': end.isoformat(), 'timeZone': interview['scheduled_timezone']},
            'attendees': [{'email': email} for email in dict.fromkeys([interview.get('candidate_email'), interview.get('interviewer_email')]) if email],
            'transparency': 'opaque',
            'extendedProperties': {'private': {'termjobs_round_id': interview['id']}},
            'reminders': {'useDefault': False, 'overrides': [{'method': 'email', 'minutes': 60}, {'method': 'popup', 'minutes': 10}]}}
        base = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
        with httpx.Client(timeout=30) as client:
            headers = {'Authorization': f'Bearer {access_token}'}
            response = client.patch(f'{base}/{event_id}', params={'sendUpdates': 'all'}, headers=headers, json=event)
            if response.status_code == 404:
                response = client.post(base, params={'sendUpdates': 'all'}, headers=headers, json={**event, 'id': event_id})
            if response.status_code == 409:
                response = client.patch(f'{base}/{event_id}', params={'sendUpdates': 'all'}, headers=headers, json=event)
            response.raise_for_status()
            return {'status': 'synced', 'event_id': event_id, 'event_url': response.json().get('htmlLink'), 'email': connection.get('email')}
    except Exception:
        return {'status': 'failed', 'message': 'Interview saved, but Google Calendar sync failed. Reconnect or retry calendar sync.'}
