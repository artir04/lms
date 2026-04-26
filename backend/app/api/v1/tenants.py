import uuid
from fastapi import APIRouter, Body, Depends, Query
from sqlalchemy import select, func
from app.db.session import get_db
from app.dependencies import CurrentUserPayload, require_roles
from app.core.permissions import Role
from app.core.exceptions import NotFoundError
from app.models.tenant import District, School
from app.schemas.tenant import DistrictCreate, DistrictUpdate, DistrictRead, SchoolCreate, SchoolRead
from app.schemas.common import MessageResponse

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
    return merged


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
        from app.core.exceptions import NotFoundError
        raise NotFoundError("District")
    return district


@router.patch("/{district_id}", response_model=DistrictRead, dependencies=[require_roles(Role.SUPERADMIN)])
async def update_district(district_id: uuid.UUID, data: DistrictUpdate, db=Depends(get_db)):
    result = await db.execute(select(District).where(District.id == district_id))
    district = result.scalar_one_or_none()
    if not district:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("District")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(district, field, value)
    await db.flush()
    return district
