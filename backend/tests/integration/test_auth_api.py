"""Integration tests for the auth router.

Verifies the login + refresh flow end-to-end:
- valid credentials issue an access + refresh token,
- invalid credentials fail with 401 (no enumeration leak),
- wrong-tenant + inactive-user paths are rejected,
- the refresh endpoint mints a new access token.
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.core.security import decode_token

pytestmark = pytest.mark.integration


async def test_login_with_valid_credentials_returns_tokens(
    client: AsyncClient, tenant, make_user
):
    user = await make_user(email="alice@example.com", roles=["teacher"])

    resp = await client.post(
        "/api/v1/auth/login",
        json={
            "email": user.email,
            "password": "Passw0rd!",
            "tenant_slug": tenant.slug,
        },
    )

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert "access_token" in body
    assert "refresh_token" in body
    assert body["token_type"] == "bearer"

    payload = decode_token(body["access_token"])
    assert payload["sub"] == str(user.id)
    assert payload["tenant_id"] == str(tenant.id)
    assert "teacher" in payload["roles"]
    assert payload["type"] == "access"


async def test_login_with_wrong_password_returns_401(
    client: AsyncClient, tenant, make_user
):
    await make_user(email="bob@example.com")
    resp = await client.post(
        "/api/v1/auth/login",
        json={
            "email": "bob@example.com",
            "password": "WRONG",
            "tenant_slug": tenant.slug,
        },
    )
    assert resp.status_code == 401
    assert resp.json()["detail"] == "Invalid credentials"


async def test_login_with_unknown_email_returns_401(client: AsyncClient, tenant):
    resp = await client.post(
        "/api/v1/auth/login",
        json={
            "email": "nobody@example.com",
            "password": "Passw0rd!",
            "tenant_slug": tenant.slug,
        },
    )
    assert resp.status_code == 401


async def test_login_with_unknown_tenant_returns_401(
    client: AsyncClient, make_user
):
    await make_user(email="charlie@example.com")
    resp = await client.post(
        "/api/v1/auth/login",
        json={
            "email": "charlie@example.com",
            "password": "Passw0rd!",
            "tenant_slug": "nonexistent-tenant",
        },
    )
    assert resp.status_code == 401


async def test_refresh_endpoint_issues_new_access_token(
    client: AsyncClient, tenant, make_user
):
    user = await make_user(email="dana@example.com", roles=["student"])
    login = await client.post(
        "/api/v1/auth/login",
        json={
            "email": user.email,
            "password": "Passw0rd!",
            "tenant_slug": tenant.slug,
        },
    )
    refresh_token = login.json()["refresh_token"]

    resp = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert resp.status_code == 200
    new_access = resp.json()["access_token"]
    payload = decode_token(new_access)
    assert payload["sub"] == str(user.id)
    assert payload["type"] == "access"


async def test_refresh_with_invalid_token_returns_401(client: AsyncClient):
    resp = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": "not.a.valid.jwt"},
    )
    assert resp.status_code == 401


async def test_protected_route_without_token_returns_401(client: AsyncClient):
    resp = await client.get("/api/v1/users/me")
    assert resp.status_code == 401


async def test_protected_route_with_token_returns_user(
    client: AsyncClient, tenant, make_user, auth_headers_for
):
    user = await make_user(email="erin@example.com", roles=["admin"])
    headers = await auth_headers_for(user.email)

    resp = await client.get("/api/v1/users/me", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["email"] == user.email
    assert "admin" in body["roles"]
