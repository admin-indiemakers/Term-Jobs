"""Database-backed chat reads that do not require a model completion."""
import re


def candidate_reply(prompt, database, requisition_id=None):
    if requisition_id is None and not (
        re.match(r'^\s*(?:please\s+)?(?:show|list|view|display|fetch|get|see)\b', prompt, re.I)
        and re.search(r'\b(?:candidates?|shortlisted)\b', prompt, re.I)
        and not re.search(r'\b(?:reject|approve|delete|schedule|send|update)\b', prompt, re.I)
    ):
        return None
    requisitions = list(database['requisitions'].find({}))
    if requisition_id is not None:
        selected = [r for r in requisitions if str(r.get('id')) == requisition_id]
    else:
        target = re.search(r'\bfor\s+(.+?)[?.!]*$', prompt, re.I)
        title = target.group(1).strip().casefold() if target else None
        selected = [r for r in requisitions if not title or str(r.get('title', '')).casefold() == title or str(r.get('id', '')).casefold() == title]
    if not selected:
        return {'reply': 'I could not find that requisition in your authorized records. Choose a requisition from your list.', 'executed_actions': []}
    if len(selected) > 1 and (requisition_id is not None or re.search(r'\bfor\b', prompt, re.I)):
        return {'reply': 'More than one requisition has that title. Use the Candidates button on the intended requisition.', 'executed_actions': []}
    titles = {str(r['id']): r.get('title', '') for r in selected if r.get('id')}
    rows = list(database['candidate_submissions'].find({'requisition_id': {'$in': list(titles)}}))
    if re.search(r'\bshortlisted\b', prompt, re.I):
        rows = [r for r in rows if str(r.get('status', '')).lower() in ('shortlisted', 'interviewing', 'under_review')]
    fields = ('candidate_id', 'candidate_email', 'email', 'status', 'match_score', 'skills', 'matched_skills', 'summary', 'vendor_name', 'requisition_id')
    candidates = [{**{key: r[key] for key in fields if key in r}, 'id': str(r.get('id') or r.get('_id') or ''),
                   'candidate_name': r.get('candidate_name') or r.get('name') or 'Name not recorded',
                   'requisition_title': titles[str(r['requisition_id'])]} for r in rows]
    return {'reply': f'Found {len(candidates)} candidate application(s) in your authorized requisitions.' if candidates else 'No candidate applications were found for this selection.',
            'executed_actions': [{'tool': 'list_requisition_candidates', 'result': candidates}]}
