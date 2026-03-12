import uuid
from datetime import date, datetime
from pydantic import BaseModel
from app.schemas.user import UserSummary


class CourseCreate(BaseModel):
    title: str
    description: str | None = None
    subject: str | None = None
    grade_level: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    school_id: uuid.UUID | None = None


class CourseUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    subject: str | None = None
    grade_level: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    is_published: bool | None = None


class CourseRead(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    title: str
    description: str | None
    subject: str | None
    grade_level: str | None
    start_date: date | None
    end_date: date | None
    is_published: bool
    teacher: UserSummary
    created_at: datetime

    model_config = {"from_attributes": True}


class SectionCreate(BaseModel):
    name: str
    capacity: int | None = None


class SectionRead(BaseModel):
    id: uuid.UUID
    course_id: uuid.UUID
    name: str
    capacity: int | None
    enrollment_count: int = 0

    model_config = {"from_attributes": True}


class EnrollmentCreate(BaseModel):
    student_id: uuid.UUID


class EnrollmentRead(BaseModel):
    id: uuid.UUID
    section_id: uuid.UUID
    student: UserSummary
    status: str
    enrolled_at: datetime | None

    model_config = {"from_attributes": True}
