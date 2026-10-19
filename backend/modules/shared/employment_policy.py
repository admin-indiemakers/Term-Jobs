"""TermJobs supports contract engagements only."""
import re


def contract_employment_type(value=''):
    text = str(value or '').strip()
    if re.fullmatch(r'contract\s*\(\s*\d+\s*(?:months?|weeks?|years?)\s*\)', text, re.I):
        return text
    return 'Contract'
