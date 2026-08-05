from pydantic import BaseModel, ConfigDict, Field


class TenantCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    tenant_type: str = Field("client", pattern="^(client|consultancy)$")

class UserRegister(BaseModel):
    email: str
    name: str = Field(..., min_length=1, max_length=255)
    password: str = Field(..., min_length=1)
    role: str = Field(default="Hiring Manager")
    company_name: str = Field(default="Company", min_length=1, max_length=255)
    tenant_type: str = Field(default="client")
    industry: str = Field(default="")
    size: str = Field(default="")
    location: str = Field(default="")
    tech_stack: list[str] = Field(default_factory=list)
    notes: str = Field(default="")

class UserLogin(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    name: str
    role: str
    tenant_id: str
    tenant_name: str
    tenant_type: str
    industry: str = ""
    size: str = ""
    location: str = ""
    tech_stack: list[str] = Field(default_factory=list)
    notes: str = ""

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
