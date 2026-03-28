import uuid
from datetime import datetime
from sqlalchemy import String, Integer, DateTime, ForeignKey, Boolean
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
    reason: Mapped[str] = mapped_column(String(100), nullable=False)  # quiz_completed, lesson_viewed, perfect_score, streak_bonus
    resource_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])
