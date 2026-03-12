import uuid
from datetime import datetime
from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    email: EmailStr
    password: str | None = None
    first_name: str
    last_name: str
    school_id: uuid.UUID | None = None
    roles: list[str] = ["student"]


class UserUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    avatar_url: str | None = None
    school_id: uuid.UUID | None = None
    is_active: bool | None = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


class UserRead(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    school_id: uuid.UUID | None
    email: str
    first_name: str
    last_name: str
    full_name: str
    avatar_url: str | None
    is_active: bool
    roles: list[str]
    last_login_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class UserSummary(BaseModel):
    id: uuid.UUID
    full_name: str
    email: str
    avatar_url: str | None
    roles: list[str]

    model_config = {"from_attributes": True}
