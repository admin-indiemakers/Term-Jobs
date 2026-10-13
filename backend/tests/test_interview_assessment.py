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


def test_questions_use_original_resume_linked_by_application(monkeypatch):
    import importlib
    import mongomock
    from unittest.mock import MagicMock
    from modules.interview.services.assessment import load_questions
    database = mongomock.MongoClient()['assessment-resume']
    monkeypatch.setattr(importlib.import_module('modules.shared.db'), 'db', database)
    database.candidate_submissions.insert_one({'id': 'app', 'requisition_id': 'req', 'candidate_id': 'person', 'candidate_email': 'candidate@example.com'})
    database.candidates.insert_one({'id': 'person', 'candidate_email': 'candidate@example.com', 'extracted_text': 'Built Kubernetes deployment pipelines.'})
    req = SimpleNamespace(id='req', tenant_id='company', to_doc=lambda: {'title': 'Engineer', 'structured_role': {'must_have_skills': ['Kubernetes']}})
    session = MagicMock()
    session.query.return_value.filter.return_value.first.return_value = req
    round_obj = SimpleNamespace(interview_questions=[], requisition_id='req', tenant_id='company', candidate_submission_id='app', candidate_email='candidate@example.com')
    result = load_questions(session, round_obj)
    assert len(result) == 4
    assert 'Kubernetes' in result[0]['prompt']
    session.commit.assert_called_once()


def test_questions_accept_top_level_parsed_experience():
    result = build_questions({'experience': [{'role': 'Backend engineer', 'company': 'Acme'}]}, {'title': 'Engineer', 'structured_role': {'must_have_skills': ['Python']}})
    assert 'Python' in result[0]['prompt']


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
    assert 'Kubernetes' in rows[0]['prompt']
    assert 'Kubernetes' in rows[1]['prompt']
    assert 'Your resume includes' not in rows[0]['prompt']
    assert all('Situation, Task, Action, Result' in row['hint'] for row in rows)
    assert all(row['rubric_version'] == RUBRIC_VERSION for row in rows)


def test_spoken_questions_never_read_resume_links_or_json():
    resume = {'resume_text': 'Email: person@example.com https://linkedin.com/in/person https://github.com/person Python APIs',
              'projects': [{'name': 'Payments API https://github.com/person/payments', 'description': 'A very long resume description ' * 50}]}
    rows = build_questions(resume, {'structured_role': {'must_have_skills': ['Python', 'https://github.com/company']}})
    assert 'Payments API' in rows[0]['prompt']
    for row in rows:
        assert len(row['prompt'].split()) < 45
        assert not any(fragment in row['prompt'] for fragment in ['https:', 'github.com', 'linkedin.com', 'person@example.com', '{', 'description'])


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


def test_recording_survives_unwritable_local_directory(monkeypatch):
    import importlib
    import sys
    from unittest.mock import MagicMock
    from modules.interview.services import interview_service as service
    record = SimpleNamespace(id='round', to_doc=lambda: {'recording_url': record.recording_url, 'recording_metadata': record.recording_metadata})
    session = MagicMock()
    session.query.return_value.filter.return_value.first.return_value = record
    monkeypatch.setattr(service, 'get_session', lambda: nullcontext(session))
    def denied(*args, **kwargs):
        raise PermissionError('read-only filesystem')
    monkeypatch.setattr(service.os, 'makedirs', denied)
    storage = MagicMock()
    storage.find.return_value = []
    storage.put.return_value = 'saved-video'
    monkeypatch.setitem(sys.modules, 'gridfs', SimpleNamespace(GridFS=lambda db: storage))
    monkeypatch.setattr(importlib.import_module('modules.shared.db'), '_get_client', lambda: MagicMock())
    result = service.save_round_recording('round', b'video-bytes')
    assert result['recording_metadata']['gridfs_id'] == 'saved-video'
    assert result['recording_metadata']['local_path'] is None
    storage.put.assert_called_once()
