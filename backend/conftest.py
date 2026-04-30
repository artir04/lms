"""Project-wide pytest configuration.

Test database
-------------
Integration tests run against a dedicated PostgreSQL database (default name
``lms_test``) on the same instance used in development. The fixtures below
auto-create the database, run create_all once per test session, and TRUNCATE
all tables before each test for isolation.

Override the URL via ``TEST_DATABASE_URL``.
"""

from __future__ import annotations

import asyncio
import os
import uuid
from typing import AsyncGenerator
from urllib.parse import urlparse, urlunparse

import asyncpg
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool


# ─────────────────────────────────────────────────────────────────────────────
# Test database URL — set BEFORE any app.* import.
# ─────────────────────────────────────────────────────────────────────────────

DEFAULT_TEST_DB_URL = (
    "postgresql+asyncpg://lms_user:lms_password@localhost:5432/lms_test"
)
TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL", DEFAULT_TEST_DB_URL)

os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ.setdefault("SECRET_KEY", "test-secret-key-do-not-use-in-prod")
os.environ.setdefault("APP_ENV", "development")


def _server_url(test_url: str) -> tuple[str, str]:
    parsed = urlparse(test_url.replace("+asyncpg", ""))
    db_name = parsed.path.lstrip("/")
    server = urlunparse(parsed._replace(path="/postgres"))
    return server, db_name


async def _ensure_test_database() -> None:
    server_url, db_name = _server_url(TEST_DATABASE_URL)
    conn = await asyncpg.connect(server_url)
    try:
        exists = await conn.fetchval(
            "SELECT 1 FROM pg_database WHERE datname = $1", db_name
        )
        if not exists:
            await conn.execute(f'CREATE DATABASE "{db_name}"')
    finally:
        await conn.close()


# ─────────────────────────────────────────────────────────────────────────────
# Engine + schema (session-wide). Tables are created once and dropped at end.
# ─────────────────────────────────────────────────────────────────────────────


@pytest_asyncio.fixture(scope="session")
async def _engine():
    await _ensure_test_database()

    from app.db.base import Base
    from app import models  # noqa: F401  ensure all mappers are registered

    engine = create_async_engine(TEST_DATABASE_URL, future=True, poolclass=NullPool)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


# ─────────────────────────────────────────────────────────────────────────────
# Per-test isolation: truncate every table before each test.
# ─────────────────────────────────────────────────────────────────────────────


@pytest_asyncio.fixture
async def _clean_db(_engine):
    from app.db.base import Base

    async with _engine.begin() as conn:
        # Disable FK checks for the truncate cycle.
        names = ", ".join(
            f'"{t.name}"' for t in reversed(Base.metadata.sorted_tables)
        )
        await conn.execute(text(f"TRUNCATE TABLE {names} RESTART IDENTITY CASCADE"))
    yield


@pytest_asyncio.fixture
async def db_session(_clean_db, _engine) -> AsyncGenerator[AsyncSession, None]:
    Session = async_sessionmaker(bind=_engine, expire_on_commit=False)
    async with Session() as session:
        yield session


# ─────────────────────────────────────────────────────────────────────────────
# Domain fixtures
# ─────────────────────────────────────────────────────────────────────────────


ROLE_NAMES = ["superadmin", "admin", "teacher", "parent", "student"]


@pytest_asyncio.fixture
async def seeded_roles(db_session: AsyncSession) -> dict[str, int]:
    from app.models.user import Role

    out: dict[str, int] = {}
    for name in ROLE_NAMES:
        role = Role(name=name)
        db_session.add(role)
        await db_session.flush()
        out[name] = role.id
    await db_session.commit()
    return out


@pytest_asyncio.fixture
async def tenant(db_session: AsyncSession):
    from app.models.tenant import District

    district = District(name="Test District", slug="test-district", is_active=True)
    db_session.add(district)
    await db_session.commit()
    await db_session.refresh(district)
    return district


@pytest_asyncio.fixture
async def make_user(db_session: AsyncSession, seeded_roles, tenant):
    """Factory fixture that commits each user so the FastAPI app can see them."""
    from app.core.security import hash_password
    from app.models.user import User, UserRole

    async def _factory(
        *,
        email: str | None = None,
        password: str = "Passw0rd!",
        first_name: str = "Test",
        last_name: str = "User",
        roles: list[str] | None = None,
    ):
        roles = roles or ["student"]
        user = User(
            tenant_id=tenant.id,
            email=email or f"u-{uuid.uuid4().hex[:8]}@example.com",
            password_hash=hash_password(password),
            first_name=first_name,
            last_name=last_name,
            is_active=True,
        )
        db_session.add(user)
        await db_session.flush()
        for role_name in roles:
            db_session.add(UserRole(user_id=user.id, role_id=seeded_roles[role_name]))
        await db_session.commit()
        await db_session.refresh(user)
        return user

    return _factory


# ─────────────────────────────────────────────────────────────────────────────
# HTTP client fixture — uses the same engine, but its OWN session per request.
# ─────────────────────────────────────────────────────────────────────────────


@pytest_asyncio.fixture
async def client(_engine) -> AsyncGenerator[AsyncClient, None]:
    """An httpx AsyncClient bound to the FastAPI app, with get_db pointed at
    the test engine."""
    from app.db.session import get_db
    from app.main import app

    Session = async_sessionmaker(bind=_engine, expire_on_commit=False)

    async def _override_get_db():
        async with Session() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = _override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.pop(get_db, None)


@pytest_asyncio.fixture
async def auth_headers_for(client: AsyncClient, tenant):
    async def _login(email: str, password: str = "Passw0rd!") -> dict[str, str]:
        resp = await client.post(
            "/api/v1/auth/login",
            json={
                "email": email,
                "password": password,
                "tenant_slug": tenant.slug,
            },
        )
        assert resp.status_code == 200, resp.text
        token = resp.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    return _login
