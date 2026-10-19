"""Read application records without confusing them with shortlists or schedules."""
import re


def application_reply(prompt, database):
    text = prompt.lower()
    if not re.search(r'\b(applied|applicants?|applications?)\b', text):
        return None
    if not re.search(r'\b(list|show|give|who|breakdown|details|all|fetch|display|get)\b', text):
        return None
    if re.search(r'^\s*(reject|approve|delete|update|schedule)\b', text):
        return None
    # database is the request-scoped facade, never the unrestricted connection.
    requisitions = list(database['requisitions'].find({}))
    selected = [row for row in requisitions if
        (row.get('title') and row['title'].lower() in text) or
        (row.get('id') and re.search(r'(?<![\w-])' + re.escape(str(row['id']).lower()) + r'(?![\w-])', text))]
    if not selected:
        target = re.search(r'\bfor\s+(?:the\s+)?(.+?)(?:[?.]|$)', text)
        if target and not re.fullmatch(r'(?:all\s+|my\s+|open\s+|active\s+|current\s+|job\s+)*(?:requisitions?|jobs?|roles?|positions?)', target.group(1).strip()):
            return {'reply': 'Please provide the exact requisition title or ID so I can list its applications.', 'executed_actions': []}
        selected = requisitions
    if re.search(r'\b(open|active)\b', text):
        selected = [row for row in selected if re.sub(r'[^a-z]', '', str(row.get('status') or '').lower()) in ('published', 'open', 'active')]
    req_map = {row['id']: row for row in selected if row.get('id')}
    rows = list(database['candidate_submissions'].find({'requisition_id': {'$in': list(req_map)}}))
    if not rows:
        return {'reply': 'No applications were found for the requested requisition(s) in your authorized records.', 'executed_actions': [{'tool': 'list_candidate_applications', 'result': []}]}
    def value(row, *keys):
        for key in keys:
            result = row.get(key)
            if result is not None and result != '':
                if isinstance(result, (list, tuple)):
                    return ', '.join(map(str, result)) or 'Not recorded'
                return str(result)
        return 'Not recorded'
    columns = ['Candidate', 'Application ID', 'Requisition', 'Applied at', 'Stage', 'Screening summary', 'Score', 'Recruiter / vendor', 'Interview feedback', 'Compliance / verification']
    lines = [f'Found **{len(rows)} application(s)** in your authorized requisitions. Each row represents an application; shortlist status is shown only when recorded.', '', '| ' + ' | '.join(columns) + ' |', '|' + '|'.join(['---'] * len(columns)) + '|']
    applications = []
    for row in rows:
        cells = [value(row, 'candidate_name', 'name', 'candidate_id'), value(row, 'id', 'submission_id', '_id'),
            req_map[row['requisition_id']].get('title') or row['requisition_id'],
            value(row, 'applied_at', 'submitted_at', 'created_at'), value(row, 'status', 'stage'),
            value(row, 'screening_summary', 'summary'), value(row, 'match_score', 'score'),
            value(row, 'recruiter_name', 'vendor_name', 'recruiter_id', 'vendor_id'),
            value(row, 'interview_feedback', 'feedback'), value(row, 'background_verification_status', 'bgv_status', 'compliance_status')]
        applications.append(dict(zip(['candidate_name', 'id', 'requisition_title', 'applied_at', 'status', 'screening_summary', 'match_score', 'recruiter', 'interview_feedback', 'compliance_status'], cells)))
        lines.append('| ' + ' | '.join(str(cell).replace('|', '\\|').replace('\n', ' ') for cell in cells) + ' |')
    lines.extend(['', '“Not recorded” means that detail is absent from the application record; it does not mean the candidate failed a check.'])
    return {'reply': '\n'.join(lines), 'executed_actions': [{'tool': 'list_candidate_applications', 'result': applications}]}
