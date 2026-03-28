import uuid
from decimal import Decimal
from pydantic import BaseModel


class CourseReport(BaseModel):
    course_id: uuid.UUID
    course_title: str
    teacher_name: str
    enrolled_count: int
    avg_grade: Decimal | None
    completion_rate: Decimal | None
    avg_attendance_rate: Decimal | None


class AdminReport(BaseModel):
    total_students: int
    total_teachers: int
    total_courses: int
    total_parents: int
    active_users_30d: int
    avg_platform_grade: Decimal | None
    avg_attendance_rate: Decimal | None
    courses: list[CourseReport]
