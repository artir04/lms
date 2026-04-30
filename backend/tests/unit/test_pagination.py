"""Unit tests for app.core.pagination."""

from __future__ import annotations

import os

import pytest

os.environ.setdefault("SECRET_KEY", "test-secret-key-do-not-use-in-prod")
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://x:x@localhost:5432/x")

from app.core.pagination import PaginatedResponse, PaginationParams  # noqa: E402

pytestmark = pytest.mark.unit


def test_pagination_params_default_values():
    p = PaginationParams()
    assert p.page == 1
    assert p.page_size == 20
    assert p.offset == 0
    assert p.limit == 20


def test_pagination_offset_scales_with_page():
    p = PaginationParams(page=3, page_size=25)
    assert p.offset == 50  # (3 - 1) * 25
    assert p.limit == 25


def test_paginated_response_create_computes_pages_exactly():
    p = PaginationParams(page=1, page_size=10)
    resp = PaginatedResponse.create(items=[1, 2, 3], total=30, params=p)

    assert resp.total == 30
    assert resp.page == 1
    assert resp.page_size == 10
    assert resp.pages == 3  # 30 / 10


def test_paginated_response_create_rounds_up_partial_pages():
    p = PaginationParams(page=1, page_size=10)
    resp = PaginatedResponse.create(items=[], total=21, params=p)
    # 21 items / 10 per page = 3 pages (ceiling).
    assert resp.pages == 3


def test_paginated_response_create_returns_at_least_one_page_for_empty():
    p = PaginationParams()
    resp = PaginatedResponse.create(items=[], total=0, params=p)
    # Even with zero items we surface 1 page — never 0 — so UI math is safe.
    assert resp.pages == 1
    assert resp.items == []


def test_paginated_response_create_materialises_items_to_list():
    p = PaginationParams()
    resp = PaginatedResponse.create(items=(x for x in range(3)), total=3, params=p)
    assert isinstance(resp.items, list)
    assert resp.items == [0, 1, 2]
