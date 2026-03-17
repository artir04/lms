import uuid
from datetime import date, datetime
from pydantic import BaseModel
from app.schemas.user import UserSummary


class AttendanceCreate(BaseModel):
    date: date
    student_id: uuid.UUID
    status: str
    notes: str | None = None


class AttendanceUpdate(BaseModel):
    status: str | None = None
    notes: str | None = None


class AttendanceRead(BaseModel):
    id: uuid.UUID
    date: date
    student: UserSummary
    status: str
    notes: str | None
    teacher: UserSummary
    created_at: datetime

    model_config = {"from_attributes": True}


class AttendanceReportRow(BaseModel):
    student_id: uuid.UUID
    student_name: str
    email: str
    attendance_count: int
    present_count: int
    absent_count: int
    tardy_count: int
    attendance_rate: float


class AttendanceReport(BaseModel):
    course_id: uuid.UUID
    date_range_start: date | None
    date_range_end: date | None
    rows: list[AttendanceReportRow]


class MarkAttendanceRequest(BaseModel):
    date: date
    records: list[AttendanceCreate]


class StudentAttendanceSummary(BaseModel):
    course_id: uuid.UUID
    course_title: str
    attendance_records: list[AttendanceRead]
    attendance_rate: float
