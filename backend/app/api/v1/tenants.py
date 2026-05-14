import uuid
from fastapi import APIRouter, Body, Depends, Query, Request
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.core.exceptions import ConflictError, NotFoundError
from app.core.permissions import Role
from app.db.session import get_db
from app.dependencies import CurrentUserPayload, require_roles
from app.models.course import Course
from app.models.tenant import District, School
from app.models.user import User
from app.schemas.common import MessageResponse
from app.schemas.tenant import (
    DistrictCreate,
    DistrictRead,
    DistrictUpdate,
    SchoolCreate,
    SchoolDetail,
    SchoolRead,
    SchoolUpdate,
)
from app.services.audit_service import AuditService

router = APIRouter(prefix="/tenants", tags=["tenants"])


@router.get("", response_model=list[DistrictRead], dependencies=[require_roles(Role.SUPERADMIN)])
async def list_districts(db=Depends(get_db), page: int = Query(1), page_size: int = Query(20)):
    result = await db.execute(select(District).offset((page - 1) * page_size).limit(page_size))
    return result.scalars().all()


@router.get(
    "/me/settings",
    response_model=dict,
    dependencies=[require_roles(Role.ADMIN, Role.SUPERADMIN)],
)
async def get_my_tenant_settings(payload: CurrentUserPayload, db=Depends(get_db)):
    tenant_id = uuid.UUID(payload["tenant_id"])
    result = await db.execute(select(District).where(District.id == tenant_id))
    district = result.scalar_one_or_none()
    if not district:
        raise NotFoundError("District")
    return district.settings or {}


@router.patch(
    "/me/settings",
    response_model=dict,
    dependencies=[require_roles(Role.ADMIN, Role.SUPERADMIN)],
)
async def update_my_tenant_settings(
    payload: CurrentUserPayload,
    request: Request,
    settings: dict = Body(...),
    db=Depends(get_db),
):
    tenant_id = uuid.UUID(payload["tenant_id"])
    result = await db.execute(select(District).where(District.id == tenant_id))
    district = result.scalar_one_or_none()
    if not district:
        raise NotFoundError("District")
    merged = {**(district.settings or {}), **settings}
    district.settings = merged
    await db.flush()
    await AuditService(db).record_from_payload(
        payload,
        action="tenant.settings.update",
        target_type="tenant",
        target_id=tenant_id,
        summary="Updated tenant settings",
        request=request,
        metadata={"keys": list(settings.keys())},
    )
    return merged


# --- Schools (admin scope) ---

@router.get(
    "/me/schools",
    response_model=list[SchoolDetail],
    dependencies=[require_roles(Role.ADMIN, Role.SUPERADMIN)],
)
async def list_my_schools(
    payload: CurrentUserPayload,
    db=Depends(get_db),
    include_inactive: bool = Query(False),
):
    tenant_id = uuid.UUID(payload["tenant_id"])
    query = select(School).where(School.district_id == tenant_id).options(selectinload(School.principal))
    if not include_inactive:
        query = query.where(School.is_active == True)
    result = await db.execute(query.order_by(School.name))
    schools = result.scalars().all()

    user_counts = dict(
        (await db.execute(
            select(User.school_id, func.count())
            .where(User.tenant_id == tenant_id, User.school_id.is_not(None))
            .group_by(User.school_id)
        )).all()
    )
    course_counts = dict(
        (await db.execute(
            select(Course.school_id, func.count())
            .where(Course.tenant_id == tenant_id, Course.school_id.is_not(None))
            .group_by(Course.school_id)
        )).all()
    )

    return [
        SchoolDetail(
            id=s.id,
            district_id=s.district_id,
            name=s.name,
            code=s.code,
            academic_year=s.academic_year,
            principal_id=s.principal_id,
            is_active=s.is_active,
            principal_name=s.principal.full_name if s.principal else None,
            principal_email=s.principal.email if s.principal else None,
            user_count=user_counts.get(s.id, 0),
            course_count=course_counts.get(s.id, 0),
        )
        for s in schools
    ]


@router.post(
    "/me/schools",
    response_model=SchoolRead,
    dependencies=[require_roles(Role.ADMIN, Role.SUPERADMIN)],
)
async def create_my_school(
    data: SchoolCreate,
    payload: CurrentUserPayload,
    request: Request,
    db=Depends(get_db),
):
    tenant_id = uuid.UUID(payload["tenant_id"])
    existing = await db.execute(
        select(School).where(School.district_id == tenant_id, School.code == data.code)
    )
    if existing.scalar_one_or_none():
        raise ConflictError("A school with this code already exists in your district")
    if data.principal_id:
        principal = await db.execute(
            select(User).where(User.id == data.principal_id, User.tenant_id == tenant_id)
        )
        if not principal.scalar_one_or_none():
            raise NotFoundError("Principal user")
        principal_conflict = await db.execute(
            select(School).where(
                School.district_id == tenant_id,
                School.principal_id == data.principal_id,
                School.is_active == True,
            )
        )
        if principal_conflict.scalar_one_or_none():
            raise ConflictError(
                "This user is already the principal of another active school"
            )

    school = School(district_id=tenant_id, **data.model_dump())
    db.add(school)
    await db.flush()
    await AuditService(db).record_from_payload(
        payload,
        action="school.create",
        target_type="school",
        target_id=school.id,
        summary=f"Created school '{school.name}' ({school.code})",
        request=request,
        metadata={"academic_year": school.academic_year},
    )
    return school


@router.patch(
    "/me/schools/{school_id}",
    response_model=SchoolRead,
    dependencies=[require_roles(Role.ADMIN, Role.SUPERADMIN)],
)
async def update_my_school(
    school_id: uuid.UUID,
    data: SchoolUpdate,
    payload: CurrentUserPayload,
    request: Request,
    db=Depends(get_db),
):
    tenant_id = uuid.UUID(payload["tenant_id"])
    result = await db.execute(
        select(School).where(School.id == school_id, School.district_id == tenant_id)
    )
    school = result.scalar_one_or_none()
    if not school:
        raise NotFoundError("School")

    updates = data.model_dump(exclude_unset=True)
    if "principal_id" in updates and updates["principal_id"]:
        principal = await db.execute(
            select(User).where(User.id == updates["principal_id"], User.tenant_id == tenant_id)
        )
        if not principal.scalar_one_or_none():
            raise NotFoundError("Principal user")
        principal_conflict = await db.execute(
            select(School).where(
                School.district_id == tenant_id,
                School.principal_id == updates["principal_id"],
                School.id != school_id,
                School.is_active == True,
            )
        )
        if principal_conflict.scalar_one_or_none():
            raise ConflictError(
                "This user is already the principal of another active school"
            )
    for field, value in updates.items():
        setattr(school, field, value)
    await db.flush()
    await AuditService(db).record_from_payload(
        payload,
        action="school.update",
        target_type="school",
        target_id=school.id,
        summary=f"Updated school '{school.name}'",
        request=request,
        metadata=data.model_dump(exclude_unset=True, mode="json"),
    )
    return school


@router.delete(
    "/me/schools/{school_id}",
    response_model=MessageResponse,
    dependencies=[require_roles(Role.ADMIN, Role.SUPERADMIN)],
)
async def deactivate_my_school(
    school_id: uuid.UUID,
    payload: CurrentUserPayload,
    request: Request,
    db=Depends(get_db),
):
    tenant_id = uuid.UUID(payload["tenant_id"])
    result = await db.execute(
        select(School).where(School.id == school_id, School.district_id == tenant_id)
    )
    school = result.scalar_one_or_none()
    if not school:
        raise NotFoundError("School")
    school.is_active = False
    await db.flush()
    await AuditService(db).record_from_payload(
        payload,
        action="school.deactivate",
        target_type="school",
        target_id=school.id,
        summary=f"Deactivated school '{school.name}'",
        request=request,
    )
    return MessageResponse(message="School deactivated")


@router.post("", response_model=DistrictRead, dependencies=[require_roles(Role.SUPERADMIN)])
async def create_district(data: DistrictCreate, db=Depends(get_db)):
    district = District(**data.model_dump())
    db.add(district)
    await db.flush()
    return district


@router.get("/{district_id}", response_model=DistrictRead, dependencies=[require_roles(Role.SUPERADMIN)])
async def get_district(district_id: uuid.UUID, db=Depends(get_db)):
    result = await db.execute(select(District).where(District.id == district_id))
    district = result.scalar_one_or_none()
    if not district:
        raise NotFoundError("District")
    return district


@router.patch("/{district_id}", response_model=DistrictRead, dependencies=[require_roles(Role.SUPERADMIN)])
async def update_district(district_id: uuid.UUID, data: DistrictUpdate, db=Depends(get_db)):
    result = await db.execute(select(District).where(District.id == district_id))
    district = result.scalar_one_or_none()
    if not district:
        raise NotFoundError("District")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(district, field, value)
    await db.flush()
    return district
