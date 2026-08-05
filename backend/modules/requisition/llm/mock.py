"""Deterministic in-memory LLM for offline tests and CI.

Produces stable, canonical outputs by running the same heuristics/dictionaries
the real flow uses, so tests never touch the network and eval fixtures are
meaningful. The mock 'knows' the StructuredRole schema and generates a role
straight from the prompt's embedded context.
"""
import re

from pydantic import BaseModel

from ..domain.schemas import Seniority, StructuredRole
from ..enrichment.heuristics import (
    parse_contract_duration,
    parse_location,
    parse_rate_band,
    parse_seniority,
    parse_years,
)
from ..enrichment.skills import (
    CANONICAL_SKILLS,
    canonicalize_skill,
    canonicalize_skills,
)

_TITLE_HINTS = [
    "backend", "frontend", "fullstack", "full stack", "devops", "data", "ml",
    "machine learning", "android", "ios", "qa", "platform", "sre",
]

_TOKEN_RE = re.compile(r"[a-z0-9#+./-]+")
_STOPWORDS = {
    "the", "and", "for", "with", "that", "will", "have", "are", "year", "years",
    "api", "work", "you", "your", "our", "role", "build", "team", "engineer",
    "company", "join", "scalable", "reliable", "systems",
}


def _title_from_prompt(prompt: str, fallback: str) -> str:
    lowered = prompt.lower()
    for hint in _TITLE_HINTS:
        if hint in lowered:
            if hint == "full stack":
                return "Full Stack Engineer"
            return f"{hint.title()} Engineer"
    return fallback


def _extract_skills(text: str) -> list[str]:
    """Canonicalize token-level skill mentions, mimicking real-model output."""
    out: list[str] = []
    for word in _TOKEN_RE.findall(text.lower()):
        if word in _STOPWORDS:
            continue
        canon = canonicalize_skill(word)
        if canon in CANONICAL_SKILLS and canon not in out:
            out.append(canon)
    return out


class MockLLM:
    def __init__(self, **overrides) -> None:
        self.overrides = overrides

    def chat(self, messages: list[dict[str, str]]) -> str:
        return "[mock]"

    def generate_text(self, prompt: str) -> str:
        title = _title_from_prompt(prompt, "Software Engineer")
        if "refining an existing" in prompt.lower():
            return (
                f"# {title} (refined)\n\n"
                "We are looking for an experienced engineer to join our team. "
                "You will own features end-to-end and collaborate across teams. "
                "Apply if you are excited to build reliable, scalable systems.\n"
            )
        return (
            f"# {title}\n\n"
            "We are looking for an experienced engineer to join our team. "
            "You will own features end-to-end and collaborate across teams. "
            "Apply if you are excited to build reliable, scalable systems.\n"
        )

    def generate_structured(self, prompt: str, schema: type[BaseModel]) -> dict:
        if schema is StructuredRole:
            return self._structured_role(prompt)
        raise NotImplementedError(f"MockLLM does not know schema {schema.__name__}")

    def _structured_role(self, prompt: str) -> dict:
        o = self.overrides.get("structured_role", {})
        text = prompt.lower()
        answers_section = (
            text.split("collected answers from the intake conversation:", 1)[1]
            if "collected answers from the intake conversation:" in text
            else ""
        )

        title = o.get("title") or _title_from_prompt(text, "Software Engineer")
        seniority = o.get("seniority") or parse_seniority(text) or Seniority.MID
        # Explicit answers to intake questions win over profile defaults.
        location = o.get("location") or parse_location(answers_section) or parse_location(text) or ""
        rate_band = o.get("rate_band") or parse_rate_band(answers_section) or parse_rate_band(text)
        years = o.get("years") or parse_years(answers_section) or parse_years(text)
        contract_duration = (
            o.get("contract_duration")
            or parse_contract_duration(answers_section)
            or parse_contract_duration(text)
            or ""
        )
        skills = o.get("must_have_skills") or canonicalize_skills(
            _extract_skills(text) or ["python"]
        )

        notes = []
        if years:
            notes.append(f"{years}+ years experience")
        if o.get("notes"):
            notes.append(str(o["notes"]))

        return StructuredRole(
            title=title,
            must_have_skills=skills,
            nice_to_have_skills=o.get("nice_to_have_skills") or [],
            seniority=seniority,
            location=location,
            rate_band=rate_band,
            contract_duration=contract_duration,
            confidence=float(o.get("confidence", 0.95)),
            notes="; ".join(notes),
        ).model_dump()