import uuid
from datetime import datetime
from pydantic import BaseModel


class CsvImportRow(BaseModel):
    email: str
    first_name: str
    last_name: str
    status: str  # "enrolled" | "created_and_enrolled" | "skipped" | "error"
    detail: str | None = None


class CsvImportResult(BaseModel):
    total_rows: int
    created_users: int
    enrolled: int
    skipped: int
    errors: int
    rows: list[CsvImportRow]


class EnrollmentTransfer(BaseModel):
    student_id: uuid.UUID
    from_section_id: uuid.UUID
    to_section_id: uuid.UUID


class EnrollmentHistoryEntry(BaseModel):
    action: str
    target_id: uuid.UUID | None
    summary: str | None
    actor_email: str | None
    event_metadata: dict | None
    created_at: datetime
