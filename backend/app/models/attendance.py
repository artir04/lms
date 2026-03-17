import uuid
from datetime import date
from typing import TYPE_CHECKING
from sqlalchemy import String, Date, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base, UUIDPrimaryKeyMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models.course import Course, Section
    from app.models.user import User
    from app.models.tenant import District


class AttendanceStatus:
    PRESENT = "present"
    ABSENT = "absent"
    TARDY = "tardy"


class Attendance(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "attendance"
    __table_args__ = (UniqueConstraint("course_id", "student_id", "date"),)

    course_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("courses.id"), nullable=False, index=True)
    section_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("sections.id"), nullable=True)
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    teacher_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(10), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("districts.id"), nullable=False, index=True)

    course: Mapped["Course"] = relationship("Course", foreign_keys=[course_id])
    section: Mapped["Section | None"] = relationship("Section", foreign_keys=[section_id])
    student: Mapped["User"] = relationship("User", foreign_keys=[student_id])
    teacher: Mapped["User"] = relationship("User", foreign_keys=[teacher_id])
    district: Mapped["District"] = relationship("District", foreign_keys=[tenant_id])
