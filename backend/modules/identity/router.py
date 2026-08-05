from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from modules.identity.domain.models import Tenant, User
from modules.identity.domain.schemas import TokenResponse, UserLogin, UserRegister, UserResponse
from modules.identity.services.auth_service import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from modules.shared.db import get_session

from modules.requisition.domain.models import CompanyProfile

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

def get_db():
    with get_session() as session:
        yield session

def get_current_user(authorization: str = Header(...), db: Session = Depends(get_db)) -> User:
    """Dependency to retrieve the currently authenticated user via JWT header."""
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
    return user

def _get_company_profile(tenant_id: str, db: Session) -> CompanyProfile | None:
    return db.query(CompanyProfile).filter(CompanyProfile.tenant_id == tenant_id).first()

@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register_user(body: UserRegister, db: Session = Depends(get_db)):
    # 1. Check if user already exists
    existing_user = db.query(User).filter(User.email == body.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email address already registered",
        )

    # 2. Create Tenant
    tenant = Tenant(
        name=body.company_name,
        tenant_type=body.tenant_type
    )
    db.add(tenant)
    db.flush()  # Populate tenant.id

    # 3. Create linked CompanyProfile for AI Requisition context
    company_profile = CompanyProfile(
        tenant_id=tenant.id,
        name=body.company_name,
        industry=body.industry,
        size=body.size,
        location=body.location,
        tech_stack=body.tech_stack,
        notes=body.notes
    )
    db.add(company_profile)

    # 4. Create User
    pwd_hash = hash_password(body.password)
    user = User(
        tenant_id=tenant.id,
        email=body.email,
        name=body.name,
        password_hash=pwd_hash,
        role=body.role
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # 5. Generate Token
    token_data = {"sub": user.id, "email": user.email, "role": user.role, "tenant_id": tenant.id}
    token = create_access_token(token_data)

    user_resp = UserResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        role=user.role,
        tenant_id=tenant.id,
        tenant_name=tenant.name,
        tenant_type=tenant.tenant_type,
        industry=company_profile.industry,
        size=company_profile.size,
        location=company_profile.location,
        tech_stack=company_profile.tech_stack or [],
        notes=company_profile.notes
    )

    return TokenResponse(access_token=token, user=user_resp)

@router.post("/login", response_model=TokenResponse)
def login_user(body: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    tenant = db.query(Tenant).filter(Tenant.id == user.tenant_id).first()
    tenant_name = tenant.name if tenant else "Unknown Tenant"
    tenant_type = tenant.tenant_type if tenant else "client"

    comp = _get_company_profile(user.tenant_id, db)

    # Generate Token
    token_data = {"sub": user.id, "email": user.email, "role": user.role, "tenant_id": user.tenant_id}
    token = create_access_token(token_data)

    user_resp = UserResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        role=user.role,
        tenant_id=user.tenant_id,
        tenant_name=tenant_name,
        tenant_type=tenant_type,
        industry=comp.industry if comp else "",
        size=comp.size if comp else "",
        location=comp.location if comp else "",
        tech_stack=(comp.tech_stack if comp and comp.tech_stack else []),
        notes=comp.notes if comp else ""
    )

    return TokenResponse(access_token=token, user=user_resp)

@router.get("/me", response_model=UserResponse)
def get_user_profile(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    tenant_name = tenant.name if tenant else "Unknown Tenant"
    tenant_type = tenant.tenant_type if tenant else "client"

    comp = _get_company_profile(current_user.tenant_id, db)

    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        role=current_user.role,
        tenant_id=current_user.tenant_id,
        tenant_name=tenant_name,
        tenant_type=tenant_type,
        industry=comp.industry if comp else "",
        size=comp.size if comp else "",
        location=comp.location if comp else "",
        tech_stack=(comp.tech_stack if comp and comp.tech_stack else []),
        notes=comp.notes if comp else ""
    )
