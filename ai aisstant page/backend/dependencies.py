"""FastAPI dependencies for authentication, database session, and services."""
from typing import Optional
from fastapi import Depends, Header, HTTPException, status
from .config import Settings, get_settings
from .security.authentication import AuthenticatedUser, AuthenticationError, authenticate_bearer_token
from .audit.logger import AuditLogger
from .proposals.service import ProposalService
from .tools.registry import registry
from .agent.llm_client import BaseLLMClient, OpenRouterLLMClient, MockLLMClient

# Shared singletons for standalone runner
_mongo_client = None
_audit_logger = None
_proposal_service = None
_llm_client = None


def get_db():
    """Return database handle or None if running offline."""
    global _mongo_client
    settings = get_settings()
    if settings.test_mode:
        return None
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
    """Dependency validating the incoming Bearer token."""
    return authenticate_bearer_token(
        authorization_header=authorization,
        secret_key=settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
        test_mode=(settings.test_mode or settings.environment == "development")
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
