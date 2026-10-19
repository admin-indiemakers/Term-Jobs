from datetime import date, timedelta
from unittest.mock import Mock
import pytest
from modules.requisition.domain.deadline import validate_start_date
from modules.requisition.domain.schemas import RoleIntent
from modules.requisition.services.requisition_service import RequisitionService


@pytest.mark.parametrize('value', ['', None, '2026-10-19', '2026-10-20'])
def test_empty_today_and_future_are_allowed(value):
    validate_start_date(value, today=date(2026, 10, 19))


@pytest.mark.parametrize('value', ['2026-10-18', '2025-10-19', '2026-02-30', '19/10/2026', 123])
def test_past_or_invalid_start_date_rejected(value):
    with pytest.raises(ValueError, match='Start Date'):
        validate_start_date(value, today=date(2026, 10, 19))


def test_service_rejects_past_date_before_database_write():
    from datetime import datetime
    from zoneinfo import ZoneInfo
    factory = Mock()
    yesterday = datetime.now(ZoneInfo('Asia/Kolkata')).date() - timedelta(days=1)
    with pytest.raises(ValueError, match='Start Date cannot be in the past'):
        RequisitionService(session_factory=factory).create('company', RoleIntent(title='Engineer', description='Build APIs'), intake_meta={'prefill': {'start_date': yesterday.isoformat()}})
    factory.assert_not_called()
