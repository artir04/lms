import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query

from app.core.exceptions import ForbiddenError
from app.core.permissions import Role
from app.db.session import get_db
from app.dependencies import CurrentUserPayload, get_current_user, require_parent, require_roles
from app.schemas.attendance import StudentAttendanceSummary
from app.schemas.common import MessageResponse
from app.schemas.grade import StudentGradeSummary
from app.schemas.parent import ChildProgressDetail, ParentDigest, ParentStudentLink
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
