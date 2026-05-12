from __future__ import annotations

import os
import uuid
from decimal import Decimal
from datetime import datetime, timezone
from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

os.environ.setdefault("SECRET_KEY", "test-secret-key-do-not-use-in-prod")
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/lms_test")

from app.db.base import Base  # noqa: E402


@pytest.fixture(scope="session")
def engine():
    db_url = os.environ.get("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/lms_test")
    return create_async_engine(db_url, echo=False)


@pytest_asyncio.fixture
async def db_session(engine) -> AsyncGenerator[AsyncSession, None]:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        yield session
        await session.rollback()


@pytest.fixture
def tenant_id() -> uuid.UUID:
    return uuid.uuid4()


@pytest.fixture
def student_id() -> uuid.UUID:
    return uuid.uuid4()


@pytest.fixture
def course_id() -> uuid.UUID:
    return uuid.uuid4()


@pytest.fixture
def sample_grade_entries(student_id, course_id):
    """Return a list of GradeEntry-like objects for _weighted_average testing."""
    from app.models.grade import GradeEntry

    return [
        GradeEntry(
            student_id=student_id,
            course_id=course_id,
            category="exam",
            label="Midterm",
            grade=5,
            weight=Decimal("0.30"),
        ),
        GradeEntry(
            student_id=student_id,
            course_id=course_id,
            category="exam",
            label="Final",
            grade=3,
            weight=Decimal("0.30"),
        ),
        GradeEntry(
            student_id=student_id,
            course_id=course_id,
            category="assignment",
            label="Homework",
            grade=4,
            weight=Decimal("0.40"),
        ),
    ]
