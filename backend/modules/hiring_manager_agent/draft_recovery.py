"""Conservative recovery of explicit staffing requests when completion fails."""
import re
from datetime import datetime
from zoneinfo import ZoneInfo


def recover_staffing_request(prompt, now=None):
    # Only the current explicit staffing request; never recycle another draft's fields.
    match = re.match(r'^\s*(?:a\s+)?(?:i\s+|we\s+)?(?:need|want|require|hire|looking for)\s+(?:a\s+|an\s+)?(.+?)\s*[.!?]*$', prompt, re.I)
    if not match or re.search(r'\b(?:do not|don.t|cancel|instead of)\b', prompt, re.I):
        return None
    text = match[1]
    title = re.split(r'\s+(?:with|starting|start|in|for|who)\b|[,;]', text, maxsplit=1, flags=re.I)[0].strip()
    if not re.search(r'\b(?:engineer|developer|tester|analyst|designer|executive|manager|specialist|architect)\b', title, re.I):
        return None
    if len(title.split()) > 8:
        return None
    title = re.sub(r'\bdevops\b', 'DevOps', title.title(), flags=re.I)
    title = re.sub(r'\bfd\b', 'Forward Deployed', title, flags=re.I)
    experience = re.search(r'\b(\d+(?:\s*[-–]\s*\d+)?)\s*years?\s*(?:of\s+)?experience\b', prompt, re.I)
    start = ''
    if re.search(r'\b(?:starting|start)(?:\s+work)?\s+next\s+month\b', prompt, re.I):
        today = now or datetime.now(ZoneInfo('Asia/Kolkata'))
        start = today.replace(year=today.year + (today.month == 12), month=today.month % 12 + 1, day=1).strftime('%B %Y')
    return {'title': title, 'experience_level': f'{experience[1]} years' if experience else '',
            'target_start_date': start, 'salary_range': 'To be confirmed',
            'skills': 'To be confirmed', 'job_description': prompt.strip()}
