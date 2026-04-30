"""Integration tests for the /api/v1/courses router.

Verifies that teachers can create courses, that students cannot, and that
listing returns role-scoped data.
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.integration


async def test_student_cannot_create_course(
    client: AsyncClient, make_user, auth_headers_for
):
    student = await make_user(email="stu@example.com", roles=["student"])
    headers = await auth_headers_for(student.email)

    resp = await client.post(
        "/api/v1/courses",
        headers=headers,
        json={"title": "Forbidden Course"},
    )
    assert resp.status_code == 403


async def test_teacher_can_create_course(
    client: AsyncClient, make_user, auth_headers_for
):
    teacher = await make_user(email="teach@example.com", roles=["teacher"])
    headers = await auth_headers_for(teacher.email)

    resp = await client.post(
        "/api/v1/courses",
        headers=headers,
        json={
            "title": "Algebra I",
            "subject": "Math",
            "grade_level": "9",
            "description": "Linear equations and inequalities.",
        },
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["title"] == "Algebra I"
    assert body["subject"] == "Math"
    assert body["is_published"] is False
    assert body["teacher"]["id"] == str(teacher.id)


async def test_teacher_lists_only_their_own_courses(
    client: AsyncClient, make_user, auth_headers_for
):
    teach_a = await make_user(email="ta@example.com", roles=["teacher"])
    teach_b = await make_user(email="tb@example.com", roles=["teacher"])

    # Each teacher creates one course and publishes it (the list endpoint
    # only returns published courses for non-student callers).
    a_headers = await auth_headers_for(teach_a.email)
    a_create = await client.post(
        "/api/v1/courses", headers=a_headers, json={"title": "Course A"}
    )
    await client.post(
        f"/api/v1/courses/{a_create.json()['id']}/publish", headers=a_headers
    )

    b_headers = await auth_headers_for(teach_b.email)
    b_create = await client.post(
        "/api/v1/courses", headers=b_headers, json={"title": "Course B"}
    )
    await client.post(
        f"/api/v1/courses/{b_create.json()['id']}/publish", headers=b_headers
    )

    # Teacher A only sees their own course.
    resp = await client.get("/api/v1/courses", headers=a_headers)
    assert resp.status_code == 200
    titles = {c["title"] for c in resp.json()["items"]}
    assert "Course A" in titles
    assert "Course B" not in titles


async def test_admin_lists_every_course_in_tenant(
    client: AsyncClient, make_user, auth_headers_for
):
    teacher = await make_user(email="teach2@example.com", roles=["teacher"])
    admin = await make_user(email="admin2@example.com", roles=["admin"])

    teach_headers = await auth_headers_for(teacher.email)
    create = await client.post(
        "/api/v1/courses", headers=teach_headers, json={"title": "Visible"}
    )
    await client.post(
        f"/api/v1/courses/{create.json()['id']}/publish", headers=teach_headers
    )

    admin_headers = await auth_headers_for(admin.email)
    resp = await client.get("/api/v1/courses", headers=admin_headers)
    assert resp.status_code == 200
    titles = {c["title"] for c in resp.json()["items"]}
    assert "Visible" in titles


async def test_get_course_detail_returns_teacher_summary(
    client: AsyncClient, make_user, auth_headers_for
):
    teacher = await make_user(
        email="alex@example.com",
        first_name="Alex",
        last_name="Pinto",
        roles=["teacher"],
    )
    headers = await auth_headers_for(teacher.email)

    create = await client.post(
        "/api/v1/courses",
        headers=headers,
        json={"title": "Geometry"},
    )
    course_id = create.json()["id"]

    resp = await client.get(f"/api/v1/courses/{course_id}", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["title"] == "Geometry"
    assert body["teacher"]["full_name"] == "Alex Pinto"
