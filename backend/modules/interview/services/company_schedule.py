"""Authenticated company LiveKit interview scheduling and rescheduling."""
import re
from urllib.parse import urlencode
from datetime import timedelta
from modules.calendar.services.google_calendar import schedule_window, sync_interview_event, check_availability, booking_lock
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
    from hashlib import sha256
    from datetime import datetime
    from zoneinfo import ZoneInfo
    if str(data.get('round_name') or '').upper().startswith('AI'):
        raise ValueError('Use the AI screening workflow for AI rounds; this booking is for a company LiveKit interview.')
    start, end = schedule_window(data['scheduled_date'], data['scheduled_time'], data['scheduled_timezone'], data['duration_minutes'])
    if data.get('round_id'):
        with get_session() as session:
            target = session.get(InterviewRound, data['round_id'])
            can_manage = (
                target is not None and
                target.tenant_id == user.tenant_id and
                (
                    user.role in ('Admin', 'HR', 'Director', 'Hiring Manager') or
                    target.created_by == str(user.id) or
                    getattr(target, 'interviewer_email', None) == user.email
                )
            )
            if not can_manage:
                raise ValueError('Only the booking manager can reschedule this Google Calendar interview.')
    with booking_lock(user):
        with get_session() as session:
            all_rounds = session.query(InterviewRound).filter(InterviewRound.tenant_id == user.tenant_id).all()
            if user.role in ('Admin', 'HR', 'Director', 'Hiring Manager'):
                own_rounds = all_rounds
            else:
                own_rounds = [row for row in all_rounds if getattr(row, 'created_by', None) == str(user.id) or getattr(row, 'interviewer_email', None) == user.email]
            target = next((row for row in all_rounds if row.id == data.get('round_id')), None)
            if not target and not data.get('round_id'):
                identifier = str(data.get('candidate_identifier') or '').lower()
                target = next((row for row in own_rounds if row.round_name == data['round_name'] and identifier in
                    (str(row.candidate_submission_id).lower(), str(row.candidate_name).lower(), str(row.candidate_email).lower())), None)
            assigned_email = data.get('interviewer_email') or user.email
            assigned_name = data.get('interviewer_name') or user.name
            target_sub_id = data.get('candidate_submission_id') or getattr(target, 'candidate_submission_id', None) or data.get('candidate_identifier')
            target_email = data.get('candidate_email') or getattr(target, 'candidate_email', None)
            target_cand_name = data.get('candidate_name') or getattr(target, 'candidate_name', None)

            from .interviewer_availability import validate_interviewer_availability, validate_candidate_availability, parse_round_time_window
            validate_candidate_availability(
                candidate_submission_id=target_sub_id,
                candidate_email=target_email,
                scheduled_date=data['scheduled_date'],
                scheduled_time=data['scheduled_time'],
                scheduled_timezone=data.get('scheduled_timezone') or 'Asia/Kolkata',
                duration_minutes=int(data.get('duration_minutes', 45)),
                exclude_round_id=data.get('round_id') or getattr(target, 'id', None),
                candidate_name=target_cand_name,
                session=session,
            )
            validate_interviewer_availability(
                interviewer_email=assigned_email,
                scheduled_date=data['scheduled_date'],
                scheduled_time=data['scheduled_time'],
                scheduled_timezone=data.get('scheduled_timezone') or 'Asia/Kolkata',
                duration_minutes=int(data.get('duration_minutes', 45)),
                exclude_round_id=data.get('round_id') or getattr(target, 'id', None),
                interviewer_name=assigned_name,
                session=session,
            )

            for row in own_rounds:
                if row.status not in ('Scheduled', 'Confirmed', 'In Progress') or row.id == getattr(target, 'id', None): continue
                is_same_cand = target_sub_id and str(getattr(row, 'candidate_submission_id', '')) == str(target_sub_id)
                is_same_int = assigned_email and getattr(row, 'interviewer_email', None) and row.interviewer_email.lower().strip() == assigned_email.lower().strip()
                if not (is_same_cand or is_same_int):
                    continue
                existing_start, existing_end = parse_round_time_window(row.scheduled_date, row.scheduled_time, row.scheduled_timezone, row.duration_minutes)
                if not existing_start or not existing_end:
                    if row.scheduled_date == data['scheduled_date']:
                        raise ValueError('An existing interview on this date has an unreadable time. Review it before reserving another slot.')
                    continue
                if existing_start < end and existing_end > start:
                    entity = "candidate" if is_same_cand else "interviewer"
                    raise ValueError(f'This slot overlaps an existing TermJobs interview for this {entity}. Choose another time.')
        exclude = (target.google_event_id or sha256(target.id.encode()).hexdigest()[:32]) if target else None
        availability = check_availability(user, data['scheduled_date'], data['scheduled_time'], data['scheduled_timezone'], data['duration_minutes'], exclude)
        if not availability['available']:
            raise ValueError('Google Calendar already has a meeting in this slot. Choose another time; no invitation has been sent.')
        result = _save_company_interview(user, data)
        from .reminders import schedule_interview_reminders
        result['reminders'] = schedule_interview_reminders(result)
        return result


def _save_company_interview(user, data):
    from modules.shared.db import db
    from .interview_service import create_interview_round, send_interview_invitation_email, send_interviewer_invitation_email, _resolve_interview_domain
    base_domain = _resolve_interview_domain()
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
            if data.get('interviewer_name'):
                round_obj.interviewer_name = data['interviewer_name']
            if data.get('interviewer_email'):
                round_obj.interviewer_email = data['interviewer_email']
            if data.get('interviewer_role'):
                round_obj.interviewer_role = data['interviewer_role']
            if data.get('instructions'):
                round_obj.instructions = data['instructions']
            round_obj.status = 'Scheduled'
            if not getattr(round_obj, 'interviewer_token', None):
                import uuid as _uuid
                round_obj.interviewer_token = str(_uuid.uuid4())
            session._track(round_obj); session.commit()
            doc = round_obj.to_doc()
        else:
            identifier = data['candidate_identifier'].strip()
            if not identifier:
                raise ValueError('Select a candidate before scheduling.')
            q = {'requisition_id': {'$in': list(req_map)}, '$or': [
                {'id': identifier}, {'submission_id': identifier}, {'candidate_email': identifier.lower()},
                {'candidate_name': {'$regex': '^' + re.escape(identifier) + '$', '$options': 'i'}}]}
            matches = list(db['candidate_submissions'].find(q).limit(2))
            if len(matches) != 1:
                raise ValueError('Select one candidate application in your requisitions using its name, email or submission ID.')
            candidate = matches[0]
            req = req_map[candidate['requisition_id']]
            submission_id = candidate.get('id') or candidate.get('submission_id')
            existing = session.query(InterviewRound).filter(InterviewRound.tenant_id == user.tenant_id,
                InterviewRound.requisition_id == req.id, InterviewRound.candidate_submission_id == submission_id,
                InterviewRound.round_name == data['round_name'], InterviewRound.status != 'Cancelled').first()
            if existing:
                if existing.status in ('Completed', 'Cancelled') or existing.round_name.startswith('AI'):
                    raise ValueError('Only active company interview rounds can be rescheduled.')
                for field in ('scheduled_date', 'scheduled_time', 'scheduled_timezone', 'duration_minutes'):
                    setattr(existing, field, data[field])
                if data.get('interviewer_name'):
                    existing.interviewer_name = data['interviewer_name']
                if data.get('interviewer_email'):
                    existing.interviewer_email = data['interviewer_email']
                if data.get('interviewer_role'):
                    existing.interviewer_role = data['interviewer_role']
                if data.get('instructions'):
                    existing.instructions = data['instructions']
                existing.status = 'Scheduled'
                if not getattr(existing, 'interviewer_token', None):
                    import uuid as _uuid
                    existing.interviewer_token = str(_uuid.uuid4())
                session._track(existing); session.commit()
                doc = existing.to_doc()
            else:
                doc = create_interview_round({**data, 'candidate_submission_id': submission_id,
                'candidate_name': candidate.get('candidate_name'), 'candidate_email': candidate.get('candidate_email'),
                'requisition_id': req.id, 'requisition_title': req.title, 'interviewer_name': data.get('interviewer_name') or user.name,
                'interviewer_email': data.get('interviewer_email') or user.email, 'interviewer_role': data.get('interviewer_role') or 'Interviewer',
                'round_name': data.get('round_name') or 'Technical Round',
                'round_type': data.get('round_type') or 'Technical', 'suppress_email': True,
                'suppress_notifications': True}, user.tenant_id, str(user.id), origin='https://termjobs.in')

    # Candidate links
    portal = f"{base_domain}/interview/candidate/login?" + urlencode({
        'token': doc['candidate_token'], 'email': doc['candidate_email'], 'passcode': doc['candidate_passcode']})
    meeting = f"{base_domain}/interview/room/{doc['id']}?" + urlencode({'role': 'candidate', 'token': doc['candidate_token']})

    # Interviewer links
    int_name = doc.get('interviewer_name') or user.name or 'Interviewer'
    int_email = doc.get('interviewer_email') or user.email or ''
    int_token = doc.get('interviewer_token') or ''
    interviewer_room_link = f"{base_domain}/interview/room/{doc['id']}?" + urlencode({
        'role': 'interviewer',
        'token': int_token,
        'name': int_name,
    })
    interviewer_portal_link = f"{base_domain}/interview/staff?" + urlencode({
        'token': int_token,
        'email': int_email,
    })

    # Lookup candidate submission details for richer context in email
    cand_doc = None
    target_sub_id = doc.get('candidate_submission_id')
    if target_sub_id:
        cand_doc = db['candidate_submissions'].find_one({'$or': [{'id': target_sub_id}, {'submission_id': target_sub_id}]})
    if not cand_doc and doc.get('candidate_email'):
        cand_doc = db['candidate_submissions'].find_one({'candidate_email': doc['candidate_email'].lower()})
    cand_doc = cand_doc or {}

    cand_phone = cand_doc.get('candidate_phone') or cand_doc.get('phone') or ''
    cand_score = cand_doc.get('match_score') or cand_doc.get('score')
    resume_url = cand_doc.get('resume_url')
    if not resume_url and (cand_doc.get('id') or cand_doc.get('submission_id')):
        sub_id = cand_doc.get('id') or cand_doc.get('submission_id')
        resume_url = f"{base_domain}/api/candidates/{sub_id}/resume"
    elif resume_url and resume_url.startswith('/'):
        resume_url = f"{base_domain}{resume_url}"

    calendar = sync_interview_event(user, doc)

    # 1. Dispatch candidate invitation email
    try:
        delivery = send_interview_invitation_email(candidate_name=doc['candidate_name'], candidate_email=doc['candidate_email'],
            requisition_title=doc['requisition_title'], company_name=user.name or 'Hiring Team', round_name=doc['round_name'],
            scheduled_date=doc['scheduled_date'], scheduled_time=f"{doc['scheduled_time']} ({doc['scheduled_timezone']})",
            duration_minutes=doc['duration_minutes'], meeting_link=meeting, candidate_portal_link=portal,
            passcode=doc['candidate_passcode'], instructions=doc.get('instructions') or '')
    except Exception as exc:
        import logging
        logging.getLogger(__name__).warning(f"Failed sending interview invitation email: {exc}")
        delivery = {'status': 'failed', 'reason': f"Email delivery error: {str(exc)}"}

    # 2. Dispatch interviewer notification email with date, time, direct room link, candidate profile
    interviewer_delivery = {'status': 'skipped', 'reason': 'No interviewer email provided'}
    if int_email:
        try:
            interviewer_delivery = send_interviewer_invitation_email(
                interviewer_name=int_name,
                interviewer_email=int_email,
                candidate_name=doc.get('candidate_name') or 'Candidate',
                candidate_email=doc.get('candidate_email') or '',
                requisition_title=doc.get('requisition_title') or 'Open Position',
                company_name=user.name or 'Hiring Team',
                round_name=doc.get('round_name') or 'Interview Round',
                round_type=doc.get('round_type') or 'Technical',
                scheduled_date=doc['scheduled_date'],
                scheduled_time=f"{doc['scheduled_time']} ({doc['scheduled_timezone']})",
                duration_minutes=doc['duration_minutes'],
                meeting_link=interviewer_room_link,
                staff_portal_link=interviewer_portal_link,
                candidate_phone=cand_phone,
                candidate_resume_link=resume_url,
                candidate_match_score=cand_score,
                instructions=doc.get('instructions') or '',
            )
        except Exception as exc:
            import logging
            logging.getLogger(__name__).warning(f"Failed sending interviewer invitation email: {exc}")
            interviewer_delivery = {'status': 'failed', 'reason': f"Interviewer email delivery error: {str(exc)}"}

    telegram = {'status': 'skipped', 'reason': 'Candidate has not linked Telegram'}
    try:
        from modules.candidate.telegram_service import send_candidate_interview_scheduled_alert
        import asyncio
        candidate_doc = db['candidates'].find_one({'candidate_email': doc['candidate_email'].lower()}) or {}
        link = db['telegram_links'].find_one({'candidate_email': doc['candidate_email'].lower()}) or {}
        chat_id = candidate_doc.get('telegram_chat_id') or link.get('telegram_chat_id') or link.get('chat_id')
        if chat_id:
            sent = asyncio.run(send_candidate_interview_scheduled_alert(
                chat_id=chat_id, candidate_name=doc['candidate_name'], requisition_title=doc['requisition_title'],
                company_name=user.name or 'Hiring Team', round_name=doc['round_name'], scheduled_date=doc['scheduled_date'],
                scheduled_time=f"{doc['scheduled_time']} ({doc['scheduled_timezone']})", duration_minutes=doc['duration_minutes'],
                meeting_link=meeting, passcode=doc['candidate_passcode'],
            ))
            telegram = {'status': 'success' if sent.get('ok') else 'failed', 'reason': sent.get('error')}
    except Exception:
        telegram = {'status': 'failed', 'reason': 'Telegram delivery failed'}

    with get_session() as session:
        stored = session.get(InterviewRound, doc['id'])
        stored.calendar_sync = calendar
        stored.email_delivery = delivery
        stored.interviewer_email_delivery = interviewer_delivery
        stored.telegram_delivery = telegram
        # Company invitations must remain valid until after the scheduled interview.
        from .interview_service import LINK_EXPIRATION_HOURS
        stored.expires_at = scheduled_end + timedelta(hours=LINK_EXPIRATION_HOURS)
        doc['expires_at'] = stored.expires_at
        if calendar.get('event_id'): stored.google_event_id = calendar['event_id']
        session._track(stored); session.commit()
    return {
        **doc,
        'calendar_sync': calendar,
        'email_delivery': delivery,
        'interviewer_email_delivery': interviewer_delivery,
        'telegram_delivery': telegram,
        'meeting_link': meeting,
        'candidate_portal_link': portal,
        'interviewer_room_link': interviewer_room_link,
        'interviewer_portal_link': interviewer_portal_link,
    }
