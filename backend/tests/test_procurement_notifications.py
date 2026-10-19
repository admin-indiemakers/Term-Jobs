from types import SimpleNamespace
import pytest
from modules.notifications.domain.models import Notification
from modules.notifications.router import _matches_user


@pytest.mark.parametrize('role', ['Procurement', 'Procurement Team'])
@pytest.mark.parametrize('kind,target,tenant,expected', [
    ('requisition_approval_request', 'Director', 'company', False),
    ('requisition_approval_request', '', 'company', False),
    ('AGREEMENT_SIGNED', '', '', False),
    ('AGREEMENT_SIGNED', '', 'company', False),
    ('general', '', 'company', False),
    ('sow_submitted_to_procurement', '', 'company', True),
    ('sow_submitted_to_procurement', '', 'other', False),
    ('work_order_ready', 'Procurement', 'company', True),
    ('work_order_ready', 'Procurement Team', 'company', True),
])
def test_procurement_only_receives_relevant_alerts(role, kind, target, tenant, expected):
    user = SimpleNamespace(id='buyer', tenant_id='company', role=role)
    notification = Notification(type=kind, target_role=target, tenant_id=tenant)
    assert _matches_user(notification, user) is expected


def test_direct_user_alert_remains_available():
    user = SimpleNamespace(id='buyer', tenant_id='company', role='Procurement')
    assert _matches_user(Notification(user_id='buyer', tenant_id='company'), user)
    assert not _matches_user(Notification(user_id='someone', tenant_id='company'), user)
