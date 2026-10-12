"""Local scope checks: rejecting unrelated admin chat must not require an LLM."""
import re

SCOPE_REPLY = (
    "I can help with TermJobs hiring operations, team accounts, requisitions, "
    "candidates, interviews, approvals, and company settings. "
    "Please ask a question about one of those tasks."
)

_DOMAIN = re.compile(
    r"\b(termjobs|hiring|hire|requisitions?|reqs?|recruit\w*|candidates?|applicants?|"
    r"applications?|interviews?|onboarding|offboarding|shortlist\w*|job\s+(?:roles?|"
    r"openings?|descriptions?|postings?)|vacanc\w*|hiring\s+managers?|directors?|"
    r"procurement|finance\s+(?:team|users?|approvals?)|approvals?|timesheets?|"
    r"workorders?|work\s+orders?|company\s+(?:profile|settings|details)|"
    r"team\s+(?:members?|accounts?|users?)|departments?|vendors?|staffing|"
    r"payroll|invoices?|contracts?|offer\s+letters?|resumes?|cv|dashboard|"
    r"calendar|cal\.com|invite\w*|passwords?|permissions?)\b", re.I
)
_UNRELATED = re.compile(
    r"\b(jokes?|poems?|recipes?|horoscopes?|weather|sports|movies?|songs?|"
    r"capital\s+of|solve\s+(?:this\s+)?(?:math|equation)|"
    r"(?:python|javascript|java|c\+\+)\s+(?:code|program|snippet)|"
    r"(?:write|send|give|generate|debug)\b.{0,40}\b(?:code|program|snippet))\b", re.I
)
_PLEASANTRY = re.compile(
    r"^(hi|hello|hey|good\s+(morning|afternoon|evening|day)|greetings|howdy|yo|"
    r"hi\s+there|hello\s+there|sup|thanks|thank\s+you|help|who\s+are\s+you|"
    r"what\s+can\s+you\s+do|what\s+do\s+you\s+do)[\s!.,?]*$", re.I
)


def is_admin_request_in_scope(prompt: str, history: list | None = None) -> bool:
    text = prompt.strip()
    # Generating interview questions and job requirements is a hiring task.
    if _UNRELATED.search(text) and not re.search(
        r"\b(interview\s+(?:questions?|assessment|exercise)|job\s+description|requisition)\b", text, re.I
    ):
        return False
    if _PLEASANTRY.fullmatch(text) or _DOMAIN.search(text):
        return True
    if text.startswith((
        "CONFIRM_EXECUTE_REQUISITION:", "CONFIRM_EXECUTE_INVITE:",
        "CONFIRM_SCHEDULE_INTERVIEW:", "CONFIRM_DELETE_HIRING_MANAGER:",
        "CONFIRM_UPDATE_PASSWORD:",
    )):
        return True
    # Permit bounded task follow-ups only when the latest assistant turn is in scope.
    latest = next((item for item in reversed(history or []) if item.get("role") == "assistant"), {})
    context = str(latest.get("content") or "")
    if not _DOMAIN.search(context) or _UNRELATED.search(context):
        return False
    return bool(re.fullmatch(
        r"(?:yes|no|ok|okay|confirm|proceed|cancel|continue|publish|delete|"
        r"show\s+(?:more|all)|\d+|[\w.+-]+@[\w.-]+\.\w+|"
        r"(?:change|set|update)\s+(?:it|the\s+(?:title|skills|location|salary|budget|openings|department))\s+.{1,120})[\s.!?]*",
        text, re.I,
    ))
