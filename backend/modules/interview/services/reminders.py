"""Durable candidate reminders; local worker or authenticated cron drives delivery."""
import hashlib
import html
import secrets
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from pymongo import ReturnDocument
from types import SimpleNamespace
from modules.calendar.services.google_calendar import booking_lock


def database():
    from modules.shared.db import db
    return db


def interview_start(interview):
    return datetime.strptime(f"{interview['scheduled_date']} {interview['scheduled_time']}", '%Y-%m-%d %H:%M').replace(
        tzinfo=ZoneInfo(interview.get('scheduled_timezone') or 'Asia/Kolkata')).astimezone(timezone.utc)


def schedule_interview_reminders(interview, now=None):
    now = now or datetime.now(timezone.utc)
    start = interview_start(interview)
    jobs = database()['interview_reminders']
    jobs.update_many({'round_id': interview['id'], 'status': {'$in': ['pending', 'sending']}}, {'$set': {'status': 'cancelled'}})
    if (interview.get('calendar_sync') or {}).get('status') != 'synced':
        return {'status': 'pending_calendar_sync', 'offset_minutes': [60, 10]}
    recipients = [interview.get('candidate_email')]
    organizer = (interview.get('calendar_sync') or {}).get('email')
    if interview.get('interviewer_email') and interview['interviewer_email'] != organizer:
        recipients.append(interview['interviewer_email'])
    for minutes in (60, 10):
        due = start - timedelta(minutes=minutes)
        if due <= now: continue
        for recipient in dict.fromkeys(recipients):
            if not recipient: continue
            identity = hashlib.sha256(f"{interview['id']}:{start.isoformat()}:{recipient}:{minutes}".encode()).hexdigest()
            existing = jobs.find_one({'_id': identity})
            if existing and existing.get('status') == 'sent': continue
            jobs.update_one({'_id': identity}, {'$set': {'round_id': interview['id'], 'tenant_id': interview['tenant_id'],
                'recipient': recipient, 'scheduled_start': start, 'due_at': due, 'minutes': minutes,
                'status': 'pending', 'attempts': 0}}, upsert=True)
    return {'status': 'scheduled', 'offset_minutes': [60, 10]}


def dispatch_due_interview_reminders(now=None, limit=100):
    from modules.candidate_screening_agent.services.email_service import send_email_via_gmail
    now = now or datetime.now(timezone.utc)
    db = database()
    jobs = db['interview_reminders']
    result = {'sent': 0, 'failed': 0, 'cancelled': 0}
    for _ in range(limit):
        owner = secrets.token_hex(16)
        job = jobs.find_one_and_update({'due_at': {'$lte': now}, '$or': [
            {'status': 'pending'}, {'status': 'sending', 'lease_until': {'$lte': now}}]},
            {'$set': {'status': 'sending', 'owner': owner, 'lease_until': now + timedelta(minutes=5)}, '$inc': {'attempts': 1}},
            sort=[('due_at', 1)], return_document=ReturnDocument.AFTER)
        if not job: break
        update_filter = {'_id': job['_id'], 'owner': owner, 'status': 'sending'}
        interview = db['interview_rounds'].find_one({'id': job['round_id'], 'tenant_id': job['tenant_id']})
        try:
            actor = SimpleNamespace(id=interview.get('created_by') if interview else '', tenant_id=job['tenant_id'])
            with booking_lock(actor):
                interview = db['interview_rounds'].find_one({'id': job['round_id'], 'tenant_id': job['tenant_id']})
                start = interview_start(interview) if interview else None
                stored_start = job['scheduled_start'].replace(tzinfo=timezone.utc) if job['scheduled_start'].tzinfo is None else job['scheduled_start']
                if not interview or interview.get('status') not in ('Scheduled', 'Confirmed', 'In Progress') or start != stored_start or start <= now:
                    jobs.update_one(update_filter, {'$set': {'status': 'cancelled'}}); result['cancelled'] += 1; continue
                link = f"https://termjobs.in/interview/room/{interview['id']}"
                body = (f"<p>Your {html.escape(interview.get('round_name') or 'interview')} starts in about {job['minutes']} minutes.</p>"
                        f"<p>{html.escape(interview['scheduled_date'])} at {html.escape(interview['scheduled_time'])} "
                        f"({html.escape(interview.get('scheduled_timezone') or 'Asia/Kolkata')})</p>"
                        f'<p><a href="{link}">Join your TermJobs company interview</a></p>')
                delivery = send_email_via_gmail(job['recipient'], 'Reminder: Your TermJobs interview', body)
                if delivery.get('status') != 'success': raise RuntimeError('Delivery not confirmed')
                jobs.update_one(update_filter, {'$set': {'status': 'sent', 'sent_at': now}}); result['sent'] += 1
        except ValueError as exc:
            if str(exc).startswith('Another meeting reservation'):
                jobs.update_one(update_filter, {'$set': {'status': 'pending', 'due_at': now + timedelta(minutes=1)}, '$inc': {'attempts': -1}})
                continue
            jobs.update_one(update_filter, {'$set': {'status': 'failed' if job['attempts'] >= 3 else 'pending', 'due_at': now + timedelta(minutes=5)}})
            result['failed'] += 1
        except Exception:
            jobs.update_one(update_filter, {'$set': {'status': 'failed' if job['attempts'] >= 3 else 'pending', 'due_at': now + timedelta(minutes=5)}})
            result['failed'] += 1
    return result
