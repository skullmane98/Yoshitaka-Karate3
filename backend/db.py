"""Async SQLAlchemy / SQLModel engine + session dependency.

DATABASE_URL format (async):
  mysql+aiomysql://user:pass@host:port/dbname
"""
import os
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlmodel import SQLModel

DATABASE_URL = os.environ["DATABASE_URL"]

# pool_pre_ping avoids stale-connection errors on shared hosts (e.g. Hostinger).
engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    pool_recycle=1800,
)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        yield session


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
