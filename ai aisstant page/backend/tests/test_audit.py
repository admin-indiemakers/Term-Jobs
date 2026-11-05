"""Tests for immutable audit logging and sanitization."""
import pytest
from backend.audit.logger import AuditLogger, sanitize_payload


def test_sensitive_payload_redaction():
    raw = {
        "user_email": "hm@enterprise.com",
        "api_key": "sk-123456789",
        "password": "supersecretpassword",
        "details": {
            "token": "bearer_token_val",
            "safe_param": "regular_value"
        }
    }
    clean = sanitize_payload(raw)
    assert clean["api_key"] == "[REDACTED]"
    assert clean["password"] == "[REDACTED]"
    assert clean["details"]["token"] == "[REDACTED]"
    assert clean["details"]["safe_param"] == "regular_value"
    assert clean["user_email"] == "hm@enterprise.com"


def test_audit_record_logging():
    import asyncio
    logger = AuditLogger(test_mode=True)

    async def run():
        rec = await logger.log_action(
            tenant_id="tenant_01",
            user_id="user_01",
            user_email="hm@test.com",
            action="approve_timesheet",
            target_resource="timesheets",
            target_id="ts_99",
            parameters={"timesheet_id": "ts_99", "secret_token": "abc"},
            status="SUCCESS"
        )
        assert rec.action == "approve_timesheet"
        assert rec.parameters["secret_token"] == "[REDACTED]"
        assert rec.status == "SUCCESS"
        assert len(logger.in_memory_records) == 1

    asyncio.run(run())
