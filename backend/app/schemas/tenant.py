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
    district_id: uuid.UUID
    name: str
    code: str


class SchoolRead(BaseModel):
    id: uuid.UUID
    district_id: uuid.UUID
    name: str
    code: str
    is_active: bool

    model_config = {"from_attributes": True}
