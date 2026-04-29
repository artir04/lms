import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload

from app.models.user import User, Role, UserRole
from app.models.tenant import District
from app.core.security import hash_password
from app.core.exceptions import ConflictError, NotFoundError, ForbiddenError
from app.core.pagination import PaginationParams, PaginatedResponse
from app.schemas.user import UserCreate, UserUpdate


class UserService:
    def __init__(self, db: AsyncSession):
        self.db = db

    def _user_query(self, tenant_id: uuid.UUID):
        return (
            select(User)
            .options(selectinload(User.user_roles).selectinload(UserRole.role))
            .where(User.tenant_id == tenant_id)
        )

    async def get_by_id(self, user_id: uuid.UUID, tenant_id: uuid.UUID) -> User:
        result = await self.db.execute(
            self._user_query(tenant_id).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()
        if not user:
            raise NotFoundError("User")
        return user

    async def list_users(self, tenant_id: uuid.UUID, params: PaginationParams, role: str | None = None, search: str | None = None) -> PaginatedResponse[User]:
        query = self._user_query(tenant_id)
        if search:
            query = query.where(
                (User.first_name.ilike(f"%{search}%"))
                | (User.last_name.ilike(f"%{search}%"))
                | (User.email.ilike(f"%{search}%"))
            )
        if role:
            query = query.join(UserRole).join(Role).where(Role.name == role)

        total_result = await self.db.execute(select(func.count()).select_from(query.subquery()))
        total = total_result.scalar_one()

        result = await self.db.execute(query.offset(params.offset).limit(params.limit))
        users = result.scalars().all()
        return PaginatedResponse.create(users, total, params)

    async def create_user(self, data: UserCreate, tenant_id: uuid.UUID) -> User:
        # Enforce parent-only policy: parent role cannot co-exist with other roles
        if "parent" in data.roles and len(data.roles) > 1:
            raise ForbiddenError("Parent role cannot be combined with other roles")

        # Check email uniqueness within tenant
        existing = await self.db.execute(
            select(User).where(User.email == data.email.lower(), User.tenant_id == tenant_id)
        )
        if existing.scalar_one_or_none():
            raise ConflictError("Email already registered")

        user = User(
            tenant_id=tenant_id,
            email=data.email.lower(),
            first_name=data.first_name,
            last_name=data.last_name,
            school_id=data.school_id,
            password_hash=hash_password(data.password) if data.password else None,
        )
        self.db.add(user)
        await self.db.flush()

        # Assign roles
        for role_name in data.roles:
            role_result = await self.db.execute(select(Role).where(Role.name == role_name))
            role = role_result.scalar_one_or_none()
            if role:
                self.db.add(UserRole(user_id=user.id, role_id=role.id))

        await self.db.flush()
        await self.db.refresh(user)
        return user

    async def update_user(self, user_id: uuid.UUID, data: UserUpdate, tenant_id: uuid.UUID) -> User:
        user = await self.get_by_id(user_id, tenant_id)
        for field, value in data.model_dump(exclude_none=True).items():
            setattr(user, field, value)
        await self.db.flush()
        return user

    async def delete_user(self, user_id: uuid.UUID, tenant_id: uuid.UUID) -> None:
        user = await self.get_by_id(user_id, tenant_id)
        user.is_active = False
        await self.db.flush()
