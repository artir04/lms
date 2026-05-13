import uuid
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel


class AssignmentCreate(BaseModel):
    title: str
    description: str | None = None
    due_at: datetime | None = None
    max_score: Decimal = Decimal("100")
    is_published: bool = False
    allows_file_upload: bool = False
    allowed_file_types: str | None = None


class AssignmentUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    due_at: datetime | None = None
    max_score: Decimal | None = None
    is_published: bool | None = None
    allows_file_upload: bool | None = None
    allowed_file_types: str | None = None


class AssignmentRead(BaseModel):
    id: uuid.UUID
    course_id: uuid.UUID
    title: str
    description: str | None
    due_at: datetime | None
    max_score: Decimal
    is_published: bool
    allows_file_upload: bool
    allowed_file_types: str | None
    created_at: datetime
    submission_count: int = 0
    has_submission: bool = False

    model_config = {"from_attributes": True}


class AssignmentSubmissionCreate(BaseModel):
    text_response: str | None = None
    file_urls: dict | None = None


class AssignmentSubmissionRead(BaseModel):
    id: uuid.UUID
    assignment_id: uuid.UUID
    student_id: uuid.UUID
    text_response: str | None
    file_urls: dict | None
    submitted_at: datetime | None
    score: Decimal | None
    status: str
    feedback: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class AssignmentSubmissionListItem(BaseModel):
    id: uuid.UUID
    assignment_id: uuid.UUID
    student_id: uuid.UUID
    student_name: str
    student_email: str
    submitted_at: datetime | None
    score: Decimal | None
    status: str

    model_config = {"from_attributes": True}


class AssignmentGradeRequest(BaseModel):
    score: Decimal
    feedback: str | None = None
