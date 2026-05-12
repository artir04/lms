import uuid
from datetime import datetime
from pydantic import BaseModel


class DistrictCreate(BaseModel):
    name: str
    slug: str
    sso_provider: str | None = None
    sso_config: dict = {}
    settings: dict = {}


class DistrictUpdate(BaseModel):
    name: str | None = None
    sso_provider: str | None = None
    sso_config: dict | None = None
    settings: dict | None = None
    is_active: bool | None = None


class DistrictRead(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    sso_provider: str | None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class SchoolCreate(BaseModel):
    name: str
    code: str
    academic_year: str | None = None
    principal_id: uuid.UUID | None = None


class SchoolUpdate(BaseModel):
    name: str | None = None
    code: str | None = None
    academic_year: str | None = None
    principal_id: uuid.UUID | None = None
    is_active: bool | None = None


class SchoolRead(BaseModel):
    id: uuid.UUID
    district_id: uuid.UUID
    name: str
    code: str
    academic_year: str | None = None
    principal_id: uuid.UUID | None = None
    is_active: bool

    model_config = {"from_attributes": True}


class SchoolDetail(SchoolRead):
    principal_name: str | None = None
    principal_email: str | None = None
    user_count: int = 0
    course_count: int = 0
