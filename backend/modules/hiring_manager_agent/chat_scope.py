"""Deterministic topic routing before calendar, AI, or hiring actions run."""
import re

from modules.company_admin_agent.scope import is_admin_request_in_scope

SCOPE_REPLY = (
    "I can help with hiring tasks in TermJobs: requisitions, candidates, "
    "interviews, onboarding, and your team's work. Please ask about one of those tasks."
)


def is_hiring_request_in_scope(prompt, history=None):
    # Normalize both the web client and API conversation formats.
    normalized = [
        {"role": item.get("role") or item.get("sender"),
         "content": item.get("content") or item.get("text") or ""}
        for item in history or [] if isinstance(item, dict)
    ]
    if is_admin_request_in_scope(prompt, normalized):
        return True
    if re.search(
        r"\b(pipeline|expenses?|reimbursements?|timecards?|workforce|"
        r"my\s+(?:team|tasks|account)|pending\s+works|how\s+(?:do\s+i\s+)?use\s+this|"
        r"urequsition|requsition)\b", prompt, re.I,
    ):
        return True
    # The authorization wrapper retains only user history. Accept bounded
    # follow-ups to a hiring request without accepting new general questions.
    latest_user = next((item for item in reversed(normalized) if item['role'] == 'user'), None)
    if latest_user and is_admin_request_in_scope(latest_user['content']):
        return is_admin_request_in_scope(prompt, [{"role": "assistant", "content": latest_user['content']}])
    return False


def scope_response():
    return {"reply": SCOPE_REPLY, "executed_actions": [], "out_of_scope": True}
