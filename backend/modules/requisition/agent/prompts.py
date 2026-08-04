"""Prompt templates for the Job Requirement Agent.

Question phrasing is templated (deterministic) so the intake loop costs no
LLM calls; the LLM is reserved for JD text + structured role generation.
"""

NEXT_QUESTION_TEMPLATES = {
    "stack": (
        "Which tech stack and key skills must the candidate have? "
        "(e.g. Python, Django, Postgres)"
    ),
    "seniority": "What seniority level? (Junior / Mid / Senior / Lead / Principal)",
    "years": "How many years of experience are required?",
    "location": "Where is the role based? (city or Remote)",
    "rate": "What is the annual salary band in INR? (e.g. 25 LPA)",
}

GAP_ORDER = ["stack", "seniority", "years", "location", "rate"]

ROLE_EXTRACTION_PROMPT = """You are extracting a structured job role.

Company profile:
{profile}

Role the hiring manager wants:
{intent}

Collected answers from the intake conversation:
{answers}

Produce a StructuredRole JSON object. Be conservative about skills: only
include skills explicitly stated in the profile, intent, or answers. Set
`confidence` between 0 and 1 reflecting how fully the role could be specified.
"""

JD_GENERATION_PROMPT = """You are a senior technical recruiter. Write a clear,
engaging job description in Markdown for the following role.

Company profile:
{profile}

Role intent:
{intent}

Structured role:
{role}

Write sections: About the role, What you will do, Requirements (must-have),
Nice to have, Experience and compensation, How to apply. Keep it concise.
"""

COVERAGE_CHECK_PROMPT = """Given the company's registered tech stack and the
required skills for this role, answer whether the role is fully covered by the
registered stack. Return JSON: {{"covered": bool, "missing_skills": [..],
"reason": "..."}}"""