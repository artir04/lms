import uuid
from datetime import date
from fastapi import APIRouter, Depends, Query
from app.db.session import get_db
from app.dependencies import get_current_user, CurrentUserPayload, require_parent
from app.services.parent_service import ParentService
from app.schemas.grade import StudentGradeSummary
from app.schemas.attendance import StudentAttendanceSummary

router = APIRouter(prefix="/parents", tags=["parents"])


@router.get("/me/children", dependencies=[require_parent()])
async def get_my_children(
    current_user=Depends(get_current_user),
    db=Depends(get_db)
):
    """Get all children linked to the current parent user."""
    service = ParentService(db)
    return await service.get_parent_children(current_user.id, current_user.tenant_id)


@router.get("/me/children/{student_id}/overview", dependencies=[require_parent()])
async def get_child_overview(
    student_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db=Depends(get_db)
):
    """Get overview information for a specific child."""
    service = ParentService(db)
    return await service.get_child_overview(current_user.id, student_id, current_user.tenant_id)


@router.get("/me/children/{student_id}/grades", dependencies=[require_parent()], response_model=list[StudentGradeSummary])
async def get_child_grades(
    student_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db=Depends(get_db)
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
    db=Depends(get_db)
):
    """Get attendance records for a specific child across all courses."""
    service = ParentService(db)
    # Note: The attendance summary service doesn't currently support date filtering,
    # but we pass the parameters for future implementation
    return await service.get_child_attendance(
        current_user.id,
        student_id,
        current_user.tenant_id,
        date_from,
        date_to
    )