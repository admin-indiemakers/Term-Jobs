"""
Stage 4 â€” JD Understanding (LLM + Embeddings)
Parses JD text into structured requirements and generates embedding vector.
"""
import logging
import re
from typing import List, Optional


from modules.resume_screener.models.schemas import JDParsed
from modules.resume_screener.utils.llm_client import call_ollama, extract_json_from_response

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a job description analyser. Extract structured requirements from job descriptions.
Return ONLY valid JSON. No prose, no markdown outside the JSON."""

JD_PARSE_PROMPT = """Analyse the job description below and extract requirements into this exact JSON schema:

{{
  "must_have_skills": ["skills absolutely required, e.g. Python, FastAPI, Docker"],
  "nice_to_have_skills": ["skills preferred but not required, e.g. Kubernetes, AWS"],
  "experience_requirements": {{
    "min_years": 0,
    "preferred_years": 3,
    "domain": "backend / frontend / full-stack / ML / DevOps etc."
  }},
  "education_requirements": {{
    "degree": "B.Tech / B.Sc / Any etc.",
    "field": "Computer Science / IT / Engineering etc.",
    "required": true
  }},
  "key_responsibilities": ["responsibility 1", "responsibility 2"],
  "embedding_text": "a clean 150-200 word summary capturing the core role, skills, and requirements for semantic search"
}}

Job Description:
\"\"\"
{jd_text}
\"\"\"

Return ONLY the JSON object:"""




def _extract_skills_from_jd_text(jd_text: str):
    """
    Regex-based fallback to extract must-have and nice-to-have skills.
    Extracts the clean skill name from each bullet (not the full description).
    """
    lines = jd_text.split("\n")
    must_have: List[str] = []
    nice_have: List[str] = []
    current_section = None

    MUST_SECTION = re.compile(r"must.have|required skills?|key skills?|mandatory", re.IGNORECASE)
    NICE_SECTION = re.compile(r"nice.to.have|preferred|bonus|optional|good.to.have", re.IGNORECASE)
    # Match common bullet starters: -, â€¢, *, â€“
    BULLET = re.compile(r"^[-\u2022\u2013\*]\s+(.+)")
    # Split skill name from description at these separators
    DESC_SEP = re.compile(r"\s+[-\u2014\u2013]|\s+[(]|\s+--|\s{2,}")

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        if MUST_SECTION.search(stripped) and len(stripped) < 80:
            current_section = "must"
            continue
        if NICE_SECTION.search(stripped) and len(stripped) < 80:
            current_section = "nice"
            continue

        m = BULLET.match(stripped)
        if m:
            raw_text_bullet = m.group(1).strip()

            # Also extract tech names from inside parentheses BEFORE cleaning
            # e.g., "LLM Evaluation frameworks (DeepEval, OpenEvals)" â†’ also add "DeepEval", "OpenEvals"
            paren_match = re.search(r"\(([^)]+)\)", raw_text_bullet)
            extra_skills = []
            if paren_match:
                paren_content = paren_match.group(1)
                for item in re.split(r"[,/]", paren_content):
                    item = item.strip()
                    # Only take short items that look like tool names (no spaces or short 2-word phrases)
                    if item and 2 <= len(item) <= 30 and not item.startswith("e.g"):
                        extra_skills.append(item)

            # Extract the skill name before description separators
            clean = DESC_SEP.split(raw_text_bullet)[0].strip()
            # Remove version specs like "(3.10+)"
            clean = re.sub(r"\s*\([^)]{0,20}\)\s*$", "", clean).strip()
            # Split at " for " to drop description: "Streamlit for building..." â†’ "Streamlit"
            clean = re.split(r"\s+for\s+", clean, maxsplit=1)[0].strip()
            # Remove trailing generic words (development, integration, etc.)
            clean = re.sub(
                r"\s+(development|integration|based|driven|powered|pipeline|pipelines"
                r"|system|services|architectures?|frameworks?|tools?|libraries?)$",
                "", clean, flags=re.IGNORECASE
            ).strip()

            # Collect all skill candidates: split compound "X and Y" â†’ ["X","Y"]
            # and "X or Y" â†’ ["X","Y"]
            parts_and = re.split(r"\s+and\s+", clean, flags=re.IGNORECASE)
            all_candidates = []
            for p in parts_and:
                # Also split on "or"
                for pp in re.split(r"\s+or\s+", p.strip(), flags=re.IGNORECASE):
                    pp = pp.strip()
                    if pp and 2 <= len(pp) <= 40:
                        all_candidates.append(pp)

            # Add extra skills from parentheses
            all_candidates.extend(extra_skills)

            for part in all_candidates:
                if current_section == "must":
                    must_have.append(part)
                elif current_section == "nice":
                    nice_have.append(part)




    # Final fallback: keyword scan of the entire JD text
    if not must_have:
        TECH = re.compile(
            r"\b(Python|FastAPI|Django|Flask|JavaScript|TypeScript|React|Node\.js"
            r"|LangChain|LangGraph|RAG|LLM|MCP|Docker|Kubernetes|PostgreSQL|MySQL|MongoDB"
            r"|Redis|AWS|GCP|Azure|TensorFlow|PyTorch|scikit-learn|FAISS|HuggingFace"
            r"|Prompt Engineering|REST API|GraphQL|Git|Machine Learning|Deep Learning"
            r"|NLP|SQL|Gemini|Groq|STT|TTS|FastAPI)\b",
            re.IGNORECASE,
        )
        found = list(dict.fromkeys(TECH.findall(jd_text)))
        must_have = found[:15]

    return must_have[:15], nice_have[:10]




async def parse_jd(jd_text: str) -> JDParsed:
    """
    Call LLM to parse JD into structured requirements.
    Falls back to regex extraction if LLM returns empty skill lists.
    """
    truncated = jd_text[:6000] if len(jd_text) > 6000 else jd_text
    prompt = JD_PARSE_PROMPT.format(jd_text=truncated)

    jd_parsed = None
    try:
        raw = await call_ollama(prompt, system_prompt=SYSTEM_PROMPT, temperature=0.05)
        data = extract_json_from_response(raw)
        if data:
            jd_parsed = JDParsed(**data)
    except Exception as e:
        logger.error(f"JD parsing LLM call failed: {e}")

    # Fallback: regex extraction when LLM returns empty skills
    if jd_parsed is None or not jd_parsed.must_have_skills:
        logger.warning("LLM returned empty must_have_skills - applying regex fallback")
        must_have, nice_have = _extract_skills_from_jd_text(jd_text)
        if jd_parsed is None:
            jd_parsed = JDParsed(
                must_have_skills=must_have,
                nice_to_have_skills=nice_have,
                embedding_text=jd_text[:500],
            )
        else:
            jd_parsed.must_have_skills = must_have
            if not jd_parsed.nice_to_have_skills:
                jd_parsed.nice_to_have_skills = nice_have
        logger.info(f"Regex extracted {len(jd_parsed.must_have_skills)} must-have skills")

    if not jd_parsed.embedding_text:
        jd_parsed.embedding_text = jd_text[:500]

    return jd_parsed



# â”€â”€ Embedding utility â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

_embedding_model = None


def _get_embedding_model():
    global _embedding_model
    if _embedding_model is None:
        from sentence_transformers import SentenceTransformer
        logger.info("Loading sentence-transformers model (all-MiniLM-L6-v2)...")
        _embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
    return _embedding_model


def generate_embedding(text: str) -> List[float]:
    """
    Generate a 384-dim embedding using all-MiniLM-L6-v2.
    Model is lazy-loaded on first call.
    """
    model = _get_embedding_model()
    embedding = model.encode(text, normalize_embeddings=True)
    return embedding.tolist()


def cosine_similarity(vec_a: List[float], vec_b: List[float]) -> float:
    """Compute cosine similarity between two pre-normalized vectors."""
    import numpy as np
    a = np.array(vec_a)
    b = np.array(vec_b)
    dot = float(np.dot(a, b))
    # Both are L2-normalized, so cosine similarity == dot product
    return max(0.0, min(1.0, dot))

