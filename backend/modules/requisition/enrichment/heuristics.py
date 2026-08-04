"""Deterministic extraction of structured fields from free-text answers.

Used in the intake loop so the LLM only has to fill what these rules cannot
parse — cutting tokens and reducing hallucination on the fields hiring
managers actually trust.
"""
import re

from ..domain.schemas import Seniority

_YEARS_RE = re.compile(r"(\d{1,2})\s*(?:\+)?\s*(?:year|years|yrs|yr)\b", re.IGNORECASE)
_LPA_RE = re.compile(r"(\d{1,3}(?:\.\d+)?)\s*(?:lpa|lakhs?|lac|lakh)\b", re.IGNORECASE)
_BASE_RE = re.compile(r"₹?[\s]?(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d{3,7})(?:\s*(?:per\s*month|pm|/mo|monthly))?", re.IGNORECASE)
_CTC_RE = re.compile(r"(\d{1,3}(?:\.\d+)?)\s*ctc\b", re.IGNORECASE)

LOCATIONS = [
    "bangalore", "bengaluru", "mumbai", "pune", "delhi", "gurugram", "gurgaon",
    "noida", "hyderabad", "chennai", "kolkata", "ahmedabad", "remote",
]

_SENIORITY_KEYWORDS = [
    (r"\bprincipal\b", Seniority.PRINCIPAL),
    (r"\blead(?:er)?\b|\btech\s*lead\b|\barchitect\b", Seniority.LEAD),
    (r"\bsenior\b|\b5\+|5\+ years|6\+|7\+", Seniority.SENIOR),
    (r"\bmid\b|\b2\s*-\s*5|2-5|3-5|4\+", Seniority.MID),
    (r"\bjunior\b|\bfresher\b|\bentry\b|\b0\s*-\s*2\b", Seniority.JUNIOR),
]


def parse_years(text: str) -> int | None:
    m = _YEARS_RE.search(text)
    return int(m.group(1)) if m else None


def parse_rate_band(text: str) -> tuple[int, int] | None:
    """Parse an INR rate into a (min, max) annual band. Heuristics only."""
    base = 0
    # "X lpa" / "X lakhs" -> annual
    m = _LPA_RE.search(text)
    if m:
        base = int(float(m.group(1)) * 100_000)
    else:
        m = _CTC_RE.search(text)
        if m:
            base = int(float(m.group(1)) * 100_000)
        else:
            m = _BASE_RE.search(text)
            if m:
                raw = float(m.group(1).replace(",", ""))
                # If a bare number appears monthly-ish or is small, treat as monthly * 12
                if "per month" in text.lower() or "pm" in text.lower() or "/mo" in text.lower():
                    base = int(raw * 12)
                else:
                    base = int(raw)
    if base <= 0:
        return None
    return (int(base * 0.9), int(base * 1.1))


def parse_location(text: str) -> str | None:
    lowered = text.lower()
    for loc in LOCATIONS:
        if loc in lowered:
            return "Remote" if loc == "remote" else loc.title()
    return None


def parse_seniority(text: str) -> Seniority | None:
    lowered = text.lower()
    for pattern, sen in _SENIORITY_KEYWORDS:
        if re.search(pattern, lowered):
            return sen
    return None


def extract_from_text(text: str) -> dict:
    """Best-effort deterministic extraction from a free-text answer."""
    return {
        "years": parse_years(text),
        "rate_band": parse_rate_band(text),
        "location": parse_location(text),
        "seniority": parse_seniority(text),
        "skills": None,  # filled by skills_in_text separately if asked
    }