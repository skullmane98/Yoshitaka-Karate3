"""Async SQLAlchemy / SQLModel engine + session dependency.

DATABASE_URL format (async):
  mysql+aiomysql://user:pass@host:port/dbname

Hardened for Hostinger shared MySQL which aggressively closes idle connections
(typically after ~60-300s) and occasionally drops mid-query.
"""
import os
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlmodel import SQLModel

DATABASE_URL = os.environ["DATABASE_URL"]

# Aggressive resilience for Hostinger shared MySQL:
# - pool_pre_ping: test every connection before using it (catches dropped sockets)
# - pool_recycle=280: recycle BEFORE Hostinger's typical 300s wait_timeout
# - pool_size=5, max_overflow=5: small pool — Hostinger limits concurrent connections
# - connect timeout: don't hang forever if MySQL is slow to handshake
engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    pool_recycle=280,
    pool_size=5,
    max_overflow=5,
    connect_args={"connect_timeout": 10},
)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise


async def init_db() -> None:
    """Create tables if they don't exist. For production, swap to Alembic migrations."""
    # Import models so SQLModel.metadata knows about them before create_all.
    from models import (  # noqa: F401
        User,
        AccessCode,
        Payment,
        PaymentReminder,
        Attendance,
        CMSPage,
        PasswordResetToken,
    )
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
