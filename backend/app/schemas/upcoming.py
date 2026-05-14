import uuid
from datetime import datetime
from typing import Literal
from pydantic import BaseModel


class UpcomingAssignment(BaseModel):
    item_id: uuid.UUID
    item_type: Literal["quiz", "assignment"]
    title: str
    course_id: uuid.UUID
    course_title: str
    due_at: datetime | None
    is_overdue: bool
    time_limit_min: int | None = None
    max_attempts: int | None = None
    attempts_used: int | None = None
