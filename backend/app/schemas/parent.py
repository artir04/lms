import uuid
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel

from app.schemas.user import UserSummary


class ParentStudentLink(BaseModel):
    parent_id: uuid.UUID
    student_id: uuid.UUID


class ChildSummary(BaseModel):
    student: UserSummary
    course_count: int
    overall_average: Decimal | None
    attendance_rate: Decimal | None


class ParentDigest(BaseModel):
    children: list[ChildSummary]


class ChildProgressDetail(BaseModel):
    student: UserSummary
    courses: list["ChildCourseProgress"]
    upcoming_assignments: list["UpcomingItem"]
    attendance_summary: "ChildAttendanceSummary"


class ChildCourseProgress(BaseModel):
    course_id: uuid.UUID
    course_title: str
    weighted_average: Decimal | None  # 1.0 - 5.0 weighted average
    final_grade: int | None  # rounded to nearest 1-5
    entry_count: int


class UpcomingItem(BaseModel):
    quiz_id: uuid.UUID
    quiz_title: str
    course_title: str
    due_at: datetime | None
    is_submitted: bool


class ChildAttendanceSummary(BaseModel):
    total_days: int
    present: int
    absent: int
    tardy: int
    attendance_rate: Decimal


# Allow forward references
ChildProgressDetail.model_rebuild()
