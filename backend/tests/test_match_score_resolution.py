import pytest
from modules.notifications.services.match_scores import submission_match_score


@pytest.fixture
def submissions():
    return [
        {'id': 'hashil', 'candidate_email': 'hashil@example.com', 'requisition_id': 'react', 'match_score': 39},
        {'id': 'arjun', 'candidate_email': 'arjun@example.com', 'requisition_id': 'react', 'match_score': 52},
        {'id': 'hashil-other', 'candidate_email': 'hashil@example.com', 'requisition_id': 'other', 'match_score': 81},
    ]


def test_selection_snapshot_uses_same_score_as_pool(submissions):
    for row in submissions:
        selection = {**row, 'id': 'selection', 'submission_id': row['id'], 'match_score': 99}
        assert submission_match_score(selection, submissions) == submission_match_score(row, submissions)


def test_candidate_and_requisition_cannot_borrow_each_others_scores(submissions):
    assert submission_match_score({'submission_id': 'arjun', 'candidate_email': 'hashil@example.com', 'requisition_id': 'react'}, submissions) == 39
    assert submission_match_score({'candidate_email': 'hashil@example.com', 'requisition_id': 'other'}, submissions) == 81


def test_recalculation_and_zero_are_reflected_in_selection(submissions):
    selection = {'submission_id': 'hashil', 'requisition_id': 'react', 'match_score': 39}
    submissions[0]['match_score'] = 0
    assert submission_match_score(selection, submissions) == 0
    submissions[0]['match_score'] = 67
    assert submission_match_score(selection, submissions) == 67


def test_names_alone_do_not_associate_candidates(submissions):
    record = {'candidate_name': 'Hashil', 'requisition_id': 'react', 'match_score': None}
    assert submission_match_score(record, submissions) is None


@pytest.mark.parametrize('score', [None, 'bad', float('nan'), float('inf'), -1, 101])
def test_invalid_scores_are_unavailable(score):
    assert submission_match_score({'match_score': score}, []) is None


def test_same_candidate_has_independent_scores_for_each_requisition(submissions):
    # The screenshots compare different roles; each role must retain its own fit.
    selections = [
        {'submission_id': 'hashil', 'candidate_email': 'hashil@example.com', 'requisition_id': 'react', 'match_score': 90},
        {'submission_id': 'hashil-other', 'candidate_email': 'hashil@example.com', 'requisition_id': 'other', 'match_score': 90},
        {'submission_id': 'arjun', 'candidate_email': 'arjun@example.com', 'requisition_id': 'react', 'match_score': 90},
    ]
    assert [submission_match_score(row, submissions) for row in selections] == [39, 81, 52]
