"""Reject cross-environment API access before any database work."""
import re
from urllib.parse import urlsplit


def rejects_environment_request(headers, active_cluster):
    required = headers.get('x-termjobs-required-cluster')
    if required and required != active_cluster:
        return True
    if active_cluster != 'main':
        return False
    # If the backend itself is receiving the request on localhost / 127.0.0.1, it is local development
    req_host = (headers.get('host') or '').split(':')[0].strip().lower()
    if req_host in ('localhost', '127.0.0.1', '::1'):
        return False
    for name in ('origin', 'referer'):
        try:
            host = urlsplit(headers.get(name, '')).hostname or ''
        except ValueError:
            return True
        if host in ('localhost', '127.0.0.1', '::1', 'qa.termjobs.in', 'dev.termjobs.in'):
            return True
        if re.fullmatch(r'(?:term-jobs|termjobs)(?:-git-(?:qa|dev)-[a-z0-9-]+|-(?:qa|dev))\.vercel\.app', host):
            return True
    return False
