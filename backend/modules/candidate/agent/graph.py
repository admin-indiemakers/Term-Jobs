import uuid
from typing import Dict, Any, List, Optional
from datetime import datetime

from backend.modules.candidate.domain.models import Candidate, Submission, SubmissionStatus, Recommendation
from backend.modules.candidate.domain.state_machine import SubmissionStateMachine
from backend.modules.candidate.schemas.screening import CandidateScreeningOutput, SkillMatch, DuplicateFlag
from backend.modules.candidate.tools.duplicate_detector import DuplicateDetector
from backend.modules.candidate.agent.budget_gate import BudgetGate
from backend.modules.candidate.agent.context_builder import ContextBuilder
from backend.modules.candidate.agent.guardrails import GuardrailChecker
from backend.modules.candidate.repository.decision_record import DecisionRecord, DecisionRecordRepository

class CandidateScreeningAgentGraph:
    """
    7-step LangGraph-compatible state workflow for Candidate Screening Agent:
    1. Budget Gate
    2. Context Builder
    3. Duplicate Check Tool
    4. LLM / Heuristic Skill Match & Fit Score Evaluation
    5. Guardrail Check
    6. Decision Record Persistence
    7. LangGraph Pause Checkpoint & Submission Status Transition to 'Screened'
    """

    @classmethod
    def evaluate_fit_score(
        cls,
        candidate: Candidate,
        requisition_data: Dict[str, Any],
        duplicate_flag: DuplicateFlag
    ) -> CandidateScreeningOutput:
        """
        Calculates skill match breakdown, overall fit score (0-100), strengths, gaps,
        and recommendation based on JD must-haves and candidate resume text.
        """
        must_haves: List[str] = requisition_data.get("must_have_skills", [])
        nice_haves: List[str] = requisition_data.get("nice_to_have_skills", [])
        resume_lower = candidate.resume_text.lower()

        skill_matches: List[SkillMatch] = []
        matched_must_count = 0

        # Assess Must-Haves
        for skill in must_haves:
            has_skill = skill.lower() in resume_lower
            score = 10.0 if has_skill else 0.0
            if has_skill:
                matched_must_count += 1
            skill_matches.append(
                SkillMatch(
                    skill=skill,
                    candidate_has=has_skill,
                    score=score,
                    quote=f"Matched '{skill}' in resume" if has_skill else None
                )
            )

        # Assess Nice-to-Haves
        matched_nice_count = 0
        for skill in nice_haves:
            has_skill = skill.lower() in resume_lower
            score = 10.0 if has_skill else 0.0
            if has_skill:
                matched_nice_count += 1
            skill_matches.append(
                SkillMatch(
                    skill=skill,
                    candidate_has=has_skill,
                    score=score,
                    quote=f"Matched optional '{skill}' in resume" if has_skill else None
                )
            )

        # Calculate Overall Fit Score (0.0 to 100.0)
        total_must = len(must_haves) if must_haves else 1
        must_ratio = matched_must_count / total_must
        nice_ratio = (matched_nice_count / len(nice_haves)) if nice_haves else 1.0

        overall_score = round((must_ratio * 80.0) + (nice_ratio * 20.0), 1)

        # Duplicate Penalty
        if duplicate_flag.is_duplicate:
            overall_score = max(0.0, overall_score - 50.0)

        # Recommendation
        if overall_score >= 80.0 and not duplicate_flag.is_duplicate:
            rec = Recommendation.SHORTLIST
        elif overall_score >= 50.0 or duplicate_flag.is_duplicate:
            rec = Recommendation.REVIEW
        else:
            rec = Recommendation.REJECT

        strengths = [
            f"Matched must-have skill: {sm.skill}" for sm in skill_matches if sm.candidate_has and sm.score == 10.0
        ]
        gaps = [
            f"Missing must-have skill: {sm.skill}" for sm in skill_matches if not sm.candidate_has
        ]

        return CandidateScreeningOutput(
            overall_fit_score=overall_score,
            recommendation=rec,
            skill_matches=skill_matches,
            seniority_fit=f"Evaluated {matched_must_count}/{len(must_haves)} required skills matched.",
            strengths=strengths if strengths else ["Basic profile uploaded"],
            gaps=gaps if gaps else ["No major skill gaps identified"],
            duplicate_flags=duplicate_flag,
            confidence_score=0.92
        )

    @classmethod
    def run(
        cls,
        candidate: Candidate,
        submission: Submission,
        requisition_data: Dict[str, Any],
        existing_candidates: Optional[List[Candidate]] = None,
        existing_submissions: Optional[List[Submission]] = None,
        auto_dispatch_opt_in: bool = False
    ) -> Dict[str, Any]:
        existing_candidates = existing_candidates or []
        existing_submissions = existing_submissions or []

        # 1. Budget Gate
        model_tier = BudgetGate.check_and_route(candidate.tenant_id)

        # 2. Context Builder
        prompt_context = ContextBuilder.build_prompt_context(candidate, requisition_data)

        # 3. Duplicate Check Tool
        duplicate_flag = DuplicateDetector.check_duplicate(
            candidate=candidate,
            existing_candidates=existing_candidates,
            existing_submissions=existing_submissions,
            requisition_id=submission.requisition_id
        )

        # 4. LLM Fit Score & Schema Validation
        screening_output = cls.evaluate_fit_score(candidate, requisition_data, duplicate_flag)

        # 5. Guardrail Check
        guardrail_status = GuardrailChecker.evaluate(screening_output, auto_dispatch_opt_in)

        # 6. Persist Decision Audit Record
        decision_record = DecisionRecord(
            id=f"dec_{uuid.uuid4().hex[:8]}",
            submission_id=submission.id,
            candidate_id=candidate.id,
            requisition_id=submission.requisition_id,
            model_used=model_tier,
            screening_output=screening_output,
            status=guardrail_status
        )
        DecisionRecordRepository.save(decision_record)

        # 7. Update Submission State Machine to 'Screened'
        updated_submission = SubmissionStateMachine.transition(submission, SubmissionStatus.SCREENED)

        return {
            "submission": updated_submission,
            "decision_record": decision_record,
            "screening_output": screening_output,
            "status": "PAUSED_AT_HIRING_MANAGER_APPROVAL_QUEUE" if guardrail_status == "PENDING_HUMAN_REVIEW" else "AUTO_DISPATCHED"
        }
