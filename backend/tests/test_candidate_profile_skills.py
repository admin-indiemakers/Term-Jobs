from modules.candidate_profile.router import resolve_candidate_skills


def test_resume_skills_fill_profile_before_manual_edit():
    assert resolve_candidate_skills(['Python', 'React'], [], False, '') == ['Python', 'React']
    assert resolve_candidate_skills([], ['Go'], False, '') == ['Go']


def test_explicit_edit_replaces_extracted_skills_including_removals():
    assert resolve_candidate_skills(['Python', 'React'], ['Java'], True, 'Python, SQL, Python') == ['Python', 'SQL']
    assert resolve_candidate_skills(['Python'], ['Java'], True, '') == []
