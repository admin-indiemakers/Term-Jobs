from pydantic import BaseModel, ConfigDict, Field, field_validator
import re

ROLES = ("Super Admin", "Admin", "HR", "Hiring Manager", "Recruiter", "Director", "Candidate", "Procurement", "Procurement Team", "Finance", "Finance Team")

# Which roles a given role is allowed to provision.
PROVISION_MATRIX = {
    "Super Admin": ("Admin", "Recruiter"),
    "Admin": ("Hiring Manager", "Director", "HR", "Procurement", "Procurement Team", "Finance", "Finance Team"),
    "HR": ("Hiring Manager", "Procurement", "Procurement Team", "Finance", "Finance Team"),
    "Recruiter": ("Candidate",),
}



# ---------------------------------------------------------------------------
# Disposable / throwaway email domain blocklist
# ---------------------------------------------------------------------------
_DISPOSABLE_DOMAINS = {
    "mailinator.com", "guerrillamail.com", "guerrillamail.net", "guerrillamail.org",
    "guerrillamail.biz", "guerrillamail.de", "guerrillamail.info",
    "tempmail.com", "temp-mail.org", "throwam.com", "throwam.net",
    "yopmail.com", "yopmail.fr", "cool.fr.nf", "jetable.fr.nf", "nospam.ze.tc",
    "nomail.xl.cx", "mega.zik.dj", "speed.1s.fr", "courriel.fr.nf",
    "moncourrier.fr.nf", "monemail.fr.nf", "monmail.fr.nf",
    "sharklasers.com", "guerrillamailblock.com", "grr.la", "guerrillamail.info",
    "spam4.me", "trashmail.com", "trashmail.me", "trashmail.net", "trashmail.at",
    "trashmail.io", "trashmail.org",
    "dispostable.com", "mailnull.com", "fakeinbox.com", "maildrop.cc",
    "mailnesia.com", "mailnull.com", "spamgourmet.com", "spamgourmet.net",
    "spamgourmet.org", "spamgourmet.com", "spamgourmet.net",
    "10minutemail.com", "10minutemail.net", "10minutemail.org",
    "20minutemail.com", "tempr.email", "discard.email", "spambog.com",
    "spambog.de", "spambog.ru", "getairmail.com", "filzmail.com",
    "mailzilla.org", "mohmal.com", "mailseal.de", "incognitomail.com",
    "armyspy.com", "cuvox.de", "dayrep.com", "einrot.com", "fleckens.hu",
    "gustr.com", "jourrapide.com", "rhyta.com", "superrito.com", "teleworm.us",
    "throwam.com",
}

# Basic email regex
_EMAIL_RE = re.compile(
    r'^[a-zA-Z0-9_.+\-]+@[a-zA-Z0-9\-]+\.[a-zA-Z]{2,}$'
)


def _validate_real_email(email: str) -> str:
    """Validate that the email is well-formed, non-disposable, and has MX records when available."""
    if not isinstance(email, str):
        raise ValueError("Invalid email address format.")
    email = email.strip().lower()

    # 1. Regex format check
    if not _EMAIL_RE.match(email):
        raise ValueError("Invalid email address format.")

    domain = email.split("@", 1)[1]

    # 2. Disposable domain check
    if domain in _DISPOSABLE_DOMAINS:
        raise ValueError(
            f"Email addresses from '{domain}' are not allowed. "
            "Please use a valid business or personal email."
        )

    # 3. Optional MX record check (domain must have real mail servers if dns is available)
    try:
        import dns.resolver
        dns.resolver.resolve(domain, "MX", lifetime=3)
    except Exception:
        # Ignore on serverless environments without dnspython or when network blocks DNS
        pass

    return email


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
    vendor_type: str = 'standard'
    client_type: str = 'standard'
    is_guest: bool = False

class VendorResponse(BaseModel):
    id: str
    name: str
    tenant_type: str = 'consultancy'
    vendor_type: str = 'standard'
    is_guest: bool = False
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
    phone: str = ''
    email: str = Field(..., min_length=3, max_length=255)
    name: str = Field(..., min_length=1, max_length=255)
    password: str = Field(..., min_length=4, max_length=128)
    role: str
    tenant_id: str = ""
    department: str = ""
    candidate_limit: int | None = Field(None, ge=1, le=100)
    candidate_id: str = ""

    @field_validator("email", mode="before")
    @classmethod
    def validate_email_real(cls, v: str) -> str:
        return _validate_real_email(v)

class UserUpdate(BaseModel):
    phone: str | None = None
    email: str | None = Field(None, min_length=3, max_length=255)
    name: str | None = Field(None, min_length=1, max_length=255)
    password: str | None = Field(None, min_length=4, max_length=128)
    department: str | None = None
    is_active: bool | None = None
    candidate_limit: int | None = Field(None, ge=1, le=100)

    @field_validator("email", mode="before")
    @classmethod
    def validate_email_real(cls, v):
        if v is None:
            return v
        return _validate_real_email(v)

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
    phone: str = ''
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
    logo_url: str = ""
    department: str = ""
    created_by: str = ""
    is_active: bool = True
    candidate_limit: int | None = None
    candidate_id: str = ""

class CompanyProfileUpdate(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=255)
    industry: str | None = Field(None, max_length=255)
    size: str | None = Field(None, max_length=100)
    location: str | None = Field(None, max_length=255)
    tech_stack: list[str] | None = None
    notes: str | None = None
    logo_url: str | None = None
    admin_name: str | None = Field(None, min_length=1, max_length=255)
    admin_email: str | None = Field(None, min_length=3, max_length=255)
    admin_phone: str | None = None

class CompanyProfileDetailResponse(BaseModel):
    tenant_id: str
    name: str
    tenant_type: str
    industry: str = ""
    size: str = ""
    location: str = ""
    tech_stack: list[str] = Field(default_factory=list)
    notes: str = ""
    logo_url: str = ""
    admin_id: str = ""
    admin_name: str = ""
    admin_email: str = ""
    admin_phone: str = ""
    admin_role: str = ""

class UserListResponse(BaseModel):
    id: str
    phone: str = ''
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
