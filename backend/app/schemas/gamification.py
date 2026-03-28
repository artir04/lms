import uuid
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel


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
