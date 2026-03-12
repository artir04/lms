from dataclasses import dataclass
from typing import TypeVar, Generic, Sequence
from pydantic import BaseModel

T = TypeVar("T")


class PaginationParams(BaseModel):
    page: int = 1
    page_size: int = 20

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size

    @property
    def limit(self) -> int:
        return self.page_size


@dataclass
class PaginatedResponse(Generic[T]):
    """Plain dataclass — safe to hold SQLAlchemy ORM objects.
    FastAPI serializes this via the response_model (schemas.common.PaginatedResponse)."""
    items: Sequence[T]
    total: int
    page: int
    page_size: int
    pages: int

    @classmethod
    def create(cls, items: Sequence[T], total: int, params: PaginationParams) -> "PaginatedResponse[T]":
        pages = max(1, -(-total // params.page_size))
        return cls(items=list(items), total=total, page=params.page, page_size=params.page_size, pages=pages)
