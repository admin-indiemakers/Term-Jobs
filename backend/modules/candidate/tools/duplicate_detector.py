from typing import List, Optional
from backend.modules.candidate.domain.models import Candidate, Submission
from backend.modules.candidate.schemas.screening import DuplicateFlag

class DuplicateDetector:
    """
    Tool to detect if a candidate has already been submitted for a requisition
    or exists under the same client tenant.
    """

    @staticmethod
    def _normalize_phone(phone: str) -> str:
        """Extract last 10 digits of phone number to ignore country code variations."""
        digits = "".join(filter(str.isdigit, phone))
        return digits[-10:] if len(digits) >= 10 else digits

    @classmethod
    def check_duplicate(
        cls,
        candidate: Candidate,
        existing_candidates: List[Candidate],
        existing_submissions: List[Submission],
        requisition_id: str
    ) -> DuplicateFlag:
        """
        Check for exact email or phone match across existing submissions for the same requisition.
        """
        cand_map = {c.id: c for c in existing_candidates}

        for existing_sub in existing_submissions:
            if existing_sub.requisition_id != requisition_id:
                continue

            existing_cand = cand_map.get(existing_sub.candidate_id)
            if not existing_cand:
                continue

            # 1. Exact Email Match
            if candidate.email.strip().lower() == existing_cand.email.strip().lower():
                return DuplicateFlag(
                    is_duplicate=True,
                    matched_submission_id=existing_sub.id,
                    reason=f"Exact email match with existing candidate ({existing_cand.name})."
                )

            # 2. Phone Match (last 10 digits comparison)
            phone1 = cls._normalize_phone(candidate.phone)
            phone2 = cls._normalize_phone(existing_cand.phone)
            if phone1 and phone1 == phone2:
                return DuplicateFlag(
                    is_duplicate=True,
                    matched_submission_id=existing_sub.id,
                    reason=f"Exact phone number match with existing candidate ({existing_cand.name})."
                )

        return DuplicateFlag(
            is_duplicate=False,
            matched_submission_id=None,
            reason="No duplicate candidate or submission detected."
        )
