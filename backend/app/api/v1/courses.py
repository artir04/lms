import uuid
from fastapi import APIRouter, Depends, Query, Request
from app.db.session import get_db
from app.dependencies import CurrentUserPayload, require_roles
from app.services.course_service import CourseService
from app.services.audit_service import AuditService
from app.core.pagination import PaginationParams
from app.core.permissions import Role
from app.core.exceptions import ForbiddenError, NotFoundError
from app.schemas.course import (
    CourseCreate,
    CourseUpdate,
    CourseRead,
    SectionCreate,
    SectionRead,
    EnrollmentCreate,
    TeacherReassign,
)
from app.schemas.common import MessageResponse, PaginatedResponse


def _is_staff(roles: list[str]) -> bool:
    return any(r in roles for r in ("teacher", "admin", "superadmin"))

router = APIRouter(prefix="/courses", tags=["courses"])


@router.get("", response_model=PaginatedResponse[CourseRead])
async def list_courses(
    payload: CurrentUserPayload,
    db=Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = None,
):
    service = CourseService(db)
    tenant_id = uuid.UUID(payload["tenant_id"])
    user_id = uuid.UUID(payload["sub"])
    roles = payload.get("roles", [])
    params = PaginationParams(page=page, page_size=page_size)
    teacher_id = user_id if "teacher" in roles else None
    student_id = user_id if "student" in roles else None
    return await service.list_courses(tenant_id, params, teacher_id=teacher_id, student_id=student_id, search=search)


@router.get(
    "/admin",
    response_model=PaginatedResponse[dict],
    dependencies=[require_roles(Role.ADMIN, Role.SUPERADMIN)],
)
async def list_courses_admin(
    payload: CurrentUserPayload,
    db=Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = None,
    teacher_id: uuid.UUID | None = None,
    school_id: uuid.UUID | None = None,
    status: str | None = Query(None, description="active | published | draft | archived"),
):
    service = CourseService(db)
    tenant_id = uuid.UUID(payload["tenant_id"])
    params = PaginationParams(page=page, page_size=page_size)
    return await service.list_admin(
        tenant_id,
        params,
        search=search,
        teacher_id=teacher_id,
        school_id=school_id,
        status=status,
    )


@router.post("", response_model=CourseRead, dependencies=[require_roles(Role.TEACHER, Role.ADMIN, Role.SUPERADMIN)])
async def create_course(data: CourseCreate, payload: CurrentUserPayload, request: Request, db=Depends(get_db)):
    service = CourseService(db)
    course = await service.create_course(data, uuid.UUID(payload["sub"]), uuid.UUID(payload["tenant_id"]))
    await AuditService(db).record_from_payload(
        payload,
        action="course.create",
        target_type="course",
        target_id=course.id,
        summary=f"Created course '{course.title}'",
        request=request,
    )
    return course


@router.get("/{course_id}", response_model=CourseRead)
async def get_course(course_id: uuid.UUID, payload: CurrentUserPayload, db=Depends(get_db)):
    service = CourseService(db)
    course = await service.get_by_id(course_id, uuid.UUID(payload["tenant_id"]))
    if not _is_staff(payload.get("roles", [])) and not course.is_published:
        raise NotFoundError("Course")
    return course


@router.patch("/{course_id}", response_model=CourseRead, dependencies=[require_roles(Role.TEACHER, Role.ADMIN, Role.SUPERADMIN)])
async def update_course(course_id: uuid.UUID, data: CourseUpdate, payload: CurrentUserPayload, request: Request, db=Depends(get_db)):
    service = CourseService(db)
    is_admin = any(r in payload.get("roles", []) for r in ["admin", "superadmin"])
    course = await service.update_course(course_id, data, uuid.UUID(payload["sub"]), uuid.UUID(payload["tenant_id"]), is_admin)
    await AuditService(db).record_from_payload(
        payload,
        action="course.update",
        target_type="course",
        target_id=course.id,
        summary=f"Updated course '{course.title}'",
        request=request,
        metadata=data.model_dump(exclude_unset=True),
    )
    return course


@router.post("/{course_id}/publish", response_model=CourseRead, dependencies=[require_roles(Role.TEACHER, Role.ADMIN)])
async def toggle_publish(course_id: uuid.UUID, payload: CurrentUserPayload, request: Request, db=Depends(get_db)):
    service = CourseService(db)
    course = await service.get_by_id(course_id, uuid.UUID(payload["tenant_id"]))
    is_admin = any(r in payload.get("roles", []) for r in ["admin", "superadmin"])
    updated = await service.update_course(
        course_id, CourseUpdate(is_published=not course.is_published),
        uuid.UUID(payload["sub"]), uuid.UUID(payload["tenant_id"]), is_admin
    )
    await AuditService(db).record_from_payload(
        payload,
        action="course.publish_toggle",
        target_type="course",
        target_id=course.id,
        summary=f"{'Published' if updated.is_published else 'Unpublished'} '{updated.title}'",
        request=request,
    )
    return updated


@router.post(
    "/{course_id}/archive",
    response_model=CourseRead,
    dependencies=[require_roles(Role.ADMIN, Role.SUPERADMIN)],
)
async def archive_course(course_id: uuid.UUID, payload: CurrentUserPayload, request: Request, db=Depends(get_db)):
    service = CourseService(db)
    tenant_id = uuid.UUID(payload["tenant_id"])
    course = await service.archive_course(course_id, tenant_id, archive=True)
    await AuditService(db).record_from_payload(
        payload,
        action="course.archive",
        target_type="course",
        target_id=course.id,
        summary=f"Archived course '{course.title}'",
        request=request,
    )
    return course


@router.post(
    "/{course_id}/unarchive",
    response_model=CourseRead,
    dependencies=[require_roles(Role.ADMIN, Role.SUPERADMIN)],
)
async def unarchive_course(course_id: uuid.UUID, payload: CurrentUserPayload, request: Request, db=Depends(get_db)):
    service = CourseService(db)
    tenant_id = uuid.UUID(payload["tenant_id"])
    course = await service.archive_course(course_id, tenant_id, archive=False)
    await AuditService(db).record_from_payload(
        payload,
        action="course.unarchive",
        target_type="course",
        target_id=course.id,
        summary=f"Unarchived course '{course.title}'",
        request=request,
    )
    return course


@router.post(
    "/{course_id}/reassign-teacher",
    response_model=CourseRead,
    dependencies=[require_roles(Role.ADMIN, Role.SUPERADMIN)],
)
async def reassign_teacher(
    course_id: uuid.UUID,
    data: TeacherReassign,
    payload: CurrentUserPayload,
    request: Request,
    db=Depends(get_db),
):
    service = CourseService(db)
    tenant_id = uuid.UUID(payload["tenant_id"])
    old = await service.get_by_id(course_id, tenant_id)
    previous_teacher_id = old.teacher_id
    course = await service.reassign_teacher(course_id, data.teacher_id, tenant_id)
    await AuditService(db).record_from_payload(
        payload,
        action="course.reassign_teacher",
        target_type="course",
        target_id=course.id,
        summary=f"Reassigned teacher for '{course.title}'",
        request=request,
        metadata={"from_teacher_id": str(previous_teacher_id), "to_teacher_id": str(data.teacher_id)},
    )
    return course


@router.get("/{course_id}/sections", response_model=list[SectionRead])
async def list_sections(course_id: uuid.UUID, payload: CurrentUserPayload, db=Depends(get_db)):
    service = CourseService(db)
    tenant_id = uuid.UUID(payload["tenant_id"])
    course = await service.get_by_id(course_id, tenant_id)
    if not _is_staff(payload.get("roles", [])) and not course.is_published:
        raise NotFoundError("Course")
    return await service.list_sections(course_id, tenant_id)


@router.post("/{course_id}/sections", response_model=SectionRead, dependencies=[require_roles(Role.TEACHER, Role.ADMIN, Role.SUPERADMIN)])
async def create_section(course_id: uuid.UUID, data: SectionCreate, payload: CurrentUserPayload, db=Depends(get_db)):
    service = CourseService(db)
    return await service.create_section(course_id, data, uuid.UUID(payload["tenant_id"]))


@router.post("/{course_id}/sections/{section_id}/enroll", response_model=MessageResponse, dependencies=[require_roles(Role.ADMIN, Role.SUPERADMIN)])
async def enroll_student(course_id: uuid.UUID, section_id: uuid.UUID, data: EnrollmentCreate, payload: CurrentUserPayload, request: Request, db=Depends(get_db)):
    service = CourseService(db)
    tenant_id = uuid.UUID(payload["tenant_id"])
    await service.enroll_student(section_id, data.student_id, tenant_id)
    await AuditService(db).record_from_payload(
        payload,
        action="enrollment.create",
        target_type="enrollment",
        target_id=section_id,
        summary="Enrolled student in section",
        request=request,
        metadata={"course_id": str(course_id), "section_id": str(section_id), "student_id": str(data.student_id)},
    )
    return MessageResponse(message="Student enrolled successfully")


@router.delete("/{course_id}/sections/{section_id}/enroll/{student_id}", response_model=MessageResponse, dependencies=[require_roles(Role.ADMIN, Role.SUPERADMIN)])
async def drop_student(course_id: uuid.UUID, section_id: uuid.UUID, student_id: uuid.UUID, payload: CurrentUserPayload, request: Request, db=Depends(get_db)):
    service = CourseService(db)
    await service.drop_student(section_id, student_id, uuid.UUID(payload["tenant_id"]))
    await AuditService(db).record_from_payload(
        payload,
        action="enrollment.drop",
        target_type="enrollment",
        target_id=section_id,
        summary="Dropped student from section",
        request=request,
        metadata={"course_id": str(course_id), "section_id": str(section_id), "student_id": str(student_id)},
    )
    return MessageResponse(message="Student dropped")


@router.get("/{course_id}/enrollments")
async def list_enrollments(
    course_id: uuid.UUID,
    payload: CurrentUserPayload,
    db=Depends(get_db),
    section_id: uuid.UUID | None = Query(None, description="Optional: filter roster to a single section"),
):
    """Class list for a course. Visible to staff and to actively-enrolled students."""
    from sqlalchemy import func, select
    from app.models.course import Enrollment, Section

    service = CourseService(db)
    tenant_id = uuid.UUID(payload["tenant_id"])
    course = await service.get_by_id(course_id, tenant_id)
    roles = payload.get("roles", [])
    user_id = uuid.UUID(payload["sub"])
    is_admin = any(r in roles for r in ("admin", "superadmin"))
    is_owning_teacher = course.teacher_id == user_id

    if not (is_admin or is_owning_teacher):
        enrolled = (await db.execute(
            select(func.count())
            .select_from(Enrollment)
            .join(Section, Section.id == Enrollment.section_id)
            .where(
                Section.course_id == course_id,
                Enrollment.student_id == user_id,
                Enrollment.status == "active",
            )
        )).scalar_one()
        if not enrolled:
            raise ForbiddenError("You don't have access to this class list")

    return await service.list_enrollments(course_id, tenant_id, section_id=section_id)
