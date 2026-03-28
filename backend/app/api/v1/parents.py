import uuid
from fastapi import APIRouter, Depends
from app.db.session import get_db
from app.dependencies import CurrentUserPayload, require_roles
from app.services.parent_service import ParentService
from app.core.permissions import Role
from app.schemas.parent import ParentDigest, ChildProgressDetail, ParentStudentLink
from app.schemas.common import MessageResponse

router = APIRouter(prefix="/parents", tags=["parents"])


@router.get("/digest", response_model=ParentDigest)
async def get_digest(
    payload: CurrentUserPayload,
    db=Depends(get_db),
):
    roles = payload.get("roles", [])
    if "parent" not in roles:
        from app.core.exceptions import ForbiddenError
        raise ForbiddenError("Parent role required")
    service = ParentService(db)
    return await service.get_digest(
        uuid.UUID(payload["sub"]),
        uuid.UUID(payload["tenant_id"]),
    )


@router.get("/children/{student_id}/progress", response_model=ChildProgressDetail)
async def get_child_progress(
    student_id: uuid.UUID,
    payload: CurrentUserPayload,
    db=Depends(get_db),
):
    roles = payload.get("roles", [])
    if "parent" not in roles:
        from app.core.exceptions import ForbiddenError
        raise ForbiddenError("Parent role required")
    service = ParentService(db)
    return await service.get_child_progress(
        uuid.UUID(payload["sub"]),
        student_id,
        uuid.UUID(payload["tenant_id"]),
    )


@router.post("/link", response_model=MessageResponse, dependencies=[require_roles(Role.ADMIN, Role.SUPERADMIN)])
async def link_parent_student(
    data: ParentStudentLink,
    db=Depends(get_db),
):
    service = ParentService(db)
    await service.link_child(data.parent_id, data.student_id)
    return MessageResponse(message="Parent-student link created")
