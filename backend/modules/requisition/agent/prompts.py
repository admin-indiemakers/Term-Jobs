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
    "contract": "What is the contract duration / engagement? (e.g. 6 months, 1 year, Permanent)",
}

GAP_ORDER = ["stack", "seniority", "years", "location", "rate", "contract"]

_CONTRACT_SECTION = (
    "Contract duration / engagement: {contract_duration}\n"
)

JD_SECTIONS = (
    "Write sections: About the role, What you will do, Requirements (must-have), "
    "Nice to have, Experience and compensation, "
    "Contract duration / engagement, How to apply. "
    "The \"Contract duration / engagement\" section is MANDATORY: always write it "
    "using the contract duration from the structured role ({contract_duration}); "
    "if none is known write \"To be confirmed\". Keep it concise."
)

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

ROLE_REFINE_PROMPT = """You are refining a previously generated structured job
role based on feedback from the hiring manager. Keep everything already
agreed, and only change what the feedback requires.

Company profile:
{profile}

Current structured role (JSON):
{role}

Hiring manager feedback:
{instruction}

Return the FULL updated StructuredRole JSON object — same shape as the current
role — with the requested additions or changes applied. Set `confidence`
between 0 and 1.
"""

JD_REFINE_PROMPT = """You are a senior technical recruiter refining an existing
job description based on feedback from the hiring manager.

Company profile:
{profile}

Current job description:
{jd}

Updated structured role:
{role}

Hiring manager feedback:
{instruction}

Return the FULL updated job description in Markdown, incorporating the
feedback while keeping the parts that were not asked to change. {sections}
"""

JD_GENERATION_PROMPT = """You are a senior technical recruiter. Write a clear,
engaging job description in Markdown for the following role.

Company profile:
{profile}

Role intent:
{intent}

Structured role:
{role}

{sections}
"""

COVERAGE_CHECK_PROMPT = """Given the company's registered tech stack and the
required skills for this role, answer whether the role is fully covered by the
registered stack. Return JSON: {{"covered": bool, "missing_skills": [..],
"reason": "..."}}"""