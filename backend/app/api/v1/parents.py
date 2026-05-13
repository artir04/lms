import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query, Request

from app.core.exceptions import ForbiddenError
from app.core.permissions import Role
from app.db.session import get_db
from app.dependencies import CurrentUserPayload, get_current_user, require_parent, require_roles
from app.schemas.attendance import StudentAttendanceSummary
from app.schemas.common import MessageResponse
from app.schemas.grade import StudentGradeSummary
from app.schemas.parent import ChildProgressDetail, ParentDigest, ParentLinkRead, ParentStudentLink
from app.services.audit_service import AuditService
from app.services.parent_service import ParentService

router = APIRouter(prefix="/parents", tags=["parents"])


@router.get("/digest", response_model=ParentDigest)
async def get_digest(
    payload: CurrentUserPayload,
    db=Depends(get_db),
):
    roles = payload.get("roles", [])
    if "parent" not in roles:
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


# --- Admin parent-student link management ---

@router.get(
    "/links",
    dependencies=[require_roles(Role.ADMIN, Role.SUPERADMIN)],
)
async def list_parent_links(
    payload: CurrentUserPayload,
    db=Depends(get_db),
    search: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
):
    service = ParentService(db)
    tenant_id = uuid.UUID(payload["tenant_id"])
    return await service.list_links_admin(tenant_id, search=search, page=page, page_size=page_size)


@router.post(
    "/links",
    response_model=ParentLinkRead,
    dependencies=[require_roles(Role.ADMIN, Role.SUPERADMIN)],
)
async def create_parent_link(
    data: ParentStudentLink,
    payload: CurrentUserPayload,
    request: Request,
    db=Depends(get_db),
):
    service = ParentService(db)
    tenant_id = uuid.UUID(payload["tenant_id"])
    link = await service.create_link_admin(
        tenant_id,
        parent_id=data.parent_id,
        student_id=data.student_id,
    )
    await AuditService(db).record_from_payload(
        payload,
        action="parent_link.create",
        target_type="parent_student",
        target_id=link.id,
        summary="Linked parent to student",
        request=request,
        metadata={"parent_id": str(data.parent_id), "student_id": str(data.student_id)},
    )
    refreshed = await service.list_links_admin(tenant_id, page=1, page_size=1)
    found = next((row for row in refreshed["items"] if row["id"] == link.id), None)
    if found:
        return found
    return {
        "id": link.id,
        "parent_id": link.parent_id,
        "parent_name": "",
        "parent_email": "",
        "student_id": link.student_id,
        "student_name": "",
        "student_email": "",
        "created_at": link.created_at,
    }


@router.delete(
    "/links/{link_id}",
    response_model=MessageResponse,
    dependencies=[require_roles(Role.ADMIN, Role.SUPERADMIN)],
)
async def delete_parent_link(
    link_id: uuid.UUID,
    payload: CurrentUserPayload,
    request: Request,
    db=Depends(get_db),
):
    service = ParentService(db)
    tenant_id = uuid.UUID(payload["tenant_id"])
    link = await service.delete_link_admin(tenant_id, link_id)
    await AuditService(db).record_from_payload(
        payload,
        action="parent_link.delete",
        target_type="parent_student",
        target_id=link_id,
        summary="Unlinked parent from student",
        request=request,
        metadata={"parent_id": str(link.parent_id), "student_id": str(link.student_id)},
    )
    return MessageResponse(message="Parent-student link removed")


@router.get("/me/children", dependencies=[require_parent()])
async def get_my_children(
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    """Get all children linked to the current parent user."""
    service = ParentService(db)
    return await service.get_parent_children(current_user.id, current_user.tenant_id)


@router.get("/me/children/{student_id}/overview", dependencies=[require_parent()])
async def get_child_overview(
    student_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    """Get overview information for a specific child."""
    service = ParentService(db)
    return await service.get_child_overview(current_user.id, student_id, current_user.tenant_id)


@router.get("/me/children/{student_id}/grades", dependencies=[require_parent()], response_model=list[StudentGradeSummary])
async def get_child_grades(
    student_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    """Get grades for a specific child across all courses."""
    service = ParentService(db)
    return await service.get_child_grades(current_user.id, student_id, current_user.tenant_id)


@router.get("/me/children/{student_id}/attendance", dependencies=[require_parent()], response_model=list[StudentAttendanceSummary])
async def get_child_attendance(
    student_id: uuid.UUID,
    date_from: date | None = Query(None, description="Filter attendance from this date"),
    date_to: date | None = Query(None, description="Filter attendance to this date"),
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    """Get attendance records for a specific child across all courses."""
    service = ParentService(db)
    return await service.get_child_attendance(
        current_user.id,
        student_id,
        current_user.tenant_id,
        date_from,
        date_to,
    )
