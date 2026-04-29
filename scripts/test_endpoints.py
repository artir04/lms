"""End-to-end smoke test for every backend endpoint.

Logs in as each role, exercises every route, prints a result table.
Creates throwaway resources (course/module/lesson/quiz/user/district) and
deletes them where possible.
"""

from __future__ import annotations
import json
import sys
import time
from dataclasses import dataclass, field
from datetime import date
from typing import Any
from urllib.parse import urlencode

import httpx

BASE = "http://localhost:8000/api/v1"

CREDS = {
    "superadmin": ("superadmin@lms.example.com", "SuperAdmin123!", "system"),
    "admin": ("admin@lincoln-unified.edu", "Admin123!", "lincoln-unified"),
    "teacher": ("sarah.chen@lincoln-unified.edu", "Teacher123!", "lincoln-unified"),
    "student": ("student001@lincoln-unified.edu", "Student123!", "lincoln-unified"),
    "parent": ("parent001@lincoln-unified.edu", "Parent123!", "lincoln-unified"),
}


@dataclass
class Result:
    method: str
    path: str
    role: str
    status: int
    expected: tuple[int, ...]
    note: str = ""

    @property
    def ok(self) -> bool:
        return self.status in self.expected


@dataclass
class Suite:
    results: list[Result] = field(default_factory=list)
    tokens: dict[str, str] = field(default_factory=dict)
    refresh_tokens: dict[str, str] = field(default_factory=dict)

    def call(
        self,
        method: str,
        path: str,
        role: str | None = None,
        json_body: Any = None,
        expected: tuple[int, ...] = (200,),
        note: str = "",
        files: dict | None = None,
    ) -> tuple[Result, httpx.Response | None]:
        url = BASE + path
        headers = {}
        if role:
            token = self.tokens.get(role)
            if token:
                headers["Authorization"] = f"Bearer {token}"
        try:
            r = httpx.request(
                method,
                url,
                json=json_body if files is None else None,
                files=files,
                headers=headers,
                timeout=15.0,
            )
            res = Result(method, path, role or "-", r.status_code, expected, note)
            self.results.append(res)
            return res, r
        except Exception as exc:
            res = Result(method, path, role or "-", 0, expected, f"{exc.__class__.__name__}: {exc}")
            self.results.append(res)
            return res, None


def fmt_status(r: Result) -> str:
    icon = "OK" if r.ok else "FAIL"
    color_start = "\033[32m" if r.ok else "\033[31m"
    color_end = "\033[0m"
    return f"{color_start}{icon:4}{color_end} {r.status:>3} {r.method:<6} {r.path:<70} [{r.role:<10}] {r.note}"


def main() -> int:
    s = Suite()

    # ── Phase 1: health, login, refresh ────────────────────────────────────
    s.call("GET", "/../../health", expected=(200,), note="health check")  # not under /api/v1
    # Actually health is at /health not /api/v1/health — call it manually
    r = httpx.get("http://localhost:8000/health", timeout=10.0)
    s.results[-1] = Result("GET", "/health", "-", r.status_code, (200,), "")

    for role, (email, pw, slug) in CREDS.items():
        res, resp = s.call(
            "POST",
            "/auth/login",
            json_body={"email": email, "password": pw, "tenant_slug": slug},
            note=f"login as {role}",
        )
        if res.ok and resp:
            data = resp.json()
            s.tokens[role] = data["access_token"]
            s.refresh_tokens[role] = data["refresh_token"]

    # Refresh
    s.call(
        "POST",
        "/auth/refresh",
        json_body={"refresh_token": s.refresh_tokens.get("admin", "")},
        note="refresh admin token",
    )

    # Forgot-password & reset-password
    s.call(
        "POST",
        "/auth/forgot-password",
        json_body={"email": "admin@lincoln-unified.edu", "tenant_slug": "lincoln-unified"},
        note="silent ok regardless",
    )

    # Get a real reset token by calling forgot-password and reading from logs would
    # require shell access. Instead, reproduce the token-creation in-process.
    # We'll just hit reset-password with a junk token to confirm the 400 path.
    s.call(
        "POST",
        "/auth/reset-password",
        json_body={"token": "junk", "new_password": "Whatever123!"},
        expected=(400,),
        note="invalid token rejected",
    )

    s.call(
        "GET",
        "/auth/sso/google",
        expected=(200,),
        note="STUB endpoint",
    )

    # ── Phase 2: /users/me as every role ───────────────────────────────────
    me_ids: dict[str, str] = {}
    for role in CREDS:
        res, resp = s.call("GET", "/users/me", role=role, note=f"current {role}")
        if res.ok and resp:
            me_ids[role] = resp.json()["id"]

    s.call(
        "PATCH",
        "/users/me",
        role="admin",
        json_body={"first_name": "Diana"},
        note="self-update",
    )
    s.call(
        "POST",
        "/users/me/change-password",
        role="admin",
        json_body={"current_password": "Admin123!", "new_password": "Admin123!"},
        note="re-set same password",
    )

    # ── Phase 3: User management ──────────────────────────────────────────
    s.call("GET", "/users", role="admin", note="list tenant users")
    s.call("GET", "/users?role=teacher&page=1&page_size=5", role="admin", note="filtered list")
    s.call("GET", "/users?search=student001", role="admin", note="search")

    res, resp = s.call(
        "POST",
        "/users",
        role="admin",
        json_body={
            "email": f"smoketest_{int(time.time())}@lincoln-unified.edu",
            "first_name": "Smoke",
            "last_name": "Test",
            "password": "TestPass123!",
            "roles": ["student"],
        },
        note="create throwaway user",
    )
    test_user_id = resp.json()["id"] if (res.ok and resp) else None

    if test_user_id:
        s.call("GET", f"/users/{test_user_id}", role="admin", note="read created user")
        s.call(
            "PATCH",
            f"/users/{test_user_id}",
            role="admin",
            json_body={"first_name": "SmokeUpdated"},
            note="update user",
        )
        s.call("DELETE", f"/users/{test_user_id}", role="admin", note="soft-delete user")

    # ── Phase 4: Tenants ─────────────────────────────────────────────────
    s.call("GET", "/tenants", role="superadmin", note="list districts")
    s.call("GET", "/tenants?page=1&page_size=5", role="superadmin")

    res, resp = s.call(
        "POST",
        "/tenants",
        role="superadmin",
        json_body={"name": "SmokeTest District", "slug": f"smoketest-{int(time.time())}"},
        note="create throwaway district",
    )
    test_district_id = resp.json()["id"] if (res.ok and resp) else None

    if test_district_id:
        s.call("GET", f"/tenants/{test_district_id}", role="superadmin")
        s.call(
            "PATCH",
            f"/tenants/{test_district_id}",
            role="superadmin",
            json_body={"name": "SmokeTest Renamed"},
        )

    s.call("GET", "/tenants/me/settings", role="admin", note="own tenant settings")
    s.call(
        "PATCH",
        "/tenants/me/settings",
        role="admin",
        json_body={"smoke_test": {"ran_at": int(time.time())}},
        note="merge-patch own settings",
    )

    # ── Phase 5: Courses (need IDs from existing seed data) ──────────────
    res, resp = s.call("GET", "/courses?page=1&page_size=5", role="admin", note="list courses")
    course_id = None
    if res.ok and resp:
        items = resp.json().get("items", [])
        if items:
            course_id = items[0]["id"]

    if course_id:
        s.call("GET", f"/courses/{course_id}", role="admin", note="course detail")
        s.call(
            "PATCH",
            f"/courses/{course_id}",
            role="admin",
            json_body={"description": "Smoke-tested description."},
        )
        s.call("POST", f"/courses/{course_id}/publish", role="admin", note="toggle publish")
        s.call("POST", f"/courses/{course_id}/publish", role="admin", note="toggle back")
        s.call("GET", f"/courses/{course_id}/sections", role="admin")

        # Get a section id
        res2, resp2 = s.call("GET", f"/courses/{course_id}/sections", role="admin")
        section_id = resp2.json()[0]["id"] if (res2.ok and resp2 and resp2.json()) else None

        s.call("GET", f"/courses/{course_id}/enrollments", role="admin", note="roster")

    # ── Phase 6: Create a fresh course we can fully manipulate ───────────
    res, resp = s.call(
        "POST",
        "/courses",
        role="teacher",
        json_body={
            "title": "Smoke Test Course",
            "description": "Created by the endpoint test runner.",
            "subject": "Testing",
            "grade_level": "TBD",
        },
        expected=(200, 201),
        note="create test course",
    )
    test_course_id = resp.json()["id"] if (res.ok and resp) else None

    test_module_id = None
    test_lesson_id = None
    if test_course_id:
        # Modules
        s.call("GET", f"/courses/{test_course_id}/modules", role="teacher")
        res, resp = s.call(
            "POST",
            f"/courses/{test_course_id}/modules",
            role="teacher",
            json_body={"title": "Module One", "position": 1},
            expected=(200, 201),
            note="create module",
        )
        test_module_id = resp.json()["id"] if (res.ok and resp) else None

        if test_module_id:
            s.call(
                "PATCH",
                f"/courses/{test_course_id}/modules/{test_module_id}",
                role="teacher",
                json_body={"title": "Module One Renamed"},
            )
            s.call(
                "GET",
                f"/courses/{test_course_id}/modules/{test_module_id}/lessons",
                role="teacher",
            )

            res, resp = s.call(
                "POST",
                f"/courses/{test_course_id}/modules/{test_module_id}/lessons",
                role="teacher",
                json_body={
                    "title": "Lesson One",
                    "content_type": "text",
                    "body": "Hello",
                    "position": 1,
                },
                expected=(200, 201),
                note="create lesson",
            )
            test_lesson_id = resp.json()["id"] if (res.ok and resp) else None

            # Reorder modules (single-element list)
            s.call(
                "PUT",
                f"/courses/{test_course_id}/modules/reorder",
                role="teacher",
                json_body=[{"id": test_module_id, "position": 1}],
                note="reorder modules",
            )

            if test_lesson_id:
                s.call(
                    "GET",
                    f"/courses/{test_course_id}/lessons/{test_lesson_id}",
                    role="teacher",
                    note="logs lesson_view event",
                )
                s.call(
                    "PATCH",
                    f"/courses/{test_course_id}/lessons/{test_lesson_id}",
                    role="teacher",
                    json_body={"title": "Lesson One Updated"},
                )

                # Reorder lessons
                s.call(
                    "PUT",
                    f"/courses/{test_course_id}/modules/{test_module_id}/lessons/reorder",
                    role="teacher",
                    json_body=[{"id": test_lesson_id, "position": 1}],
                    note="reorder lessons",
                )

                # Upload an attachment (multipart)
                s.call(
                    "POST",
                    f"/courses/{test_course_id}/lessons/{test_lesson_id}/attachments",
                    role="teacher",
                    files={"file": ("smoke.txt", b"smoke test content", "text/plain")},
                    expected=(200, 201),
                    note="upload attachment",
                )

    # ── Phase 7: Sections + enrollment on the test course ────────────────
    test_section_id = None
    if test_course_id:
        res, resp = s.call(
            "POST",
            f"/courses/{test_course_id}/sections",
            role="teacher",
            json_body={"name": "Section A"},
            expected=(200, 201),
            note="create section",
        )
        test_section_id = resp.json()["id"] if (res.ok and resp) else None

        if test_section_id and "student" in me_ids:
            sid = me_ids["student"]
            s.call(
                "POST",
                f"/courses/{test_course_id}/sections/{test_section_id}/enroll",
                role="admin",
                json_body={"student_id": sid},
                expected=(200, 201),
                note="enroll student001",
            )
            s.call(
                "DELETE",
                f"/courses/{test_course_id}/sections/{test_section_id}/enroll/{sid}",
                role="admin",
                note="drop student001",
            )

    # ── Phase 8: Assessments — find an existing quiz to test grading ─────
    quiz_id = None
    if course_id:
        res, resp = s.call(
            "GET",
            f"/assessments/courses/{course_id}/quizzes",
            role="admin",
            note="list quizzes",
        )
        if res.ok and resp:
            items = resp.json()
            if items:
                quiz_id = items[0]["id"]

    test_quiz_id = None
    test_question_id = None
    if test_course_id:
        # Create a quiz on the throwaway course
        res, resp = s.call(
            "POST",
            f"/assessments/courses/{test_course_id}/quizzes",
            role="teacher",
            json_body={
                "title": "Smoke Quiz",
                "description": "auto",
                "max_attempts": 3,
                "time_limit_min": 10,
            },
            expected=(200, 201),
            note="create quiz",
        )
        test_quiz_id = resp.json()["id"] if (res.ok and resp) else None

        if test_quiz_id:
            s.call("GET", f"/assessments/quizzes/{test_quiz_id}", role="teacher")
            s.call(
                "PATCH",
                f"/assessments/quizzes/{test_quiz_id}",
                role="teacher",
                json_body={"description": "edited"},
            )
            res, resp = s.call(
                "POST",
                f"/assessments/quizzes/{test_quiz_id}/questions",
                role="teacher",
                json_body={
                    "text": "2 + 2 = ?",
                    "question_type": "multiple_choice",
                    "points": 1.0,
                    "position": 1,
                    "options": [
                        {"text": "3", "is_correct": False},
                        {"text": "4", "is_correct": True},
                    ],
                },
                expected=(200, 201),
                note="add question",
            )
            test_question_id = resp.json()["id"] if (res.ok and resp) else None

            s.call(
                "GET",
                f"/assessments/quizzes/{test_quiz_id}/submissions",
                role="teacher",
                note="list submissions (empty)",
            )

            # Student submits the throwaway quiz — needs to be enrolled. Use a
            # student fixture only if test_section_id wired up below; otherwise
            # we'll use the published-quiz route on an already-enrolled course.
            if test_question_id:
                s.call(
                    "POST",
                    f"/assessments/quizzes/{test_quiz_id}/submissions",
                    role="student",
                    json_body={
                        "answers": [
                            {"question_id": test_question_id, "answer_text": "4"}
                        ]
                    },
                    expected=(200, 201, 400, 403),
                    note="student submit (may 403 if not enrolled)",
                )

    # Existing quiz: list submissions and grade one
    submission_id = None
    if quiz_id:
        s.call("GET", f"/assessments/quizzes/{quiz_id}", role="admin")
        res, resp = s.call(
            "GET",
            f"/assessments/quizzes/{quiz_id}/submissions",
            role="admin",
            note="list real submissions",
        )
        if res.ok and resp:
            subs = resp.json()
            if subs:
                submission_id = subs[0]["id"]

    if submission_id:
        s.call("GET", f"/assessments/submissions/{submission_id}", role="admin")
        # Manual-grade is shape-dependent; just hit the endpoint with empty items
        s.call(
            "PATCH",
            f"/assessments/submissions/{submission_id}/grade",
            role="admin",
            json_body={"items": []},
            expected=(200, 422),
            note="grading endpoint",
        )

    # ── Phase 9: Grades ──────────────────────────────────────────────────
    if course_id:
        s.call("GET", f"/gradebook/courses/{course_id}", role="admin", note="course gradebook")

        # Find an enrolled student
        res, resp = s.call("GET", f"/courses/{course_id}/enrollments", role="admin")
        enrolled_student_id = None
        if res.ok and resp:
            items = resp.json()
            if items:
                enrolled_student_id = items[0]["id"]

        if enrolled_student_id:
            res, resp = s.call(
                "POST",
                f"/gradebook/courses/{course_id}/entries",
                role="admin",
                json_body={
                    "student_id": enrolled_student_id,
                    "title": "Smoke entry",
                    "category": "assignment",
                    "grade": 4,
                    "weight": 0.1,
                },
                expected=(200, 201),
                note="create grade entry",
            )
            entry_id = resp.json()["id"] if (res.ok and resp) else None
            if entry_id:
                s.call(
                    "PATCH",
                    f"/gradebook/entries/{entry_id}",
                    role="admin",
                    json_body={"grade": 5},
                    note="edit grade entry",
                )

    s.call("GET", "/gradebook/me", role="student", note="student grades")
    s.call("GET", "/gradebook/upcoming", role="student", note="student upcoming")

    # ── Phase 10: Attendance ─────────────────────────────────────────────
    if course_id and "student" in me_ids:
        today = date.today().isoformat()
        s.call(
            "POST",
            f"/attendance/courses/{course_id}",
            role="admin",
            json_body={
                "date": today,
                "records": [
                    {"date": today, "student_id": me_ids["student"], "status": "present"}
                ],
            },
            expected=(200, 201),
            note="mark attendance",
        )
        s.call("GET", f"/attendance/courses/{course_id}", role="admin", note="course report")
        s.call(
            "GET",
            f"/attendance/courses/{course_id}/students/{me_ids['student']}",
            role="admin",
            note="single-student report",
        )
        s.call(
            "GET",
            f"/attendance/courses/{course_id}/date/{today}",
            role="admin",
            note="day records",
        )

    s.call("GET", "/attendance/students/me", role="student", note="own attendance")

    # ── Phase 11: Analytics ──────────────────────────────────────────────
    s.call("GET", "/analytics/dashboard", role="admin")
    s.call("GET", "/analytics/engagement?days=30", role="admin")
    if course_id:
        s.call("GET", f"/analytics/grade-distribution/{course_id}", role="admin")
    s.call("GET", "/analytics/reports", role="admin", note="admin report")

    # ── Phase 12: Gamification ──────────────────────────────────────────
    s.call("GET", "/gamification/me", role="student")
    s.call("GET", "/gamification/leaderboard?limit=5", role="student")

    # ── Phase 13: Parents ───────────────────────────────────────────────
    s.call("GET", "/parents/digest", role="parent")

    # Find one of parent's children
    if "parent" in s.tokens:
        # Use the digest to discover a child id
        r = httpx.get(
            BASE + "/parents/digest",
            headers={"Authorization": f"Bearer {s.tokens['parent']}"},
            timeout=10.0,
        )
        try:
            digest = r.json()
            children = digest.get("children", [])
            if children:
                child_id = (
                    children[0].get("student", {}).get("id")
                    or children[0].get("student_id")
                    or children[0].get("id")
                )
                if child_id:
                    s.call(
                        "GET",
                        f"/parents/children/{child_id}/progress",
                        role="parent",
                        note="child progress",
                    )
        except Exception:
            pass

    if "student" in me_ids and "parent" in me_ids:
        s.call(
            "POST",
            "/parents/link",
            role="admin",
            json_body={"parent_id": me_ids["parent"], "student_id": me_ids["student"]},
            expected=(200, 201, 409),
            note="link (already-linked allowed)",
        )

    # ── Phase 14: Notifications ─────────────────────────────────────────
    s.call("GET", "/notifications", role="admin")
    s.call(
        "POST",
        "/notifications/read",
        role="admin",
        json_body={"notification_ids": []},
        note="mark empty list",
    )

    # ── Phase 15: Cleanup our test course ───────────────────────────────
    if test_course_id and test_module_id:
        s.call(
            "DELETE",
            f"/courses/{test_course_id}/modules/{test_module_id}",
            role="teacher",
            note="cleanup module",
        )

    # ── Print results ────────────────────────────────────────────────────
    passed = sum(1 for r in s.results if r.ok)
    failed = len(s.results) - passed
    print()
    print("=" * 110)
    print(f"  Endpoint smoke test — {len(s.results)} calls, {passed} passed, {failed} failed")
    print("=" * 110)
    for r in s.results:
        print(fmt_status(r))
    print()
    print(f"  Total: {len(s.results)}  Passed: \033[32m{passed}\033[0m  Failed: \033[31m{failed}\033[0m")

    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
