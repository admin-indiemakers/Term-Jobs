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
    # Allow login with either email or username "ADMIN" for superadmin
    if body.username == "ADMIN":
        user = db.query(User).filter(User.role == "Super Admin", User.email == "ADMIN").first()
    elif body.email:
        user = db.query(User).filter(User.email == body.email).first()
    else:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )
    
    if not user or not user.is_active or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
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
        created_by=current_user.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

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
    return [
        UserListResponse(
            id=u.id,
            email=u.email,
            name=u.name,
            role=u.role,
            tenant_id=u.tenant_id,
            tenant_name=_tenant_name(u.tenant_id, db),
            tenant_type=_tenant_type(u.tenant_id, db),
            department=u.department or "",
            is_active=u.is_active,
            created_by=u.created_by,
            created_at=u.created_at.isoformat() if u.created_at else "",
            candidate_limit=u.candidate_limit,
        )
        for u in users
    ]


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

    db.delete(target)
    db.commit()
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

    # Cascade: remove all accounts in the company first.
    db._coll(User).delete_many({"tenant_id": tenant_id})
    db.delete(tenant)
    db.commit()
    return None


# --- Super Admin / Admin tenant management -----------------------------------
@router.get("/tenants", response_model=list[TenantResponse])
def list_tenants(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Super Admin lists all tenants; Admin lists their own company tenant."""
    if current_user.role == "Super Admin":
        tenants = db.query(Tenant).all()
    elif current_user.role == "Admin":
        tenants = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).all()
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not allowed to list tenants",
        )
    return [
        TenantResponse(id=t.id, name=t.name, tenant_type=t.tenant_type)
        for t in sorted(tenants, key=lambda t: (t.tenant_type, t.name))
    ]


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
    tenant = Tenant(name=body.name, tenant_type=body.tenant_type)
    db.add(tenant)
    db.commit()
    db.refresh(tenant)

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
            industry=(prof.industry if (prof := profiles.get(v.id)) else ""),
            size=(prof.size if (prof := profiles.get(v.id)) else ""),
            location=(prof.location if (prof := profiles.get(v.id)) else ""),
            specializations=(prof.tech_stack or [] if (prof := profiles.get(v.id)) else []),
            engaged=(v.id in engaged_map),
            candidate_limit=(engaged_map[v.id].candidate_limit if v.id in engaged_map else None),
        )
        for v in sorted(vendors, key=lambda t: t.name)
    ]


@router.put("/vendors", response_model=list[VendorResponse])
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
