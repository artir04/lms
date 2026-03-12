import uuid
from typing import TYPE_CHECKING
from sqlalchemy import String, Boolean, JSON, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base, UUIDPrimaryKeyMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.course import Course


class District(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "districts"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    sso_provider: Mapped[str | None] = mapped_column(String(50), nullable=True)
    sso_config: Mapped[dict] = mapped_column(JSON, default=dict)
    settings: Mapped[dict] = mapped_column(JSON, default=dict)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    schools: Mapped[list["School"]] = relationship("School", back_populates="district", cascade="all, delete-orphan")
    users: Mapped[list["User"]] = relationship("User", back_populates="district")


class School(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "schools"

    district_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("districts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str] = mapped_column(String(20), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    district: Mapped["District"] = relationship("District", back_populates="schools")
    users: Mapped[list["User"]] = relationship("User", back_populates="school")
