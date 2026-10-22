"""Projected reads for hiring dashboard counters; no candidate-card enrichment."""


def hiring_counts(database, user, workforce):
    scope = {'tenant_id': user.tenant_id}
    if getattr(user, 'role', 'Hiring Manager') == 'Hiring Manager':
        scope['created_by'] = user.id
    requisitions = list(database['requisitions'].find(scope, {'id': 1, 'status': 1}))
    req_ids = [row['id'] for row in requisitions]
    candidates = list(database['candidate_submissions'].find({'requisition_id': {'$in': req_ids}}, {
        'id': 1, 'submission_id': 1, 'candidate_id': 1, 'candidate_email': 1,
        'requisition_id': 1, 'status': 1, 'manual_shortlist': 1,
        'interview_score': 1, 'round_status': 1,
    }))
    completed = list(database['interview_rounds'].find(
        {'requisition_id': {'$in': req_ids}, 'status': 'Completed'},
        {'requisition_id': 1, 'candidate_submission_id': 1, 'candidate_email': 1}))
    completed_ids = {(r.get('candidate_submission_id'), r.get('requisition_id')) for r in completed if r.get('candidate_submission_id')}
    completed_emails = {(str(r.get('candidate_email', '')).strip().lower(), r.get('requisition_id')) for r in completed if r.get('candidate_email')}
    accepted, shortlisted = set(), set()
    accepted_statuses = {'Accepted', 'Offer Extended', 'Offer Accepted', 'Hired'}
    for row in candidates:
        identity = str(row.get('id') or row.get('submission_id') or row.get('candidate_id') or row.get('candidate_email') or '').lower()
        if not identity:
            continue
        status = row.get('status')
        if status in accepted_statuses:
            accepted.add(identity)
        elif status == 'Under Review':
            shortlisted.add(identity)
        elif status == 'Shortlisted' or (row.get('manual_shortlist') and status == 'Screened'):
            verified = row.get('manual_shortlist') or row.get('interview_score') is not None or row.get('round_status') == 'Completed'
            verified = verified or (row.get('id') or row.get('submission_id'), row.get('requisition_id')) in completed_ids
            verified = verified or (str(row.get('candidate_email', '')).strip().lower(), row.get('requisition_id')) in completed_emails
            if verified:
                shortlisted.add(identity)
    application_ids = [row['id'] for row in candidates if row.get('id')]
    return {
        'requisitions': sum(str(row.get('status', '')).lower() in ('published', 'active', 'open', 'approved') for row in requisitions),
        'candidates': len(accepted | shortlisted),
        'shortlisted': len(shortlisted - accepted),
        'accepted': len(accepted),
        'openIssues': database['onboarding_issues'].count_documents({
            'candidate_id': {'$in': application_ids}, 'status': {'$regex': '^open$', '$options': 'i'}}),
        'pendingTimesheets': workforce.get('pending_timesheets', 0),
        'pendingExpenses': workforce.get('pending_expenses', 0),
    }
