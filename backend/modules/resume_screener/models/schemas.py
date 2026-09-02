from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime
from enum import Enum


# â”€â”€ Enums â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class RunStatus(str, Enum):
    pending = "pending"
    processing = "processing"
    completed = "completed"
    failed = "failed"


class MatchCategory(str, Enum):
    strong_match = "Strong Match"
    consider = "Consider"
    weak_match = "Weak Match"


# â”€â”€ Resume Structure (LLM output â€” bias-free) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class ProjectItem(BaseModel):
    name: Optional[str] = ""
    description: Optional[str] = ""
    technologies: Optional[List[str]] = []
    outcome: Optional[str] = None


class ExperienceItem(BaseModel):
    role: Optional[str] = ""
    company: Optional[str] = ""
    duration_months: Optional[int] = None
    description: Optional[str] = ""
    technologies: Optional[List[str]] = []


class EducationItem(BaseModel):
    degree: Optional[str] = ""
    field: Optional[str] = ""
    institution: Optional[str] = ""
    year: Optional[int] = None


class StructuredResume(BaseModel):
    name: Optional[str] = ""
    email: Optional[str] = ""
    skills: Optional[List[str]] = []
    projects: Optional[List[ProjectItem]] = []
    experience: Optional[List[ExperienceItem]] = []
    education: Optional[List[EducationItem]] = []
    certifications: Optional[List[str]] = []
    github_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    raw_text_for_embedding: Optional[str] = ""


# â”€â”€ JD Structure (LLM output) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class JDParsed(BaseModel):
    must_have_skills: List[str] = []
    nice_to_have_skills: List[str] = []
    experience_requirements: Dict[str, Any] = {}
    education_requirements: Dict[str, Any] = {}
    key_responsibilities: List[str] = []
    embedding_text: str = ""


# â”€â”€ GitHub Evidence â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class GitHubRepo(BaseModel):
    name: str
    url: str
    description: Optional[str] = None
    languages: List[str] = []
    topics: List[str] = []
    has_dockerfile: bool = False
    has_ci: bool = False
    stars: int = 0
    recent_activity: bool = False


class GitHubEvidence(BaseModel):
    verified: bool = False
    username: Optional[str] = None
    profile_url: Optional[str] = None
    public_repos: int = 0
    top_repos: List[GitHubRepo] = []
    verified_skills: List[str] = []
    ci_evidence: bool = False
    docker_evidence: bool = False
    recent_activity: bool = False
    evidence_score: float = 0.0
    error: Optional[str] = None


# â”€â”€ Scoring â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class ScoreBreakdown(BaseModel):
    must_have_skills: float = 0.0
    project_evidence: float = 0.0
    semantic_relevance: float = 0.0
    github_evidence: float = 0.0
    problem_solving: float = 0.0
    nice_to_have_skills: float = 0.0
    experience_alignment: float = 0.0
    education_relevance: float = 0.0

    def total(self) -> float:
        return (
            self.must_have_skills * 0.30
            + self.project_evidence * 0.25
            + self.semantic_relevance * 0.20
            + self.github_evidence * 0.10
            + self.problem_solving * 0.05
            + self.nice_to_have_skills * 0.05
            + self.experience_alignment * 0.03
            + self.education_relevance * 0.02
        )


# â”€â”€ API Request / Response Models â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class JDSubmitRequest(BaseModel):
    jd_text: str = Field(..., min_length=50, description="Full job description text")


class JDSubmitResponse(BaseModel):
    run_id: str
    message: str


class RunStatusResponse(BaseModel):
    run_id: str
    status: RunStatus
    total_candidates: int
    processed_candidates: int
    error_message: Optional[str] = None
    created_at: datetime


class CandidateResultResponse(BaseModel):
    id: str
    filename: str
    status: str
    total_score: Optional[float] = None
    category: Optional[MatchCategory] = None
    score_breakdown: Optional[Dict[str, float]] = None
    matched_skills: Optional[List[str]] = None
    missing_skills: Optional[List[str]] = None
    github_evidence: Optional[Dict[str, Any]] = None
    rank: Optional[int] = None
    error_message: Optional[str] = None

    class Config:
        from_attributes = True


class ResultsResponse(BaseModel):
    run_id: str
    status: RunStatus
    jd_summary: Optional[Dict[str, Any]] = None
    candidates: List[CandidateResultResponse] = []
    total: int = 0

