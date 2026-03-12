from datetime import date
from decimal import Decimal
from pydantic import BaseModel
import uuid


class DashboardSummary(BaseModel):
    total_students: int
    total_courses: int
    avg_grade: Decimal
    active_users_today: int
    at_risk_count: int


class EngagementPoint(BaseModel):
    date: date
    logins: int
    lesson_views: int
    submissions: int


class EngagementReport(BaseModel):
    points: list[EngagementPoint]


class AtRiskStudent(BaseModel):
    student_id: uuid.UUID
    student_name: str
    email: str
    course_average: Decimal
    last_login: date | None
    missing_assignments: int


class GradeDistributionBucket(BaseModel):
    label: str  # A, B, C, D, F
    count: int
    percentage: Decimal


class GradeDistribution(BaseModel):
    course_id: uuid.UUID
    buckets: list[GradeDistributionBucket]
    mean: Decimal
    median: Decimal
