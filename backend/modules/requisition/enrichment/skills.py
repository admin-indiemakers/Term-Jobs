"""Canonical tech-stack taxonomy + fuzzy canonicalization.

Reduces LLM load: skills are normalised deterministically instead of by the
model, so 'Javascript', 'JS' and 'java script' all collapse to one canonical
term and the structured output stays stable and deduplicated.
"""
import re

from rapidfuzz import fuzz, process

CANONICAL_SKILLS = {
    "python", "java", "javascript", "typescript", "kotlin", "swift", "ruby",
    "go", "golang", "rust", "c#", "c++", "php", "scala", "groovy", "r", "sql",
    "react", "react native", "angular", "vue.js", "svelte", "next.js", "node.js",
    "express", "django", "flask", "fastapi", "spring boot", "laravel", "rails",
    "graphql", "rest api", "grpc", "kafka", "redis", "mongodb", "postgresql",
    "mysql", "cassandra", "elasticsearch", "docker", "kubernetes", "terraform",
    "ansible", "aws", "gcp", "azure", "ci/cd", "jenkins", "gitlab ci", "github actions",
    "pandas", "numpy", "tensorflow", "pytorch", "scikit-learn", "spark", "airflow",
    "databricks", "snowflake", "bigquery", "linux", "bash", "html", "css", "tailwind",
    "jest", "pytest", "cypress", "playwright", "selenium", "microservices",
    "system design", "rabbitmq", "nginx", "prometheus", "grafana", "openai api",
    "langchain", "langgraph", "datadog", "storybook", "webpack", "vite",
}

_FUZZY_THRESHOLD = 82


def canonicalize_skill(token: str) -> str:
    """Return the canonical form of a skill, or a cleaned fallback."""
    token = token.strip().lower().rstrip(".")
    if not token:
        return token
    if token in CANONICAL_SKILLS:
        return token
    # Prefix / containment: 'postgres' -> 'postgresql', 'js' -> 'javascript'
    candidates = [s for s in CANONICAL_SKILLS if s.startswith(token) or token.startswith(s)]
    if candidates:
        best = max(candidates, key=len)
        if len(best) >= 3 and (best.startswith(token) or token.startswith(best)):
            return best
    # Fuzzy fallback for short hand-typed variants
    match = process.extractOne(token, list(CANONICAL_SKILLS), scorer=fuzz.WRatio)
    if match and match[1] >= _FUZZY_THRESHOLD and len(token) >= 3:
        return match[0]
    return token


def canonicalize_skills(items: list[str]) -> list[str]:
    """Canonicalize and deduplicate, preserving order."""
    seen: set[str] = set()
    out: list[str] = []
    for item in items:
        canon = canonicalize_skill(item)
        if canon not in seen:
            seen.add(canon)
            out.append(canon)
    return out


_WORD_BOUNDARY = re.compile(r"[a-z0-9]")


def skills_in_text(text: str) -> list[str]:
    """Return canonical skills mentioned in free text (deterministic).

    Uses word-boundary matching so 'go' is not detected inside 'Django' and
    'r' is not detected inside 'Postgres' — only whole-token mentions count.
    """
    lowered = text.lower()
    found: list[str] = []
    for s in sorted(CANONICAL_SKILLS):
        pattern = rf"(?<![a-z0-9]){re.escape(s)}(?![a-z0-9])"
        if re.search(pattern, lowered):
            found.append(s)
    return found


def is_covered(required: list[str], registered: list[str]) -> tuple[bool, list[str]]:
    """Which required skills are missing from the registered tech stack."""
    registered_norm = set(canonicalize_skills(registered))
    missing = [s for s in canonicalize_skills(required) if s not in registered_norm]
    return (not missing, missing)