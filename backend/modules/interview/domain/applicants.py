def attended_applicants(database, submissions):
    """Applications qualify for the hiring pipeline only after a completed interview."""
    submissions = list(submissions)
    req_ids = list({str(row.get('requisition_id')) for row in submissions if row.get('requisition_id')})
    rounds = list(database['interview_rounds'].find({'requisition_id': {'$in': req_ids}, 'status': 'Completed'}))
    def attended(sub):
        ids = {str(value) for value in (sub.get('id'), sub.get('submission_id')) if value}
        email = str(sub.get('candidate_email') or '').strip().lower()
        return any(str(r.get('requisition_id')) == str(sub.get('requisition_id')) and (
            str(r.get('candidate_submission_id') or '') in ids or
            (email and str(r.get('candidate_email') or '').strip().lower() == email)
        ) for r in rounds)
    return [sub for sub in submissions if attended(sub)]
