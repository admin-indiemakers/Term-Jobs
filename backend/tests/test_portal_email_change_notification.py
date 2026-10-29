from types import SimpleNamespace
from unittest.mock import Mock


def test_admin_portal_email_change_sends_security_notice_not_fake_credentials(monkeypatch):
    from modules.identity import router
    from modules.identity.domain.models import User
    import importlib
    shared_db = importlib.import_module("modules.shared.db")

    target = SimpleNamespace(
        id="candidate-1",
        email="old@example.com",
        name="Candidate",
        role="Candidate",
        candidate_id="C-1",
        workorder_id="C-1",
        is_active=True,
    )
    query_calls = 0

    class Query:
        def filter(self, *_args, **_kwargs):
            return self

        def first(self):
            nonlocal query_calls
            query_calls += 1
            return target if query_calls == 1 else None

    class Session:
        def query(self, _model):
            return Query()

        def commit(self):
            pass

        def refresh(self, _target):
            pass

    class Collection:
        def find_one(self, *_args, **_kwargs):
            return None

    class Mongo:
        users = Collection()

        def __getitem__(self, _name):
            return self.users

    notification = Mock(return_value={"status": "success"})
    credential_email = Mock(return_value={"status": "success"})
    monkeypatch.setattr(router, "send_account_change_email", notification)
    monkeypatch.setattr(router, "_send_credentials_email", credential_email)
    monkeypatch.setattr(router, "_sync_candidate_credentials_to_mongo", Mock())
    monkeypatch.setattr(router._cache, "invalidate_prefix", Mock())
    monkeypatch.setitem(vars(shared_db), "db", Mongo())

    result = router.update_portal_user(
        "candidate-1",
        {"email": "new@example.com"},
        current_user=SimpleNamespace(role="Admin"),
        db=Session(),
    )

    assert result["email_delivery"] == {"status": "success"}
    assert result["credential_delivery"] == {"status": "not_requested"}
    notification.assert_called_once_with(
        target, previous_email="old@example.com", password_changed=False
    )
    credential_email.assert_not_called()
    assert target.email == "new@example.com"
