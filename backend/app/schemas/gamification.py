import uuid
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field


class BadgeRead(BaseModel):
    id: uuid.UUID
    name: str
    description: str
    icon: str
    category: str
    criteria_type: str
    criteria_value: int

    model_config = {"from_attributes": True}


class UserBadgeRead(BaseModel):
    id: uuid.UUID
    badge: BadgeRead
    earned_at: datetime

    model_config = {"from_attributes": True}


class PointEntryRead(BaseModel):
    id: uuid.UUID
    points: int
    reason: str
    resource_id: uuid.UUID | None
    created_at: datetime

    model_config = {"from_attributes": True}


class StudentPoints(BaseModel):
    total_points: int
    badges: list[UserBadgeRead]
    recent_points: list[PointEntryRead]


class LeaderboardEntry(BaseModel):
    student_id: uuid.UUID
    student_name: str
    avatar_url: str | None
    total_points: int
    badge_count: int
    rank: int


class ActivityCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1, max_length=2000)
    points: int = Field(ge=1, le=1000, default=10)
    category: str = Field(min_length=1, max_length=50, default="general")
    course_id: uuid.UUID | None = None
    is_active: bool = True


class ActivityUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, min_length=1, max_length=2000)
    points: int | None = Field(default=None, ge=1, le=1000)
    category: str | None = Field(default=None, min_length=1, max_length=50)
    course_id: uuid.UUID | None = None
    is_active: bool | None = None


class ActivityRead(BaseModel):
    id: uuid.UUID
    title: str
    description: str
    points: int
    category: str
    course_id: uuid.UUID | None
    created_by: uuid.UUID
    is_active: bool
    created_at: datetime
    completed: bool = False
    completed_at: datetime | None = None
    completion_count: int = 0

    model_config = {"from_attributes": True}
