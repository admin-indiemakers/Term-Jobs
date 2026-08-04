from backend.modules.candidate.schemas.screening import CandidateScreeningOutput

class GuardrailChecker:
    """
    Evaluates confidence threshold and applies MVP safety guardrails:
    - Human-reviewed by default (queued for Hiring Manager approval).
    - Auto-shortlist is OFF by default for MVP.
    """
    MIN_CONFIDENCE_THRESHOLD = 0.70

    @classmethod
    def evaluate(cls, screening_output: CandidateScreeningOutput, auto_dispatch_opt_in: bool = False) -> str:
        # 1. Low confidence check
        if screening_output.confidence_score < cls.MIN_CONFIDENCE_THRESHOLD:
            return "PENDING_HUMAN_REVIEW"

        # 2. Duplicate submission flag check
        if screening_output.duplicate_flags.is_duplicate:
            return "PENDING_HUMAN_REVIEW"

        # 3. Tenant policy (Default MVP: Off)
        if auto_dispatch_opt_in:
            return "AUTO_DISPATCHED"
        
        return "PENDING_HUMAN_REVIEW"
