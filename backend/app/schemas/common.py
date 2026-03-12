from typing import Generic, TypeVar, Sequence
from pydantic import BaseModel

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    """Pydantic schema used as FastAPI response_model. Reads from ORM objects via from_attributes."""
    items: Sequence[T]
    total: int
    page: int
    page_size: int
    pages: int

    model_config = {"from_attributes": True}


class MessageResponse(BaseModel):
    message: str


class HealthResponse(BaseModel):
    status: str = "ok"
    version: str = "1.0.0"
