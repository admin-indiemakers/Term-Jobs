from typing import Any

from services.llm_service import screen_candidate


def rank_candidates(
    jd: str,
    candidates: list[dict[str, str]],
    existing_submissions: list[dict[str, Any]] | None = None
) -> dict[str, Any]:
    """Screen multiple candidates against a JD, flag duplicates, and rank them to find the best match.

    Args:
        jd: Job description text.
        candidates: List of dicts, each with 'filename' and 'extracted_text'.
        existing_submissions: Existing candidate submissions for duplicate checking.

    Returns:
        Structured evaluation containing ranked list of candidates and top candidate.
    """
    evaluations = []
    current_submissions = list(existing_submissions) if existing_submissions else []

    for item in candidates:
        filename = item.get("filename", "resume.pdf")
        resume_text = item.get("extracted_text", "")
        
        evaluation = screen_candidate(
            jd=jd,
            resume_text=resume_text,
            filename=filename,
            existing_submissions=current_submissions
        )
        evaluations.append(evaluation)
        current_submissions.append(evaluation)

    # Sort candidates by match_score in descending order
    evaluations.sort(key=lambda x: x["match_score"], reverse=True)

    # Assign rank
    for rank, cand in enumerate(evaluations, 1):
        cand["rank"] = rank

    # Select best candidate (preferring non-duplicates if available)
    non_duplicate_candidates = [c for c in evaluations if not c.get("is_duplicate")]
    best_candidate = non_duplicate_candidates[0] if non_duplicate_candidates else (evaluations[0] if evaluations else None)

    return {
        "total_candidates_analyzed": len(evaluations),
        "best_candidate": best_candidate,
        "ranked_candidates": evaluations,
    }
