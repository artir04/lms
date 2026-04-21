import uuid
from typing import TYPE_CHECKING
from sqlalchemy import String, SmallInteger, ForeignKey, UniqueConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base, UUIDPrimaryKeyMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models.user import User


class ParentChildRelationship(Base):
    """Lookup table for parent-child relationship types (mother, father, guardian, etc.)"""
    __tablename__ = "parent_child_relationships"

    id: Mapped[int] = mapped_column(SmallInteger, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)

    parent_child_links: Mapped[list["ParentChildLink"]] = relationship(
        "ParentChildLink", back_populates="relationship"
    )


class ParentChildLink(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Junction table linking parents to their children"""
    __tablename__ = "parent_child_links"
    __table_args__ = (
        # Ensure each parent-child pair is unique
        UniqueConstraint("parent_id", "student_id", name="uq_parent_student"),
        # Index for efficient queries by parent
        Index("idx_parent_child_parent_id", "parent_id"),
        # Index for efficient queries by student
        Index("idx_parent_child_student_id", "student_id"),
    )

    parent_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    relationship_id: Mapped[int] = mapped_column(
        SmallInteger, ForeignKey("parent_child_relationships.id", ondelete="RESTRICT"), nullable=False
    )
    is_primary_contact: Mapped[bool] = mapped_column(default=False, nullable=False)

    # Relationships
    parent: Mapped["User"] = relationship(
        "User", foreign_keys=[parent_id], back_populates="parent_children"
    )
    student: Mapped["User"] = relationship(
        "User", foreign_keys=[student_id], back_populates="student_parents"
    )
    relationship: Mapped["ParentChildRelationship"] = relationship(
        "ParentChildRelationship", back_populates="parent_child_links"
    )
