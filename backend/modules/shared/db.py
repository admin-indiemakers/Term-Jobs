"""SQLAlchemy engine, session factory and declarative base.

Uses a synchronous engine for MVP simplicity. Swap for an async engine when
the API layer lands.
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import settings


class Base(DeclarativeBase):
    pass


engine = create_engine(settings.database_url, echo=False, future=True)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False, future=True)


def get_session():
    return SessionLocal()


def init_db():
    """Create tables from metadata. Used for tests and quick local runs;
    production schema changes flow through Alembic."""
    import modules.requisition.domain.models  # noqa: F401  (register models)

    Base.metadata.create_all(bind=engine)