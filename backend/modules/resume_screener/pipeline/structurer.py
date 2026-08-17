"""
Stage 3 â€” Resume Structuring (LLM)
Parses cleaned resume text into a bias-free structured JSON object.
Explicitly excludes: name, gender, age, photo, address, religion/caste, marital status.
"""
import logging
from typing import Optional

from modules.resume_screener.models.schemas import StructuredResume
from modules.resume_screener.utils.llm_client import call_ollama, extract_json_from_response

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a resume parser. Your job is to extract structured information from resume text.

CRITICAL RULES:
1. Return ONLY valid JSON â€” no explanations, no markdown prose outside the JSON.
2. Do NOT include: candidate name, gender, age, date of birth, photo, address, phone number, email, marital status, religion, caste, nationality, or any other personal identifying information.
3. Focus on: skills, projects, work experience, education, certifications, GitHub/portfolio URLs.
4. If a field has no data, return an empty list [] or null.
5. For duration_months, estimate from date ranges if given (e.g., "Jan 2022 â€“ Dec 2022" = 12).
"""

EXTRACTION_PROMPT = """Extract the following fields from the resume text below into a JSON object.

Required JSON schema:
{{
  "skills": ["list of technical skills, tools, languages, frameworks"],
  "projects": [
    {{
      "name": "project name",
      "description": "detailed description of what was built",
      "technologies": ["tech1", "tech2"],
      "outcome": "measurable outcome if mentioned (e.g. 40% latency reduction)"
    }}
  ],
  "experience": [
    {{
      "role": "job title",
      "company": "company name",
      "duration_months": 12,
      "description": "what they did",
      "technologies": ["tech used"]
    }}
  ],
  "education": [
    {{
      "degree": "B.Tech / B.Sc / M.Tech etc.",
      "field": "Computer Science / IT etc.",
      "institution": "university name",
      "year": 2023
    }}
  ],
  "certifications": ["cert1", "cert2"],
  "github_url": "https://github.com/username or null",
  "portfolio_url": "https://... or null",
  "raw_text_for_embedding": "a clean 200-300 word summary of skills, experience, and projects for semantic search"
}}

Resume text:
\"\"\"
{resume_text}
\"\"\"

Return ONLY the JSON object:"""


async def structure_resume(resume_text: str) -> StructuredResume:
    """
    Call LLM to parse resume text into structured JSON.
    After LLM extraction, augments skills via regex scan of raw text
    to catch any skills the LLM missed.
    """
    import re

    # Truncate very long resumes to avoid context overflow
    truncated_text = resume_text[:8000] if len(resume_text) > 8000 else resume_text

    prompt = EXTRACTION_PROMPT.format(resume_text=truncated_text)

    structured = None
    try:
        raw_response = await call_ollama(prompt, system_prompt=SYSTEM_PROMPT, temperature=0.05)
        data = extract_json_from_response(raw_response)
        if data:
            structured = StructuredResume(**data)
    except Exception as e:
        logger.error(f"Resume structuring failed: {e}")

    if structured is None:
        logger.warning("LLM returned empty JSON for resume structuring, using fallback")
        structured = _fallback_structure(resume_text)

    # â”€â”€ Skill augmentation: scan raw text for skills LLM missed â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    KNOWN_SKILLS = re.compile(
        r"\b(Python|FastAPI|Django|Flask|LangChain|LangGraph|MCP|"
        r"Model Context Protocol|RAG|Retrieval.Augmented Generation|"
        r"FAISS|HuggingFace|Hugging Face|Gemini|Groq|OpenRouter|"
        r"Prompt Engineering|REST API|GraphQL|Docker|Kubernetes|"
        r"PostgreSQL|MySQL|MongoDB|Redis|SQLite|"
        r"React|TypeScript|JavaScript|HTML|CSS|"
        r"LLM|Large Language Model|NLP|Machine Learning|Deep Learning|"
        r"TensorFlow|PyTorch|scikit.learn|pandas|NumPy|"
        r"AWS|GCP|Azure|Git|GitHub|Flutter|Dart|"
        r"DeepEval|OpenEvals|LangSmith|Streamlit|"
        r"AI Agents?|Tool Calling|Function Calling|"
        r"Speech.to.Text|STT|Text.to.Speech|TTS|"
        r"Event.Driven|Microservices|FastAPI|ESP32|IoT)\b",
        re.IGNORECASE,
    )
    found_in_raw = set(KNOWN_SKILLS.findall(resume_text))
    existing_lower = {s.lower() for s in structured.skills}
    for skill in found_in_raw:
        if skill.lower() not in existing_lower:
            structured.skills.append(skill)
            existing_lower.add(skill.lower())
    logger.debug(f"Skills after augmentation: {len(structured.skills)}")

    # â”€â”€ Always store actual raw text for reliable downstream text matching â”€â”€â”€â”€â”€â”€â”€
    # The LLM summary is good for semantic embedding but insufficient for keyword
    # searches (problem solving, experience, skill matching).
    # We always append the actual resume text so all scorers have full coverage.
    if not structured.raw_text_for_embedding or len(structured.raw_text_for_embedding) < 100:
        structured.raw_text_for_embedding = resume_text[:3000]
    else:
        # Keep LLM summary + append real text for keyword searches
        structured.raw_text_for_embedding = (
            structured.raw_text_for_embedding.strip() + "\n\n" + resume_text[:2500]
        )

    return structured






def _fallback_structure(resume_text: str) -> StructuredResume:
    """Minimal fallback structure if LLM fails â€” at least preserve raw text for embedding."""
    return StructuredResume(
        skills=[],
        projects=[],
        experience=[],
        education=[],
        certifications=[],
        github_url=_extract_github_url_regex(resume_text),
        raw_text_for_embedding=resume_text[:3000],
    )


def _extract_github_url_regex(text: str) -> Optional[str]:
    """Regex fallback to find GitHub URLs â€” handles with and without https://."""
    import re
    # Match with or without protocol, with or without www
    match = re.search(
        r"(?:https?://)?(?:www\.)?github\.com/([A-Za-z0-9_-]+)(?:/[^\s,)]*)?" ,
        text,
        re.IGNORECASE,
    )
    if match:
        username = match.group(1)
        # Skip common non-user paths
        if username.lower() not in ("features", "about", "pricing", "login", "signup", "orgs"):
            return f"https://github.com/{username}"
    return None

