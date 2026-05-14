"""Async SQLAlchemy / SQLModel engine + session dependency.

DATABASE_URL format (async):
  mysql+aiomysql://user:pass@host:port/dbname

Configured with NullPool to avoid the aiomysql "TCPTransport closed" bug, which
fires when a pooled connection survives across asyncio event loops (common on
Render free tier and any environment that may dispose the loop). NullPool opens
a fresh connection per request — slightly slower, fully reliable on Hostinger
shared MySQL.
"""
import os
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool
from sqlmodel import SQLModel

DATABASE_URL = os.environ["DATABASE_URL"]

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    poolclass=NullPool,
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
    """Create tables if they don't exist + lightweight column migrations."""
    # Import models so SQLModel.metadata knows about them before create_all.
    from models import (  # noqa: F401
        User,
        AccessCode,
        Payment,
        PaymentReminder,
        Attendance,
        CMSPage,
        PasswordResetToken,
        RolePermission,
        UserPermissionOverride,
        Notification,
        BlogPost,
    )
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    # Add new columns to existing tables (idempotent — ignore "duplicate column")
    await _migrate_add_columns()


async def _migrate_add_columns() -> None:
    """Lightweight per-column migration for already-deployed MySQL databases.

    Adds new optional User columns without nuking existing data. Safe to run on
    every boot — duplicate-column errors are swallowed.
    """
    from sqlalchemy import text
    additions = [
        ("users", "date_of_birth", "VARCHAR(32) NULL"),
        ("users", "address", "TEXT NULL"),
        ("users", "emergency_contact_name", "VARCHAR(255) NULL"),
        ("users", "emergency_contact_phone", "VARCHAR(64) NULL"),
        ("users", "medical_notes", "TEXT NULL"),
        ("users", "notes", "TEXT NULL"),
        ("users", "photo_url", "TEXT NULL"),
        ("users", "idcard_template", "VARCHAR(32) NULL"),
        ("users", "idcard_overrides", "JSON NULL"),
        ("users", "username", "VARCHAR(64) NULL"),
        ("users", "qr_code", "VARCHAR(64) NULL"),
    ]
    async with engine.begin() as conn:
        for table, col, spec in additions:
            try:
                await conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {spec}"))
            except Exception:
                # Column likely already exists — ignore.
                pass
        # Unique indexes (idempotent — duplicate errors ignored)
        for stmt in (
            "CREATE UNIQUE INDEX ix_users_username ON users (username)",
            "CREATE UNIQUE INDEX ix_users_qr_code ON users (qr_code)",
        ):
            try:
                await conn.execute(text(stmt))
            except Exception:
                pass
