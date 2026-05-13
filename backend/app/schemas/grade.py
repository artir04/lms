import uuid
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field


class GradeEntryRead(BaseModel):
    id: uuid.UUID
    student_id: uuid.UUID
    course_id: uuid.UUID
    quiz_id: uuid.UUID | None
    category: str
    label: str | None
    grade: int  # 1-5
    weight: Decimal
    feedback: str | None = None
    posted_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class GradeEntryCreate(BaseModel):
    student_id: uuid.UUID
    category: str = "assignment"
    label: str | None = None
    grade: int = Field(ge=1, le=5)
    weight: Decimal = Decimal("0")  # 0 = auto-compute from course category config
    feedback: str | None = None


class GradeEntryUpdate(BaseModel):
    grade: int | None = Field(default=None, ge=1, le=5)
    category: str | None = None
    label: str | None = None
    weight: Decimal | None = None
    feedback: str | None = None


class GradeBookRow(BaseModel):
    student_id: uuid.UUID
    student_name: str
    email: str
    grades: list[GradeEntryRead]
    weighted_average: Decimal  # weighted average (1.0 - 5.0)
    final_grade: int | None  # rounded to nearest integer 1-5


class GradeBookRead(BaseModel):
    course_id: uuid.UUID
    course_title: str
    rows: list[GradeBookRow]


class StudentGradeSummary(BaseModel):
    course_id: uuid.UUID
    course_title: str
    weighted_average: Decimal  # 1.0 - 5.0
    final_grade: int | None  # rounded integer 1-5
    entries: list[GradeEntryRead]
