import uuid
from datetime import datetime
from sqlalchemy import String, Integer, DateTime, ForeignKey, Boolean, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base, UUIDPrimaryKeyMixin, TimestampMixin


class Badge(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "badges"

    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    icon: Mapped[str] = mapped_column(String(50), nullable=False)  # lucide icon name
    category: Mapped[str] = mapped_column(String(50), nullable=False)  # academic, attendance, engagement
    criteria_type: Mapped[str] = mapped_column(String(50), nullable=False)  # quiz_score, streak, completion
    criteria_value: Mapped[int] = mapped_column(Integer, nullable=False)  # threshold value


class UserBadge(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "user_badges"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    badge_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("badges.id", ondelete="CASCADE"), nullable=False)
    earned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])
    badge: Mapped["Badge"] = relationship("Badge", foreign_keys=[badge_id])


class PointEntry(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "point_entries"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    points: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str] = mapped_column(String(100), nullable=False)  # quiz_completed, lesson_viewed, perfect_score, streak_bonus, activity_completed
    resource_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])


class Activity(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "gamification_activities"

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(String(2000), nullable=False)
    points: Mapped[int] = mapped_column(Integer, nullable=False, default=10)
    category: Mapped[str] = mapped_column(String(50), nullable=False, default="general")
    course_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("courses.id", ondelete="SET NULL"), nullable=True, index=True)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("districts.id", ondelete="CASCADE"), nullable=False, index=True)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    creator: Mapped["User"] = relationship("User", foreign_keys=[created_by])


class ActivityCompletion(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "activity_completions"
    __table_args__ = (
        UniqueConstraint("activity_id", "user_id", name="uq_activity_completion_user"),
    )

    activity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("gamification_activities.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    activity: Mapped["Activity"] = relationship("Activity", foreign_keys=[activity_id])
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])
