import uuid
from datetime import datetime
from pydantic import BaseModel
from app.schemas.user import UserSummary


class ThreadCreate(BaseModel):
    subject: str
    recipient_ids: list[uuid.UUID]
    course_id: uuid.UUID | None = None
    initial_message: str


class MessageCreate(BaseModel):
    body: str


class MessageRead(BaseModel):
    id: uuid.UUID
    sender_id: uuid.UUID
    body: str
    sent_at: datetime

    model_config = {"from_attributes": True}


class ThreadRead(BaseModel):
    id: uuid.UUID
    subject: str
    course_id: uuid.UUID | None
    created_by: uuid.UUID
    unread_count: int = 0
    last_message: MessageRead | None = None
    participants: list[UserSummary] = []
    created_at: datetime

    model_config = {"from_attributes": True}


class ThreadDetailRead(ThreadRead):
    messages: list[MessageRead]
