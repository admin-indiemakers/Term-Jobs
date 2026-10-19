"""Extract explicit hiring requests without depending on a model or role templates."""
import re

_PROFESSION = r'(?:engineers?|developers?|designers?|analysts?|managers?|architects?|administrators?|specialists?|recruiters?|consultants?|testers?|scientists?)'


def requested_hiring_role(prompt):
    text = prompt.strip()
    # Common profession typos must be normalized before the scope gate too.
    text = re.sub(r"\b(enginners?|enginerrs?|engeneers?|engineeers?)\b",
                  lambda match: 'engineers' if match.group().lower().endswith('s') else 'engineer',
                  text, flags=re.I)
    # Do not turn questions about a profession into draft mutations.
    prefix = re.search(
        r'\b(?:(?:create|draft|make|post)\s+(?:a\s+|an\s+)?(?:new\s+)?'
        r'(?:job\s+)?(?:requisitions?|requsitions?|requsitions|reqs?|role|job|position)\s+for\s+|'
        r'(?:i\s+)?(?:need|want|require|looking\s+for)\s+(?:to\s+hire\s+)?|hire\s+)', text, re.I,
    )
    if not prefix:
        return None
    rest = text[prefix.end():]
    match = re.match(
        rf'(?:a\s+|an\s+)?(?:(\d+)\s+)?'
        rf'((?:[\w.+#/-]+\s+){{0,6}}{_PROFESSION})\b', rest, re.I,
    )
    if not match:
        return None
    title = match.group(2).strip()
    title = re.sub(r'\b(engineer|developer|designer|analyst|manager|architect|administrator|specialist|recruiter|consultant|tester|scientist)s\b', r'\1', title, flags=re.I)
    title = title.title()
    title = re.sub(r'\bDevops\b', 'DevOps', title)
    title = re.sub(r'\bDevsecops\b', 'DevSecOps', title)
    return {'title': title, 'openings': max(1, int(match.group(1) or 1))}
