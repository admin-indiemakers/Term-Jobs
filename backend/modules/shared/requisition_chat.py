"""Deterministic date/status queries shared by portal chat agents."""
import re
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

ACTIVE = {'active', 'open', 'published', 'intake'}
CLOSED = {'closed', 'completed', 'filled'}
DRAFT = {'draft', 'drafted', 'structuring'}
PENDING = {'pending', 'pending_approval', 'pendingapproval'}


def filtered_requisition_reply(prompt, load_rows, tool_name, timezone_name='Asia/Kolkata', now=None):
    """Return a filtered listing, or None when this is not a supported list query.

    Naive database timestamps represent UTC. Calendar days use the user's timezone;
    records without valid creation timestamps cannot match a requested date.
    A date alone includes every status; status constraints must be explicit.
    """
    text = prompt.lower()
    if not re.search(r'\b(requisitions?|reqs?|jobs?|roles?|positions?|openings?)\b', text):
        return None
    if not re.search(r'\b(show|list|view|display|get|fetch|which|what)\b', text):
        return None
    if re.search(r'\b(create|update|edit|delete|publish|approve|close|archive)\b', text):
        return None
    if re.search(r'\b(candidates?|applicants?|interviews?|managers?)\b', text):
        return None
    try:
        tz = ZoneInfo(timezone_name or 'Asia/Kolkata')
    except (ZoneInfoNotFoundError, ValueError, TypeError):
        tz = ZoneInfo('Asia/Kolkata')
    today = (now or datetime.now(timezone.utc)).astimezone(tz).date()
    requested_date = None
    if re.search(r'\byesterday\b', text):
        requested_date = today - timedelta(days=1)
    elif re.search(r'\btoday\b', text):
        requested_date = today
    else:
        match = re.search(r'\b\d{4}-\d{2}-\d{2}\b', text)
        if match:
            try:
                requested_date = date.fromisoformat(match.group())
            except ValueError:
                return {'reply': 'Please provide a valid creation date in YYYY-MM-DD format.', 'executed_actions': []}
    statuses = set()
    labels = []
    for pattern, values, label in [
        (r'\b(inactive|non[- ]active)\b', CLOSED | {'inactive', 'expired', 'archived', 'cancelled', 'canceled', 'rejected'}, 'inactive'),
        (r'(?<!non-)(?<!non )\b(active|live|open|published)\b', ACTIVE, 'active'),
        (r'\b(closed|completed|filled)\b', CLOSED, 'closed'),
        (r'\b(drafts?|drafted)\b', DRAFT, 'draft'),
        (r'\b(pending|awaiting approval)\b', PENDING, 'pending approval'),
        (r'\bexpired\b', {'expired'}, 'expired'),
        (r'\barchived\b', {'archived'}, 'archived'),
        (r'\b(cancelled|canceled)\b', {'cancelled', 'canceled'}, 'cancelled'),
    ]:
        if re.search(pattern, text):
            statuses.update(values)
            labels.append(label)
    if requested_date is None and not statuses:
        return None
    rows = []
    for row in load_rows():
        status = str(row.get('status') or '').strip().lower().replace(' ', '_')
        if statuses and status not in statuses:
            continue
        if requested_date is not None:
            value = row.get('created_at')
            try:
                stamp = value if isinstance(value, datetime) else datetime.fromisoformat(str(value).replace('Z', '+00:00'))
                stamp = stamp.replace(tzinfo=timezone.utc) if stamp.tzinfo is None else stamp
                if stamp.astimezone(tz).date() != requested_date:
                    continue
            except (ValueError, TypeError):
                continue
        rows.append(row)
    description = ' / '.join(labels) + ' requisitions' if labels else 'requisitions'
    if requested_date:
        description += f' created on {requested_date.isoformat()} ({tz.key})'
    reply = f'Found {len(rows)} {description}.'
    if rows:
        def cell(value):
            return str(value or '').replace('|', '\\|').replace('\n', ' ')
        reply += '\n\n| Requisition | Status | Created at |\n| --- | --- | --- |\n'
        reply += '\n'.join(f"| {cell(r.get('title'))} | {cell(r.get('status'))} | {cell(r.get('created_at'))} |" for r in rows)
    return {'reply': reply, 'executed_actions': [{'tool': tool_name, 'result': rows}]}
