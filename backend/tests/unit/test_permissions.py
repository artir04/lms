"""Unit tests for app.core.permissions.

Pure boolean role-check helpers. No database, no I/O.
"""

from __future__ import annotations

import os

import pytest

os.environ.setdefault("SECRET_KEY", "test-secret-key-do-not-use-in-prod")
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://x:x@localhost:5432/x")

from app.core.permissions import (  # noqa: E402
    Role,
    has_any_role,
    has_min_role,
    has_role,
)

pytestmark = pytest.mark.unit


# ─── has_role ───────────────────────────────────────────────────────────────


def test_has_role_returns_true_when_role_present():
    assert has_role(["teacher", "admin"], Role.TEACHER) is True


def test_has_role_returns_false_when_role_absent():
    assert has_role(["student"], Role.TEACHER) is False


def test_has_role_returns_false_for_empty_list():
    assert has_role([], Role.ADMIN) is False


# ─── has_any_role ───────────────────────────────────────────────────────────


def test_has_any_role_matches_any_listed_role():
    assert has_any_role(["student"], Role.TEACHER, Role.STUDENT) is True
    assert has_any_role(["parent"], Role.TEACHER, Role.STUDENT) is False


def test_has_any_role_with_zero_required_returns_false():
    # No required roles → can never pass.
    assert has_any_role(["admin"]) is False


# ─── has_min_role ───────────────────────────────────────────────────────────


def test_has_min_role_admin_passes_teacher_threshold():
    # admin > teacher in the hierarchy.
    assert has_min_role(["admin"], Role.TEACHER) is True


def test_has_min_role_student_fails_teacher_threshold():
    assert has_min_role(["student"], Role.TEACHER) is False


def test_has_min_role_superadmin_passes_every_threshold():
    for required in (Role.STUDENT, Role.TEACHER, Role.ADMIN, Role.SUPERADMIN):
        assert has_min_role(["superadmin"], required) is True


def test_has_min_role_unknown_role_strings_are_ignored():
    # Unknown role strings should not crash and should not satisfy the check.
    assert has_min_role(["nonsense"], Role.TEACHER) is False


def test_has_min_role_picks_highest_role_in_list():
    # Even if the list contains a low role, a high role in the same list passes.
    assert has_min_role(["student", "admin"], Role.TEACHER) is True
