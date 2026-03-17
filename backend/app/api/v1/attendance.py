import uuid
from datetime import date
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select

from app.db.session import get_db
from app.dependencies import CurrentUserPayload, require_teacher
from app.services.attendance_service import AttendanceService
from app.schemas.attendance import (
    AttendanceRead,
    AttendanceReport,
    StudentAttendanceSummary,
    MarkAttendanceRequest,
)
from app.schemas.common import MessageResponse
from app.models.course import Course

router = APIRouter(prefix="/attendance", tags=["attendance"])


async def _can_edit_course(course_id: uuid.UUID, user_id: uuid.UUID, tenant_id: uuid.UUID, db) -> bool:
    """Check if user can edit attendance for this course (is teacher or admin)."""
    # Check if user is teacher of the course
    result = await db.execute(
        select(Course).where(
            Course.id == course_id,
            Course.teacher_id == user_id,
            Course.tenant_id == tenant_id
        )
    )
    if result.scalar_one_or_none():
        return True

    # Admin/Superadmin can edit any course in their tenant
    # This is handled by the role check in the route, so just return True if we get here
    # Actually, we need to check roles for this
    return False


# ─────────────────────────────────────────────
# Teacher endpoints
# ─────────────────────────────────────────────


@router.post("/courses/{course_id}", response_model=list[AttendanceRead])
async def mark_course_attendance(
    course_id: uuid.UUID,
    data: MarkAttendanceRequest,
    payload: CurrentUserPayload,
    db=Depends(get_db),
):
    """
    Mark attendance for multiple students in a course.

    - Teacher: Can only mark for their own courses
    - Admin/Superadmin: Can mark for any course in their tenant
    """
    user_id = uuid.UUID(payload["sub"])
    tenant_id = uuid.UUID(payload["tenant_id"])
    roles = payload.get("roles", [])

    # Verify course exists and user has access
    result = await db.execute(
        select(Course).where(Course.id == course_id, Course.tenant_id == tenant_id)
    )
    course = result.scalar_one_or_none()
    if not course:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("Course")

    # Check permissions
    is_admin = any(r in roles for r in ["admin", "superadmin"])
    if not is_admin and course.teacher_id != user_id:
        from app.core.exceptions import ForbiddenError
        raise ForbiddenError("You can only mark attendance for your own courses")

    # Get section_id from request or course (use first section if none specified)
    section_id = None  # Can be passed via body in the future

    service = AttendanceService(db)
    return await service.mark_attendance(
        course_id=course_id,
        section_id=section_id,
        attendance_date=data.date,
        records=data.records,
        teacher_id=user_id,
        tenant_id=tenant_id
    )


@router.get("/courses/{course_id}", response_model=AttendanceReport)
async def get_course_attendance_report(
    course_id: uuid.UUID,
    payload: CurrentUserPayload,
    db=Depends(get_db),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
):
    """
    Get attendance report for a course.

    - Teacher: Can only view their own courses
    - Admin/Superadmin: Can view any course in their tenant
    """
    tenant_id = uuid.UUID(payload["tenant_id"])
    user_id = uuid.UUID(payload["sub"])
    roles = payload.get("roles", [])

    # Verify course exists and user has access
    result = await db.execute(
        select(Course).where(Course.id == course_id, Course.tenant_id == tenant_id)
    )
    course = result.scalar_one_or_none()
    if not course:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("Course")

    # Check permissions
    is_admin = any(r in roles for r in ["admin", "superadmin"])
    if not is_admin and course.teacher_id != user_id:
        from app.core.exceptions import ForbiddenError
        raise ForbiddenError("You can only view attendance for your own courses")

    service = AttendanceService(db)
    return await service.get_attendance_report(
        course_id=course_id,
        date_from=date_from,
        date_to=date_to,
        tenant_id=tenant_id
    )


@router.get("/courses/{course_id}/students/{student_id}", response_model=AttendanceReport)
async def get_student_course_attendance(
    course_id: uuid.UUID,
    student_id: uuid.UUID,
    payload: CurrentUserPayload,
    db=Depends(get_db),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
):
    """
    Get attendance report for a specific student in a course.

    - Teacher: Can only view their own courses
    - Admin/Superadmin: Can view any course in their tenant
    """
    tenant_id = uuid.UUID(payload["tenant_id"])
    user_id = uuid.UUID(payload["sub"])
    roles = payload.get("roles", [])

    # Verify course exists and user has access
    result = await db.execute(
        select(Course).where(Course.id == course_id, Course.tenant_id == tenant_id)
    )
    course = result.scalar_one_or_none()
    if not course:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("Course")

    # Check permissions
    is_admin = any(r in roles for r in ["admin", "superadmin"])
    if not is_admin and course.teacher_id != user_id:
        from app.core.exceptions import ForbiddenError
        raise ForbiddenError("You can only view attendance for your own courses")

    service = AttendanceService(db)
    return await service.get_attendance_by_student(
        course_id=course_id,
        student_id=student_id,
        date_from=date_from,
        date_to=date_to,
        tenant_id=tenant_id
    )


@router.get("/courses/{course_id}/date/{attendance_date}", response_model=list[AttendanceRead])
async def get_course_attendance_by_date(
    course_id: uuid.UUID,
    attendance_date: date,
    payload: CurrentUserPayload,
    db=Depends(get_db),
):
    """
    Get all attendance records for a course on a specific date.

    - Teacher: Can only view their own courses
    - Admin/Superadmin: Can view any course in their tenant
    """
    tenant_id = uuid.UUID(payload["tenant_id"])
    user_id = uuid.UUID(payload["sub"])
    roles = payload.get("roles", [])

    # Verify course exists and user has access
    result = await db.execute(
        select(Course).where(Course.id == course_id, Course.tenant_id == tenant_id)
    )
    course = result.scalar_one_or_none()
    if not course:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("Course")

    # Check permissions
    is_admin = any(r in roles for r in ["admin", "superadmin"])
    if not is_admin and course.teacher_id != user_id:
        from app.core.exceptions import ForbiddenError
        raise ForbiddenError("You can only view attendance for your own courses")

    service = AttendanceService(db)
    return await service.get_attendance(
        course_id=course_id,
        attendance_date=attendance_date,
        tenant_id=tenant_id
    )


# ─────────────────────────────────────────────
# Student endpoints
# ─────────────────────────────────────────────


@router.get("/students/me", response_model=list[StudentAttendanceSummary])
async def get_my_attendance(
    payload: CurrentUserPayload,
    db=Depends(get_db),
    course_id: uuid.UUID | None = Query(None),
):
    """
    Get attendance for the current student.
    Optionally filter by course_id.
    """
    tenant_id = uuid.UUID(payload["tenant_id"])
    user_id = uuid.UUID(payload["sub"])
    roles = payload.get("roles", [])

    # Only students can access this endpoint for themselves
    if "student" not in roles:
        from app.core.exceptions import ForbiddenError
        raise ForbiddenError("Only students can access their own attendance")

    service = AttendanceService(db)

    if course_id:
        # Get attendance for specific course
        attendance_records = await service.get_student_attendance(
            student_id=user_id,
            course_id=course_id,
            tenant_id=tenant_id
        )
        # Calculate attendance rate
        total = len(attendance_records)
        present_count = sum(1 for r in attendance_records if r.status == "present")
        attendance_rate = (present_count / total * 100) if total > 0 else 0.0

        # Get course title
        course_result = await db.execute(
            select(Course).where(Course.id == course_id, Course.tenant_id == tenant_id)
        )
        course = course_result.scalar_one_or_none()

        return [StudentAttendanceSummary(
            course_id=course_id,
            course_title=course.title if course else "Unknown",
            attendance_records=attendance_records,
            attendance_rate=round(attendance_rate, 2)
        )]
    else:
        # Get attendance summary for all courses
        return await service.get_student_attendance_summary(
            student_id=user_id,
            tenant_id=tenant_id
        )
