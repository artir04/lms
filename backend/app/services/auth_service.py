import uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload

from app.models.user import User
from app.models.tenant import District
from app.core.security import verify_password, create_access_token, create_refresh_token, decode_token
from app.core.exceptions import UnauthorizedError, NotFoundError
from app.schemas.auth import LoginRequest, TokenResponse


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def login(self, data: LoginRequest) -> dict:
        # Resolve tenant
        result = await self.db.execute(
            select(District).where(District.slug == data.tenant_slug, District.is_active == True)
        )
        district = result.scalar_one_or_none()
        if not district:
            raise UnauthorizedError("Invalid credentials")

        # Fetch user
        result = await self.db.execute(
            select(User)
            .options(selectinload(User.user_roles).selectinload(User.user_roles.property.mapper.class_.role))
            .where(
                and_(
                    User.email == data.email.lower(),
                    User.tenant_id == district.id,
                    User.is_active == True,
                )
            )
        )
        user = result.scalar_one_or_none()
        if not user or not user.password_hash:
            raise UnauthorizedError("Invalid credentials")
        if not verify_password(data.password, user.password_hash):
            raise UnauthorizedError("Invalid credentials")

        # Update last login
        user.last_login_at = datetime.now(timezone.utc)
        await self.db.flush()

        roles = [ur.role.name for ur in user.user_roles if ur.role]
        return {
            "access_token": create_access_token(user.id, district.id, roles),
            "refresh_token": create_refresh_token(user.id),
            "token_type": "bearer",
        }

    async def refresh(self, refresh_token: str) -> dict:
        try:
            payload = decode_token(refresh_token)
        except ValueError:
            raise UnauthorizedError("Invalid refresh token")
        if payload.get("type") != "refresh":
            raise UnauthorizedError("Invalid token type")

        user_id = uuid.UUID(payload["sub"])
        result = await self.db.execute(
            select(User)
            .options(selectinload(User.user_roles).selectinload(User.user_roles.property.mapper.class_.role))
            .where(User.id == user_id, User.is_active == True)
        )
        user = result.scalar_one_or_none()
        if not user:
            raise UnauthorizedError("User not found")

        roles = [ur.role.name for ur in user.user_roles if ur.role]
        return {
            "access_token": create_access_token(user.id, user.tenant_id, roles),
            "refresh_token": create_refresh_token(user.id),
            "token_type": "bearer",
        }
