import uuid
from fastapi import APIRouter, Depends, Query
from app.db.session import get_db
from app.dependencies import get_current_user, CurrentUserPayload, require_roles
from app.services.user_service import UserService
from app.core.pagination import PaginationParams
from app.core.permissions import Role
from app.schemas.user import UserCreate, UserUpdate, UserRead, PasswordChange
from app.schemas.common import MessageResponse, PaginatedResponse
from app.core.security import verify_password, hash_password
from app.core.exceptions import UnauthorizedError

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserRead)
async def get_me(current_user=Depends(get_current_user)):
    return current_user


@router.get("/teacher/students")
async def get_teacher_students(payload: CurrentUserPayload, db=Depends(get_db)):
    """Return the distinct students enrolled in courses the caller teaches,
    along with which courses each is in. Admin/superadmin sees every student
    in the tenant."""
    from sqlalchemy import select, func
    from sqlalchemy.orm import selectinload
    from app.models.user import User as UserModel
    from app.models.course import Course, Section, Enrollment
    from app.core.exceptions import ForbiddenError

    user_id = uuid.UUID(payload["sub"])
    tenant_id = uuid.UUID(payload["tenant_id"])
    roles = payload.get("roles", [])
    is_admin = any(r in roles for r in ("admin", "superadmin"))
    is_teacher = "teacher" in roles
    if not is_teacher and not is_admin:
        raise ForbiddenError()

    course_q = select(Course).where(Course.tenant_id == tenant_id)
    if not is_admin:
        course_q = course_q.where(Course.teacher_id == user_id)
    courses = (await db.execute(course_q)).scalars().all()
    if not courses:
        return []
    course_ids = [c.id for c in courses]
    course_titles = {c.id: c.title for c in courses}

    rows_r = await db.execute(
        select(
            UserModel.id,
            UserModel.first_name,
            UserModel.last_name,
            UserModel.email,
            UserModel.avatar_url,
            Section.course_id,
        )
        .join(Enrollment, Enrollment.student_id == UserModel.id)
        .join(Section, Section.id == Enrollment.section_id)
        .where(
            Section.course_id.in_(course_ids),
            Enrollment.status == "active",
            UserModel.is_active == True,
        )
        .distinct()
    )

    students: dict[uuid.UUID, dict] = {}
    for row in rows_r.all():
        sid = row[0]
        if sid not in students:
            students[sid] = {
                "id": str(sid),
                "first_name": row[1],
                "last_name": row[2],
                "full_name": f"{row[1]} {row[2]}",
                "email": row[3],
                "avatar_url": row[4],
                "course_count": 0,
                "courses": [],
            }
        students[sid]["course_count"] += 1
        students[sid]["courses"].append(
            {"id": str(row[5]), "title": course_titles[row[5]]}
        )

    return sorted(students.values(), key=lambda s: s["full_name"].lower())


@router.patch("/me", response_model=UserRead)
async def update_me(data: UserUpdate, current_user=Depends(get_current_user), db=Depends(get_db)):
    service = UserService(db)
    return await service.update_user(current_user.id, data, current_user.tenant_id)


@router.post("/me/change-password", response_model=MessageResponse)
async def change_password(data: PasswordChange, current_user=Depends(get_current_user), db=Depends(get_db)):
    if not current_user.password_hash or not verify_password(data.current_password, current_user.password_hash):
        raise UnauthorizedError("Current password is incorrect")
    current_user.password_hash = hash_password(data.new_password)
    await db.flush()
    return MessageResponse(message="Password changed successfully")


@router.get("", response_model=PaginatedResponse[UserRead], dependencies=[require_roles(Role.ADMIN, Role.SUPERADMIN)])
async def list_users(
    payload: CurrentUserPayload,
    db=Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    role: str | None = None,
    search: str | None = None,
):
    service = UserService(db)
    tenant_id = uuid.UUID(payload["tenant_id"])
    params = PaginationParams(page=page, page_size=page_size)
    return await service.list_users(tenant_id, params, role=role, search=search)


@router.post("", response_model=UserRead, dependencies=[require_roles(Role.ADMIN, Role.SUPERADMIN)])
async def create_user(
    data: UserCreate,
    payload: CurrentUserPayload,
    db=Depends(get_db),
):
    service = UserService(db)
    tenant_id = uuid.UUID(payload["tenant_id"])
    return await service.create_user(data, tenant_id)


@router.get("/{user_id}", response_model=UserRead)
async def get_user(user_id: uuid.UUID, payload: CurrentUserPayload, db=Depends(get_db)):
    service = UserService(db)
    return await service.get_by_id(user_id, uuid.UUID(payload["tenant_id"]))


@router.patch("/{user_id}", response_model=UserRead, dependencies=[require_roles(Role.ADMIN, Role.SUPERADMIN)])
async def update_user(
    user_id: uuid.UUID,
    data: UserUpdate,
    payload: CurrentUserPayload,
    db=Depends(get_db),
):
    service = UserService(db)
    return await service.update_user(user_id, data, uuid.UUID(payload["tenant_id"]))


@router.delete("/{user_id}", response_model=MessageResponse, dependencies=[require_roles(Role.ADMIN, Role.SUPERADMIN)])
async def delete_user(
    user_id: uuid.UUID,
    payload: CurrentUserPayload,
    db=Depends(get_db),
):
    service = UserService(db)
    await service.delete_user(user_id, uuid.UUID(payload["tenant_id"]))
    return MessageResponse(message="User deactivated")
