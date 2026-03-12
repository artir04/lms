import uuid
from datetime import datetime
from pydantic import BaseModel


class ModuleCreate(BaseModel):
    title: str
    position: int = 0
    is_locked: bool = False


class ModuleUpdate(BaseModel):
    title: str | None = None
    position: int | None = None
    is_locked: bool | None = None


class ModuleRead(BaseModel):
    id: uuid.UUID
    course_id: uuid.UUID
    title: str
    position: int
    is_locked: bool
    lesson_count: int = 0

    model_config = {"from_attributes": True}


class LessonCreate(BaseModel):
    title: str
    content_type: str = "text"  # text | video | pdf | embed
    body: str | None = None
    video_url: str | None = None
    position: int = 0
    duration_min: int | None = None


class LessonUpdate(BaseModel):
    title: str | None = None
    content_type: str | None = None
    body: str | None = None
    video_url: str | None = None
    position: int | None = None
    duration_min: int | None = None


class LessonRead(BaseModel):
    id: uuid.UUID
    module_id: uuid.UUID
    title: str
    content_type: str
    body: str | None
    video_url: str | None
    position: int
    duration_min: int | None
    created_at: datetime

    model_config = {"from_attributes": True}


class AttachmentRead(BaseModel):
    id: uuid.UUID
    filename: str
    mime_type: str
    size_bytes: int
    url: str

    model_config = {"from_attributes": True}
