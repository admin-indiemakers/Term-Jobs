"""
Stage 6 â€” Match & Score
Implements the 8-criterion weighted scoring framework:

  Must-have skills        30%
  Project evidence        25%
  Semantic relevance      20%
  GitHub evidence         10%
  Problem-solving          5%
  Nice-to-have skills      5%
  Experience alignment     3%
  Education relevance      2%
"""
import re
import logging
from typing import List, Dict, Tuple, Optional

from modules.resume_screener.models.schemas import (
    StructuredResume,
    JDParsed,
    GitHubEvidence,
    ScoreBreakdown,
    MatchCategory,
)

logger = logging.getLogger(__name__)

# â”€â”€ Skill synonym map (extend as needed) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
SYNONYMS: Dict[str, List[str]] = {
    "python": ["py", "python3"],
    "javascript": ["js", "node.js", "nodejs"],
    "typescript": ["ts"],
    "postgresql": ["postgres", "psql"],
    "mongodb": ["mongo"],
    "kubernetes": ["k8s"],
    "machine learning": ["ml", "deep learning", "ai"],
    "natural language processing": ["nlp"],
    "computer vision": ["cv", "image recognition"],
    "ci/cd": ["ci", "cd", "continuous integration", "continuous deployment", "github actions"],
    "rest api": ["restful", "rest", "api"],
    "fastapi": ["fast-api"],
    "react": ["reactjs", "react.js"],
    "vue": ["vuejs", "vue.js"],
    "angular": ["angularjs"],
    "tensorflow": ["tf", "keras"],
    "pytorch": ["torch"],
}

# Signals indicating active problem-solving / innovation
PROBLEM_SOLVING_SIGNALS = [
    r"optim[iz]",
    r"reduc\w+\s+\w*(latency|time|cost|error|load)",
    r"improv\w+\s+\w*(performance|speed|accuracy|efficiency)",
    r"design\w*\s+\w*architect",
    r"built\s+from\s+scratch",
    r"lead\w*\s+\w*(project|team|initiative)",
    r"resol\w+\s+\w*(bug|issue|problem|bottleneck)",
    r"deploy\w+\s+\w*(production|prod|scale)",
    r"migrat\w+\s+\w*(system|database|service)",
    r"automat\w+",
    r"implement\w+\s+\w*(algorithm|solution|feature|pipeline)",
    r"integrat\w+\s+\w*(api|service|model|system)",
    r"end.to.end",
    r"enabl\w+\s+\w*(real.time|low.latency|seamless|natural)",
    r"architect\w+",
]


def _normalize_skill(skill: str) -> str:
    return skill.lower().strip()


def _expand_synonyms(skill: str) -> List[str]:
    """Return skill + all known synonyms."""
    norm = _normalize_skill(skill)
    variants = [norm]
    # Check if this skill is a key
    if norm in SYNONYMS:
        variants.extend(SYNONYMS[norm])
    # Check if this skill appears in any synonym list
    for canonical, syns in SYNONYMS.items():
        if norm in [s.lower() for s in syns]:
            variants.append(canonical)
    return variants


def _skill_match_score(required_skill: str, candidate_skills: List[str]) -> float:
    """
    Score how well a required skill is met:
    1.0 = exact match
    0.8 = synonym/equivalent match
    0.0 = not found
    """
    required_norm = _normalize_skill(required_skill)
    candidate_norm = [_normalize_skill(s) for s in candidate_skills]

    # Exact match
    if required_norm in candidate_norm:
        return 1.0

    # Synonym match
    required_variants = _expand_synonyms(required_skill)
    for variant in required_variants:
        if variant in candidate_norm:
            return 0.8

    # Substring match (e.g. "React" matches "React.js")
    for cs in candidate_norm:
        if required_norm in cs or cs in required_norm:
            return 0.6

    return 0.0


def score_must_have_skills(
    jd: JDParsed, resume: StructuredResume
) -> Tuple[float, List[str], List[str]]:
    """
    Returns (raw_score_0_100, matched_skills, missing_skills).
    Also checks raw resume text to catch skills the LLM missed in structured extraction.
    """
    if not jd.must_have_skills:
        return 50.0, [], []

    # Build a combined text corpus to search: structured skills + raw resume text
    raw_lower = (resume.raw_text_for_embedding or "").lower()
    all_resume_lower = " ".join(resume.skills).lower() + " " + raw_lower

    matched, missing = [], []
    total_score = 0.0

    for skill in jd.must_have_skills:
        # First try structured skill matching
        s = _skill_match_score(skill, resume.skills)

        # Fallback: search in raw resume text (whole-phrase matching to avoid false positives)
        if s == 0 and raw_lower:
            skill_norm = _normalize_skill(skill)
            if skill_norm and skill_norm in all_resume_lower:
                s = 0.75
            elif skill_norm and len(skill_norm) >= 4:
                # For single-word skills or abbreviations, do whole-word search
                if re.search(r'\b' + re.escape(skill_norm) + r'\b', all_resume_lower):
                    s = 0.75

        if s > 0:
            matched.append(skill)
            total_score += s
        else:
            missing.append(skill)

    raw = (total_score / len(jd.must_have_skills)) * 100
    return raw, matched, missing



def score_nice_to_have(jd: JDParsed, resume: StructuredResume) -> float:
    """Score nice-to-have skills with raw text fallback."""
    if not jd.nice_to_have_skills:
        return 50.0

    raw_lower = (resume.raw_text_for_embedding or "").lower()
    all_resume_lower = " ".join(resume.skills).lower() + " " + raw_lower

    total_score = 0.0
    for skill in jd.nice_to_have_skills:
        s = _skill_match_score(skill, resume.skills)
        # Fallback: check raw resume text
        if s == 0 and raw_lower:
            skill_norm = _normalize_skill(skill)
            if skill_norm and skill_norm in all_resume_lower:
                s = 0.6
            elif skill_norm and len(skill_norm) >= 4:
                if re.search(r'\b' + re.escape(skill_norm) + r'\b', all_resume_lower):
                    s = 0.6
        total_score += s

    return (total_score / len(jd.nice_to_have_skills)) * 100



def score_project_evidence(jd: JDParsed, resume: StructuredResume) -> float:
    """
    Score project evidence using both LLM-structured projects AND full raw resume text.
    Rewards: action verbs, JD skill mentions, number of projects, quantified outcomes.
    """
    STRONG_VERBS = [
        r"\bbuilt\b", r"\bdeployed\b", r"\bimplemented\b",
        r"\bdesigned\b", r"\bcreated\b", r"\bdeveloped\b",
        r"\barchitected\b", r"\bscaled\b", r"\boptimized\b",
        r"\bintegrated\b", r"\bautomated\b", r"\bengineered\b",
    ]
    OUTCOME_PATTERN = re.compile(
        r"\d+[%x]\s*(reduc|improv|increas|speed|latency|accur|throughput)"
        r"|reduc\w+.*?\d+"
        r"|improv\w+.*?\d+",
        re.IGNORECASE,
    )

    all_jd_skills_raw = jd.must_have_skills + jd.nice_to_have_skills
    # Expand compound skills: "LangChain and LangGraph" â†’ {"langchain and langgraph", "langchain", "langgraph"}
    all_jd_skills: set = set()
    for skill in all_jd_skills_raw:
        norm = _normalize_skill(skill)
        all_jd_skills.add(norm)
        for part in re.split(r'\s+and\s+|\s*,\s*|\s*/\s*', norm):
            part = part.strip()
            if len(part) >= 3:
                all_jd_skills.add(part)
    raw_text = (resume.raw_text_for_embedding or "").lower()

    # Build a comprehensive text: LLM project descriptions + raw resume text
    llm_project_text = " ".join(
        (p.name or "") + " " + (p.description or "") + " " + " ".join(p.technologies or [])
        for p in (resume.projects or [])
    ).lower()
    full_text = llm_project_text + " " + raw_text

    # Count action verbs in full text
    verb_hits = sum(1 for p in STRONG_VERBS if re.search(p, full_text, re.IGNORECASE))

    # Count JD skill mentions â€” use word-boundary for short skills to avoid false positives
    # e.g., "rag" in "storage", "git" in "digital", "llm" in "fillm"
    tech_hits = 0
    for skill in all_jd_skills:
        if len(skill) < 3:
            continue
        if len(skill) <= 5:
            # Short abbreviations need word boundaries
            if re.search(r'\b' + re.escape(skill) + r'\b', full_text) or \
               re.search(r'\b' + re.escape(skill) + r'\b', raw_text):
                tech_hits += 1
        else:
            if skill in full_text or skill in raw_text:
                tech_hits += 1

    # Bonus for number of projects
    project_count = len(resume.projects) if resume.projects else 0
    # Fallback: count "project" sections in raw text
    if project_count == 0 and raw_text:
        project_count = min(6, raw_text.count("project"))

    # Quantified outcomes
    has_outcome = 1 if OUTCOME_PATTERN.search(full_text) else 0

    # Rebalanced scoring: JD-skill overlap is the primary signal (60 pts)
    # Generic signals (verbs, project count, outcomes) fill the remaining 40 pts
    skill_score   = min(60.0, tech_hits * 6)        # 60 pts max â€” JD relevance
    verb_score    = min(15.0, verb_hits * 2)         # 15 pts max â€” action verbs
    project_score = min(15.0, project_count * 2.5)   # 15 pts max â€” project depth
    outcome_score = has_outcome * 10                  # 10 pts â€” measurable impact

    return min(100.0, skill_score + verb_score + project_score + outcome_score)


def score_semantic_relevance(
    jd_embedding: List[float], resume_embedding: List[float]
) -> float:
    """Convert cosine similarity (0â€“1) to 0â€“100."""
    from modules.resume_screener.pipeline.jd_parser import cosine_similarity
    similarity = cosine_similarity(jd_embedding, resume_embedding)
    return round(similarity * 100, 2)


def score_github_evidence(github_evidence: Optional[GitHubEvidence]) -> float:
    """Map GitHub evidence score to 0â€“100."""
    if not github_evidence or not github_evidence.verified:
        return 0.0
    return github_evidence.evidence_score


def score_problem_solving(resume: StructuredResume) -> float:
    """
    Detect problem-solving and innovation signals across all text.
    Score 0â€“100 based on number of distinct signal types found.
    """
    all_text = (
        resume.raw_text_for_embedding
        + " "
        + " ".join(
            (p.description or "") + " " + (p.outcome or "")
            for p in resume.projects
        )
        + " "
        + " ".join(e.description for e in resume.experience)
    ).lower()

    hits = sum(1 for pattern in PROBLEM_SOLVING_SIGNALS if re.search(pattern, all_text, re.IGNORECASE))
    # 6+ distinct signals = 100
    return min(100.0, (hits / 6) * 100)


def score_experience_alignment(jd: JDParsed, resume: StructuredResume) -> float:
    """Score experience in years vs. JD requirements.
    Falls back to raw text scanning when LLM failed to extract structured experience.
    """
    total_months = sum(e.duration_months or 0 for e in resume.experience)
    total_years = total_months / 12

    # Fallback: estimate from raw text when LLM returned no structured experience
    if total_years == 0:
        raw = (resume.raw_text_for_embedding or "").lower()
        internships = len(re.findall(r'\bintern\b', raw))
        jobs = len(re.findall(r'\b(engineer|developer|analyst|architect|manager|lead)\b', raw))
        if internships >= 1:
            total_years = 0.5 * internships  # ~6 months per internship
        elif jobs >= 1:
            total_years = 1.0

    req = jd.experience_requirements or {}
    preferred = req.get("preferred_years") or 2
    minimum = req.get("min_years") or 0

    if total_years >= preferred:
        return 100.0
    elif total_years >= minimum:
        if preferred > minimum:
            return ((total_years - minimum) / (preferred - minimum)) * 100
        return 70.0
    elif total_years > 0:
        return 30.0
    # Base score if any experience-related content found
    if resume.raw_text_for_embedding and re.search(
        r'intern|experience|work|project|role', resume.raw_text_for_embedding, re.IGNORECASE
    ):
        return 40.0
    return 0.0


def score_education_relevance(jd: JDParsed, resume: StructuredResume) -> float:
    """Simple degree + field match scoring. Falls back to raw text scan when LLM missed education."""
    if not resume.education:
        # Fallback: scan raw text for degree keywords
        raw = (resume.raw_text_for_embedding or "").lower()
        if re.search(r'\bb\.?tech\b|\bb\.?e\b|\bbachelor|b\.?sc\b', raw, re.IGNORECASE):
            cs_match = re.search(r'computer|software|information|engineer|ai|data science', raw, re.IGNORECASE)
            return 80.0 if cs_match else 50.0
        if re.search(r'm\.?tech|master|m\.?sc|mca\b', raw, re.IGNORECASE):
            return 90.0
        return 30.0  # Has some education presumably



    req = jd.education_requirements
    if not req:
        return 50.0

    required_field = _normalize_skill(req.get("field", ""))
    required_degree = _normalize_skill(req.get("degree", ""))

    best = 0.0
    for edu in resume.education:
        score = 0.0
        field_norm = _normalize_skill(edu.field)
        degree_norm = _normalize_skill(edu.degree)

        if required_field and required_field in field_norm:
            score += 60
        elif required_field and any(
            kw in field_norm
            for kw in ["computer", "software", "information", "engineering", "tech"]
        ):
            score += 40

        if required_degree and required_degree in degree_norm:
            score += 40
        elif degree_norm:
            score += 20

        best = max(best, score)

    return min(100.0, best)


def classify_candidate(total_score: float) -> MatchCategory:
    if total_score >= 80:
        return MatchCategory.strong_match
    elif total_score >= 65:
        return MatchCategory.consider
    return MatchCategory.weak_match


def compute_score(
    resume: StructuredResume,
    jd: JDParsed,
    jd_embedding: List[float],
    github_evidence: Optional[GitHubEvidence] = None,
) -> Tuple[float, ScoreBreakdown, List[str], List[str]]:
    """
    Main scoring function. Returns:
      (total_score, breakdown, matched_skills, missing_skills)
    All sub-scores are 0â€“100 before weighting.
    """
    # Generate resume embedding
    from modules.resume_screener.pipeline.jd_parser import generate_embedding
    resume_embedding = generate_embedding(resume.raw_text_for_embedding or " ".join(resume.skills))

    # Run all criteria
    must_have_raw, matched, missing = score_must_have_skills(jd, resume)

    breakdown = ScoreBreakdown(
        must_have_skills=must_have_raw,
        project_evidence=score_project_evidence(jd, resume),
        semantic_relevance=score_semantic_relevance(jd_embedding, resume_embedding),
        github_evidence=score_github_evidence(github_evidence),
        problem_solving=score_problem_solving(resume),
        nice_to_have_skills=score_nice_to_have(jd, resume),
        experience_alignment=score_experience_alignment(jd, resume),
        education_relevance=score_education_relevance(jd, resume),
    )

    total = round(breakdown.total(), 2)
    return total, breakdown, matched, missing


