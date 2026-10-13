import mongomock
from modules.hiring_manager_agent.scope import ScopedDatabase, authorized_chat
from modules.hiring_manager_agent import agent


def test_pipeline_counts_only_owned_requisitions(monkeypatch):
    raw = mongomock.MongoClient()['pipeline']
    monkeypatch.setattr(agent, 'db', raw)
    raw.requisitions.insert_many([{'id': 'mine', 'tenant_id': 'a', 'created_by': 'manager', 'status': 'Published'}, {'id': 'other', 'tenant_id': 'a', 'created_by': 'other-manager'}])
    raw.candidate_submissions.insert_one({'id': 'foreign', 'tenant_id': 'a', 'requisition_id': 'other', 'status': 'Shortlisted'})
    result = agent.hiring_pipeline_reply('manager', 'a')
    assert '| Requisitions | 1 |' in result['reply']
    assert '| Candidate applications | 0 |' in result['reply']
    assert '| Shortlisted candidates | 0 |' in result['reply']
    assert 'No candidate applications' in result['reply']
    assert result['executed_actions'] == []


def test_chat_never_expands_scope():
    raw = mongomock.MongoClient()['scope']
    raw.requisitions.insert_many([{'id': 'mine', 'tenant_id': 'a', 'created_by': 'manager'}, {'id': 'other-manager', 'tenant_id': 'a', 'created_by': 'someone'}, {'id': 'other-company', 'tenant_id': 'b', 'created_by': 'manager'}])
    raw.candidate_submissions.insert_many([{'id': 'allowed', 'requisition_id': 'mine', 'tenant_id': 'a'}, {'id': 'same-company', 'requisition_id': 'other-manager', 'tenant_id': 'a'}, {'id': 'foreign', 'requisition_id': 'other-company', 'tenant_id': 'b'}, {'id': 'conflicting-tenant', 'requisition_id': 'mine', 'tenant_id': 'b'}])
    scoped = ScopedDatabase(raw)
    @authorized_chat(raw)
    def query(prompt, history, current_user):
        return list(scoped['candidate_submissions'].find({}))
    assert [r['id'] for r in query('', current_user={'id': 'manager', 'tenant_id': 'a'})] == ['allowed']
    assert query('', current_user={'id': 'no-reqs', 'tenant_id': 'a'}) == []
    assert query('', current_user={'id': 'manager', 'tenant_id': 'local'})['executed_actions'] == []


def test_shortlist_does_not_promote_unlinked_talent(monkeypatch):
    raw = mongomock.MongoClient()['shortlist']
    monkeypatch.setattr(agent, 'db', raw)
    raw.requisitions.insert_many([{'id': 'mine', 'tenant_id': 'a', 'created_by': 'manager'}, {'id': 'other', 'tenant_id': 'a', 'created_by': 'someone'}])
    raw.candidate_submissions.insert_one({'id': 'wrong', 'candidate_name': 'Other candidate', 'requisition_id': 'other', 'tenant_id': 'a', 'status': 'Shortlisted'})
    raw.candidates.insert_one({'id': 'talent', 'candidate_name': 'Unlinked prospect', 'tenant_id': 'a'})
    assert agent.list_shortlisted_candidates('manager', '', 'a') == []
    assert agent.list_shortlisted_candidates('manager', '', 'local') == []


def test_sandbox_blocks_ownership_changes_unscoped_reads_and_bulk_methods():
    import pytest
    raw = mongomock.MongoClient()['write-scope']
    raw.requisitions.insert_many([{'id': 'mine', 'tenant_id': 'a', 'created_by': 'manager'}, {'id': 'other', 'tenant_id': 'a', 'created_by': 'other-manager'}])
    scoped = ScopedDatabase(raw)
    assert list(scoped['requisitions'].find({})) == []
    @authorized_chat(raw)
    def attempt(prompt, history, current_user):
        result = scoped['requisitions'].update_many({}, {'$set': {'title': 'Updated'}})
        assert result.modified_count == 1
        for update in ({'$set': {'tenant_id': 'b'}}, {'$unset': {'created_by': ''}}, {'$rename': {'title': 'tenant_id'}}):
            with pytest.raises(PermissionError):
                scoped['requisitions'].update_one({}, update)
        with pytest.raises(PermissionError):
            scoped['requisitions'].update_one({}, {'$set': {'title': 'fake'}}, upsert=True)
        with pytest.raises(PermissionError):
            scoped['requisitions'].aggregate([{'$lookup': {'from': 'candidate_submissions', 'as': 'all'}}])
        with pytest.raises(PermissionError):
            scoped['candidates'].update_many({}, {'$set': {'summary': 'changed'}})
        return True
    assert attempt('', current_user={'id': 'manager', 'tenant_id': 'a'})
    assert 'title' not in raw.requisitions.find_one({'id': 'other'})


def test_scope_is_cleared_after_exception_and_old_assistant_history_is_dropped():
    import pytest
    raw = mongomock.MongoClient()['exception-scope']
    raw.requisitions.insert_one({'id': 'mine', 'tenant_id': 'a', 'created_by': 'manager'})
    scoped = ScopedDatabase(raw)
    @authorized_chat(raw)
    def operation(prompt, history, current_user):
        assert len(history) == 1 and history[0]['role'] == 'user'
        assert scoped['requisitions'].find_one({})['id'] == 'mine'
        raise RuntimeError('test')
    with pytest.raises(RuntimeError):
        operation('', [{'role': 'assistant', 'content': 'Previously leaked response'}, {'role': 'user', 'content': 'show my roles'}], {'id': 'manager', 'tenant_id': 'a'})
    assert list(scoped['requisitions'].find({})) == []
