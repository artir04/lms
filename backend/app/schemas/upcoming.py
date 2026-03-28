import uuid
from datetime import datetime
from pydantic import BaseModel


class UpcomingAssignment(BaseModel):
    quiz_id: uuid.UUID
    quiz_title: str
    course_id: uuid.UUID
    course_title: str
    due_at: datetime | None
    time_limit_min: int | None
    max_attempts: int
    attempts_used: int
    is_overdue: bool
