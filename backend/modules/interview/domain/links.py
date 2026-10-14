from urllib.parse import urlencode


def is_ai_round(round_doc):
    return str(round_doc.get('round_name') or '').upper().startswith('AI') or str(round_doc.get('round_type') or '').lower() == 'ai'


def candidate_interview_link(round_doc, domain='https://termjobs.in'):
    path = 'ai' if is_ai_round(round_doc) else 'room'
    return f"{domain}/interview/{path}/{round_doc['id']}?" + urlencode({
        'role': 'candidate', 'token': round_doc.get('candidate_token') or '',
    })
