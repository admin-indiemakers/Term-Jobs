import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from modules.shared.db import Base
from modules.identity.domain.models import User, Tenant
from modules.requisition.domain.models import CompanyProfile
from modules.identity.domain.schemas import UserRegister, UserLogin
from modules.identity.services.auth_service import hash_password, verify_password, decode_access_token
from modules.identity.router import register_user, login_user

@pytest.fixture
def session_factory():
    engine = create_engine(
        "sqlite:///:memory:", connect_args={"check_same_thread": False}, future=True
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False, future=True)
    return factory

def test_password_hashing():
    pwd = "my-secure-password"
    hashed = hash_password(pwd)
    assert hashed != pwd
    assert verify_password(pwd, hashed) is True
    assert verify_password("wrong-password", hashed) is False

def test_user_registration_with_company_profile(session_factory):
    reg = UserRegister(
        email="test@example.com",
        name="Test User",
        password="password123",
        role="Hiring Manager",
        company_name="Acme Corp",
        tenant_type="client",
        industry="Fintech",
        size="51-200",
        location="Bangalore",
        tech_stack=["Python", "FastAPI", "PostgreSQL"],
        notes="High-performance backend workforce"
    )
    
    with session_factory() as session:
        # Run register API function logic
        res = register_user(reg, db=session)
        assert res.access_token is not None
        assert res.user.email == "test@example.com"
        assert res.user.name == "Test User"
        assert res.user.role == "Hiring Manager"
        assert res.user.tenant_name == "Acme Corp"
        assert res.user.tenant_type == "client"
        assert res.user.industry == "Fintech"
        assert res.user.size == "51-200"
        assert res.user.location == "Bangalore"
        assert res.user.tech_stack == ["Python", "FastAPI", "PostgreSQL"]
        assert res.user.notes == "High-performance backend workforce"

        # Verify User DB record
        user_db = session.query(User).filter(User.email == "test@example.com").first()
        assert user_db is not None
        assert user_db.name == "Test User"
        assert verify_password("password123", user_db.password_hash) is True

        # Verify linked CompanyProfile DB record
        profile_db = session.query(CompanyProfile).filter(CompanyProfile.tenant_id == res.user.tenant_id).first()
        assert profile_db is not None
        assert profile_db.name == "Acme Corp"
        assert profile_db.industry == "Fintech"
        assert profile_db.tech_stack == ["Python", "FastAPI", "PostgreSQL"]

def test_user_login(session_factory):
    reg = UserRegister(
        email="login@example.com",
        name="Login User",
        password="securepass123",
        role="Recruiter",
        company_name="Consulting Org",
        tenant_type="consultancy",
        industry="Recruitment",
        size="10-50",
        location="Remote",
        tech_stack=["React", "Node.js"],
        notes="Talent acquisition consultants"
    )
    
    with session_factory() as session:
        register_user(reg, db=session)
        
        # Valid login
        login = UserLogin(email="login@example.com", password="securepass123")
        res = login_user(login, db=session)
        assert res.access_token is not None
        assert res.user.role == "Recruiter"
        assert res.user.tenant_name == "Consulting Org"
        assert res.user.tenant_type == "consultancy"
        assert res.user.tech_stack == ["React", "Node.js"]

        # Decode token and verify content
        payload = decode_access_token(res.access_token)
        assert payload is not None
        assert payload["email"] == "login@example.com"
        assert payload["role"] == "Recruiter"
        
        # Invalid login
        with pytest.raises(Exception):
            invalid_login = UserLogin(email="login@example.com", password="wrongpassword")
            login_user(invalid_login, db=session)
