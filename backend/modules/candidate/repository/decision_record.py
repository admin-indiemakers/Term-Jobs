from datetime import datetime
from typing import Dict, List, Optional
from pydantic import BaseModel, Field
from backend.modules.candidate.schemas.screening import CandidateScreeningOutput

class DecisionRecord(BaseModel):
    id: str = Field(..., description="Unique Decision Record ID")
    submission_id: str = Field(..., description="Submission ID")
    candidate_id: str = Field(..., description="Candidate ID")
    requisition_id: str = Field(..., description="Requisition ID")
    model_used: str = Field(default="gpt-4o-mini", description="LLM Model Tier used")
    screening_output: CandidateScreeningOutput = Field(..., description="Full structured AI screening result")
    status: str = Field(default="PENDING_HUMAN_REVIEW", description="Status: PENDING_HUMAN_REVIEW or AUTO_DISPATCHED")
    created_at: datetime = Field(default_factory=datetime.utcnow)

class DecisionRecordRepository:
    """Auditable persistence repository for AI agent decision records."""
    _store: Dict[str, DecisionRecord] = {}

    @classmethod
    def save(cls, record: DecisionRecord) -> DecisionRecord:
        cls._store[record.id] = record
        return record

    @classmethod
    def get_by_id(cls, record_id: str) -> Optional[DecisionRecord]:
        return cls._store.get(record_id)

    @classmethod
    def get_by_submission_id(cls, submission_id: str) -> Optional[DecisionRecord]:
        for rec in cls._store.values():
            if rec.submission_id == submission_id:
                return rec
        return None

    @classmethod
    def list_all(cls) -> List[DecisionRecord]:
        return list(cls._store.values())

    @classmethod
    def clear(cls):
        cls._store.clear()
