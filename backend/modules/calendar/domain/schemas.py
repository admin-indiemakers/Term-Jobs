from typing import Literal, Optional

from pydantic import BaseModel

CalendarProvider = Literal["google", "microsoft", "zoho"]


class CalendarConfigUpdate(BaseModel):
    provider: Optional[CalendarProvider] = None
    status: Literal["connected", "disconnected"] = "connected"
    connected_email: Optional[str] = None


class CalendarConfigResponse(BaseModel):
    tenant_id: str
    provider: Optional[str] = None
    status: str = "disconnected"
    connected_email: Optional[str] = None
    connected_at: Optional[str] = None


class AuthUrlResponse(BaseModel):
    provider: str
    auth_url: str
    configured: bool


class CalendarProvidersResponse(BaseModel):
    providers: list[dict]