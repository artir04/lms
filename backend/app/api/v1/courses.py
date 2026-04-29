import uuid
from fastapi import APIRouter, Depends, Query
from app.db.session import get_db
from app.dependencies import CurrentUserPayload, require_roles
from app.services.course_service import CourseService
from app.core.pagination import PaginationParams
from app.core.permissions import Role
from app.schemas.course import CourseCreate, CourseUpdate, CourseRead, SectionCreate, SectionRead, EnrollmentCreate
from app.schemas.common import MessageResponse, PaginatedResponse

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


@router.post("", response_model=CourseRead, dependencies=[require_roles(Role.TEACHER, Role.ADMIN, Role.SUPERADMIN)])
async def create_course(data: CourseCreate, payload: CurrentUserPayload, db=Depends(get_db)):
    service = CourseService(db)
    return await service.create_course(data, uuid.UUID(payload["sub"]), uuid.UUID(payload["tenant_id"]))


@router.get("/{course_id}", response_model=CourseRead)
async def get_course(course_id: uuid.UUID, payload: CurrentUserPayload, db=Depends(get_db)):
    service = CourseService(db)
    return await service.get_by_id(course_id, uuid.UUID(payload["tenant_id"]))


@router.patch("/{course_id}", response_model=CourseRead, dependencies=[require_roles(Role.TEACHER, Role.ADMIN, Role.SUPERADMIN)])
async def update_course(course_id: uuid.UUID, data: CourseUpdate, payload: CurrentUserPayload, db=Depends(get_db)):
    service = CourseService(db)
    is_admin = any(r in payload.get("roles", []) for r in ["admin", "superadmin"])
    return await service.update_course(course_id, data, uuid.UUID(payload["sub"]), uuid.UUID(payload["tenant_id"]), is_admin)


@router.post("/{course_id}/publish", response_model=CourseRead, dependencies=[require_roles(Role.TEACHER, Role.ADMIN)])
async def toggle_publish(course_id: uuid.UUID, payload: CurrentUserPayload, db=Depends(get_db)):
    service = CourseService(db)
    course = await service.get_by_id(course_id, uuid.UUID(payload["tenant_id"]))
    is_admin = any(r in payload.get("roles", []) for r in ["admin", "superadmin"])
    return await service.update_course(
        course_id, CourseUpdate(is_published=not course.is_published),
        uuid.UUID(payload["sub"]), uuid.UUID(payload["tenant_id"]), is_admin
    )


@router.get("/{course_id}/sections", response_model=list[SectionRead])
async def list_sections(course_id: uuid.UUID, payload: CurrentUserPayload, db=Depends(get_db)):
    service = CourseService(db)
    return await service.list_sections(course_id, uuid.UUID(payload["tenant_id"]))


@router.post("/{course_id}/sections", response_model=SectionRead, dependencies=[require_roles(Role.TEACHER, Role.ADMIN)])
async def create_section(course_id: uuid.UUID, data: SectionCreate, payload: CurrentUserPayload, db=Depends(get_db)):
    service = CourseService(db)
    return await service.create_section(course_id, data, uuid.UUID(payload["tenant_id"]))


@router.post("/{course_id}/sections/{section_id}/enroll", response_model=MessageResponse, dependencies=[require_roles(Role.ADMIN, Role.SUPERADMIN)])
async def enroll_student(course_id: uuid.UUID, section_id: uuid.UUID, data: EnrollmentCreate, payload: CurrentUserPayload, db=Depends(get_db)):
    service = CourseService(db)
    await service.enroll_student(section_id, data.student_id, uuid.UUID(payload["tenant_id"]))
    return MessageResponse(message="Student enrolled successfully")


@router.delete("/{course_id}/sections/{section_id}/enroll/{student_id}", response_model=MessageResponse, dependencies=[require_roles(Role.ADMIN, Role.SUPERADMIN)])
async def drop_student(course_id: uuid.UUID, section_id: uuid.UUID, student_id: uuid.UUID, db=Depends(get_db)):
    service = CourseService(db)
    await service.drop_student(section_id, student_id)
    return MessageResponse(message="Student dropped")


@router.get("/{course_id}/enrollments")
async def list_enrollments(course_id: uuid.UUID, payload: CurrentUserPayload, db=Depends(get_db)):
    """Get all enrolled students for a course."""
    service = CourseService(db)
    return await service.list_enrollments(course_id, uuid.UUID(payload["tenant_id"]))
