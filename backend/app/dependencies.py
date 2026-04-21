import uuid
from typing import Annotated, Any

from fastapi import Depends, Request, Cookie
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.core.security import decode_token
from app.core.exceptions import UnauthorizedError, ForbiddenError
from app.core.permissions import Role, has_any_role

bearer_scheme = HTTPBearer(auto_error=False)

DbSession = Annotated[AsyncSession, Depends(get_db)]


async def get_current_user_payload(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> dict:
    if not credentials:
        raise UnauthorizedError()
    try:
        payload = decode_token(credentials.credentials)
    except ValueError:
        raise UnauthorizedError("Invalid or expired token")
    if payload.get("type") != "access":
        raise UnauthorizedError("Invalid token type")
    return payload


CurrentUserPayload = Annotated[dict, Depends(get_current_user_payload)]


async def get_current_user(
    payload: CurrentUserPayload,
    db: DbSession,
):
    from app.models.user import User, UserRole
    from sqlalchemy.orm import selectinload

    user_id = uuid.UUID(payload["sub"])
    result = await db.execute(
        select(User)
        .options(selectinload(User.user_roles).selectinload(UserRole.role))
        .where(User.id == user_id, User.is_active == True)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise UnauthorizedError("User not found or inactive")
    return user


CurrentUser = Annotated[Any, Depends(get_current_user)]


def require_roles(*roles: Role):
    async def _check(payload: CurrentUserPayload):
        user_roles = payload.get("roles", [])
        if not has_any_role(user_roles, *roles):
            raise ForbiddenError()
        return payload
    return Depends(_check)


def require_admin():
    return require_roles(Role.ADMIN, Role.SUPERADMIN)


def require_teacher():
    return require_roles(Role.TEACHER, Role.ADMIN, Role.SUPERADMIN)


def require_superadmin():
    return require_roles(Role.SUPERADMIN)


def require_parent():
    return require_roles(Role.PARENT)
