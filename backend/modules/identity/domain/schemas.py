from pydantic import BaseModel, ConfigDict, Field

ROLES = ("Super Admin", "Admin", "HR", "Hiring Manager", "Recruiter")

# Which roles a given role is allowed to provision.
PROVISION_MATRIX = {
    "Super Admin": ("Admin", "Recruiter"),
    "Admin": ("Hiring Manager",),
    "HR": ("Hiring Manager",),
}


class TenantCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    tenant_type: str = Field("client", pattern="^(client|consultancy)$")
    industry: str = ""
    size: str = ""
    location: str = ""
    tech_stack: list[str] = Field(default_factory=list)
    notes: str = ""

class TenantResponse(BaseModel):
    id: str
    name: str
    tenant_type: str

class UserCreate(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    name: str = Field(..., min_length=1, max_length=255)
    password: str = Field(..., min_length=4, max_length=128)
    role: str
    tenant_id: str = ""
    department: str = ""

class UserUpdate(BaseModel):
    email: str | None = Field(None, min_length=3, max_length=255)
    name: str | None = Field(None, min_length=1, max_length=255)
    password: str | None = Field(None, min_length=4, max_length=128)
    department: str | None = None
    is_active: bool | None = None

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
    department: str = ""
    created_by: str = ""
    is_active: bool = True

class UserListResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str
    tenant_id: str
    tenant_name: str
    tenant_type: str
    department: str = ""
    is_active: bool
    created_by: str = ""
    created_at: str = ""

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
