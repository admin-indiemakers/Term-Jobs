from pydantic import BaseModel, ConfigDict, Field

ROLES = ("Super Admin", "Admin", "HR", "Hiring Manager", "Recruiter", "Director", "Candidate")

# Which roles a given role is allowed to provision.
PROVISION_MATRIX = {
    "Super Admin": ("Admin", "Recruiter"),
    "Admin": ("Hiring Manager", "Director", "HR"),
    "HR": ("Hiring Manager",),
    "Recruiter": ("Candidate",),
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
    created_at: str = ""

class VendorResponse(BaseModel):
    id: str
    name: str
    industry: str = ""
    size: str = ""
    location: str = ""
    specializations: list[str] = Field(default_factory=list)
    engaged: bool = False
    candidate_limit: int | None = None

class VendorEngagementItem(BaseModel):
    vendor_tenant_id: str
    candidate_limit: int | None = Field(None, ge=1, le=100)

class VendorEngagementsIn(BaseModel):
    vendor_tenant_ids: list[str] = Field(default_factory=list)
    engagements: list[VendorEngagementItem] = Field(default_factory=list)

class UserCreate(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    name: str = Field(..., min_length=1, max_length=255)
    password: str = Field(..., min_length=4, max_length=128)
    role: str
    tenant_id: str = ""
    department: str = ""
    candidate_limit: int | None = Field(None, ge=1, le=100)
    candidate_id: str = ""

class UserUpdate(BaseModel):
    email: str | None = Field(None, min_length=3, max_length=255)
    name: str | None = Field(None, min_length=1, max_length=255)
    password: str | None = Field(None, min_length=4, max_length=128)
    department: str | None = None
    is_active: bool | None = None
    candidate_limit: int | None = Field(None, ge=1, le=100)

class UserLogin(BaseModel):
    email: str | None = None
    username: str | None = None
    password: str

class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=4, max_length=128)

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
    candidate_limit: int | None = None
    candidate_id: str = ""

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
    candidate_limit: int | None = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
