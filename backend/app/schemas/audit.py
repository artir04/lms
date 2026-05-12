import uuid
from datetime import datetime
from pydantic import BaseModel


class AuditLogRead(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    actor_user_id: uuid.UUID | None
    actor_email: str | None
    actor_role: str | None
    action: str
    target_type: str | None
    target_id: uuid.UUID | None
    summary: str | None
    ip_address: str | None
    user_agent: str | None
    event_metadata: dict | None
    created_at: datetime

    model_config = {"from_attributes": True}
