import uuid
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel


class GradeEntryRead(BaseModel):
    id: uuid.UUID
    student_id: uuid.UUID
    course_id: uuid.UUID
    quiz_id: uuid.UUID | None
    category: str
    raw_score: Decimal
    max_score: Decimal
    percentage: Decimal
    letter_grade: str | None
    posted_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class GradeEntryUpdate(BaseModel):
    raw_score: Decimal | None = None
    letter_grade: str | None = None


class GradeBookRow(BaseModel):
    student_id: uuid.UUID
    student_name: str
    email: str
    grades: list[GradeEntryRead]
    course_average: Decimal
    letter_grade: str | None


class GradeBookRead(BaseModel):
    course_id: uuid.UUID
    course_title: str
    rows: list[GradeBookRow]


class StudentGradeSummary(BaseModel):
    course_id: uuid.UUID
    course_title: str
    average: Decimal
    letter_grade: str | None
    entries: list[GradeEntryRead]
