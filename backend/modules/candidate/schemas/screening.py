from typing import List, Optional
from pydantic import BaseModel, Field
from backend.modules.candidate.domain.models import Recommendation

class SkillMatch(BaseModel):
    skill: str = Field(..., description="Name of the skill assessed")
    candidate_has: bool = Field(..., description="Whether candidate has this skill")
    score: float = Field(..., ge=0.0, le=10.0, description="Skill proficiency score out of 10")
    quote: Optional[str] = Field(default=None, description="Direct quote from resume as evidence")

class DuplicateFlag(BaseModel):
    is_duplicate: bool = Field(default=False, description="True if duplicate candidate/submission detected")
    matched_submission_id: Optional[str] = Field(default=None, description="Matched existing submission ID")
    reason: str = Field(default="No duplicate found", description="Reason or similarity metric description")

class CandidateScreeningOutput(BaseModel):
    overall_fit_score: float = Field(..., ge=0.0, le=100.0, description="Overall match fit score between 0 and 100")
    recommendation: Recommendation = Field(..., description="Agent recommendation: SHORTLIST, REVIEW, or REJECT")
    skill_matches: List[SkillMatch] = Field(default_factory=list, description="Breakdown of candidate skill matches")
    seniority_fit: str = Field(..., description="Evaluation of seniority and experience fit")
    strengths: List[str] = Field(default_factory=list, description="Key candidate strengths for the role")
    gaps: List[str] = Field(default_factory=list, description="Missing requirements or skill gaps")
    duplicate_flags: DuplicateFlag = Field(default_factory=DuplicateFlag, description="Duplicate submission detection results")
    confidence_score: float = Field(..., ge=0.0, le=1.0, description="AI agent confidence score between 0.0 and 1.0")
