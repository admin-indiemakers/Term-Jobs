from contextlib import contextmanager
from unittest.mock import Mock
import pytest
from modules.interview.services import interview_service as service
from modules.interview.domain.models import InterviewRound
from modules.requisition.domain.models import Requisition, CompanyProfile
from modules.identity.domain.models import Tenant


@pytest.mark.parametrize('title', ['Digital Marketing Specialist', 'Position'])
@pytest.mark.parametrize('has_profile', [True, False])
def test_round_resolves_hiring_company_even_with_known_title(monkeypatch, title, has_profile):
    round = InterviewRound(id='round', requisition_id='req', requisition_title=title, company_name='Bearitt')
    req = Requisition(id='req', tenant_id='tenant', company_profile_id='profile', title='Digital Marketing Specialist')
    profile = CompanyProfile(id='profile', tenant_id='tenant', name='Asimovx Technology AB') if has_profile else None
    tenant = Tenant(id='tenant', name='Asimovx Technology AB')
    session = Mock()
    session.query.return_value.filter.return_value.first.return_value = round
    session.get.side_effect = lambda model, ident: {Requisition: req, CompanyProfile: profile, Tenant: tenant}[model]
    @contextmanager
    def factory():
        yield session
    monkeypatch.setattr(service, 'get_session', factory)
    monkeypatch.setattr(service, '_reconcile_completed_round', lambda *args: None)
    monkeypatch.setattr(service, 'get_round_expiration_info', lambda _: {'is_expired': False, 'expires_at': None, 'remaining_seconds': 100})
    result = service.get_round_by_id('round')
    assert result['company_name'] == 'Asimovx Technology AB'
    assert result['requisition_title'] == 'Digital Marketing Specialist'
