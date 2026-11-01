from contextlib import contextmanager
from unittest.mock import Mock
import pytest
import main as app_main
from modules.requisition.domain.models import Requisition
from modules.requisition.domain.schemas import RoleIntent
from modules.requisition.services.requisition_service import _structured_role_from_prefill


def test_structured_role_preserves_chat_summary():
    role = _structured_role_from_prefill(RoleIntent(title='Marketing Specialist', description='Plan Google Ads campaigns and generate leads.'), {'title': 'Marketing Specialist'})
    assert role['job_description'] == 'Plan Google Ads campaigns and generate leads.'
    assert role['submission_deadline'] == ''


@pytest.mark.parametrize('deadline', ['', '2099-11-10'])
@pytest.mark.parametrize('source', ['structured_role', 'intent'])
def test_public_list_and_detail_show_summary_and_only_application_deadline(monkeypatch, deadline, source):
    summary = 'Plan Google Ads campaigns and generate leads.'
    role = {'submission_deadline': deadline}
    if source == 'structured_role':
        role['job_description'] = summary
    req = Requisition(id='public-role', title='Marketing Specialist', status='Published', tenant_id='', structured_role=role,
                      intent={'description': summary}, shortlist_deadline='2099-11-03T00:00:00+00:00')
    session = Mock()
    session.get.return_value = req
    session.query.return_value.filter.return_value.order_by.return_value.all.return_value = [req]
    @contextmanager
    def factory():
        yield session
    monkeypatch.setattr(app_main, 'get_session', factory)
    monkeypatch.setattr(app_main, '_auto_close_expired', lambda: None)
    monkeypatch.setattr(app_main, '_cache', Mock(get=Mock(return_value=None)))
    for result in (app_main.get_public_requisition(req.id), app_main.list_public_requisitions()[0]):
        assert result['generated_jd_markdown'] == summary
        assert result['structured_role']['job_description'] == summary
        assert result['due_date'] == deadline
        assert result['submission_deadline'] == deadline
