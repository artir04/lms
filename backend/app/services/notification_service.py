import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from app.models.notification import Notification
from app.core.pagination import PaginationParams, PaginatedResponse


class NotificationService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_notification(self, user_id: uuid.UUID, tenant_id: uuid.UUID, type_: str, payload: dict) -> Notification:
        notif = Notification(user_id=user_id, tenant_id=tenant_id, type=type_, payload=payload)
        self.db.add(notif)
        await self.db.flush()
        return notif

    async def list_for_user(self, user_id: uuid.UUID, params: PaginationParams) -> PaginatedResponse[Notification]:
        query = select(Notification).where(Notification.user_id == user_id).order_by(Notification.created_at.desc())
        total = (await self.db.execute(select(func.count()).select_from(query.subquery()))).scalar_one()
        result = await self.db.execute(query.offset(params.offset).limit(params.limit))
        return PaginatedResponse.create(result.scalars().all(), total, params)

    async def mark_read(self, user_id: uuid.UUID, notification_ids: list[uuid.UUID]) -> None:
        result = await self.db.execute(
            select(Notification).where(
                Notification.user_id == user_id,
                Notification.id.in_(notification_ids),
            )
        )
        for notif in result.scalars().all():
            notif.is_read = True
        await self.db.flush()

    async def unread_count(self, user_id: uuid.UUID) -> int:
        result = await self.db.execute(
            select(func.count()).select_from(Notification).where(
                Notification.user_id == user_id, Notification.is_read == False
            )
        )
        return result.scalar_one()
