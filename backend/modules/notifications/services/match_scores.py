"""Resolve displayed fit from the candidate's own requisition submission."""
import math


def recorded_match_score(value):
    try:
        score = float(value)
        return score if math.isfinite(score) and 0 <= score <= 100 else None
    except (TypeError, ValueError):
        return None


def submission_match_score(record, submissions):
    requisition = str(record.get('requisition_id') or '')
    if not requisition:
        return recorded_match_score(record.get('match_score'))
    submission_id = str(record.get('submission_id') or record.get('id') or '')
    email = str(record.get('candidate_email') or '').strip().casefold()
    candidate_id = str(record.get('candidate_id') or record.get('workorder_id') or '')
    candidates = []
    for submission in submissions:
        if str(submission.get('requisition_id') or '') != requisition:
            continue
        other_email = str(submission.get('candidate_email') or '').strip().casefold()
        # Conflicting known identities must never share a score.
        if email and other_email and email != other_email:
            continue
        sid = str(submission.get('id') or submission.get('_id') or '')
        if submission_id and submission_id == sid:
            return recorded_match_score(submission.get('match_score'))
        ids = {str(submission.get(key) or '') for key in ('candidate_id', 'workorder_id')}
        if (email and email == other_email) or (candidate_id and candidate_id in ids):
            candidates.append(submission)
    if candidates:
        latest = max(candidates, key=lambda row: str(row.get('updated_at') or row.get('created_at') or ''))
        return recorded_match_score(latest.get('match_score'))
    # Keep historical selections with no surviving source record, without a name-only join.
    return recorded_match_score(record.get('match_score'))
