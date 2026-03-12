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
