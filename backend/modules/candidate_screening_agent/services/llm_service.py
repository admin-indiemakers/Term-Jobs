import hashlib
import json
import re
import urllib.error
import urllib.request
from typing import Any, Dict, List, Optional
from services.email_service import extract_candidate_email

OLLAMA_URL = "http://localhost:11434/api/generate"
DEFAULT_OLLAMA_MODEL = "llama3"


def generate_resume_fingerprint(candidate_name: str, resume_text: str) -> str:
    """Generate a unique fingerprint hash for a candidate submission based on normalized name & text content."""
    clean_name = candidate_name.lower().strip()
    clean_text = re.sub(r"\s+", "", resume_text.lower()[:300])  # Normalize first 300 chars
    fingerprint_raw = f"{clean_name}:{clean_text}"
    return hashlib.md5(fingerprint_raw.encode("utf-8")).hexdigest()


def check_duplicate_submission(
    candidate_name: str,
    resume_text: str,
    existing_submissions: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """Check if the candidate or resume content has already been submitted for this requisition."""
    if not existing_submissions:
        return {"is_duplicate": False, "duplicate_reason": None}

    new_fingerprint = generate_resume_fingerprint(candidate_name, resume_text)
    clean_name = candidate_name.lower().strip()

    for item in existing_submissions:
        existing_name = item.get("candidate_name", "").lower().strip()
        existing_fp = item.get("fingerprint", "")
        
        if existing_fp and existing_fp == new_fingerprint:
            return {
                "is_duplicate": True,
                "duplicate_reason": f"Exact resume fingerprint match with previous submission (File: {item.get('filename')})"
            }
        
        if clean_name and clean_name != "candidate" and clean_name == existing_name:
            return {
                "is_duplicate": True,
                "duplicate_reason": f"Candidate '{candidate_name}' was already submitted under file '{item.get('filename')}'"
            }

    return {"is_duplicate": False, "duplicate_reason": None}


def extract_candidate_name(resume_text: str, default_filename: Optional[str] = None) -> str:
    """Extract candidate name from resume text or filename."""
    lines = [line.strip() for line in resume_text.splitlines() if line.strip()]
    if lines:
        first_line = lines[0]
        if re.match(r"^[A-Za-z\s\.]{2,40}$", first_line) and len(first_line.split()) <= 4:
            return first_line.title()
    
    if default_filename:
        clean_name = re.sub(r"\.(pdf|docx|txt)$", "", default_filename, flags=re.IGNORECASE)
        clean_name = re.sub(r"[_\-]", " ", clean_name)
        return clean_name.title()
    
    return "Candidate"


def query_ollama_ai(
    jd: str,
    resume_text: str,
    model: str = DEFAULT_OLLAMA_MODEL,
    timeout_seconds: int = 5
) -> Optional[Dict[str, Any]]:
    """Query local Ollama instance for deep AI analysis and verification of candidate fit."""
    prompt = f"""You are an expert HR Screening AI. Evaluate the following candidate resume against the Job Description.

Job Description:
{jd}

Candidate Resume:
{resume_text}

Respond strictly in valid JSON format with the following keys:
{{
  "ai_score": 85,
  "ai_recommendation": "Strong Match" or "Moderate Match" or "Low Match",
  "key_strengths": ["strength 1", "strength 2"],
  "potential_gaps": ["gap 1"],
  "ai_summary": "A concise 2-sentence summary of candidate fit."
}}
"""

    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "format": "json"
    }

    try:
        req = urllib.request.Request(
            OLLAMA_URL,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=timeout_seconds) as response:
            if response.status == 200:
                result = json.loads(response.read().decode("utf-8"))
                response_text = result.get("response", "")
                parsed_json = json.loads(response_text)
                return parsed_json
    except Exception:
        pass

    return None


def screen_candidate(
    jd: str,
    resume_text: str,
    filename: Optional[str] = None,
    existing_submissions: Optional[List[Dict[str, Any]]] = None,
    ollama_model: str = DEFAULT_OLLAMA_MODEL
) -> Dict[str, Any]:
    """Analyze candidate resume against JD using Ollama deep AI + Local NLP cross-verification engine."""
    name = extract_candidate_name(resume_text, filename)
    email = extract_candidate_email(resume_text)
    fingerprint = generate_resume_fingerprint(name, resume_text)

    # Check for duplicate submission
    dup_check = check_duplicate_submission(name, resume_text, existing_submissions)

    # --- 1. Base Local NLP Analysis ---
    jd_clean = jd.lower()
    resume_clean = resume_text.lower()

    potential_skills = re.findall(r"\b[a-zA-Z0-9\+#\.]+\b", jd_clean)
    stopwords = {
        "and", "or", "the", "a", "an", "in", "on", "at", "to", "for", "with", "by", "of",
        "is", "are", "be", "required", "skills", "experience", "years", "plus", "must",
        "have", "role", "job", "developer", "engineer", "description", "good", "strong",
        "knowledge", "ability", "work", "team", "project", "projects", "2+", "3+", "5+"
    }
    
    jd_skills = list(set([s for s in potential_skills if len(s) > 1 and s not in stopwords and not s.isdigit()]))

    matched_skills = [s for s in jd_skills if re.search(rf"\b{re.escape(s)}\b", resume_clean)]
    missing_skills = [s for s in jd_skills if s not in matched_skills]

    if jd_skills:
        skill_score = (len(matched_skills) / len(jd_skills)) * 80
    else:
        skill_score = 50

    jd_exp_match = re.search(r"(\d+)\+?\s*years?", jd_clean)
    resume_exp_match = re.search(r"(\d+)\+?\s*years?", resume_clean)

    exp_bonus = 10
    exp_note = "Relevant experience mentioned"
    if jd_exp_match and resume_exp_match:
        jd_years = int(jd_exp_match.group(1))
        res_years = int(resume_exp_match.group(1))
        if res_years >= jd_years:
            exp_bonus = 20
            exp_note = f"Meets experience criteria ({res_years}+ years)"
        else:
            exp_bonus = 5
            exp_note = f"Lower experience ({res_years} years vs {jd_years}+ required)"

    nlp_score = round(min(100.0, skill_score + exp_bonus), 1)

    # --- 2. Query Ollama AI for Deep Verification ---
    ollama_res = query_ollama_ai(jd=jd, resume_text=resume_text, model=ollama_model)

    if ollama_res:
        ai_engine_used = f"Ollama AI ({ollama_model}) + Cross-Verification"
        ai_score = float(ollama_res.get("ai_score", nlp_score))
        final_score = round((ai_score * 0.6) + (nlp_score * 0.4), 1)
        recommendation = ollama_res.get("ai_recommendation", "Strong Match" if final_score >= 75 else ("Moderate Match" if final_score >= 50 else "Low Match"))
        summary = ollama_res.get("ai_summary", f"{name} was evaluated using Ollama AI reasoning.")
        key_strengths = ollama_res.get("key_strengths", [])
        potential_gaps = ollama_res.get("potential_gaps", [])
    else:
        ai_engine_used = "Local Fast NLP Engine (Ollama Offline)"
        final_score = nlp_score
        if final_score >= 75:
            recommendation = "Strong Match"
            summary = f"{name} is a highly suitable candidate with strong alignment in required skills ({', '.join(matched_skills[:4])})."
        elif final_score >= 50:
            recommendation = "Moderate Match"
            summary = f"{name} satisfies several requirements but is missing key skills ({', '.join(missing_skills[:3])})."
        else:
            recommendation = "Low Match"
            summary = f"{name} has low alignment with the job requirements."
        key_strengths = [f"Matched {len(matched_skills)} core skills"]
        potential_gaps = [f"Missing skills: {', '.join(missing_skills[:3])}"] if missing_skills else []

    return {
        "candidate_name": name,
        "candidate_email": email,
        "filename": filename or "resume.pdf",
        "fingerprint": fingerprint,
        "status": "Screened",
        "is_duplicate": dup_check["is_duplicate"],
        "duplicate_reason": dup_check["duplicate_reason"],
        "match_score": final_score,
        "recommendation": recommendation,
        "matched_skills": matched_skills,
        "missing_skills": missing_skills,
        "summary": summary,
        "engine_info": ai_engine_used,
        "details": {
            "experience_evaluation": exp_note,
            "skills_matched_count": len(matched_skills),
            "total_jd_skills_identified": len(jd_skills),
            "key_strengths": key_strengths,
            "potential_gaps": potential_gaps,
            "nlp_baseline_score": nlp_score,
        },
    }
