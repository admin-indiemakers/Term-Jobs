from typing import Optional
from pydantic import BaseModel


class CalendarConfigUpdate(BaseModel):
    provider: Optional[str] = "cal"
    status: Optional[str] = "connected"
    cal_link: Optional[str] = None
    cal_username: Optional[str] = None
    event_slug: Optional[str] = "30min"
    cal_api_key: Optional[str] = None
    default_duration: Optional[int] = 60
    default_timezone: Optional[str] = "Asia/Kolkata"
    instructions: Optional[str] = None


class CalendarConfigResponse(BaseModel):
    tenant_id: str
    provider: str = "cal"
    status: str = "connected"
    cal_link: Optional[str] = "https://cal.com/"
    cal_username: Optional[str] = ""
    event_slug: Optional[str] = "30min"
    cal_api_key: Optional[str] = ""
    default_duration: int = 60
    default_timezone: str = "Asia/Kolkata"
    instructions: Optional[str] = ""
    connected_at: Optional[str] = None
