"""
Python Candidate Pool Ranking Engine
Evaluates platform-wide candidates (historical applicants, direct portal registrations, vendor submissions)
against a target job requisition to determine the deterministic Top 20 best-fit candidates.
"""

import re
import logging
from typing import Any, Dict, List, Optional, Set
from modules.shared.db import db, get_session
from modules.requisition.domain import models

logger = logging.getLogger(__name__)

# Common skill synonym map for comprehensive cross-technology matching
SKILL_SYNONYMS: Dict[str, Set[str]] = {
    "python": {"py", "python3", "django", "fastapi", "flask"},
    "javascript": {"js", "es6", "node", "nodejs", "node.js"},
    "typescript": {"ts"},
    "react": {"reactjs", "react.js", "next.js", "nextjs", "redux"},
    "vue": {"vuejs", "vue.js", "nuxt", "nuxtjs"},
    "angular": {"angularjs", "angular 2+"},
    "node": {"nodejs", "node.js", "express", "expressjs", "nest.js", "nestjs"},
    "fastapi": {"fast-api", "python api", "starlette"},
    "docker": {"containerization", "containers", "docker-compose"},
    "kubernetes": {"k8s", "container orchestration"},
    "aws": {"amazon web services", "ec2", "s3", "lambda", "ecs", "eks", "cloud"},
    "azure": {"microsoft azure", "azure cloud"},
    "gcp": {"google cloud", "google cloud platform"},
    "postgresql": {"postgres", "psql", "sql"},
    "mysql": {"sql", "mariadb"},
    "mongodb": {"mongo", "nosql", "documentdb"},
    "redis": {"caching", "in-memory"},
    "graphql": {"apollo", "graphql api"},
    "rest": {"restful", "rest api", "api design"},
    "ci/cd": {"continuous integration", "continuous deployment", "github actions", "jenkins", "gitlab ci"},
    "machine learning": {"ml", "deep learning", "ai", "artificial intelligence", "nlp", "llm"},
    "golang": {"go"},
    "java": {"spring", "springboot", "spring boot"},
    "c#": {"csharp", ".net", "dotnet"},
}

SENIORITY_KEYWORDS = {
    "lead": {"lead", "principal", "architect", "staff", "head"},
    "senior": {"senior", "sr", "lead", "principal"},
    "mid": {"mid", "intermediate", "software engineer", "developer"},
    "junior": {"junior", "jr", "entry", "associate", "intern"},
}


def _clean_str(val: Any) -> str:
    if not val:
        return ""
    return str(val).strip()


def _normalize_skill(skill: str) -> str:
    return re.sub(r"[^\w\s\.\#\+\-]", "", skill.lower()).strip()


def _extract_skill_variants(skill: str) -> Set[str]:
    norm = _normalize_skill(skill)
    if not norm:
        return set()
    variants = {norm}
    for key, syns in SKILL_SYNONYMS.items():
        if norm == key or norm in syns:
            variants.add(key)
            variants.update(syns)
    return variants


def _parse_candidate_skills(raw_skills: Any) -> List[str]:
    if not raw_skills:
        return []
    if isinstance(raw_skills, list):
        out = []
        for s in raw_skills:
            if isinstance(s, str):
                for p in s.split(","):
                    clean = p.strip()
                    if clean:
                        out.append(clean)
            elif s:
                out.append(str(s).strip())
        return list(dict.fromkeys(out))
    if isinstance(raw_skills, str):
        return [p.strip() for p in raw_skills.split(",") if p.strip()]
    return []


def get_requisition_data(requisition_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve full requisition metadata from SQLite & MongoDB."""
    req_dict = {}

    # 1. SQL model
    try:
        with get_session() as session:
            req_model = session.get(models.Requisition, requisition_id)
            if req_model:
                req_dict["id"] = req_model.id
                req_dict["title"] = req_model.title or "Open Position"
                req_dict["description"] = req_model.description or ""
                req_dict["tenant_id"] = req_model.tenant_id
                req_dict["status"] = req_model.status
                if req_model.company_profile:
                    req_dict["company_name"] = req_model.company_profile.name
    except Exception as e:
        logger.warning(f"Failed to fetch SQL requisition {requisition_id}: {e}")

    # 2. MongoDB sync document (contains structured_role, tech_stack, etc.)
    try:
        mongo_doc = db["requisitions"].find_one({"id": requisition_id})
        if mongo_doc:
            req_dict["id"] = mongo_doc.get("id", req_dict.get("id", requisition_id))
            req_dict["title"] = mongo_doc.get("title") or req_dict.get("title", "Open Position")
            req_dict["company_name"] = mongo_doc.get("company_name") or req_dict.get("company_name", "Enterprise Partner")
            req_dict["description"] = mongo_doc.get("description") or req_dict.get("description", "")
            req_dict["structured_role"] = mongo_doc.get("structured_role") or {}
            req_dict["skills"] = mongo_doc.get("skills") or []
    except Exception as e:
        logger.warning(f"Failed to fetch Mongo requisition {requisition_id}: {e}")

    if not req_dict.get("title"):
        return None

    # Derive unified target skill list
    target_skills = []
    if req_dict.get("skills"):
        target_skills.extend(_parse_candidate_skills(req_dict["skills"]))

    structured = req_dict.get("structured_role") or {}
    if structured.get("required_skills"):
        target_skills.extend(_parse_candidate_skills(structured["required_skills"]))
    if structured.get("skills"):
        target_skills.extend(_parse_candidate_skills(structured["skills"]))
    if structured.get("tech_stack"):
        target_skills.extend(_parse_candidate_skills(structured["tech_stack"]))

    # If few skills found, parse common tech words from title & description
    text_corpus = f"{req_dict.get('title', '')} {req_dict.get('description', '')}".lower()
    for tech_key in SKILL_SYNONYMS.keys():
        pattern = r"\b" + re.escape(tech_key) + r"\b"
        if re.search(pattern, text_corpus):
            target_skills.append(tech_key.capitalize())

    req_dict["target_skills"] = list(dict.fromkeys([s for s in target_skills if s]))
    return req_dict


def calculate_candidate_match(
    candidate: Dict[str, Any],
    requisition: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Computes a 0 - 100 weighted match score for a candidate against a requisition:
    - Skills match (40 pts)
    - Title & semantic fit (30 pts)
    - Experience & seniority fit (20 pts)
    - Contact & profile verification (10 pts)
    """
    req_title = _clean_str(requisition.get("title")).lower()
    req_skills = [_normalize_skill(s) for s in requisition.get("target_skills", [])]

    cand_skills = _parse_candidate_skills(candidate.get("skills"))
    cand_title = _clean_str(candidate.get("candidate_title") or (candidate.get("details") or {}).get("candidate_title")).lower()
    cand_summary = _clean_str(candidate.get("summary") or "").lower()
    cand_corpus = f"{cand_title} {cand_summary} {' '.join(cand_skills)}".lower()

    # 1. Skills Match (0 - 40 pts)
    matched_skills = []
    if req_skills:
        skill_hits = 0
        cand_skill_variants: Set[str] = set()
        for cs in cand_skills:
            cand_skill_variants.update(_extract_skill_variants(cs))

        for rs in req_skills:
            req_variants = _extract_skill_variants(rs)
            # Check overlap with candidate skill variants or candidate text corpus
            if req_variants.intersection(cand_skill_variants) or any(v in cand_corpus for v in req_variants):
                skill_hits += 1
                matched_skills.append(rs.capitalize())

        ratio = skill_hits / max(len(req_skills), 1)
        skill_score = min(40.0, ratio * 40.0 + (5.0 if skill_hits >= 2 else 0.0))
    else:
        # Generic role without explicit skill list: score by keyword overlap
        skill_score = 25.0

    # 2. Title & Semantic Fit (0 - 30 pts)
    title_score = 0.0
    req_words = set(re.findall(r"\w+", req_title))
    cand_words = set(re.findall(r"\w+", cand_title))
    common_title_words = req_words.intersection(cand_words)

    # Filter out stopwords
    meaningful_common = [w for w in common_title_words if w not in {"and", "or", "in", "at", "for", "to", "the", "a", "of"}]
    if len(meaningful_common) >= 2:
        title_score += 24.0
    elif len(meaningful_common) == 1:
        title_score += 15.0
    elif any(w in cand_corpus for w in req_words if len(w) > 3):
        title_score += 10.0
    else:
        title_score += 5.0

    # Domain bonuses
    domains = ["python", "react", "frontend", "backend", "fullstack", "devops", "cloud", "data", "ml", "ai", "engineer", "lead"]
    for d in domains:
        if d in req_title and d in cand_corpus:
            title_score = min(30.0, title_score + 4.0)

    # 3. Experience & Seniority Fit (0 - 20 pts)
    exp_score = 10.0  # Base line
    for level, keywords in SENIORITY_KEYWORDS.items():
        if any(k in req_title for k in keywords):
            if any(k in cand_corpus for k in keywords):
                exp_score += 10.0
            break

    # 4. Profile & Resume Availability (0 - 10 pts)
    profile_score = 0.0
    if candidate.get("candidate_email") and "@" in candidate.get("candidate_email"):
        profile_score += 5.0
    if candidate.get("has_resume") or candidate.get("filename"):
        profile_score += 3.0
    if candidate.get("candidate_phone"):
        profile_score += 2.0

    total_score = round(min(100.0, max(10.0, skill_score + title_score + exp_score + profile_score)), 1)

    reasons = []
    if matched_skills:
        reasons.append(f"Matched skills: {', '.join(matched_skills[:4])}")
    if meaningful_common:
        reasons.append(f"Role alignment on '{', '.join(meaningful_common)}'")
    if profile_score >= 8.0:
        reasons.append("Verified email & resume on file")

    return {
        "score": total_score,
        "matched_skills": matched_skills,
        "reasons": reasons,
        "score_breakdown": {
            "skills": round(skill_score, 1),
            "title_fit": round(title_score, 1),
            "seniority": round(exp_score, 1),
            "profile": round(profile_score, 1),
        }
    }


def rank_candidates_for_requisition(
    requisition_id: str,
    limit: int = 20
) -> List[Dict[str, Any]]:
    """
    Scans the platform candidate pool and returns the deterministic Top 20 best-fit candidates.
    Filters out candidates who explicitly marked themselves unavailable or placed elsewhere.
    """
    req_data = get_requisition_data(requisition_id)
    if not req_data:
        logger.warning(f"Requisition {requisition_id} not found for candidate ranking")
        return []

    # 1. Ingest candidates from both talent bank and historical candidate submissions
    bank_candidates = list(db["candidates"].find({}, {"resume_pdf": 0, "extracted_text": 0}))
    submissions = list(db["candidate_submissions"].find({}, {"resume_pdf": 0, "resume_text": 0}))

    # Deduplicate candidates into consolidated profile map
    cand_map: Dict[str, Dict[str, Any]] = {}

    for c in bank_candidates:
        cid = c.get("id") or str(c.get("_id"))
        email = (c.get("candidate_email") or "").strip().lower()
        key = email if email else cid
        v_name = (c.get("vendor_company_name") or c.get("vendor_name") or "Direct Applicant").strip()
        is_direct = v_name.lower() in ["direct applicant", "portal registration", "portal applicant"]

        cand_map[key] = {
            "id": cid,
            "candidate_name": c.get("candidate_name") or "Candidate",
            "candidate_email": (c.get("candidate_email") or "").strip(),
            "candidate_phone": c.get("candidate_phone") or (c.get("details") or {}).get("candidate_phone") or "",
            "candidate_title": c.get("candidate_title") or (c.get("details") or {}).get("candidate_title") or "Candidate",
            "vendor_name": v_name,
            "is_direct_applicant": is_direct,
            "skills": c.get("skills") or [],
            "summary": c.get("summary") or "",
            "details": c.get("details") or {},
            "availability": c.get("availability") or "available",
            "has_resume": bool(c.get("resume_pdf") or c.get("filename") or c.get("extracted_text")),
            "filename": c.get("filename") or f"{c.get('candidate_name', 'resume')}.pdf",
            "created_at": c.get("created_at"),
        }

    for s in submissions:
        sub_id = s.get("id") or str(s.get("_id"))
        email = (s.get("candidate_email") or "").strip().lower()
        cid = s.get("workorder_id") or s.get("candidate_id") or sub_id
        key = email if (email and email in cand_map) else cid

        v_name = (s.get("vendor_name") or "Direct Applicant").strip()
        is_direct = v_name.lower() in ["direct applicant", "portal registration", "portal applicant"]

        if key in cand_map:
            # Augment existing candidate with any missing skills or info
            if not cand_map[key]["skills"] and s.get("matched_skills"):
                cand_map[key]["skills"] = s.get("matched_skills")
            if not cand_map[key]["candidate_phone"]:
                cand_map[key]["candidate_phone"] = (s.get("details") or {}).get("candidate_phone") or ""
        else:
            cand_map[key] = {
                "id": sub_id,
                "candidate_name": s.get("candidate_name") or "Candidate",
                "candidate_email": (s.get("candidate_email") or "").strip(),
                "candidate_phone": (s.get("details") or {}).get("candidate_phone") or "",
                "candidate_title": (s.get("details") or {}).get("candidate_title") or "Candidate",
                "vendor_name": v_name,
                "is_direct_applicant": is_direct,
                "skills": s.get("matched_skills") or (s.get("details") or {}).get("skills") or [],
                "summary": s.get("summary") or "",
                "details": s.get("details") or {},
                "availability": s.get("availability") or "available",
                "has_resume": True,
                "filename": s.get("filename") or f"{s.get('candidate_name', 'resume')}.pdf",
                "created_at": s.get("created_at"),
            }

    # 2. Filter out candidates who explicitly marked themselves unavailable / placed
    eligible_candidates = []
    for cand in cand_map.values():
        avail_status = (cand.get("availability") or "available").lower()
        if avail_status in ["placed_elsewhere", "unavailable", "not_looking"]:
            continue
        # Candidates must have at least an email or name
        if not cand.get("candidate_email") and not cand.get("candidate_name"):
            continue
        eligible_candidates.append(cand)

    # 3. Score every eligible candidate
    scored_candidates = []
    for cand in eligible_candidates:
        match_result = calculate_candidate_match(cand, req_data)
        item = {
            **cand,
            "match_score": match_result["score"],
            "matched_skills": match_result["matched_skills"],
            "match_reasons": match_result["reasons"],
            "score_breakdown": match_result["score_breakdown"],
            "requisition_id": requisition_id,
            "requisition_title": req_data["title"],
            "company_name": req_data["company_name"],
        }
        scored_candidates.append(item)

    # 4. Sort descending by score, then by recency
    scored_candidates.sort(
        key=lambda x: (x["match_score"], str(x.get("created_at") or "")),
        reverse=True
    )

    # 5. Extract Top N (default 20) and assign ranks
    top_candidates = scored_candidates[:limit]
    for idx, c in enumerate(top_candidates, start=1):
        c["rank"] = idx

    logger.info(f"Successfully ranked {len(scored_candidates)} candidates for requisition '{req_data['title']}'. Selected Top {len(top_candidates)}.")
    return top_candidates
