"""Admin-triggered invitations for an application's existing AI interview flow."""
from datetime import datetime, timedelta, timezone
import uuid

from fastapi import HTTPException

from modules.interview.domain.links import candidate_interview_link, is_ai_round
from modules.interview.domain.models import InterviewRound
from modules.interview.domain.invitation_origin import resolve_admin_invitation_origin
from modules.interview.services.interview_service import (
    _generate_candidate_passcode,
    send_interview_invitation_email,
)


def email_application_interview(submission_id, requisition_id, admin_id, origin=None):
    from modules.shared.db import db
    from modules.shared.cache import cache

    submission = db.candidate_submissions.find_one({'id': submission_id, 'requisition_id': requisition_id})
    if not requisition_id or not submission:
        raise HTTPException(404, 'Candidate application not found for this requisition.')
    req = db.requisitions.find_one({'id': requisition_id})
    if not req or req.get('is_deleted') or req.get('status') in ('Closed', 'Cancelled', 'Rejected', 'Draft'):
        raise HTTPException(409, 'This requisition is not available for interviews.')
    if submission.get('status') in ('Rejected', 'Withdrawn', 'Hired', 'Offer Accepted'):
        raise HTTPException(409, 'This application is no longer available for an AI interview.')
    email = (submission.get('candidate_email') or '').strip().lower()
    if not email:
        raise HTTPException(400, 'This application has no candidate email address.')
    public_origin = resolve_admin_invitation_origin(origin)
    if submission.get('resume_match_score') is None and submission.get('interview_score') is None and submission.get('composite_score') is None:
        db.candidate_submissions.update_one(
            {'id': submission_id, 'resume_match_score': None, 'interview_score': None, 'composite_score': None},
            {'$set': {'resume_match_score': submission.get('match_score')}},
        )

    identity = [{'candidate_submission_id': submission_id}, {'candidate_email': email}]
    rounds = [r for r in db.interview_rounds.find({
        'requisition_id': requisition_id, '$or': identity,
    }).sort('created_at', -1) if is_ai_round(r) and r.get('status') != 'Cancelled']
    if any(r.get('status') in ('Completed', 'Evaluated') or r.get('communication_analysis') for r in rounds):
        raise HTTPException(409, 'The AI interview has already been completed. A new attempt was not created.')
    now = datetime.now(timezone.utc)
    if rounds:
        round_doc = rounds[0]
    else:
        # Stable ID makes repeated/concurrent requests resolve to the same attempt.
        round_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f'termjobs:admin-ai:{submission_id}:{requisition_id}'))
        round_doc = InterviewRound(
            id=round_id, tenant_id=req.get('tenant_id') or '',
            requisition_id=requisition_id, requisition_title=req.get('title') or 'Open Role',
            candidate_submission_id=submission_id,
            candidate_name=submission.get('candidate_name') or 'Candidate', candidate_email=email,
            round_name='AI Interview', round_type='AI', round_number=1,
            scheduled_date=now.strftime('%Y-%m-%d'), scheduled_time='Immediate / On-Demand',
            interviewer_name='TermJobs AI Bot', interviewer_role='AI Autonomous Interviewer',
            candidate_passcode=_generate_candidate_passcode(), room_id=f'room_round_{uuid.uuid4().hex[:10]}',
            expires_at=now + timedelta(hours=10), created_by=admin_id,
        ).to_doc()
        db.interview_rounds.update_one({'id': round_id}, {'$setOnInsert': round_doc}, upsert=True)
        round_doc = db.interview_rounds.find_one({'id': round_id})
    if round_doc.get('status') not in ('Scheduled', 'Confirmed'):
        raise HTTPException(409, 'This AI interview has already started. Its attempt was not reset.')

    # Prevent double clicks or parallel admins from sending duplicate invitations.
    claim = db.interview_rounds.update_one({
        'id': round_doc['id'], 'status': {'$in': ['Scheduled', 'Confirmed']},
        '$and': [
            {'$or': [{'admin_invite_claimed_at': {'$exists': False}},
                     {'admin_invite_claimed_at': {'$lt': now - timedelta(minutes=2)}}]},
            {'$or': [{'admin_invite_sent_at': {'$exists': False}},
                     {'admin_invite_sent_at': {'$lt': now - timedelta(minutes=1)}}]},
        ],
    }, {'$set': {'admin_invite_claimed_at': now}})
    if not claim.matched_count:
        raise HTTPException(409, 'An invitation was just sent or is being sent. Please wait before retrying.')

    updates = {'updated_at': now, 'expires_at': now + timedelta(hours=10)}
    if not round_doc.get('candidate_token'):
        updates['candidate_token'] = str(uuid.uuid4())
    if not round_doc.get('candidate_passcode'):
        updates['candidate_passcode'] = _generate_candidate_passcode()
    # An unattended expired invitation gets another 10 hours on the same attempt.
    db.interview_rounds.update_one({'id': round_doc['id']}, {'$set': updates})
    round_doc.update(updates)
    link = candidate_interview_link(round_doc, public_origin)
    company = req.get('company_name') or req.get('client_name')
    if not company and req.get('company_profile_id'):
        profile = db.company_profiles.find_one({'id': req['company_profile_id']}) or {}
        company = profile.get('name')
    try:
        delivery = send_interview_invitation_email(
            candidate_name=round_doc['candidate_name'], candidate_email=email,
            requisition_title=req.get('title') or 'Open Role', company_name=company or 'Hiring Team',
            round_name=round_doc['round_name'], scheduled_date=round_doc.get('scheduled_date') or '',
            scheduled_time='Immediate / On-Demand · Link valid for 10 hours',
            duration_minutes=round_doc.get('duration_minutes') or 45,
            meeting_link=link, candidate_portal_link=link,
            passcode=round_doc.get('candidate_passcode') or '', instructions=round_doc.get('instructions') or '',
            public_origin=public_origin,
        )
    except Exception:
        delivery = {'status': 'failed', 'reason': 'Email delivery could not be confirmed. Please retry.'}
    saved = {'email_delivery': delivery, 'updated_at': now}
    if delivery.get('status') == 'success':
        saved.update(admin_invite_sent_at=now, admin_invite_sent_by=admin_id)
    db.interview_rounds.update_one({'id': round_doc['id']}, {
        '$set': saved, '$unset': {'admin_invite_claimed_at': ''},
    })
    cache.clear()
    if delivery.get('status') != 'success':
        raise HTTPException(502, delivery.get('reason') or 'Interview email was not delivered. Please retry.')
    return {'status': 'success', 'round_id': round_doc['id'], 'message': f'AI interview invitation emailed to {email}.'}
