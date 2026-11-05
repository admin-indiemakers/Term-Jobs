"""FastAPI dependencies for authentication, database session, and services."""
import logging
from typing import Optional
from fastapi import Depends, Header, HTTPException, status
from .config import Settings, get_settings
from .security.authentication import AuthenticatedUser, AuthenticationError, authenticate_bearer_token, decode_token
from .security.authorization import check_action_permitted, AuthorizationError
from .audit.logger import AuditLogger
from .proposals.service import ProposalService
from .tools.registry import registry
from .agent.llm_client import BaseLLMClient, OpenRouterLLMClient, MockLLMClient

logger = logging.getLogger("aura.dependencies")

# Shared singletons for standalone runner
_mongo_client = None
_audit_logger = None
_proposal_service = None
_llm_client = None


def get_db():
    """Return TermJobs live MongoDB database, or standalone connection, or None if running offline."""
    settings = get_settings()
    if settings.test_mode:
        return None
    try:
        from modules.shared.db import db as termjobs_db
        if termjobs_db is not None:
            return termjobs_db
    except (ImportError, Exception):
        pass

    global _mongo_client
    if _mongo_client is None:
        try:
            from pymongo import MongoClient
            _mongo_client = MongoClient(settings.mongodb_uri, serverSelectionTimeoutMS=2000)
            _mongo_client.admin.command('ping')
            return _mongo_client[settings.database_name]
        except Exception:
            return None
    return _mongo_client[settings.database_name]


def get_authenticated_user(
    authorization: Optional[str] = Header(None, alias="Authorization"),
    settings: Settings = Depends(get_settings)
) -> AuthenticatedUser:
    """Dependency validating the incoming Bearer token using TermJobs authentication."""
    dev_fallback_user = AuthenticatedUser(
        user_id="test_user_hm_01",
        tenant_id="test_tenant_corp_01",
        role="Hiring Manager",
        email="hm@testcorp.com",
        name="Test Hiring Manager",
        department="Engineering",
        permissions=["hiring_manager_read", "hiring_manager_write"]
    )

    if not authorization:
        if settings.test_mode:
            return dev_fallback_user
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    if not authorization.startswith("Bearer "):
        if settings.test_mode:
            return dev_fallback_user
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header format. Use 'Bearer <token>'",
        )

    token = authorization.split(" ")[1].strip()

    # Support dev/preview tokens for fast offline iteration
    if token in ("test_token", "mock_token", "test", "dev_token", "preview", "null", "undefined") or token.startswith("mock_"):
        return dev_fallback_user

    user = None
    # 1. Primary: TermJobs real server-side JWT authentication
    try:
        from modules.identity.services.auth_service import decode_access_token
        from modules.identity.domain.models import User
        from modules.shared.cache import cache as _cache
        from modules.shared.db import get_session

        payload = decode_access_token(token)
        if payload and "sub" in payload:
            user_id = str(payload["sub"])
            cached_user = _cache.get(f"auth_user:{user_id}")
            if cached_user is not None and getattr(cached_user, "role", "") not in ("Finance", "Finance Team"):
                user = cached_user
            else:
                with get_session() as sess:
                    user = sess.query(User).filter(User.id == user_id).first()
                    if not user:
                        # Fallback query by email if sub was an email
                        user = sess.query(User).filter(User.email == user_id).first()
    except Exception as exc:
        logger.warning(f"[Auth] TermJobs token decoding attempt failed: {exc}")

    # 2. Secondary: Standalone token decoding (for test harness or standalone runner)
    if not user:
        try:
            payload = decode_token(token, settings.jwt_secret_key, settings.jwt_algorithm)
            if payload:
                user_id = payload.get("sub") or payload.get("user_id") or payload.get("id")
                tenant_id = payload.get("tenant_id")
                role = payload.get("role", "Hiring Manager")
                if user_id and tenant_id:
                    user_role = role
                    allowed_roles = ("Hiring Manager", "Admin", "Super Admin", "HR", "Director")
                    if user_role not in allowed_roles:
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail=f"Access Denied: Role '{user_role}' is not authorized for Aura Hiring Assistant."
                        )
                    perms = ["hiring_manager_read", "hiring_manager_write"]
                    if user_role in ("Admin", "Super Admin"):
                        perms.extend(["admin_manage", "all_access"])

                    return AuthenticatedUser(
                        user_id=str(user_id),
                        tenant_id=str(tenant_id),
                        email=payload.get("email", ""),
                        role=user_role,
                        name=payload.get("name", ""),
                        department=payload.get("department", "Hiring") or "Hiring",
                        permissions=perms
                    )
        except HTTPException:
            raise
        except Exception:
            pass

    if not user or getattr(user, 'is_deleted', False):
        if settings.test_mode:
            return dev_fallback_user
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    # Validate role authorization
    user_role = getattr(user, "role", "")
    allowed_roles = ("Hiring Manager", "Admin", "Super Admin", "HR", "Director")
    if user_role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access Denied: Role '{user_role}' is not authorized for Aura Hiring Assistant."
        )

    tenant_id = getattr(user, "tenant_id", None)
    if not tenant_id or tenant_id in ("local", "all"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: A verified company tenant is required."
        )

    perms = ["hiring_manager_read", "hiring_manager_write"]
    if user_role in ("Admin", "Super Admin"):
        perms.extend(["admin_manage", "all_access"])

    return AuthenticatedUser(
        user_id=str(user.id),
        tenant_id=str(tenant_id),
        email=getattr(user, "email", ""),
        role=user_role,
        department=getattr(user, "department", "Hiring") or "Hiring",
        permissions=perms
    )


def get_audit_logger(db=Depends(get_db), settings: Settings = Depends(get_settings)) -> AuditLogger:
    global _audit_logger
    if _audit_logger is None:
        _audit_logger = AuditLogger(db_client=db, test_mode=(db is None or settings.test_mode))
    return _audit_logger


def get_proposal_service(db=Depends(get_db), settings: Settings = Depends(get_settings)) -> ProposalService:
    global _proposal_service
    if _proposal_service is None:
        _proposal_service = ProposalService(db_client=db, test_mode=(db is None or settings.test_mode))
    return _proposal_service


def get_llm_client(settings: Settings = Depends(get_settings)) -> BaseLLMClient:
    global _llm_client
    if _llm_client is None:
        if settings.test_mode:
            _llm_client = MockLLMClient()
        else:
            api_key = settings.openrouter_api_key or settings.openai_api_key
            _llm_client = OpenRouterLLMClient(
                api_key=api_key,
                preferred_model=settings.openrouter_model,
                api_base=settings.openrouter_api_base
            )
    return _llm_client
