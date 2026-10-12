"""Per-user Google Calendar connections and company interview events."""
import hashlib
import secrets
import time
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode, urlparse
from zoneinfo import ZoneInfo

import httpx

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
            'location': f"https://termjobs.in/interview/room/{interview['id']}",
            'start': {'dateTime': start.isoformat(), 'timeZone': interview['scheduled_timezone']},
            'end': {'dateTime': end.isoformat(), 'timeZone': interview['scheduled_timezone']},
            'attendees': [{'email': email} for email in dict.fromkeys([interview.get('candidate_email'), interview.get('interviewer_email')]) if email]}
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
