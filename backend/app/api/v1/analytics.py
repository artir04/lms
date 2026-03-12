import uuid
from fastapi import APIRouter, Depends, Query
from app.db.session import get_db
from app.dependencies import CurrentUserPayload, require_roles
from app.services.analytics_service import AnalyticsService
from app.core.permissions import Role
from app.schemas.analytics import DashboardSummary, EngagementReport, GradeDistribution

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/dashboard", response_model=DashboardSummary)
async def dashboard(payload: CurrentUserPayload, db=Depends(get_db)):
    service = AnalyticsService(db)
    teacher_id = uuid.UUID(payload["sub"]) if "teacher" in payload.get("roles", []) else None
    return await service.get_dashboard(uuid.UUID(payload["tenant_id"]), teacher_id)


@router.get("/engagement", response_model=EngagementReport, dependencies=[require_roles(Role.TEACHER, Role.ADMIN)])
async def engagement(
    payload: CurrentUserPayload,
    db=Depends(get_db),
    days: int = Query(30, ge=7, le=365),
):
    service = AnalyticsService(db)
    return await service.get_engagement(uuid.UUID(payload["tenant_id"]), days)


@router.get("/grade-distribution/{course_id}", response_model=GradeDistribution, dependencies=[require_roles(Role.TEACHER, Role.ADMIN)])
async def grade_distribution(course_id: uuid.UUID, db=Depends(get_db)):
    service = AnalyticsService(db)
    return await service.get_grade_distribution(course_id)
