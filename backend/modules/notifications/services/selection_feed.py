"""Keep the live feed to one item per candidate and requisition selection."""


def deduplicate_selections(entries: list[dict]) -> list[dict]:
    unique: list[dict] = []
    by_submission: dict[tuple[str, str], dict] = {}
    by_email: dict[tuple[str, str], dict] = {}
    by_candidate_id: dict[tuple[str, str], dict] = {}
    by_candidate: dict[tuple[str, str], list[dict]] = {}

    for entry in entries:
        submission_id = str(entry.get("submission_id") or "").strip()
        requisition_id = str(entry.get("requisition_id") or "").strip()
        email = str(entry.get("candidate_email") or "").strip().casefold()
        name = " ".join(str(entry.get("candidate_name") or "").split()).casefold()
        candidate_id = str(entry.get("candidate_id") or "").strip().casefold()

        match = by_submission.get((requisition_id, submission_id)) if submission_id else None
        if not match and requisition_id and email:
            match = by_email.get((requisition_id, email))
        if not match and requisition_id and candidate_id:
            match = by_candidate_id.get((requisition_id, candidate_id))
        if not match and requisition_id and name:
            # Name is a fallback for legacy records without a candidate ID.
            for possible in by_candidate.get((requisition_id, name), []):
                other_email = str(possible.get("candidate_email") or "").strip().casefold()
                other_id = str(possible.get("candidate_id") or "").strip().casefold()
                if email and other_email and email != other_email:
                    continue
                if candidate_id and other_id and candidate_id != other_id and not (email and email == other_email):
                    continue
                match = possible
                break

        if match:
            for field in ("candidate_email", "candidate_phone", "candidate_id", "submission_id",
                          "hiring_manager_email", "notes", "match_score"):
                if match.get(field) in (None, "") and entry.get(field) not in (None, ""):
                    match[field] = entry[field]
            if submission_id:
                by_submission[(requisition_id, submission_id)] = match
            if requisition_id and email:
                by_email[(requisition_id, email)] = match
            if requisition_id and candidate_id:
                by_candidate_id[(requisition_id, candidate_id)] = match
            continue

        unique.append(entry)
        if submission_id:
            by_submission[(requisition_id, submission_id)] = entry
        if requisition_id and email:
            by_email[(requisition_id, email)] = entry
        if requisition_id and candidate_id:
            by_candidate_id[(requisition_id, candidate_id)] = entry
        if requisition_id and name:
            by_candidate.setdefault((requisition_id, name), []).append(entry)

    return unique
