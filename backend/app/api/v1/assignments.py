import uuid
from fastapi import APIRouter, Depends
from sqlalchemy import select
from app.db.session import get_db
from app.dependencies import CurrentUserPayload, require_roles
from app.services.assignment_service import AssignmentService
from app.core.permissions import Role
from app.core.exceptions import ForbiddenError, NotFoundError
from app.models.course import Course, Section, Enrollment
from app.schemas.assignment import (
    AssignmentCreate, AssignmentUpdate, AssignmentRead,
    AssignmentSubmissionCreate, AssignmentSubmissionRead,
    AssignmentSubmissionListItem, AssignmentGradeRequest,
)

router = APIRouter(prefix="/assignments", tags=["assignments"])


async def _assert_course_access(course_id: uuid.UUID, payload: dict, db) -> None:
    course_r = await db.execute(
        select(Course).where(
            Course.id == course_id,
            Course.tenant_id == uuid.UUID(payload["tenant_id"]),
        )
    )
    course = course_r.scalar_one_or_none()
    if not course:
        raise NotFoundError("Course")
    roles = payload.get("roles", [])
    if any(r in roles for r in ("admin", "superadmin")):
        return
    if course.teacher_id != uuid.UUID(payload["sub"]):
        raise ForbiddenError("You can only access your own course")


async def _assert_course_view_access(course_id: uuid.UUID, payload: dict, db) -> None:
    roles = payload.get("roles", [])
    if any(r in roles for r in ("admin", "superadmin", "teacher")):
        await _assert_course_access(course_id, payload, db)
        return
    user_id = uuid.UUID(payload["sub"])
    enrolled = await db.execute(
        select(Enrollment)
        .join(Section, Section.id == Enrollment.section_id)
        .where(
            Section.course_id == course_id,
            Enrollment.student_id == user_id,
            Enrollment.status == "active",
        )
        .limit(1)
    )
    if not enrolled.scalar_one_or_none():
        raise ForbiddenError("You are not enrolled in this course")


# ── Assignment CRUD ─────────────────────────────────────────────────────────

@router.get("/courses/{course_id}", response_model=list[AssignmentRead])
async def list_assignments(course_id: uuid.UUID, payload: CurrentUserPayload, db=Depends(get_db)):
    await _assert_course_view_access(course_id, payload, db)
    roles = payload.get("roles", [])
    student_id = uuid.UUID(payload["sub"]) if "student" in roles else None
    return await AssignmentService(db).list_assignments(course_id, student_id)


@router.post("/courses/{course_id}", response_model=AssignmentRead, dependencies=[require_roles(Role.TEACHER, Role.ADMIN)])
async def create_assignment(course_id: uuid.UUID, data: AssignmentCreate, payload: CurrentUserPayload, db=Depends(get_db)):
    await _assert_course_access(course_id, payload, db)
    return await AssignmentService(db).create_assignment(course_id, data)


@router.get("/{assignment_id}", response_model=AssignmentRead)
async def get_assignment(assignment_id: uuid.UUID, payload: CurrentUserPayload, db=Depends(get_db)):
    assignment = await AssignmentService(db).get_assignment(assignment_id)
    await _assert_course_view_access(assignment.course_id, payload, db)
    return assignment


@router.patch("/{assignment_id}", response_model=AssignmentRead, dependencies=[require_roles(Role.TEACHER, Role.ADMIN)])
async def update_assignment(assignment_id: uuid.UUID, data: AssignmentUpdate, payload: CurrentUserPayload, db=Depends(get_db)):
    assignment = await AssignmentService(db).get_assignment(assignment_id)
    await _assert_course_access(assignment.course_id, payload, db)
    return await AssignmentService(db).update_assignment(assignment_id, data)


# ── Submissions ─────────────────────────────────────────────────────────────

@router.post("/{assignment_id}/submissions", response_model=AssignmentSubmissionRead)
async def submit_assignment(assignment_id: uuid.UUID, data: AssignmentSubmissionCreate, payload: CurrentUserPayload, db=Depends(get_db)):
    assignment = await AssignmentService(db).get_assignment(assignment_id)
    await _assert_course_view_access(assignment.course_id, payload, db)
    return await AssignmentService(db).submit(assignment_id, uuid.UUID(payload["sub"]), data)


@router.get("/{assignment_id}/submissions", response_model=list[AssignmentSubmissionListItem], dependencies=[require_roles(Role.TEACHER, Role.ADMIN)])
async def list_submissions(assignment_id: uuid.UUID, payload: CurrentUserPayload, db=Depends(get_db)):
    assignment = await AssignmentService(db).get_assignment(assignment_id)
    await _assert_course_access(assignment.course_id, payload, db)
    submissions = await AssignmentService(db).list_submissions(assignment_id)
    return [
        AssignmentSubmissionListItem(
            id=s.id,
            assignment_id=s.assignment_id,
            student_id=s.student_id,
            student_name=s.student.full_name,
            student_email=s.student.email,
            submitted_at=s.submitted_at,
            score=s.score,
            status=s.status,
        )
        for s in submissions
    ]


@router.get("/submissions/{submission_id}", response_model=AssignmentSubmissionRead)
async def get_submission(submission_id: uuid.UUID, payload: CurrentUserPayload, db=Depends(get_db)):
    submission = await AssignmentService(db).get_submission(submission_id)
    assignment = await AssignmentService(db).get_assignment(submission.assignment_id)
    roles = payload.get("roles", [])
    if not any(r in roles for r in ("admin", "superadmin", "teacher")):
        if submission.student_id != uuid.UUID(payload["sub"]):
            raise ForbiddenError("You can only view your own submissions")
    return submission


@router.patch("/submissions/{submission_id}/grade", response_model=AssignmentSubmissionRead, dependencies=[require_roles(Role.TEACHER, Role.ADMIN)])
async def grade_submission(submission_id: uuid.UUID, data: AssignmentGradeRequest, payload: CurrentUserPayload, db=Depends(get_db)):
    submission = await AssignmentService(db).get_submission(submission_id)
    assignment = await AssignmentService(db).get_assignment(submission.assignment_id)
    await _assert_course_access(assignment.course_id, payload, db)
    return await AssignmentService(db).grade_submission(submission_id, uuid.UUID(payload["sub"]), data)
