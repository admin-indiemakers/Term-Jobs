"""
Candidate Resume Extractor & Structurer
Uses dedicated Groq LLM API to extract candidate identity and qualifications:
- Full Name
- Email Address
- Phone Number
- Job Title / Role
- Skills
- Professional Summary
- Experience
"""
import os
import re
import json
import logging
from typing import Any, Dict, Optional
from groq import AsyncGroq
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

# Dedicated Groq Key for Candidate Bank Parsing (falls back to primary GROQ_API_KEY)
CANDIDATE_GROQ_API_KEY = os.getenv("GROQ_API_KEY_CANDIDATE") or os.getenv("GROQ_API_KEY")
GROQ_MODEL = os.getenv("GROQ_MODEL") or "openai/gpt-oss-120b"

CANDIDATE_EXTRACTION_SYSTEM = """You are an expert HR and recruitment AI parser.
Your task is to accurately extract candidate contact information, professional title, skills, and summary from the given resume text.

CRITICAL RULES:
1. Output MUST be strictly valid JSON without any markdown or code blocks outside the JSON.
2. Extract the actual candidate full name, email, phone number, and current or most recent job title/role.
3. Extract all relevant technical and professional skills as a clean list of strings.
4. If a field cannot be found, provide null (or [] for skills).
"""

CANDIDATE_EXTRACTION_PROMPT = """Extract the candidate profile information from the following resume text into JSON format.

Required JSON format:
{{
  "candidate_name": "Full Name (e.g. John Doe)",
  "candidate_email": "email@domain.com or null",
  "candidate_phone": "+1 555-0199 or phone number or null",
  "candidate_title": "Primary Job Title / Role (e.g. Senior Full Stack Engineer, React Developer)",
  "skills": ["Skill 1", "Skill 2", "Skill 3"],
  "experience_years": 5,
  "summary": "Concise 2-3 sentence executive profile summary of the candidate's background and core expertise"
}}

Resume text:
\"\"\"
{resume_text}
\"\"\"

Return ONLY the JSON object:"""


async def extract_candidate_profile(resume_text: str, filename: str = "") -> Dict[str, Any]:
    """
    Extract structured candidate profile from resume text using Groq LLM with regex heuristics fallback.
    """
    if not resume_text or not resume_text.strip():
        return _build_fallback_profile("", filename)

    truncated_text = resume_text[:7500]
    prompt = CANDIDATE_EXTRACTION_PROMPT.format(resume_text=truncated_text)

    parsed_data = None
    try:
        client = AsyncGroq(api_key=CANDIDATE_GROQ_API_KEY)
        response = await client.chat.completions.create(
            messages=[
                {"role": "system", "content": CANDIDATE_EXTRACTION_SYSTEM},
                {"role": "user", "content": prompt},
            ],
            model=GROQ_MODEL,
            temperature=0.05,
            response_format={"type": "json_object"},
        )
        content = response.choices[0].message.content
        if content:
            parsed_data = json.loads(content.strip())
    except Exception as e:
        logger.warning(f"Groq candidate profile extraction failed ({e}), attempting fallback model or heuristics...")
        # Try fallback model if first one fails
        try:
            client = AsyncGroq(api_key=CANDIDATE_GROQ_API_KEY)
            response = await client.chat.completions.create(
                messages=[
                    {"role": "system", "content": CANDIDATE_EXTRACTION_SYSTEM},
                    {"role": "user", "content": prompt},
                ],
                model="openai/gpt-oss-20b",
                temperature=0.05,
                response_format={"type": "json_object"},
            )
            content = response.choices[0].message.content
            if content:
                parsed_data = json.loads(content.strip())
        except Exception as e2:
            logger.warning(f"Secondary Groq model extraction failed ({e2}), using regex fallback.")

    # Fallback or Augment if any field is missing
    fallback = _build_fallback_profile(resume_text, filename)
    
    if not parsed_data:
        parsed_data = fallback
    else:
        # Fill missing values from fallback regex
        if not parsed_data.get("candidate_name") or parsed_data.get("candidate_name") in ("Full Name", "Candidate", "null", None):
            parsed_data["candidate_name"] = fallback["candidate_name"]
            
        if not parsed_data.get("candidate_email"):
            parsed_data["candidate_email"] = fallback["candidate_email"]
            
        if not parsed_data.get("candidate_phone"):
            parsed_data["candidate_phone"] = fallback["candidate_phone"]
            
        if not parsed_data.get("candidate_title") or parsed_data.get("candidate_title") in ("Professional", "Software Engineer", None):
            if fallback["candidate_title"]:
                parsed_data["candidate_title"] = fallback["candidate_title"]
            else:
                parsed_data["candidate_title"] = parsed_data.get("candidate_title") or "Software Engineer"
                
        # Augment skills with known skill patterns
        extracted_skills = parsed_data.get("skills") or []
        if isinstance(extracted_skills, list):
            existing_lower = {s.lower() for s in extracted_skills if isinstance(s, str)}
            for s in fallback["skills"]:
                if s.lower() not in existing_lower:
                    extracted_skills.append(s)
                    existing_lower.add(s.lower())
            parsed_data["skills"] = extracted_skills
        else:
            parsed_data["skills"] = fallback["skills"]

        if not parsed_data.get("summary"):
            parsed_data["summary"] = fallback["summary"]

    return parsed_data


def _build_fallback_profile(resume_text: str, filename: str = "") -> Dict[str, Any]:
    """Regex-based fallback extraction for email, phone, name, and skills."""
    # 1. Email extraction
    email = None
    email_match = re.search(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+', resume_text)
    if email_match:
        email = email_match.group(0).strip().rstrip('.')

    # 2. Phone extraction (handles +, international codes, parentheses, dashes, spaces)
    phone = None
    phone_match = re.search(
        r'(?:(?:\+|00)\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)?\d{3,5}[-.\s]?\d{3,5}',
        resume_text
    )
    if phone_match:
        p_str = phone_match.group(0).strip()
        digits_only = re.sub(r'\D', '', p_str)
        if 8 <= len(digits_only) <= 15:
            phone = p_str

    # 3. Name extraction (from top lines before contact info or filename)
    name = None
    lines = [l.strip() for l in resume_text.split('\n') if l.strip()]
    for line in lines[:6]:
        if '@' in line or 'http' in line or re.search(r'\d{5,}', line):
            continue
        if 2 <= len(line.split()) <= 4 and len(line) < 40 and not any(kw in line.lower() for kw in ['resume', 'curriculum', 'profile', 'page', 'summary', 'contact']):
            name = line
            break
            
    if not name and filename:
        clean_fn = os.path.splitext(filename)[0]
        clean_fn = re.sub(r'[-_]', ' ', clean_fn)
        clean_fn = re.sub(r'\b(resume|cv|profile|latest|updated|\d+)\b', '', clean_fn, flags=re.IGNORECASE).strip()
        if clean_fn:
            name = clean_fn.title()

    if not name:
        name = "Candidate"

    # 4. Title extraction
    title = "Software Engineer"
    for line in lines[:8]:
        lower = line.lower()
        if any(kw in lower for kw in ['developer', 'engineer', 'architect', 'lead', 'manager', 'consultant', 'analyst', 'designer', 'specialist']):
            if len(line) < 60 and not any(kw in lower for kw in ['experience', 'work', 'project']):
                title = line
                break

    # 5. Skills scanning
    KNOWN_SKILLS = re.compile(
        r"\b(Python|FastAPI|Django|Flask|React|Next\.js|Vue|Angular|TypeScript|JavaScript|"
        r"Node\.js|Express|Java|Spring Boot|C\+\+|C#|\.NET|Golang|Rust|PHP|Laravel|"
        r"Docker|Kubernetes|AWS|GCP|Azure|Terraform|CI/CD|Git|GitHub|"
        r"PostgreSQL|MySQL|MongoDB|Redis|GraphQL|REST API|Kafka|RabbitMQ|"
        r"Machine Learning|Deep Learning|NLP|LLM|PyTorch|TensorFlow|LangChain|LangGraph|"
        r"HTML5|CSS3|TailwindCSS|Redux|SQL|Linux|Figma|Microservices)\b",
        re.IGNORECASE,
    )
    skills = list(dict.fromkeys(KNOWN_SKILLS.findall(resume_text)))

    summary = (
        f"{name} is a {title} with expertise in {', '.join(skills[:5]) if skills else 'software development'}."
    )

    return {
        "candidate_name": name,
        "candidate_email": email,
        "candidate_phone": phone,
        "candidate_title": title,
        "skills": skills,
        "experience_years": None,
        "summary": summary,
    }
