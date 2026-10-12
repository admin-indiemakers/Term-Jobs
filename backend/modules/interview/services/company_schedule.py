"""Authenticated company LiveKit interview scheduling and rescheduling."""
import re
from urllib.parse import urlencode
from datetime import timedelta
from modules.calendar.services.google_calendar import schedule_window, sync_interview_event
from modules.interview.domain.models import InterviewRound
from modules.requisition.domain.models import Requisition
from modules.shared.db import get_session


def validate_company_requisition(user, requisition_id):
    with get_session() as session:
        req = session.get(Requisition, requisition_id)
        if user.role not in ('Hiring Manager', 'Admin', 'HR', 'Director') or not req or req.tenant_id != user.tenant_id:
            raise ValueError('Select a requisition in your company before scheduling an interview.')
        if user.role == 'Hiring Manager' and req.created_by != user.id:
            raise ValueError('You can schedule interviews only for your own requisitions.')


def save_company_interview(user, data):
    from modules.shared.db import db
    from .interview_service import create_interview_round, send_interview_invitation_email
    _, scheduled_end = schedule_window(data['scheduled_date'], data['scheduled_time'], data['scheduled_timezone'], data['duration_minutes'])
    with get_session() as session:
        query = session.query(Requisition).filter(Requisition.tenant_id == user.tenant_id)
        if user.role == 'Hiring Manager':
            query = query.filter(Requisition.created_by == user.id)
        reqs = query.all()
        req_map = {req.id: req for req in reqs}
        if data.get('requisition_id'):
            req_map = {key: value for key, value in req_map.items() if key == data['requisition_id']}
        if not req_map:
            raise ValueError('No authorized requisition is available for this candidate.')
        if data.get('round_id'):
            round_obj = session.query(InterviewRound).filter(InterviewRound.id == data['round_id'], InterviewRound.tenant_id == user.tenant_id).first()
            if not round_obj or round_obj.requisition_id not in req_map:
                raise ValueError('Interview round not found in your requisitions.')
            if round_obj.status in ('Completed', 'Cancelled') or round_obj.round_name.startswith('AI'):
                raise ValueError('Only active company interview rounds can be rescheduled.')
            for field in ('scheduled_date', 'scheduled_time', 'scheduled_timezone', 'duration_minutes'):
                setattr(round_obj, field, data[field])
            session._track(round_obj); session.commit()
            doc = round_obj.to_doc()
        else:
            identifier = data['candidate_identifier'].strip()
            if not identifier:
                raise ValueError('Select a candidate before scheduling.')
            matches = list(db['candidate_submissions'].find({'requisition_id': {'$in': list(req_map)}, '$or': [
                {'id': identifier}, {'submission_id': identifier}, {'candidate_email': identifier.lower()},
                {'candidate_name': {'$regex': '^' + re.escape(identifier) + '$', '$options': 'i'}}]}).limit(2))
            if len(matches) != 1:
                raise ValueError('Select one candidate application in your requisitions using its name, email or submission ID.')
            candidate = matches[0]
            req = req_map[candidate['requisition_id']]
            submission_id = candidate.get('id') or candidate.get('submission_id')
            existing = session.query(InterviewRound).filter(InterviewRound.tenant_id == user.tenant_id,
                InterviewRound.requisition_id == req.id, InterviewRound.candidate_submission_id == submission_id,
                InterviewRound.round_name == data['round_name'], InterviewRound.status != 'Cancelled').first()
            if existing:
                if any(getattr(existing, field) != data[field] for field in ('scheduled_date', 'scheduled_time', 'scheduled_timezone', 'duration_minutes')):
                    raise ValueError('This company interview round already exists. Open its review and edit the schedule there.')
                doc = existing.to_doc()
            else:
                doc = create_interview_round({**data, 'candidate_submission_id': submission_id,
                'candidate_name': candidate.get('candidate_name'), 'candidate_email': candidate.get('candidate_email'),
                'requisition_id': req.id, 'requisition_title': req.title, 'interviewer_name': user.name,
                'interviewer_email': user.email, 'round_name': data.get('round_name') or 'Technical Round',
                'round_type': 'Technical', 'suppress_email': True}, user.tenant_id, str(user.id), origin='https://termjobs.in')
    portal = 'https://termjobs.in/interview/candidate/login?' + urlencode({
        'token': doc['candidate_token'], 'email': doc['candidate_email'], 'passcode': doc['candidate_passcode']})
    meeting = f"https://termjobs.in/interview/room/{doc['id']}"
    calendar = sync_interview_event(user, doc)
    try:
        delivery = send_interview_invitation_email(candidate_name=doc['candidate_name'], candidate_email=doc['candidate_email'],
            requisition_title=doc['requisition_title'], company_name=user.name or 'Hiring Team', round_name=doc['round_name'],
            scheduled_date=doc['scheduled_date'], scheduled_time=f"{doc['scheduled_time']} ({doc['scheduled_timezone']})",
            duration_minutes=doc['duration_minutes'], meeting_link=meeting, candidate_portal_link=portal,
            passcode=doc['candidate_passcode'], instructions=doc.get('instructions') or '')
    except Exception:
        delivery = {'status': 'failed', 'reason': 'Interview saved but email delivery failed. Retry dispatch.'}
    with get_session() as session:
        stored = session.get(InterviewRound, doc['id'])
        stored.calendar_sync = calendar
        stored.email_delivery = delivery
        # Company invitations must remain valid until after the scheduled interview.
        from .interview_service import LINK_EXPIRATION_HOURS
        stored.expires_at = scheduled_end + timedelta(hours=LINK_EXPIRATION_HOURS)
        doc['expires_at'] = stored.expires_at
        if calendar.get('event_id'): stored.google_event_id = calendar['event_id']
        session._track(stored); session.commit()
    return {**doc, 'calendar_sync': calendar, 'email_delivery': delivery, 'meeting_link': meeting, 'candidate_portal_link': portal}
