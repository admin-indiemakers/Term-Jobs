from types import SimpleNamespace
import mongomock
from modules.shared.db import Session
from modules.requisition.services.submitter import requisition_submitters


def test_creator_account_wins_over_role_text_and_stays_within_company():
    db = mongomock.MongoClient().submitters
    db.users.insert_many([
        {'id': 'one', 'tenant_id': 'company', 'name': 'Manager One', 'email': 'one@example.com', 'password_hash': 'private'},
        {'id': 'two', 'tenant_id': 'company', 'name': 'Manager Two', 'email': 'two@example.com'},
        {'id': 'foreign', 'tenant_id': 'other', 'name': 'Private Manager', 'email': 'private@example.com'},
    ])
    rows = [SimpleNamespace(id=identity, tenant_id='company', created_by=creator, structured_role={'hiring_manager': 'Legacy name'})
            for identity, creator in [('a', 'one'), ('b', 'two'), ('c', 'foreign'), ('d', 'missing')]]
    with Session(db) as session:
        result = requisition_submitters(session, rows)
    assert result['a'] == {'hiring_manager_id': 'one', 'hiring_manager_name': 'Manager One', 'hiring_manager_email': 'one@example.com'}
    assert result['b']['hiring_manager_name'] == 'Manager Two'
    for identity in ['c', 'd']:
        assert result[identity] == {'hiring_manager_id': None, 'hiring_manager_name': 'Legacy name', 'hiring_manager_email': ''}
