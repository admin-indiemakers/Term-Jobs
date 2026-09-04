from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, Header, HTTPException, status

from modules.identity.domain.models import Tenant, User, VendorEngagement
from modules.identity.domain.schemas import (
    PROVISION_MATRIX,
    ROLES,
    PasswordChange,
    TenantCreate,
    TenantResponse,
    TokenResponse,
    UserCreate,
    UserListResponse,
    UserLogin,
    UserResponse,
    UserUpdate,
    VendorEngagementsIn,
    VendorResponse,
)
from modules.identity.services.auth_service import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from modules.requisition.domain.models import CompanyProfile
from modules.shared.db import Session, get_session
from modules.shared.cache import cache as _cache

router = APIRouter(tags=["Authentication"])

def get_db():
    with get_session() as session:
        yield session

def get_current_user(authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> User:
    """Dependency to retrieve the currently authenticated user via JWT header."""
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header format. Use 'Bearer <token>'",
        )
    token = authorization.split(" ")[1]
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token",
        )

    user_id = payload["sub"]
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated user not found",
        )
    if getattr(user, 'is_deleted', False):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is deactivated",
        )
    return user

def _get_company_profile(tenant_id: str, db: Session) -> CompanyProfile | None:
    return db.query(CompanyProfile).filter(CompanyProfile.tenant_id == tenant_id).first()

def _tenant_name(tenant_id: str, db: Session) -> str:
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    return tenant.name if tenant else "Unknown Tenant"

def _tenant_type(tenant_id: str, db: Session) -> str:
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    return tenant.tenant_type if tenant else "client"

@router.post("/login", response_model=TokenResponse)
def login_user(body: UserLogin, db: Session = Depends(get_db)):
    # Determine the lookup identifier: prefer username (candidate ID or ADMIN), fall back to email
    lookup = body.username or body.email or ""

    user = None
    if lookup.upper() == "ADMIN":
        user = db.query(User).filter(User.role == "Super Admin", User.email == "ADMIN").first()
    elif lookup:
        # Try candidate_id first, then email
        user = db.query(User).filter(User.candidate_id == lookup).first()
        if not user:
            user = db.query(User).filter(User.email == lookup).first()

    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    if getattr(user, 'is_deleted', False):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is pending approval by the company administrator. Please wait for approval before logging in.",
        )

    comp = _get_company_profile(user.tenant_id, db)

    token_data = {"sub": user.id, "email": user.email, "role": user.role, "tenant_id": user.tenant_id}
    token = create_access_token(token_data)

    user_resp = UserResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        role=user.role,
        tenant_id=user.tenant_id,
        tenant_name=_tenant_name(user.tenant_id, db),
        tenant_type=_tenant_type(user.tenant_id, db),
        industry=comp.industry if comp else "",
        size=comp.size if comp else "",
        location=comp.location if comp else "",
        tech_stack=(comp.tech_stack if comp and comp.tech_stack else []),
        notes=comp.notes if comp else "",
        department=user.department or "",
        created_by=user.created_by,
        is_active=user.is_active,
        candidate_id=getattr(user, 'candidate_id', '') or '',
    )

    return TokenResponse(access_token=token, user=user_resp)

@router.get("/me", response_model=UserResponse)
def get_user_profile(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    comp = _get_company_profile(current_user.tenant_id, db)

    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        role=current_user.role,
        tenant_id=current_user.tenant_id,
        tenant_name=_tenant_name(current_user.tenant_id, db),
        tenant_type=_tenant_type(current_user.tenant_id, db),
        industry=comp.industry if comp else "",
        size=comp.size if comp else "",
        location=comp.location if comp else "",
        tech_stack=(comp.tech_stack if comp and comp.tech_stack else []),
        notes=comp.notes if comp else "",
        department=current_user.department or "",
        created_by=current_user.created_by,
        is_active=current_user.is_active,
        candidate_id=getattr(current_user, 'candidate_id', '') or '',
    )


@router.post("/change-password")
def change_password(
    body: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Self-service password change: verifies the current password before updating."""
    if not verify_password(body.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )
    user = db.query(User).filter(User.id == current_user.id).first()
    user.password_hash = hash_password(body.new_password)
    db.commit()
    return {"status": "ok", "message": "Password updated successfully"}


# --- Admin/HR provisioning (MVP v2: no self-registration) --------------------

@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    body: UserCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Admin creates HR/Recruiter; HR creates Hiring Manager. No self-signup."""
    if body.role not in ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role '{body.role}'. Must be one of: {', '.join(ROLES)}",
        )
    allowed = PROVISION_MATRIX.get(current_user.role, ())
    if body.role not in allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"{current_user.role} may only provision: {', '.join(allowed) or 'none'}",
        )

    existing = db.query(User).filter(User.email == body.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email address already registered",
        )

    # Company Admin (created by Super Admin) must be attached to an existing
    # tenant; the tenant type must match the company kind.
    if body.role == "Admin":
        if not body.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Admin accounts require a tenant_id",
            )
        tenant = db.query(Tenant).filter(Tenant.id == body.tenant_id).first()
        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tenant not found",
            )
        if tenant.tenant_type not in ("client", "consultancy"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid tenant type for an Admin account",
            )
        tenant_id = body.tenant_id

    elif body.role == "Recruiter":
        if not body.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Recruiter accounts require a consultancy tenant_id",
            )
        tenant = db.query(Tenant).filter(Tenant.id == body.tenant_id).first()
        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tenant not found",
            )
        if tenant.tenant_type != "consultancy":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Recruiters must belong to a consultancy tenant",
            )
        tenant_id = body.tenant_id

    elif body.role == "HR":
        if body.tenant_id:
            tenant = db.query(Tenant).filter(Tenant.id == body.tenant_id).first()
            if not tenant or tenant.tenant_type != "client":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="HR accounts must belong to a client tenant",
                )
        tenant_id = body.tenant_id or current_user.tenant_id

    elif body.role == "Director":
        # Directors are company executives provisioned by the company Admin.
        if body.tenant_id:
            tenant = db.query(Tenant).filter(Tenant.id == body.tenant_id).first()
            if not tenant or tenant.tenant_type != "client":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Director accounts must belong to a client tenant",
                )
            tenant_id = body.tenant_id
        else:
            tenant_id = current_user.tenant_id

    elif body.role == "Candidate":
        # Candidates are provisioned by Recruiters; place in the same tenant.
        tenant_id = current_user.tenant_id

    else:
        # Hiring Manager: place in the same tenant as the Admin/HR who provisions them.
        tenant_id = current_user.tenant_id

    user = User(
        tenant_id=tenant_id,
        email=body.email,
        name=body.name,
        password_hash=hash_password(body.password),
        role=body.role,
        department=body.department,
        candidate_limit=body.candidate_limit,
        candidate_id=getattr(body, 'candidate_id', '') or '',
        created_by=current_user.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    _cache.invalidate_prefix("users:")


    return UserResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        role=user.role,
        tenant_id=user.tenant_id,
        tenant_name=_tenant_name(user.tenant_id, db),
        tenant_type=_tenant_type(user.tenant_id, db),
        department=user.department or "",
        created_by=user.created_by,
        is_active=user.is_active,
        candidate_limit=user.candidate_limit,
    )


@router.get("/users", response_model=list[UserListResponse])
def list_users(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Super Admin sees all accounts; Admin sees their tenant's users; HR sees the Hiring Managers they created."""
    # Cache per-role results for 30s to avoid repeated full collection scans
    _cache_key = f"users:{current_user.id}:{current_user.role}:{current_user.tenant_id}"
    _cached = _cache.get(_cache_key)
    if _cached is not None:
        return _cached

    if current_user.role == "Super Admin":
        users = db.query(User).all()
    elif current_user.role == "Admin":
        users = db.query(User).filter(User.tenant_id == current_user.tenant_id).all()
    elif current_user.role == "HR":
        users = (
            db.query(User)
            .filter(User.created_by == current_user.id)
            .all()
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not allowed to list users",
        )
    
    users = [u for u in users if not getattr(u, 'is_deleted', False)]
    all_tenants = db.query(Tenant).all()
    tenant_map = {t.id: t for t in all_tenants}

    def _safe_iso(dt_val):
        """Safely convert a datetime to ISO string, handling string values."""
        if not dt_val:
            return ""
        if hasattr(dt_val, 'isoformat'):
            return dt_val.isoformat()
        return str(dt_val)

    result = [
        UserListResponse(
            id=u.id,
            email=u.email,
            name=u.name,
            role=u.role,
            tenant_id=u.tenant_id,
            tenant_name=tenant_map[u.tenant_id].name if u.tenant_id in tenant_map else "Unknown Tenant",
            tenant_type=tenant_map[u.tenant_id].tenant_type if u.tenant_id in tenant_map else "client",
            department=u.department or "",
            is_active=u.is_active,
            created_by=u.created_by,
            created_at=_safe_iso(u.created_at),
            candidate_limit=u.candidate_limit,
        )
        for u in users
    ]
    _cache.set(_cache_key, result, ttl=30)
    return result


@router.patch("/users/{user_id}", response_model=UserResponse)
def update_user(
    user_id: str,
    body: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update an account's email/name/password/active state.

    Super Admin can update anyone; Admin can update users in their tenant;
    HR can update the Hiring Managers they created.
    """
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    if current_user.role == "Super Admin":
        pass
    elif current_user.role == "Admin":
        if target.tenant_id != current_user.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only update accounts in your company",
            )
    elif current_user.role == "HR":
        if target.created_by != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only update the Hiring Managers you created",
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not allowed to update accounts",
        )

    if body.email is not None:
        if body.email != target.email:
            existing = db.query(User).filter(User.email == body.email).first()
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email address already registered",
                )
        target.email = body.email
    if body.name is not None:
        target.name = body.name
    if body.password is not None:
        target.password_hash = hash_password(body.password)
    if body.department is not None:
        target.department = body.department
    if body.is_active is not None:
        target.is_active = body.is_active
    if body.candidate_limit is not None:
        target.candidate_limit = body.candidate_limit

    db.commit()
    db.refresh(target)
    _cache.invalidate_prefix("users:")

    comp = _get_company_profile(target.tenant_id, db)
    return UserResponse(
        id=target.id,
        email=target.email,
        name=target.name,
        role=target.role,
        tenant_id=target.tenant_id,
        tenant_name=_tenant_name(target.tenant_id, db),
        tenant_type=_tenant_type(target.tenant_id, db),
        industry=comp.industry if comp else "",
        size=comp.size if comp else "",
        location=comp.location if comp else "",
        tech_stack=(comp.tech_stack if comp and comp.tech_stack else []),
        notes=comp.notes if comp else "",
        department=target.department or "",
        created_by=target.created_by,
        is_active=target.is_active,
        candidate_limit=target.candidate_limit,
    )


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a single account (role-scoped like updates)."""
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    if current_user.role == "Super Admin":
        pass
    elif current_user.role == "Admin":
        if target.tenant_id != current_user.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only delete accounts in your company",
            )
    elif current_user.role == "HR":
        if target.created_by != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only delete the Hiring Managers you created",
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not allowed to delete accounts",
        )

    # Archive before deleting
    from modules.shared.db import db as mongo_db

    user_doc = mongo_db["users"].find_one({"id": user_id})
    if user_doc:
        user_doc.pop("_id", None)
        _archive_item("user", user_doc, current_user.id, "Deleted by admin")

    mongo_db["users"].delete_one({"id": user_id})
    db.delete(target)
    db.commit()
    _cache.invalidate_prefix("users:")
    _log_admin_action(
        current_user,
        'ARCHIVE_USER',
        getattr(target, 'role', '') or 'User',
        getattr(target, 'name', '') or getattr(target, 'email', ''),
        f"Archived {getattr(target, 'role', '') or 'User'} account '{getattr(target, 'name', '') or getattr(target, 'email', '')}' ({getattr(target, 'email', '')})"
    )
    return None


@router.delete("/tenants/{tenant_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tenant(
    tenant_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Super Admin deletes a company and all of its accounts."""
    if current_user.role != "Super Admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Super Admins can delete companies",
        )

    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found",
        )

    # Archive the tenant and all its users before deleting
    from modules.shared.db import db as mongo_db
    tenant_data = {"id": tenant.id, "name": tenant.name, "tenant_type": tenant.tenant_type}
    _archive_item("tenant", tenant_data, current_user.id, "Deleted by Super Admin")

    # Archive all users in this tenant
    users = mongo_db["users"].find({"tenant_id": tenant_id})
    for u in users:
        u.pop("_id", None)
        _archive_item("user", u, current_user.id, f"User of deleted tenant: {tenant.name}")

    mongo_db["tenants"].delete_one({"id": tenant_id})
    mongo_db["users"].delete_many({"tenant_id": tenant_id})
    db.query(User).filter(User.tenant_id == tenant_id).delete(synchronize_session=False)
    db.delete(tenant)
    db.commit()
    _cache.invalidate_prefix("users:")
    _cache.invalidate_prefix("tenants:")
    t_type = 'Vendor' if getattr(tenant, 'tenant_type', '') == 'consultancy' else 'Company'
    _log_admin_action(
        current_user,
        f'ARCHIVE_{t_type.upper()}',
        t_type,
        getattr(tenant, 'name', ''),
        f"Archived {t_type.lower()} '{getattr(tenant, 'name', '')}' and cascaded accounts to archives"
    )
    return None


# --- Super Admin / Admin tenant management -----------------------------------
@router.get("/tenants", response_model=list[TenantResponse])
def list_tenants(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Super Admin lists all tenants; Admin lists their own company tenant."""
    _cache_key = f"tenants:{current_user.id}:{current_user.role}:{current_user.tenant_id}"
    _cached = _cache.get(_cache_key)
    if _cached is not None:
        return _cached

    if current_user.role == "Super Admin":
        tenants = db.query(Tenant).all()
    elif current_user.role == "Admin":
        tenants = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).all()
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not allowed to list tenants",
        )
    tenants = [t for t in tenants if not getattr(t, 'is_deleted', False)]
    result = [
        TenantResponse(
            id=t.id,
            name=t.name,
            tenant_type=t.tenant_type,
            vendor_type=getattr(t, 'vendor_type', 'standard') or 'standard',
            is_guest=(getattr(t, 'vendor_type', '') == 'guest' or getattr(t, 'is_guest', False))
        )
        for t in sorted(tenants, key=lambda t: (t.tenant_type, t.name))
    ]
    _cache.set(_cache_key, result, ttl=30)
    return result


@router.get("/tenants/check-name")
def check_tenant_name(
    name: str,
    current_user: User = Depends(get_current_user),
):
    """Check if a tenant name is already taken (case-insensitive)."""
    if current_user.role not in ("Super Admin", "Admin"):
        raise HTTPException(status_code=403, detail="Only Admins and Super Admins")
    from modules.shared.db import db as mongo_db
    existing = mongo_db["tenants"].find_one({"name": name.strip()})
    return {"taken": existing is not None, "existing_name": existing.get("name") if existing else None}


@router.post("/tenants/ai-describe")
def ai_describe_company(
    body: dict,
    current_user: User = Depends(get_current_user),
):
    """Use AI to research a company and return ALL profile fields."""
    if current_user.role not in ("Super Admin", "Admin"):
        raise HTTPException(status_code=403, detail="Only Admins and Super Admins")
    company_name = body.get("name", "")
    if not company_name:
        raise HTTPException(status_code=400, detail="Company name is required")
    prompt = f"""Research the company "{company_name}" and return a JSON object with these fields:
{{
  "industry": "string — primary industry (e.g. IT Services, SaaS, Fintech, E-commerce)",
  "size": "string — approximate employee count range (e.g. 500-1000, 5000+)",
  "location": "string — headquarters location (e.g. Bangalore, India)",
  "tech_stack": "string — comma-separated list of known technologies (e.g. Python, React, AWS, PostgreSQL)",
  "notes": "string — 3-5 sentence professional description: what the company does, strengths, why candidates would want to work there"
}}

Rules:
- If you don't know something for certain, use your best estimate based on the company's industry and size.
- Keep the description professional, concise, and suitable for a recruitment platform.
- Return ONLY the JSON object, no markdown fences, no extra text."""
    try:
        from modules.requisition.llm.groq import GroqClient
        import json
        client = GroqClient()
        raw = client.generate_text(prompt, tier="small").strip()
        # Clean markdown fences
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[-1]
        if raw.endswith("```"):
            raw = raw.rsplit("```", 1)[0]
        raw = raw.strip()
        result = json.loads(raw)
        return result
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="AI returned invalid data. Please try again.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)}")


@router.post("/tenants", response_model=TenantResponse, status_code=status.HTTP_201_CREATED)
def create_tenant(
    body: TenantCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Super Admin creates a client or consultancy tenant."""
    if current_user.role != "Super Admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Super Admins can create tenants",
        )
    # Check for duplicate company/vendor name via MongoDB
    from modules.shared.db import db as mongo_db
    existing = mongo_db["tenants"].find_one({"name": body.name.strip()})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A {existing.get('tenant_type', 'company')} with the name '{existing.get('name')}' already exists. Company names must be unique.",
        )
    tenant = Tenant(name=body.name.strip(), tenant_type=body.tenant_type)
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    _cache.invalidate_prefix("tenants:")
    _cache.invalidate_prefix("users:")

    # Keep a company profile in sync so the requisition agents have rich
    # context (industry, size, location, tech stack) for automated requisitions.
    profile = CompanyProfile(
        tenant_id=tenant.id,
        name=tenant.name,
        industry=body.industry,
        size=body.size,
        location=body.location,
        tech_stack=body.tech_stack,
        notes=body.notes,
    )
    db.add(profile)
    db.commit()

    action_type = 'CREATE_VENDOR' if body.tenant_type == 'consultancy' else 'CREATE_COMPANY'
    target_type = 'Vendor' if body.tenant_type == 'consultancy' else 'Company'
    details = f"Onboarded {target_type.lower()} '{tenant.name}'"
    _log_admin_action(current_user, action_type, target_type, tenant.name, details)

    return TenantResponse(id=tenant.id, name=tenant.name, tenant_type=tenant.tenant_type)


def _engaged_vendor_map(db: Session, client_tenant_id: str) -> dict[str, VendorEngagement]:
    """VendorEngagements currently engaged by a client company."""
    rows = (
        db.query(VendorEngagement)
        .filter(VendorEngagement.tenant_id == client_tenant_id)
        .all()
    )
    return {r.vendor_tenant_id: r for r in rows}


# --- Vendor management (company Admin selects which vendors it works with) ----
@router.get("/vendors", response_model=list[VendorResponse])
def list_vendors(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Admin lists all consultancy vendors; engaged flags reflect this company's selection.

    Super Admin sees every vendor with no per-company engagement context.
    """
    if current_user.role not in ("Admin", "Super Admin", "Director"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only company Admins can list vendors",
        )

    engaged_map = _engaged_vendor_map(db, current_user.tenant_id) if current_user.role == "Admin" else {}
    vendors = db.query(Tenant).filter(Tenant.tenant_type == "consultancy").all()
    profiles = {
        p.tenant_id: p
        for p in db.query(CompanyProfile).filter(CompanyProfile.tenant_id.in_([v.id for v in vendors])).all()
    }
    return [
        VendorResponse(
            id=v.id,
            name=v.name,
            tenant_type="consultancy",
            industry=(prof.industry if (prof := profiles.get(v.id)) else ""),
            size=(prof.size if (prof := profiles.get(v.id)) else ""),
            location=(prof.location if (prof := profiles.get(v.id)) else ""),
            specializations=(prof.tech_stack or [] if (prof := profiles.get(v.id)) else []),
            engaged=(v.id in engaged_map),
            candidate_limit=(engaged_map[v.id].candidate_limit if v.id in engaged_map else None),
            vendor_type=getattr(v, 'vendor_type', 'standard') or 'standard',
            is_guest=(getattr(v, 'vendor_type', '') == 'guest' or getattr(v, 'is_guest', False)),
        )
        for v in sorted(vendors, key=lambda t: t.name)
    ]


@router.put("/vendors", response_model=list[VendorResponse])
@router.post("/vendors", response_model=list[VendorResponse])
def set_vendor_engagements(
    body: VendorEngagementsIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Admin replaces the set of vendors its company works with."""
    if current_user.role != "Admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only company Admins can manage vendor partnerships",
        )

    # Build mapping of vendor_tenant_id -> candidate_limit
    requested_map: dict[str, int | None] = {}
    if body.engagements:
        for item in body.engagements:
            requested_map[item.vendor_tenant_id] = item.candidate_limit
    else:
        for vid in (body.vendor_tenant_ids or []):
            requested_map[vid] = None

    vendor_ids = list(requested_map.keys())

    # Validate requested vendor ids are real consultancy tenants.
    existing = {
        v.id
        for v in db.query(Tenant)
        .filter(Tenant.tenant_type == "consultancy")
        .filter(Tenant.id.in_(vendor_ids))
        .all()
    }
    invalid = set(vendor_ids) - existing
    if invalid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown vendor ids: {', '.join(sorted(invalid))}",
        )

    existing_rows = db.query(VendorEngagement).filter(
        VendorEngagement.tenant_id == current_user.tenant_id
    ).all()
    for row in existing_rows:
        db.delete(row)
    for vid, cap in requested_map.items():
        db.add(VendorEngagement(
            tenant_id=current_user.tenant_id,
            vendor_tenant_id=vid,
            candidate_limit=cap,
        ))
    db.commit()

    return list_vendors(current_user=current_user, db=db)


@router.get("/portal-users")
def list_portal_users(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List accepted candidates with portal access status.
    
    For Hiring Managers: returns all accepted candidates from their requisitions.
    For Recruiters: returns Candidate users in their tenant.
    For Admin/Super Admin: returns all Candidate users in their tenant.
    """
    from modules.shared.db import db as mongo_db
    
    # Build accepted candidate IDs from submissions
    accepted_subs = []
    if current_user.role in ("Hiring Manager", "Admin", "HR", "Director", "Super Admin"):
        # Get requisition IDs scoped to this user
        from modules.requisition.domain.models import Requisition
        with get_session() as req_session:
            filters = [Requisition.tenant_id == current_user.tenant_id]
            if current_user.role == "Hiring Manager":
                filters.append(Requisition.created_by == current_user.id)
            req_ids = {r.id for r in req_session.query(Requisition).filter(*filters).all()}
        
        # Get accepted submissions for these requisitions
        sub_filter = {"status": {"$in": ["Accepted", "Hired"]}}
        if current_user.role != "Super Admin":
            if req_ids:
                sub_filter["requisition_id"] = {"$in": list(req_ids)}
            else:
                sub_filter["requisition_id"] = {"$in": []}
        
        for sub in mongo_db["candidate_submissions"].find(sub_filter):
            accepted_subs.append({
                "candidate_id": sub.get("id"),
                "candidate_name": sub.get("candidate_name", ""),
                "candidate_email": sub.get("candidate_email", ""),
                "requisition_id": sub.get("requisition_id", ""),
                "vendor_name": sub.get("vendor_name", ""),
            })
    else:
        # Recruiters see their own tenant's Candidate users
        users = db.query(User).filter(
            User.role == "Candidate",
            User.tenant_id == current_user.tenant_id,
        ).all()
        return [
            {
                "id": u.id,
                "email": u.email,
                "name": u.name,
                "candidate_id": getattr(u, 'candidate_id', '') or '',
                "is_active": u.is_active,
                "created_at": u.created_at.isoformat() if hasattr(u.created_at, 'isoformat') else str(u.created_at) if u.created_at else None,
            }
            for u in users
        ]
    
    # Build map of existing portal users with flexible candidate ID and email indexing
    portal_users_by_cid = {}
    portal_users_by_email = {}
    
    for u in db.query(User).filter(User.role == "Candidate").all():
        raw_cid = (getattr(u, 'candidate_id', '') or '').strip()
        clean_cid = raw_cid.replace("SDC-", "").replace("SDC -", "").replace("BEAR-", "").strip()
        uemail = (getattr(u, 'email', '') or '').strip().lower()

        if raw_cid:
            portal_users_by_cid[raw_cid] = u
        if clean_cid:
            portal_users_by_cid[clean_cid] = u
            portal_users_by_cid[f"SDC-{clean_cid}"] = u
            portal_users_by_cid[f"SDC -{clean_cid}"] = u
            portal_users_by_cid[f"BEAR-{clean_cid}"] = u

        if uemail:
            portal_users_by_email[uemail] = u
    
    # Also index candidate users stored in Mongo users collection
    try:
        for mu in mongo_db["users"].find({"role": "Candidate"}):
            raw_cid = (mu.get("candidate_id") or "").strip()
            clean_cid = raw_cid.replace("SDC-", "").replace("SDC -", "").replace("BEAR-", "").strip()
            uemail = (mu.get("email") or "").strip().lower()

            # Wrap dict as lightweight object with email, name, id, is_active attributes if not in SQL map
            class MongoUserWrapper:
                def __init__(self, doc):
                    self.id = str(doc.get("_id") or doc.get("id"))
                    self.email = doc.get("email", "")
                    self.name = doc.get("name", "")
                    self.candidate_id = doc.get("candidate_id", "")
                    self.is_active = doc.get("is_active", True)

            wrapper = MongoUserWrapper(mu)
            if raw_cid and raw_cid not in portal_users_by_cid:
                portal_users_by_cid[raw_cid] = wrapper
            if clean_cid and clean_cid not in portal_users_by_cid:
                portal_users_by_cid[clean_cid] = wrapper
                portal_users_by_cid[f"SDC-{clean_cid}"] = wrapper
                portal_users_by_cid[f"SDC -{clean_cid}"] = wrapper
                portal_users_by_cid[f"BEAR-{clean_cid}"] = wrapper
            if uemail and uemail not in portal_users_by_email:
                portal_users_by_email[uemail] = wrapper
    except Exception as mongo_err:
        print(f"Error indexing Mongo candidate users: {mongo_err}")
    
    # Batch-fetch all requisitions in one query (eliminates N+1)
    req_ids_needed = list({sub.get("requisition_id") for sub in accepted_subs if sub.get("requisition_id")})
    req_cache = {}
    if req_ids_needed:
        for rd in mongo_db["requisitions"].find({"id": {"$in": req_ids_needed}}, {"id": 1, "title": 1}):
            req_cache[rd.get("id")] = rd

    # Batch-fetch work orders for all candidates
    wo_list = list(mongo_db["work_orders"].find({"status": {"$ne": "CLOSED"}}))
    wo_cache = {}

    # Enrich accepted subs with portal user status + requisition title + work order
    results = []
    for sub in accepted_subs:
        cid = (sub.get("candidate_id") or "").strip()
        cemail = (sub.get("candidate_email") or sub.get("email") or "").lower().strip()
        cname = (sub.get("candidate_name") or "").lower().strip()
        cid_clean = cid.replace("SDC-", "").replace("SDC -", "").replace("BEAR-", "").strip()

        wo_doc = None
        for wo in wo_list:
            wcid = str(wo.get("candidate_id", "")).strip()
            wcemail = str(wo.get("candidate_email", "") or wo.get("email", "")).lower().strip()
            wcname = str(wo.get("candidate_name", "")).lower().strip()
            wcid_clean = wcid.replace("SDC-", "").replace("SDC -", "").replace("BEAR-", "").strip()

            if (cid and wcid and cid == wcid) or \
               (cid_clean and wcid_clean and cid_clean == wcid_clean) or \
               (cemail and wcemail and cemail == wcemail) or \
               (cname and wcname and cname == wcname):
                wo_doc = wo
                break

        pu = (
            portal_users_by_cid.get(cid)
            or portal_users_by_cid.get(cid_clean)
            or portal_users_by_cid.get(f"SDC-{cid_clean}")
            or portal_users_by_cid.get(f"SDC -{cid_clean}")
            or portal_users_by_email.get(cemail)
        )
        req_doc = req_cache.get(sub.get("requisition_id"))

        eff_email = (pu.email if pu and getattr(pu, 'email', None) else (sub.get("candidate_email") or sub.get("email") or "")).strip()
        eff_name = (pu.name if pu and getattr(pu, 'name', None) else (sub.get("candidate_name") or "")).strip()

        results.append({
            "candidate_id": cid,
            "candidate_name": eff_name,
            "candidate_email": eff_email,
            "requisition_title": (req_doc or {}).get("title", ""),
            "vendor_name": sub.get("vendor_name", ""),
            "has_portal_access": pu is not None and getattr(pu, 'is_active', True),
            "portal_user_id": pu.id if pu else None,
            "portal_user_email": eff_email,
            "work_order_status": wo_doc.get("status") if wo_doc else None,
            "work_order_number": wo_doc.get("work_order_number") if wo_doc else None,
            "has_work_order": wo_doc is not None,
        })
    
    return results


def _sync_candidate_credentials_to_mongo(candidate_id: str, email: str, name: str):
    if not candidate_id:
        return
    cid = candidate_id.strip()
    clean_cid = cid.replace("SDC-", "").replace("SDC -", "").replace("BEAR-", "").strip()
    id_variants = list(set([cid, clean_cid, f"SDC-{clean_cid}", f"SDC -{clean_cid}", f"BEAR-{clean_cid}"]))
    
    try:
        from modules.shared.db import db as mongo_db
        # Sync candidate_submissions
        mongo_db["candidate_submissions"].update_many(
            {"$or": [{"id": {"$in": id_variants}}, {"candidate_id": {"$in": id_variants}}]},
            {"$set": {"candidate_email": email, "email": email, "candidate_name": name}}
        )
        # Sync onboarding_checklists
        mongo_db["onboarding_checklists"].update_many(
            {"$or": [{"candidate_id": {"$in": id_variants}}, {"candidate_email": email}]},
            {"$set": {"candidate_email": email, "candidate_name": name}}
        )
        # Sync mongo_db["users"] collection
        mongo_db["users"].update_many(
            {"$or": [{"candidate_id": {"$in": id_variants}}, {"email": email}]},
            {"$set": {"candidate_email": email, "email": email, "name": name, "candidate_id": cid}}
        )
    except Exception as sync_err:
        print(f"MongoDB sync error on portal user update: {sync_err}")


@router.post("/portal-users")
def create_or_update_portal_user(
    body: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create or update a Candidate portal account for a specific candidate submission."""
    if current_user.role not in ("Recruiter", "Admin", "Super Admin", "Hiring Manager"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only recruiters, admins, and hiring managers may provision candidate portal access",
        )

    email = (body.get("email") or "").strip().lower()
    name = (body.get("name") or "").strip()
    password = body.get("password") or ""
    candidate_id = (body.get("candidate_id") or "").strip()
    cid_clean = candidate_id.replace("SDC-", "").replace("SDC -", "").replace("BEAR-", "").strip()

    if not email or "@" not in email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A valid email is required")
    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Candidate name is required")
    if not candidate_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Candidate ID is required")

    tenant_id = current_user.tenant_id
    from modules.shared.db import db as mongo_db

    # 1. Search for existing Candidate user specifically for THIS candidate_id
    existing_user = None
    if candidate_id:
        existing_user = db.query(User).filter(
            User.role == "Candidate",
            User.candidate_id.in_([candidate_id, cid_clean, f"SDC-{cid_clean}", f"SDC -{cid_clean}", f"BEAR-{cid_clean}"])
        ).first()

    # 2. Check if email is already taken by ANOTHER account (candidate or non-candidate)
    email_owner = db.query(User).filter(User.email == email).first()
    if email_owner:
        is_same_account = existing_user is not None and email_owner.id == existing_user.id
        if not is_same_account:
            if email_owner.role == "Candidate":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"The email '{email}' is already in use by another candidate portal account.",
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"The email '{email}' is already registered for staff account ({email_owner.role}).",
                )

    # Double-check Mongo users collection for duplicate email
    mongo_email_owner = mongo_db["users"].find_one({"email": email})
    if mongo_email_owner:
        m_id = str(mongo_email_owner.get("_id") or mongo_email_owner.get("id"))
        m_cid = (mongo_email_owner.get("candidate_id") or "").strip()
        m_clean_cid = m_cid.replace("SDC-", "").replace("SDC -", "").replace("BEAR-", "").strip()

        is_same_account = False
        if existing_user and (existing_user.id == m_id or existing_user.candidate_id in [m_cid, m_clean_cid]):
            is_same_account = True
        elif candidate_id and (candidate_id == m_cid or cid_clean == m_clean_cid):
            is_same_account = True

        if not is_same_account:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"The email '{email}' is already in use by another candidate portal account.",
            )

    if existing_user:
        # Update existing candidate user credentials & ensure active
        existing_user.name = name
        existing_user.email = email
        existing_user.candidate_id = candidate_id
        existing_user.tenant_id = tenant_id  # reassign to correct tenant
        if password:
            existing_user.password_hash = hash_password(password)
        existing_user.is_active = True
        db.commit()
        db.refresh(existing_user)
        _cache.invalidate_prefix("users:")

        # Synchronize to Mongo collections
        _sync_candidate_credentials_to_mongo(candidate_id, email, name)

        return {
            "ok": True,
            "id": existing_user.id,
            "email": existing_user.email,
            "name": existing_user.name,
            "candidate_id": existing_user.candidate_id,
            "is_active": existing_user.is_active,
            "message": "Portal credentials updated and activated successfully",
        }

    if not password or len(password) < 4:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 4 characters long",
        )

    # 3. Truly new user — create
    new_user = User(
        tenant_id=tenant_id,
        email=email,
        name=name,
        password_hash=hash_password(password),
        role="Candidate",
        candidate_id=candidate_id,
        created_by=current_user.id,
        is_active=True,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    _cache.invalidate_prefix("users:")

    # Sync candidate email & name to candidate_submissions and onboarding_checklists in MongoDB
    _sync_candidate_credentials_to_mongo(candidate_id, email, name)

    return {
        "ok": True,
        "id": new_user.id,
        "email": new_user.email,
        "name": new_user.name,
        "candidate_id": new_user.candidate_id,
        "is_active": new_user.is_active,
        "message": "Portal access created successfully",
    }


@router.put("/portal-users/{user_id}")
def update_portal_user(
    user_id: str,
    body: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a Candidate user's name, email, password, or active status."""
    target = db.query(User).filter(
        User.id == user_id,
    ).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    email = (body.get("email") or "").strip().lower()
    name = (body.get("name") or "").strip()
    password = body.get("password") or ""
    from modules.shared.db import db as mongo_db

    if email and email != target.email:
        # Check if email is used by another user account
        email_owner = db.query(User).filter(User.email == email, User.id != user_id).first()
        if email_owner:
            if email_owner.role == "Candidate":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"The email '{email}' is already in use by another candidate portal account.",
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"The email '{email}' is already registered for staff account ({email_owner.role}).",
                )

        mongo_email_owner = mongo_db["users"].find_one({"email": email, "id": {"$ne": user_id}})
        if mongo_email_owner:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"The email '{email}' is already in use by another candidate portal account.",
            )

    if name:
        target.name = name
    if email:
        target.email = email
    if password:
        target.password_hash = hash_password(password)
    if "is_active" in body:
        target.is_active = body["is_active"]
    if "candidate_id" in body and body["candidate_id"]:
        target.candidate_id = body["candidate_id"]

    db.commit()
    db.refresh(target)
    _cache.invalidate_prefix("users:")

    # Sync to MongoDB collections as well
    cid = target.candidate_id or body.get("candidate_id")
    if cid:
        _sync_candidate_credentials_to_mongo(cid, target.email, target.name)

    return {
        "ok": True,
        "message": "Portal credentials updated successfully",
        "user": {
            "id": target.id,
            "email": target.email,
            "name": target.name,
            "candidate_id": target.candidate_id,
        }
    }

    return {
        "ok": True,
        "message": "Portal credentials updated successfully",
        "user": {
            "id": target.id,
            "email": target.email,
            "name": target.name,
            "candidate_id": target.candidate_id,
        }
    }


@router.delete("/portal-users/{user_id}")
def delete_portal_user(
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a Candidate user."""
    target = db.query(User).filter(
        User.id == user_id,
        User.tenant_id == current_user.tenant_id,
    ).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(target)
    db.commit()
    _cache.invalidate_prefix("users:")
    return {"ok": True, "message": "Portal user deleted"}


def _archives():
    from modules.shared.db import db as _db
    return _db["archives"]


def _archive_item(item_type: str, item: dict, archived_by: str, reason: str = ""):
    """Move an item to the archives collection."""
    import uuid
    from datetime import datetime, timezone
    archive_doc = {
        "id": f"arch_{uuid.uuid4().hex[:12]}",
        "item_type": item_type,
        "original_data": item,
        "archived_by": archived_by,
        "reason": reason,
        "archived_at": datetime.now(timezone.utc).isoformat(),
    }
    _archives().insert_one(archive_doc)
    return archive_doc


@router.get("/archives")
def list_archives(
    current_user: User = Depends(get_current_user),
):
    """List all archived items. Super Admin only."""
    if current_user.role not in ("Super Admin", "Admin"):
        raise HTTPException(status_code=403, detail="Only Admins and Super Admins")
    docs = list(_archives().find({"$and": [{"is_deleted": {"$ne": True}}, {"purged_from_ui": {"$ne": True}}]}).sort("archived_at", -1).limit(200))
    for d in docs:
        d.pop("_id", None)
        if isinstance(d.get("original_data"), dict):
            for k, v in list(d["original_data"].items()):
                if hasattr(v, "isoformat"):
                    d["original_data"][k] = v.isoformat()
    return docs


@router.post("/archives/{archive_id}/restore")
def restore_archive(
    archive_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Restore an archived item back to its original collection."""
    if current_user.role not in ("Super Admin", "Admin"):
        raise HTTPException(status_code=403, detail="Only Admins and Super Admins")
    archive = _archives().find_one({"id": archive_id})
    if not archive:
        raise HTTPException(status_code=404, detail="Archive not found")
    original = archive.get("original_data", {})
    item_type = archive.get("item_type", "")

    if item_type == "tenant":
        # Restore tenant
        tenant = Tenant(id=original.get("id", ""), name=original.get("name", ""), tenant_type=original.get("tenant_type", "client"))
        db.add(tenant)
        db.commit()
    elif item_type == "user":
        # Restore user
        user = User(
            id=original.get("id", ""),
            email=original.get("email", ""),
            name=original.get("name", ""),
            role=original.get("role", ""),
            tenant_id=original.get("tenant_id", ""),
            password_hash=original.get("password_hash", ""),
            is_active=original.get("is_active", True),
        )
        db.add(user)
        db.commit()

    # Remove from archives
    _archives().delete_one({"id": archive_id})
    _log_admin_action(
        current_user,
        'RESTORE_RECORD',
        item_type.capitalize(),
        original.get('name') or original.get('email') or archive_id,
        f"Restored archived {item_type} '{original.get('name') or original.get('email') or archive_id}' back to production"
    )
    return {"ok": True, "message": f"{item_type} restored successfully"}


@router.delete("/archives/{archive_id}")
def permanently_delete_archive(
    archive_id: str,
    current_user: User = Depends(get_current_user),
):
    """Hide/purge archived item from UI while safely preserving raw data in the database."""
    if current_user.role not in ("Super Admin", "Admin"):
        raise HTTPException(status_code=403, detail="Only Admins and Super Admins")
    from datetime import datetime, timezone
    now_iso = datetime.now(timezone.utc).isoformat()
    result = _archives().update_one(
        {"id": archive_id},
        {"$set": {"is_deleted": True, "purged_from_ui": True, "purged_at": now_iso}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Archive not found")
    _log_admin_action(
        current_user,
        'DELETE_RECORD',
        'Archive',
        archive_id,
        f"Purged archived record {archive_id} from management interface"
    )
    return {"ok": True, "message": "Permanently deleted"}


class HiringManagerInviteIn(BaseModel):
    name: str
    email: str
    department: str = ""
    password: str
    tenant_id: str | None = None
    company_name: str | None = None


@router.get("/join/company-info")
def get_invite_company_info(
    tenant_id: str | None = None,
    company: str | None = None,
    db: Session = Depends(get_db),
):
    users = [u for u in users if not getattr(u, 'is_deleted', False)]
    all_tenants = db.query(Tenant).all()
    target_tenant = None

    if tenant_id:
        target_tenant = next((t for t in all_tenants if t.id == tenant_id), None)
    if not target_tenant and company:
        comp_clean = company.strip().lower()
        target_tenant = next((t for t in all_tenants if (t.name or '').strip().lower() == comp_clean), None)
    if not target_tenant:
        target_tenant = next((t for t in all_tenants if (t.name or '').strip().lower() == 'bearitt'), None)
    if not target_tenant:
        target_tenant = next((t for t in all_tenants if getattr(t, 'tenant_type', '') == 'client'), None)

    return {
        "tenant_id": target_tenant.id if target_tenant else "",
        "company_name": target_tenant.name if target_tenant else "Bearitt",
    }


@router.post("/join/hiring-manager", status_code=status.HTTP_201_CREATED)
@router.post("/hiring-manager/register", status_code=status.HTTP_201_CREATED)
def register_hiring_manager(
    body: HiringManagerInviteIn,
    db: Session = Depends(get_db),
):
    """Public self-registration for Hiring Managers via secure company invite link.
    Stores the account under the company's tenant so the Company Admin sees them
    in their Hiring Manager governance list immediately.
    """
    if not body.email or not body.email.strip():
        raise HTTPException(status_code=400, detail="Email address is required")
    if not body.name or not body.name.strip():
        raise HTTPException(status_code=400, detail="Full name is required")
    if not body.password or len(body.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    email = body.email.strip().lower()
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists. Please log in.",
        )

    users = [u for u in users if not getattr(u, 'is_deleted', False)]
    all_tenants = db.query(Tenant).all()
    target_tenant = None
    if body.tenant_id:
        target_tenant = next((t for t in all_tenants if t.id == body.tenant_id), None)

    if not target_tenant and body.company_name:
        comp_clean = body.company_name.strip().lower()
        target_tenant = next((t for t in all_tenants if (t.name or '').strip().lower() == comp_clean), None)

    if not target_tenant:
        target_tenant = next((t for t in all_tenants if (t.name or '').strip().lower() == 'bearitt'), None)
    if not target_tenant:
        target_tenant = next((t for t in all_tenants if getattr(t, 'tenant_type', '') == 'client'), None)

    tenant_id = target_tenant.id if target_tenant else "local"

    # Find the company admin or creator for reference
    all_users = db.query(User).filter(User.tenant_id == tenant_id).all()
    admin_user = next((u for u in all_users if u.role in ("Admin", "Super Admin")), None)
    created_by_id = admin_user.id if admin_user else "self_invite"

    user = User(
        tenant_id=tenant_id,
        email=email,
        name=body.name.strip(),
        password_hash=hash_password(body.password),
        role="Hiring Manager",
        department=body.department.strip() or "General",
        created_by="self_invite",
        is_active=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "success": True,
        "message": f"Access request submitted successfully for {user.name}. Your account is registered under {target_tenant.name if target_tenant else 'company'}.",
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "role": user.role,
            "department": user.department,
            "tenant_id": user.tenant_id,
            "tenant_name": target_tenant.name if target_tenant else "Bearitt",
        }
    }

@router.post("/users/{user_id}/approve", response_model=UserResponse)
def approve_user(
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Approve a self-registered hiring manager or user access request."""
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    if current_user.role not in ("Super Admin", "Admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only company administrators can approve user access requests",
        )

    if current_user.role == "Admin" and target.tenant_id != current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only approve accounts in your company workspace",
        )

    target.is_active = True
    db.commit()
    db.refresh(target)
    _cache.invalidate_prefix("users:")


    return UserResponse(
        id=target.id,
        email=target.email,
        name=target.name,
        role=target.role,
        tenant_id=target.tenant_id,
        tenant_name=_tenant_name(target.tenant_id, db),
        tenant_type=_tenant_type(target.tenant_id, db),
        department=target.department or "",
        created_by=target.created_by,
        is_active=target.is_active,
        candidate_limit=target.candidate_limit,
    )


class DirectorInviteIn(BaseModel):
    name: str
    email: str
    department: str = ""
    password: str
    tenant_id: str | None = None
    company_name: str | None = None


@router.post("/join/director", status_code=status.HTTP_201_CREATED)
@router.post("/director/register", status_code=status.HTTP_201_CREATED)
def register_director(
    body: DirectorInviteIn,
    db: Session = Depends(get_db),
):
    """Public self-registration for Directors via secure company invite link.
    Stores the account under the company's tenant with is_active=False pending approval.
    """
    if not body.email or not body.email.strip():
        raise HTTPException(status_code=400, detail="Email address is required")
    if not body.name or not body.name.strip():
        raise HTTPException(status_code=400, detail="Full name is required")
    if not body.password or len(body.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    email = body.email.strip().lower()
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists. Please log in.",
        )

    users = [u for u in users if not getattr(u, 'is_deleted', False)]
    all_tenants = db.query(Tenant).all()
    target_tenant = None
    if body.tenant_id:
        target_tenant = next((t for t in all_tenants if t.id == body.tenant_id), None)

    if not target_tenant and body.company_name:
        comp_clean = body.company_name.strip().lower()
        target_tenant = next((t for t in all_tenants if (t.name or '').strip().lower() == comp_clean), None)

    if not target_tenant:
        target_tenant = next((t for t in all_tenants if (t.name or '').strip().lower() == 'bearitt'), None)
    if not target_tenant:
        target_tenant = next((t for t in all_tenants if getattr(t, 'tenant_type', '') == 'client'), None)

    tenant_id = target_tenant.id if target_tenant else "local"

    user = User(
        tenant_id=tenant_id,
        email=email,
        name=body.name.strip(),
        password_hash=hash_password(body.password),
        role="Director",
        department=body.department.strip() or "Executive",
        created_by="self_invite",
        is_active=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "success": True,
        "message": f"Access request submitted successfully for {user.name}. Your account is pending company administrator approval.",
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "role": user.role,
            "department": user.department,
            "tenant_id": user.tenant_id,
            "tenant_name": target_tenant.name if target_tenant else "Bearitt",
            "is_active": False,
        }
    }


def _admin_logs():
    from modules.shared.db import db as _db
    return _db["admin_audit_logs"]


def _log_admin_action(admin, action: str, target_type: str, target_name: str, details: str = ""):
    """Records an administrative audit log entry in MongoDB."""
    import uuid
    from datetime import datetime, timezone
    doc = {
        "id": f"log_{uuid.uuid4().hex[:12]}",
        "admin_id": getattr(admin, "id", "") or "system",
        "admin_name": getattr(admin, "name", "") or "Super Admin",
        "admin_email": getattr(admin, "email", "") or "admin@platform.com",
        "action": action,
        "target_type": target_type,
        "target_name": target_name,
        "details": details,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "ip_address": "Platform Console",
    }
    _admin_logs().insert_one(doc)
    return doc


class SuperAdminCreate(BaseModel):
    name: str
    email: str
    phone: str = ""
    password: str


@router.post("/superadmins", response_model=UserResponse)
def create_superadmin(
    body: SuperAdminCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Super Admin provisions another Super Administrator account."""
    if current_user.role != "Super Admin":
        raise HTTPException(status_code=403, detail="Only Super Admins can create Super Admin accounts")
    
    email = body.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Valid email address is required")
    if not body.name or not body.name.strip():
        raise HTTPException(status_code=400, detail="Full name is required")
    if not body.password or len(body.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Account with this email already exists")

    user = User(
        email=email,
        name=body.name.strip(),
        password_hash=hash_password(body.password),
        role="Super Admin",
        phone=body.phone.strip(),
        tenant_id=current_user.tenant_id or "system",
        is_active=True,
        created_by=current_user.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    _log_admin_action(
        current_user,
        "CREATE_ADMIN",
        "Super Admin",
        user.name,
        f"Provisioned Super Admin account for {user.email} (Phone: {user.phone or 'N/A'})"
    )
    _cache.invalidate_prefix("users:")


    return UserResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        role=user.role,
        tenant_id=user.tenant_id,
        tenant_name="Platform Administration",
        tenant_type="system",
        department="Platform Admin",
        created_by=user.created_by,
        is_active=user.is_active,
        phone=user.phone or "",
    )


@router.get("/admin-logs")
def list_admin_logs(
    current_user: User = Depends(get_current_user),
):
    """List administrative audit trail logs. Super Admin only."""
    if current_user.role != "Super Admin":
        raise HTTPException(status_code=403, detail="Only Super Admins can view audit logs")
    
    docs = list(_admin_logs().find().sort("timestamp", -1).limit(200))
    for d in docs:
        d.pop("_id", None)
    return docs


class GuestVendorCreate(BaseModel):
    vendor_name: str = Field(..., min_length=2, max_length=255)
    industry: str = ""
    location: str = ""
    specializations: str = ""
    notes: str = ""
    name: str = Field(..., min_length=1, max_length=255)
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=4, max_length=128)
    candidate_limit: int = Field(3, ge=1, le=100)


@router.post("/vendors/guest", response_model=VendorResponse, status_code=status.HTTP_201_CREATED)
def create_guest_vendor(
    body: GuestVendorCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Company Admin or Super Admin onboards a guest vendor in existing tables."""
    if current_user.role not in ("Admin", "Super Admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only company Admins and Super Admins can onboard guest vendors",
        )

    v_name = body.vendor_name.strip()
    from modules.shared.db import db as mongo_db
    existing = mongo_db["tenants"].find_one({"name": v_name, "is_deleted": {"$ne": True}})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A vendor or company with the name '{v_name}' already exists.",
        )

    recruiter_email = body.email.strip().lower()
    existing_user = mongo_db["users"].find_one({"email": recruiter_email, "is_deleted": {"$ne": True}})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Recruiter email is already registered",
        )

    # 1. Create Tenant marked as guest in existing 'tenants' table
    tenant = Tenant(
        name=v_name,
        tenant_type="consultancy",
        vendor_type="guest",
        is_deleted=False,
    )
    db.add(tenant)
    db.commit()
    db.refresh(tenant)

    mongo_db["tenants"].update_one(
        {"id": tenant.id},
        {"$set": {
            "vendor_type": "guest",
            "is_guest": True,
            "created_by_tenant_id": current_user.tenant_id,
            "created_by_admin_id": current_user.id,
        }}
    )

    # 2. Create CompanyProfile in existing 'company_profiles' table
    specs = [s.strip() for s in body.specializations.split(",") if s.strip()] if body.specializations else []
    profile = CompanyProfile(
        tenant_id=tenant.id,
        name=tenant.name,
        industry=body.industry,
        size="1-50 employees",
        location=body.location,
        tech_stack=specs,
        notes=body.notes,
    )
    db.add(profile)
    db.commit()

    # 3. Create Recruiter in existing 'users' table
    recruiter = User(
        email=recruiter_email,
        name=body.name.strip(),
        password_hash=hash_password(body.password),
        role="Recruiter",
        tenant_id=tenant.id,
        candidate_limit=body.candidate_limit,
        is_active=True,
        is_deleted=False,
        created_by=current_user.id,
    )
    db.add(recruiter)
    db.commit()

    # 4. Auto-engage guest vendor with current company
    if current_user.tenant_id and current_user.role == "Admin":
        existing_eng = db.query(VendorEngagement).filter(
            VendorEngagement.tenant_id == current_user.tenant_id,
            VendorEngagement.vendor_tenant_id == tenant.id,
        ).first()
        if not existing_eng:
            db.add(VendorEngagement(
                tenant_id=current_user.tenant_id,
                vendor_tenant_id=tenant.id,
                candidate_limit=body.candidate_limit,
            ))
            db.commit()

    _cache.invalidate_prefix("tenants:")
    _cache.invalidate_prefix("users:")

    company_name = _tenant_name(current_user.tenant_id, db) if current_user.tenant_id else "Platform"
    _log_admin_action(
        current_user,
        "CREATE_VENDOR",
        "Guest Vendor",
        tenant.name,
        f"Company Admin '{current_user.name}' ({company_name}) onboarded guest vendor '{tenant.name}'"
    )

    return VendorResponse(
        id=tenant.id,
        name=tenant.name,
        tenant_type="consultancy",
        industry=body.industry,
        size="1-50 employees",
        location=body.location,
        specializations=specs,
        engaged=True,
        candidate_limit=body.candidate_limit,
        vendor_type="guest",
        is_guest=True,
    )
