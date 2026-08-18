"""
Company Cal.com / Cal.diy calendar configuration model (MongoDB collection).
"""
from typing import ClassVar
from ...shared.db import Column, Model, _utcnow, _uuid


class CalendarConfig(Model):
    __tablename__ = "calendar_configs"

    _fields: ClassVar[dict[str, object]] = {
        "id": _uuid,
        "tenant_id": None,
        "provider": "cal",                    # "cal" | "cal_diy"
        "status": "connected",                # "connected" | "disconnected"
        "cal_link": "https://cal.com/",       # e.g. "https://cal.com/your-username" or "your-username/30min"
        "cal_username": "",
        "event_slug": "30min",                # e.g. "technical-round", "30min", "60min"
        "cal_api_key": "",                    # optional Cal.com API key
        "default_duration": 60,               # minutes
        "default_timezone": "Asia/Kolkata",
        "instructions": "",
        "created_at": _utcnow,
        "updated_at": _utcnow,
    }

    id = Column("id")
    tenant_id = Column("tenant_id")
    provider = Column("provider")
    status = Column("status")
    cal_link = Column("cal_link")
    cal_username = Column("cal_username")
    event_slug = Column("event_slug")
    cal_api_key = Column("cal_api_key")
    default_duration = Column("default_duration")
    default_timezone = Column("default_timezone")
    instructions = Column("instructions")
    created_at = Column("created_at")
    updated_at = Column("updated_at")
