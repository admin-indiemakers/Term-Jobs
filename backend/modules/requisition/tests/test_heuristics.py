"""Deterministic heuristic extraction: years and compensation parsing."""
from modules.requisition.enrichment.heuristics import (
    parse_contract_duration,
    parse_location,
    parse_rate_band,
    parse_years,
)


def _lpa(text: str) -> int | None:
    band = parse_rate_band(text)
    return band[0] / 90_000 if band else None  # band lower bound == 0.9 * base


def test_bare_number_is_treated_as_lpa():
    # "instead of giving 24lpa he may type just 24"
    assert _lpa("just 24") == 24
    assert _lpa("24") == 24
    assert _lpa("₹24") == 24
    assert _lpa("24l") == 24
    assert _lpa("expecting around 28") == 28


def test_lpa_lakh_variants_and_typos():
    assert _lpa("24 lpa") == 24
    assert _lpa("24 lakhs") == 24
    assert _lpa("24 laks") == 24
    assert _lpa("4 lacs") == 4
    assert _lpa("8.5 lakhs") == 8.5


def test_absolute_numbers_understood():
    assert _lpa("2400000") == 24
    assert _lpa("24,00,000") == 24


def test_monthly_and_k_shorthand():
    assert _lpa("50,000 per month") == 6
    assert _lpa("50k") == 6
    assert _lpa("50000") == 6


def test_ctc_and_crore():
    assert _lpa("3 ctc") == 3
    assert _lpa("3 ctce") == 3
    assert _lpa("2.4 crore") == 240
    assert _lpa("2.4 cr") == 240


def test_range_takes_upper_bound():
    assert _lpa("30-35 lpa") == 35


def test_experience_words_are_not_rates():
    assert parse_rate_band("3 years experience") is None
    assert _lpa("expecting 25lpa with 3 years exp") == 25


def test_non_rate_text_returns_none():
    for text in ["no expectation yet", "negotiable", "flexible", "market rate", ""]:
        assert parse_rate_band(text) is None


def test_parse_years_typos():
    assert parse_years("3 yr expieerence") == 3
    assert parse_years("5 yeaers") == 5
    assert parse_years("2 yeras") == 2
    assert parse_years("7 years") == 7
    assert parse_years("no info") is None


def test_parse_years_bare_number():
    assert parse_years("3") is None  # bare digits are for the years question specifically
    assert parse_years("") is None


def test_parse_location_known_cities():
    assert parse_location("bangalore") == "Bangalore"
    assert parse_location("Hyderabad or remote") == "Hyderabad"
    assert parse_location("work from home") is None  # 'remote' not mentioned


def test_parse_location_new_cities():
    assert parse_location("kozhikode") == "Kozhikode"
    assert parse_location("calicut") == "Calicut"
    assert parse_location("kochi") == "Kochi"
    assert parse_location("trivandrum") == "Trivandrum"
    assert parse_location("remote") == "Remote"


def test_parse_location_typos():
    assert parse_location("chenai") == "Chennai"
    assert parse_location("bangaluru") == "Bengaluru"
    assert parse_location("kozhikoda") == "Kozhikode"
    assert parse_location("mumbai") == "Mumbai"


def test_parse_contract_duration():
    assert parse_contract_duration("6 months") == "6 months"
    assert parse_contract_duration("contract for 12 months") == "12 months"
    assert parse_contract_duration("1 year") == "1 year"
    assert parse_contract_duration("3 yrs") == "3 years"
    assert parse_contract_duration("permanent") == "Permanent"
    assert parse_contract_duration("Full Time") == "Permanent"
    assert parse_contract_duration("12 week contract") == "12 weeks"
    assert parse_contract_duration("open ended") is None
    assert parse_contract_duration("") is None
