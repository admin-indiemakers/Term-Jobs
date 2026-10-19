import pytest
from fastapi import HTTPException
from modules.billing.services.billing_periods import billing_period


@pytest.mark.parametrize('period', ['2026-10', '0001-01', '9999-12'])
def test_four_digit_billing_year_accepted(period):
    assert billing_period(period) == period


@pytest.mark.parametrize('period', ['202026-10', '10000-01', '026-10', '0000-10', '2026-13', '2026-00', '2026-1'])
def test_invalid_billing_year_or_month_rejected(period):
    with pytest.raises(HTTPException) as error:
        billing_period(period)
    assert error.value.status_code == 422
    assert 'four-digit year' in error.value.detail
