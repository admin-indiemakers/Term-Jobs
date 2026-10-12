import asyncio
import ast
from pathlib import Path
from types import SimpleNamespace
from contextlib import nullcontext

import pytest

from modules.interview.services.assessment import build_questions, validate_assessment, evaluate_assessment, RUBRIC_VERSION


def questions():
    return build_questions({'resume_text': 'Built Kubernetes deployment pipelines at Acme.'},
                           {'title': 'DevOps Engineer', 'structured_role': {'must_have_skills': ['Kubernetes', 'Terraform']}})


def valid_assessment():
    text = 'The service failed. I owned recovery. I fixed deployment retries. Downtime fell by 30 percent.'
    answers = {question['id']: text for question in questions()}
    rows = [{'question_id': question['id'], 'rating': 3, 'evidence': ['I fixed deployment retries.'],
             'star': {'situation': 'The service failed.', 'task': 'I owned recovery.',
                      'action': 'I fixed deployment retries.', 'result': 'Downtime fell by 30 percent.'},
             'rationale': 'Clear own actions and an explicit outcome.'} for question in questions()]
    return {'competencies': rows, 'overall_score': 99}, answers


def test_questions_use_actual_resume_and_role_requirements():
    rows = questions()
    assert len(rows) == 4
    assert 'Built Kubernetes deployment pipelines at Acme.' in rows[0]['prompt']
    assert 'Terraform' in rows[1]['prompt']
    assert 'DevOps Engineer' in rows[0]['prompt']
    assert all('Situation, Task, Action, Result' in row['hint'] for row in rows)
    assert all(row['rubric_version'] == RUBRIC_VERSION for row in rows)


def test_missing_resume_or_requisition_requirements_blocks_start():
    with pytest.raises(ValueError, match='resume'):
        build_questions({}, {'structured_role': {'must_have_skills': ['Python']}})
    with pytest.raises(ValueError, match='requirements'):
        build_questions({'resume_text': 'Developer experience'}, {'title': 'Developer'})


def test_score_is_computed_from_weighted_dictionary_ratings_not_model_total():
    payload, answers = valid_assessment()
    result = validate_assessment(payload, questions(), answers)
    assert result['overall_score'] == 50
    assert result['status'] == 'scored'
    assert len(result['competencies']) == 4


@pytest.mark.parametrize('change', ['hallucinated_quote', 'missing_star', 'missing_action', 'rating_range', 'missing_competency', 'duplicate_question'])
def test_invalid_or_unsubstantiated_assessments_are_rejected(change):
    payload, answers = valid_assessment()
    if change == 'hallucinated_quote': payload['competencies'][0]['evidence'] = ['Invented resume achievement']
    if change == 'missing_star': payload['competencies'][0]['star'] = {}
    if change == 'missing_action': payload['competencies'][0]['star']['action'] = None
    if change == 'rating_range': payload['competencies'][0]['rating'] = 6
    if change == 'missing_competency': payload['competencies'].pop()
    if change == 'duplicate_question': payload['competencies'][1]['question_id'] = payload['competencies'][0]['question_id']
    with pytest.raises(ValueError): validate_assessment(payload, questions(), answers)


def test_interviewer_text_cannot_substitute_for_candidate_evidence():
    result = asyncio.run(evaluate_assessment(questions(), [{'speaker': 'interviewer', 'text': 'Long detailed question'}], 60))
    assert result['analysis']['overall_score'] is None
    assert result['analysis']['status'] == 'pending_review'


def test_model_unavailable_does_not_invent_a_score(monkeypatch):
    from modules.shared.config import settings
    monkeypatch.setattr(settings, 'groq_api_key', '')
    payload, answers = valid_assessment()
    turns = [{'speaker': 'candidate', 'question_id': key, 'text': value, 'input_mode': 'typed_fallback'} for key, value in answers.items()]
    result = asyncio.run(evaluate_assessment(questions(), turns, 60))
    assert result['analysis']['overall_score'] is None
    assert result['metrics']['typed_fallback_used']
    assert not result['metrics']['speech_metrics_available']


@pytest.mark.parametrize('recording_url, metadata', [('', {}), ('/video', {}), ('/audio', {'size_bytes': 100, 'content_type': 'audio/webm'})])
def test_server_requires_saved_video_before_assessment(recording_url, metadata):
    path = Path(__file__).parents[1] / 'modules/interview/services/interview_service.py'
    tree = ast.parse(path.read_text())
    function = next(node for node in tree.body if isinstance(node, ast.AsyncFunctionDef) and node.name == 'analyze_round_communication')
    interview = SimpleNamespace(recording_url=recording_url, recording_metadata=metadata,
                                transcript=[], candidate_name='Candidate', requisition_title='Role', round_name='Round')
    class Query:
        def filter(self, *args): return self
        def first(self): return interview
    session = SimpleNamespace(query=lambda model: Query())
    namespace = {'Optional': __import__('typing').Optional, 'InterviewRound': SimpleNamespace(id='id'),
                 'get_session': lambda: nullcontext(session)}
    exec(compile(ast.Module(body=[function], type_ignores=[]), str(path), 'exec'), namespace)
    with pytest.raises(ValueError, match='video recording is required'):
        asyncio.run(namespace['analyze_round_communication']('round-1'))


def test_question_snapshot_survives_model_serialization():
    from modules.interview.domain.models import InterviewRound
    model = InterviewRound.from_doc({'id': 'round-1', 'interview_questions': questions()})
    assert model.to_doc()['interview_questions'] == questions()


def test_review_response_contains_same_round_video_transcript_and_criteria():
    path = Path(__file__).parents[1] / 'modules/interview/services/interview_service.py'
    tree = ast.parse(path.read_text())
    function = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == 'get_round_communication_analysis')
    payload, answers = valid_assessment()
    analysis = validate_assessment(payload, questions(), answers)
    transcript = [{'speaker': 'candidate', 'question_id': key, 'text': value} for key, value in answers.items()]
    interview = SimpleNamespace(id='review-round', candidate_name='Candidate', requisition_title='DevOps',
        round_name='AI Interview', communication_metrics={}, communication_analysis=analysis,
        transcript=transcript, interview_questions=questions(), recording_url='/api/interviews/rounds/review-round/recording',
        recording_metadata={'size_bytes': 100}, status='Completed')
    class Query:
        def filter(self, *args): return self
        def first(self): return interview
    namespace = {'Optional': __import__('typing').Optional, 'InterviewRound': SimpleNamespace(id='id'),
        'get_session': lambda: nullcontext(SimpleNamespace(query=lambda model: Query()))}
    exec(compile(ast.Module(body=[function], type_ignores=[]), str(path), 'exec'), namespace)
    review = namespace['get_round_communication_analysis']('review-round')
    assert review['round_id'] == 'review-round'
    assert review['recording_url'] == interview.recording_url
    assert review['transcript'] == transcript
    assert review['questions'] == questions()
    assert review['analysis']['competency_dictionary'] == analysis['competency_dictionary']
