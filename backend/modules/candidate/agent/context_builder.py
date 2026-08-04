from typing import Dict, Any
from backend.modules.candidate.domain.models import Candidate

class ContextBuilder:
    """Prepares structured prompt context combining JD criteria and candidate resume."""
    
    @classmethod
    def build_prompt_context(
        cls,
        candidate: Candidate,
        requisition_data: Dict[str, Any]
    ) -> str:
        job_title = requisition_data.get("title", "Software Engineer")
        must_haves = ", ".join(requisition_data.get("must_have_skills", []))
        nice_haves = ", ".join(requisition_data.get("nice_to_have_skills", []))
        seniority = requisition_data.get("seniority", "Mid-Senior")

        return f"""
Job Requisition Criteria:
- Title: {job_title}
- Seniority: {seniority}
- Must-Have Skills: {must_haves}
- Nice-to-Have Skills: {nice_haves}

Candidate Submission:
- Candidate Name: {candidate.name}
- Email: {candidate.email}
- Phone: {candidate.phone}
- Resume Content:
{candidate.resume_text}
"""
