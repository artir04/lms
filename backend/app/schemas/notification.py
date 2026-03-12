import uuid
from datetime import datetime
from pydantic import BaseModel


class NotificationRead(BaseModel):
    id: uuid.UUID
    type: str
    payload: dict
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class MarkReadRequest(BaseModel):
    notification_ids: list[uuid.UUID]


class NotificationPreferenceUpdate(BaseModel):
    email_enabled: bool | None = None
    push_enabled: bool | None = None
    grade_notifications: bool | None = None
    message_notifications: bool | None = None
    deadline_notifications: bool | None = None
