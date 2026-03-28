import uuid
from datetime import datetime
from decimal import Decimal
from sqlalchemy import String, Integer, Numeric, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base, UUIDPrimaryKeyMixin, TimestampMixin


class GradeEntry(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "grade_entries"

    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    course_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True)
    quiz_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("quizzes.id", ondelete="SET NULL"), nullable=True)
    submission_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("submissions.id", ondelete="SET NULL"), nullable=True)
    category: Mapped[str] = mapped_column(String(50), default="quiz")  # quiz | assignment | participation | exam
    label: Mapped[str | None] = mapped_column(String(120), nullable=True)  # e.g. "Test 1", "Midterm", "Homework 3"
    grade: Mapped[int] = mapped_column(Integer, nullable=False)  # Kosovo system: 1 (lowest) to 5 (highest)
    weight: Mapped[Decimal] = mapped_column(Numeric(4, 3), default=Decimal("1.0"))  # e.g. 0.30 = 30%
    posted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
