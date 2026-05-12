import uuid
from typing import Any

from fastapi import Request
from sqlalchemy import select, and_, or_, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.pagination import PaginatedResponse, PaginationParams
from app.models.audit import AuditLog
from app.models.user import User


class AuditService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def record(
        self,
        *,
        tenant_id: uuid.UUID,
        action: str,
        actor_user_id: uuid.UUID | None = None,
        actor_email: str | None = None,
        actor_role: str | None = None,
        target_type: str | None = None,
        target_id: uuid.UUID | None = None,
        summary: str | None = None,
        request: Request | None = None,
        metadata: dict | None = None,
    ) -> AuditLog:
        ip = None
        ua = None
        if request is not None:
            forwarded = request.headers.get("x-forwarded-for")
            ip = (forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else None))
            ua = request.headers.get("user-agent")
            if ua and len(ua) > 255:
                ua = ua[:255]

        entry = AuditLog(
            tenant_id=tenant_id,
            actor_user_id=actor_user_id,
            actor_email=actor_email,
            actor_role=actor_role,
            action=action,
            target_type=target_type,
            target_id=target_id,
            summary=summary,
            ip_address=ip,
            user_agent=ua,
            event_metadata=metadata,
        )
        self.db.add(entry)
        await self.db.flush()
        return entry

    async def record_from_payload(
        self,
        payload: dict,
        *,
        action: str,
        target_type: str | None = None,
        target_id: uuid.UUID | None = None,
        summary: str | None = None,
        request: Request | None = None,
        metadata: dict | None = None,
    ) -> AuditLog:
        roles = payload.get("roles") or []
        actor_role = roles[0] if roles else None
        actor_user_id = uuid.UUID(payload["sub"]) if payload.get("sub") else None
        tenant_id = uuid.UUID(payload["tenant_id"])
        actor_email = payload.get("email")
        if not actor_email and actor_user_id:
            res = await self.db.execute(select(User.email).where(User.id == actor_user_id))
            actor_email = res.scalar_one_or_none()
        return await self.record(
            tenant_id=tenant_id,
            action=action,
            actor_user_id=actor_user_id,
            actor_email=actor_email,
            actor_role=actor_role,
            target_type=target_type,
            target_id=target_id,
            summary=summary,
            request=request,
            metadata=metadata,
        )

    async def list_logs(
        self,
        tenant_id: uuid.UUID,
        params: PaginationParams,
        *,
        action: str | None = None,
        target_type: str | None = None,
        target_id: uuid.UUID | None = None,
        actor_user_id: uuid.UUID | None = None,
        search: str | None = None,
    ) -> PaginatedResponse[AuditLog]:
        query = select(AuditLog).where(AuditLog.tenant_id == tenant_id)
        if action:
            query = query.where(AuditLog.action == action)
        if target_type:
            query = query.where(AuditLog.target_type == target_type)
        if target_id:
            query = query.where(AuditLog.target_id == target_id)
        if actor_user_id:
            query = query.where(AuditLog.actor_user_id == actor_user_id)
        if search:
            term = f"%{search}%"
            query = query.where(
                or_(
                    AuditLog.summary.ilike(term),
                    AuditLog.actor_email.ilike(term),
                    AuditLog.action.ilike(term),
                )
            )

        total = (await self.db.execute(select(func.count()).select_from(query.subquery()))).scalar_one()
        ordered = query.order_by(desc(AuditLog.created_at)).offset(params.offset).limit(params.limit)
        rows = (await self.db.execute(ordered)).scalars().all()
        return PaginatedResponse.create(rows, total, params)

    async def list_for_target(
        self,
        tenant_id: uuid.UUID,
        target_type: str,
        target_id: uuid.UUID,
        limit: int = 100,
    ) -> list[AuditLog]:
        result = await self.db.execute(
            select(AuditLog)
            .where(
                and_(
                    AuditLog.tenant_id == tenant_id,
                    AuditLog.target_type == target_type,
                    AuditLog.target_id == target_id,
                )
            )
            .order_by(desc(AuditLog.created_at))
            .limit(limit)
        )
        return list(result.scalars().all())
