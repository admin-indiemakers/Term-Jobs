"""Read application records without confusing them with shortlists or schedules."""
import re


def application_reply(prompt, database):
    text = prompt.lower()
    if not re.search(r'\b(applied|applicants?|applications?)\b', text):
        return None
    if not re.search(r'\b(list|show|give|who|breakdown|details|all|fetch|display|get|how\s+many|count|number\s+of|total)\b', text):
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
        return {'reply': "I couldn't find any candidate applications for your requisitions.", 'executed_actions': [{'tool': 'list_candidate_applications', 'result': []}]}
    def value(row, *keys):
        for key in keys:
            result = row.get(key)
            if result is not None and result != '':
                if isinstance(result, (list, tuple)):
                    return ', '.join(map(str, result)) or 'Not recorded'
                return str(result)
        return 'Not recorded'
    columns = ['Candidate', 'Application ID', 'Requisition', 'Applied at', 'Stage', 'Screening summary', 'Score', 'Recruiter / vendor', 'Interview feedback', 'Compliance / verification']
    applications = []
    for row in rows:
        cells = [value(row, 'candidate_name', 'name', 'candidate_id'), value(row, 'id', 'submission_id', '_id'),
            req_map[row['requisition_id']].get('title') or row['requisition_id'],
            value(row, 'applied_at', 'submitted_at', 'created_at'), value(row, 'status', 'stage'),
            value(row, 'screening_summary', 'summary'), value(row, 'match_score', 'score'),
            value(row, 'recruiter_name', 'vendor_name', 'recruiter_id', 'vendor_id'),
            value(row, 'interview_feedback', 'feedback'), value(row, 'background_verification_status', 'bgv_status', 'compliance_status')]
        applications.append(dict(zip(['candidate_name', 'id', 'requisition_title', 'applied_at', 'status', 'screening_summary', 'match_score', 'recruiter', 'interview_feedback', 'compliance_status'], cells)))

    # Direct answer for count inquiries (e.g. "How many candidates have applied to my requisitions")
    is_count_query = bool(re.search(r'\b(how\s+many|count|number\s+of|total)\b', text) and not re.search(r'\b(table|details|columns|csv)\b', text))
    if is_count_query:
        count = len(rows)
        stages = {}
        for r in rows:
            st = str(r.get('status') or r.get('stage') or 'Applied').title()
            stages[st] = stages.get(st, 0) + 1
        breakdown = ', '.join(f"{cnt} {st.lower()}" for st, cnt in stages.items())
        reply_msg = f"A total of **{count} candidate{'s have' if count != 1 else ' has'} applied** to your requisitions ({breakdown})."
        return {'reply': reply_msg, 'executed_actions': [{'tool': 'list_candidate_applications', 'result': applications}]}

    lines = [f'Here are the **{len(rows)} candidate application(s)** for your requisitions:', '', '| ' + ' | '.join(columns) + ' |', '|' + '|'.join(['---'] * len(columns)) + '|']
    for row in rows:
        cells = [value(row, 'candidate_name', 'name', 'candidate_id'), value(row, 'id', 'submission_id', '_id'),
            req_map[row['requisition_id']].get('title') or row['requisition_id'],
            value(row, 'applied_at', 'submitted_at', 'created_at'), value(row, 'status', 'stage'),
            value(row, 'screening_summary', 'summary'), value(row, 'match_score', 'score'),
            value(row, 'recruiter_name', 'vendor_name', 'recruiter_id', 'vendor_id'),
            value(row, 'interview_feedback', 'feedback'), value(row, 'background_verification_status', 'bgv_status', 'compliance_status')]
        lines.append('| ' + ' | '.join(str(cell).replace('|', '\\|').replace('\n', ' ') for cell in cells) + ' |')
    lines.extend(['', 'Fields marked “Not recorded” were not provided in the candidate submission.'])
    return {'reply': '\n'.join(lines), 'executed_actions': [{'tool': 'list_candidate_applications', 'result': applications}]}
