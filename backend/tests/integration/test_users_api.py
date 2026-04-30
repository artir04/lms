"""Integration tests for the /api/v1/users router.

Verifies role gating on list / create endpoints and the self-service /me
profile endpoints.
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.integration


async def test_list_users_requires_admin(
    client: AsyncClient, make_user, auth_headers_for
):
    student = await make_user(email="s1@example.com", roles=["student"])
    headers = await auth_headers_for(student.email)

    resp = await client.get("/api/v1/users", headers=headers)
    assert resp.status_code == 403


async def test_admin_can_list_users(
    client: AsyncClient, make_user, auth_headers_for
):
    admin = await make_user(email="a1@example.com", roles=["admin"])
    await make_user(email="x@example.com", roles=["student"])
    await make_user(email="y@example.com", roles=["teacher"])
    headers = await auth_headers_for(admin.email)

    resp = await client.get("/api/v1/users", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] >= 3  # admin + the two students
    emails = {u["email"] for u in body["items"]}
    assert {"a1@example.com", "x@example.com", "y@example.com"}.issubset(emails)


async def test_admin_can_create_user(
    client: AsyncClient, make_user, auth_headers_for
):
    admin = await make_user(email="a2@example.com", roles=["admin"])
    headers = await auth_headers_for(admin.email)

    resp = await client.post(
        "/api/v1/users",
        headers=headers,
        json={
            "email": "newbie@example.com",
            "password": "FreshPassw0rd!",
            "first_name": "New",
            "last_name": "Bie",
            "roles": ["student"],
        },
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["email"] == "newbie@example.com"
    assert "student" in body["roles"]


async def test_change_password_round_trip(
    client: AsyncClient, tenant, make_user, auth_headers_for
):
    user = await make_user(email="changer@example.com", roles=["student"])
    headers = await auth_headers_for(user.email)

    # 1. Old password works.
    login_old = await client.post(
        "/api/v1/auth/login",
        json={
            "email": user.email,
            "password": "Passw0rd!",
            "tenant_slug": tenant.slug,
        },
    )
    assert login_old.status_code == 200

    # 2. Change the password.
    change = await client.post(
        "/api/v1/users/me/change-password",
        headers=headers,
        json={"current_password": "Passw0rd!", "new_password": "NewPassw0rd!"},
    )
    assert change.status_code == 200

    # 3. New password works.
    login_new = await client.post(
        "/api/v1/auth/login",
        json={
            "email": user.email,
            "password": "NewPassw0rd!",
            "tenant_slug": tenant.slug,
        },
    )
    assert login_new.status_code == 200

    # 4. Old password no longer works.
    login_old2 = await client.post(
        "/api/v1/auth/login",
        json={
            "email": user.email,
            "password": "Passw0rd!",
            "tenant_slug": tenant.slug,
        },
    )
    assert login_old2.status_code == 401


async def test_change_password_rejects_wrong_current(
    client: AsyncClient, make_user, auth_headers_for
):
    user = await make_user(email="grumpy@example.com")
    headers = await auth_headers_for(user.email)

    resp = await client.post(
        "/api/v1/users/me/change-password",
        headers=headers,
        json={"current_password": "WRONG", "new_password": "DoesntMatter1!"},
    )
    assert resp.status_code == 401
