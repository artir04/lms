import uuid
from fastapi import APIRouter, Depends, Query

from app.core.pagination import PaginationParams
from app.core.permissions import Role
from app.db.session import get_db
from app.dependencies import CurrentUserPayload, require_roles
from app.schemas.audit import AuditLogRead
from app.schemas.common import PaginatedResponse
from app.services.audit_service import AuditService

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get(
    "/logs",
    response_model=PaginatedResponse[AuditLogRead],
    dependencies=[require_roles(Role.ADMIN, Role.SUPERADMIN)],
)
async def list_audit_logs(
    payload: CurrentUserPayload,
    db=Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    action: str | None = None,
    target_type: str | None = None,
    target_id: uuid.UUID | None = None,
    actor_user_id: uuid.UUID | None = None,
    search: str | None = None,
):
    service = AuditService(db)
    tenant_id = uuid.UUID(payload["tenant_id"])
    params = PaginationParams(page=page, page_size=page_size)
    return await service.list_logs(
        tenant_id,
        params,
        action=action,
        target_type=target_type,
        target_id=target_id,
        actor_user_id=actor_user_id,
        search=search,
    )
