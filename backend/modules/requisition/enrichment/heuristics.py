"""Deterministic extraction of structured fields from free-text answers.

Used in the intake loop so the LLM only has to fill what these rules cannot
parse — cutting tokens and reducing hallucination on the fields hiring
managers actually trust.

Values are tolerant of small spelling mistakes and human shorthand: '24 lpa',
'₹24', '24', '24l', '24 laks', '2400000' and '24,00,000' all read as ~24 LPA.
"""
import re

from rapidfuzz import fuzz, process

from ..domain.schemas import Seniority

_YEARS_RE = re.compile(r"(\d{1,2}(?:\.\d+)?)\s*(?:\+)?\s*(?:year|years|yrs|yr|exp|experience)\b", re.IGNORECASE)
_YEAR_WORDS = ["year", "years", "yr", "yrs", "exp", "experience"]

# A number followed by an optional unit word, e.g. "24", "24lpa", "24 lpa",
# "50k", "24,00,000", "2400000", "3 ctc".
_AMOUNT_RE = re.compile(
    r"(\d{4,7}(?:\.\d+)?|\d{1,3}(?:,\d{2,3})*(?:\.\d+)?)\s*([a-z]+)?",
    re.IGNORECASE,
)

# Rate-unit vocabularies; matched fuzzy so 'laks', 'ctce', 'per monht' work.
_ANNUAL_UNITS = ["lpa", "lakh", "lac", "ctc", "pa", "annum", "annual", "yearly", "crore", "cr"]
_MONTHLY_UNITS = ["pm", "monthly", "per", "mo"]
_K_UNIT = ["k"]
_EXPERIENCE_UNITS = ["year", "years", "yr", "yrs", "exp", "experience", "month", "months"]

LOCATIONS = [
    "bangalore", "bengaluru", "mumbai", "pune", "delhi", "gurugram", "gurgaon",
    "noida", "hyderabad", "chennai", "kolkata", "ahmedabad", "remote",
    "kochi", "cochin", "kozhikode", "calicut", "trivandrum", "thiruvananthapuram",
    "coimbatore", "mysuru", "mysore", "jaipur", "lucknow", "indore", "surat",
    "nagpur", "bhubaneswar", "visakhapatnam", "vijayawada", "guwahati", "patna",
    "vadodara", "chandigarh", "dehradun", "goa", "kerala", "tamil nadu",
    "london", "new york", "manhattan", "brooklyn", "los angeles", "san francisco",
    "seattle", "chicago", "austin", "boston", "denver", "atlanta", "toronto",
    "vancouver", "montreal", "sydney", "melbourne", "singapore", "dubai", "abu dhabi",
    "berlin", "munich", "frankfurt", "paris", "amsterdam", "madrid", "barcelona",
    "lisbon", "zurich", "geneva", "stockholm", "copenhagen", "oslo", "helsinki",
    "dublin", "warsaw", "prague", "tel aviv", "tokyo", "hong kong", "shanghai",
    "beijing", "seoul", "bangkok", "kuala lumpur", "jakarta", "manila", "sao paulo",
    "mexico city", "new delhi", "ncr", "remote - india", "hybrid", "on-site", "onsite",
]

_SENIORITY_KEYWORDS = [
    (r"\bprincipal\b", Seniority.PRINCIPAL),
    (r"\blead(?:er)?\b|\btech\s*lead\b|\barchitect\b", Seniority.LEAD),
    (r"\bsenior\b|\b5\+|5\+ years|6\+|7\+", Seniority.SENIOR),
    (r"\bmid\b|\b2\s*-\s*5|2-5|3-5|4\+", Seniority.MID),
    (r"\bjunior\b|\bfresher\b|\bentry\b|\b0\s*-\s*2\b", Seniority.JUNIOR),
]


def _best_unit(word: str, vocab: list[str]) -> tuple[str, int] | None:
    """Fuzzy-match a unit word against a vocabulary; None if no good match.

    Uses full-string ratio (not partial) plus a length guard so a long word
    can't win against a short one just by *containing* it ('lakhs' -> 'k',
    'per' -> 'experience').
    """
    if not word:
        return None
    best, score, _ = process.extractOne(word, vocab, scorer=fuzz.ratio)
    if score < 80 or len(best) > 2 * len(word) or len(word) > 2 * len(best):
        return None
    return (best, score)


def parse_years(text: str) -> int | None:
    m = _YEARS_RE.search(text)
    if m:
        return int(float(m.group(1)))
    # Fuzzy fallback for misspellings like '3 yeaers' / '3 yeras'.
    for m in re.finditer(r"\b(\d{1,2})\s+([a-z]+)\b", text.lower()):
        if _best_unit(m.group(2), _YEAR_WORDS):
            return int(m.group(1))
    return None


def _rate_base(value: float, unit: str | None) -> int | None:
    """Annual INR implied by a numeric value + optional unit word."""
    if unit:
        if _best_unit(unit, _K_UNIT):  # 50k -> 50,000 (monthly shorthand)
            value *= 1000
            unit = None
        elif _best_unit(unit, _EXPERIENCE_UNITS):
            return None  # '3 years' is experience, not a rate
        elif _best_unit(unit, _ANNUAL_UNITS):
            if "crore" in unit or unit in ("cr",):
                return int(value * 10_000_000)
            return int(value * 100_000) if value < 100_000 else int(value)
        elif _best_unit(unit, _MONTHLY_UNITS):
            return int(value * 12)
    # No unit: a bare number. Small -> LPA, mid -> monthly salary, big -> already annual.
    if value < 1000:
        return int(value * 100_000)          # '24' -> 24 LPA
    if value < 100_000:
        return int(value * 12)               # '50,000' -> 6 LPA p.a.
    return int(value)                        # '2,400,000' -> 24 LPA


def parse_rate_band(text: str) -> tuple[int, int] | None:
    """Parse an INR rate into a (min, max) annual band. Heuristics only."""
    base = 0
    for m in _AMOUNT_RE.finditer(text):
        raw = m.group(1).replace(",", "")
        try:
            value = float(raw)
        except ValueError:
            continue
        unit = (m.group(2) or "").lower()
        annual = _rate_base(value, unit)
        if annual and annual > base:
            base = annual
    if base <= 0:
        return None
    return (int(base * 0.9), int(base * 1.1))


def parse_location(text: str) -> str | None:
    lowered = text.lower()
    for loc in LOCATIONS:
        if loc in lowered:
            return "Remote" if loc == "remote" else loc.title()
    # Fuzzy fallback for small typos: 'chenai', 'bangaluru', 'kozhikoda'.
    best, score, _ = process.extractOne(
        lowered.strip(), [l for l in LOCATIONS if l != "remote"], scorer=fuzz.partial_ratio
    )
    if score >= 75:
        return best.title()
    return None


def parse_seniority(text: str) -> Seniority | None:
    lowered = text.lower()
    for pattern, sen in _SENIORITY_KEYWORDS:
        if re.search(pattern, lowered):
            return sen
    return None


def parse_contract_duration(text: str) -> str | None:
    """Extract the engagement/contract duration: '6 months', '1 year', 'Permanent'."""
    lowered = " ".join(text.lower().split())
    if re.search(r"\bpermanent\b|\bfull[-\s]?time\b", lowered):
        return "Permanent"
    m = re.search(r"\b(\d{1,2})\s*(?:\+|to\s+\d{1,2})?\s*(months?|monthly|mos?)\b", lowered)
    if m:
        return f"{int(m.group(1))} months"
    m = re.search(r"\b(\d{1,2})\s*(?:\.\d+)?\s*(years?|yrs?)\b", lowered)
    if m:
        return f"{int(m.group(1))} year{'s' if int(m.group(1)) > 1 else ''}"
    m = re.search(r"\b(\d{1,2})\s*(weeks?|wks?)\b", lowered)
    if m:
        return f"{int(m.group(1))} weeks"
    if re.search(r"\bcontract\b|\bfixed[-\s]?term\b", lowered):
        return "Contract"
    return None


def extract_from_text(text: str) -> dict:
    """Best-effort deterministic extraction from a free-text answer."""
    return {
        "years": parse_years(text),
        "rate_band": parse_rate_band(text),
        "location": parse_location(text),
        "seniority": parse_seniority(text),
        "contract_duration": parse_contract_duration(text),
        "skills": None,  # filled by skills_in_text separately if asked
    }