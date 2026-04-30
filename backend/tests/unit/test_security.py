"""Unit tests for app.core.security.

These tests exercise pure-Python helpers (no database, no I/O) covering:
- bcrypt password hashing and verification.
- JWT access / refresh / password-reset token issuance.
- Token decoding success and failure modes.
"""

from __future__ import annotations

import os
import uuid
from datetime import datetime, timedelta, timezone

import pytest

# These env vars must be set BEFORE importing app.config / app.core.security.
os.environ.setdefault("SECRET_KEY", "test-secret-key-do-not-use-in-prod")
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://x:x@localhost:5432/x")

from app.core import security  # noqa: E402


pytestmark = pytest.mark.unit


# ─── Password hashing ───────────────────────────────────────────────────────


def test_hash_password_produces_distinct_bcrypt_hash():
    h1 = security.hash_password("CorrectHorseBattery!")
    h2 = security.hash_password("CorrectHorseBattery!")
    # bcrypt salts each hash → identical input must produce different hashes.
    assert h1 != h2
    # bcrypt hashes start with $2 and are at least 60 chars long.
    assert h1.startswith("$2") and len(h1) >= 60


def test_verify_password_round_trip():
    plain = "CorrectHorseBattery!"
    hashed = security.hash_password(plain)
    assert security.verify_password(plain, hashed) is True
    assert security.verify_password("wrong-password", hashed) is False


def test_verify_password_rejects_empty_string():
    hashed = security.hash_password("real-password")
    assert security.verify_password("", hashed) is False


# ─── JWT issuance + decoding ────────────────────────────────────────────────


def test_create_access_token_round_trips_via_decode():
    user_id = uuid.uuid4()
    tenant_id = uuid.uuid4()
    roles = ["teacher", "admin"]

    token = security.create_access_token(user_id, tenant_id, roles)
    payload = security.decode_token(token)

    assert payload["sub"] == str(user_id)
    assert payload["tenant_id"] == str(tenant_id)
    assert payload["roles"] == roles
    assert payload["type"] == "access"
    assert "exp" in payload and "iat" in payload


def test_create_refresh_token_has_no_tenant_or_roles():
    user_id = uuid.uuid4()
    token = security.create_refresh_token(user_id)
    payload = security.decode_token(token)

    assert payload["sub"] == str(user_id)
    assert payload["type"] == "refresh"
    assert "tenant_id" not in payload
    assert "roles" not in payload


def test_create_password_reset_token_marks_type():
    user_id = uuid.uuid4()
    token = security.create_password_reset_token(user_id)
    payload = security.decode_token(token)
    assert payload["type"] == "password_reset"


def test_decode_token_rejects_garbage_input():
    with pytest.raises(ValueError):
        security.decode_token("not.a.jwt")


def test_decode_token_rejects_expired_token(monkeypatch):
    # Forge an already-expired token using the same secret + algorithm.
    from jose import jwt as _jwt

    expired_payload = {
        "sub": str(uuid.uuid4()),
        "type": "access",
        "exp": datetime.now(timezone.utc) - timedelta(minutes=1),
        "iat": datetime.now(timezone.utc) - timedelta(minutes=10),
    }
    expired = _jwt.encode(
        expired_payload,
        security.settings.SECRET_KEY,
        algorithm=security.settings.ALGORITHM,
    )

    with pytest.raises(ValueError):
        security.decode_token(expired)


def test_decode_token_rejects_wrong_secret():
    user_id = uuid.uuid4()
    tenant_id = uuid.uuid4()
    valid = security.create_access_token(user_id, tenant_id, ["student"])

    # Decode with a different secret — should fail.
    from jose import jwt as _jwt, JWTError

    with pytest.raises(JWTError):
        _jwt.decode(valid, "different-secret", algorithms=[security.settings.ALGORITHM])
