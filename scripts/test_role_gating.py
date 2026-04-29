"""Negative-case role-gating tests.

Confirms the ownership checks added to gradebook, assessments, analytics, and
courses actually prevent cross-teacher access.
"""

from __future__ import annotations
import sys
import httpx

BASE = "http://localhost:8000/api/v1"


def login(email: str, password: str, slug: str) -> str:
    r = httpx.post(
        f"{BASE}/auth/login",
        json={"email": email, "password": password, "tenant_slug": slug},
        timeout=10.0,
    )
    r.raise_for_status()
    return r.json()["access_token"]


def _headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def main() -> int:
    sarah = login("sarah.chen@lincoln-unified.edu", "Teacher123!", "lincoln-unified")
    james = login("james.rivera@lincoln-unified.edu", "Teacher123!", "lincoln-unified")
    admin = login("admin@lincoln-unified.edu", "Admin123!", "lincoln-unified")
    student = login("student001@lincoln-unified.edu", "Student123!", "lincoln-unified")

    # Find a course Sarah owns
    courses = httpx.get(f"{BASE}/courses?page=1&page_size=20", headers=_headers(sarah)).json()
    if not courses["items"]:
        print("Sarah has no courses; cannot run gating tests")
        return 1
    sarah_course_id = courses["items"][0]["id"]

    # Find a course James owns (so we can confirm Sarah can't touch it)
    j_courses = httpx.get(f"{BASE}/courses?page=1&page_size=20", headers=_headers(james)).json()
    if not j_courses["items"]:
        print("James has no courses; cannot run gating tests")
        return 1
    james_course_id = j_courses["items"][0]["id"]

    # Find a quiz on James's course
    j_quizzes = httpx.get(
        f"{BASE}/assessments/courses/{james_course_id}/quizzes",
        headers=_headers(james),
    ).json()
    james_quiz_id = j_quizzes[0]["id"] if j_quizzes else None

    cases: list[tuple[str, str, str, dict | None, int, str]] = [
        # Gradebook isolation
        ("GET", f"/gradebook/courses/{james_course_id}", sarah, None, 403, "sarah reads james's gradebook"),
        ("POST", f"/gradebook/courses/{james_course_id}/entries", sarah,
         {"student_id": "00000000-0000-0000-0000-000000000000", "title": "x", "category": "assignment", "grade": 4, "weight": 0.1},
         403, "sarah writes to james's gradebook"),

        # Quiz isolation
        ("POST", f"/assessments/courses/{james_course_id}/quizzes", sarah,
         {"title": "evil", "max_attempts": 1, "time_limit_min": 5}, 403, "sarah creates quiz on james's course"),

        # Analytics grade-distribution
        ("GET", f"/analytics/grade-distribution/{james_course_id}", sarah, None, 403,
         "sarah reads grade dist of james's course"),

        # Course publish toggle
        ("POST", f"/courses/{james_course_id}/publish", sarah, None, 403, "sarah toggles publish on james's course"),

        # Admin happy path — should pass
        ("GET", f"/gradebook/courses/{james_course_id}", admin, None, 200, "admin reads any gradebook"),
        ("GET", f"/analytics/grade-distribution/{james_course_id}", admin, None, 200, "admin reads any grade dist"),

        # Sarah's own course — should pass
        ("GET", f"/gradebook/courses/{sarah_course_id}", sarah, None, 200, "sarah reads her own gradebook"),
    ]

    if james_quiz_id:
        cases.extend([
            ("PATCH", f"/assessments/quizzes/{james_quiz_id}", sarah, {"title": "hijacked"}, 403,
             "sarah edits james's quiz"),
            ("POST", f"/assessments/quizzes/{james_quiz_id}/questions", sarah,
             {"text": "?", "question_type": "multiple_choice", "points": 1, "position": 1, "options": []},
             403, "sarah adds question to james's quiz"),
            ("GET", f"/assessments/quizzes/{james_quiz_id}/submissions", sarah, None, 403,
             "sarah views submissions on james's quiz"),
        ])

    # Student should not be able to hit teacher routes
    cases.append(
        ("GET", "/analytics/dashboard", student, None, 403, "student cannot hit analytics/dashboard"),
    )

    passed = 0
    failed = 0
    for method, path, token, body, expected, note in cases:
        r = httpx.request(
            method,
            BASE + path,
            json=body,
            headers=_headers(token),
            timeout=10.0,
        )
        ok = r.status_code == expected
        icon = "\033[32mOK  \033[0m" if ok else "\033[31mFAIL\033[0m"
        print(f"{icon} {r.status_code:>3} (want {expected}) {method:<6} {path:<60} {note}")
        if ok:
            passed += 1
        else:
            failed += 1

    print()
    print(f"Total: {passed + failed}  Passed: \033[32m{passed}\033[0m  Failed: \033[31m{failed}\033[0m")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
