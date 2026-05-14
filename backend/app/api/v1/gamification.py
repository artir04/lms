import uuid
from fastapi import APIRouter, Depends, Query, status
from app.db.session import get_db
from app.dependencies import CurrentUserPayload, require_teacher
from app.services.gamification_service import GamificationService
from app.schemas.gamification import (
    StudentPoints,
    LeaderboardEntry,
    ActivityCreate,
    ActivityUpdate,
    ActivityRead,
    PointEntryRead,
)

router = APIRouter(prefix="/gamification", tags=["gamification"])


@router.get("/me", response_model=StudentPoints)
async def get_my_points(payload: CurrentUserPayload, db=Depends(get_db)):
    service = GamificationService(db)
    return await service.get_student_points(uuid.UUID(payload["sub"]))


@router.get("/leaderboard", response_model=list[LeaderboardEntry])
async def get_leaderboard(
    payload: CurrentUserPayload,
    db=Depends(get_db),
    limit: int = Query(20, ge=1, le=100),
):
    service = GamificationService(db)
    return await service.get_leaderboard(uuid.UUID(payload["tenant_id"]), limit)


@router.get("/activities", response_model=list[ActivityRead])
async def list_activities(
    payload: CurrentUserPayload,
    db=Depends(get_db),
    include_inactive: bool = Query(False),
    course_id: uuid.UUID | None = Query(None),
):
    service = GamificationService(db)
    return await service.list_activities(
        tenant_id=uuid.UUID(payload["tenant_id"]),
        user_id=uuid.UUID(payload["sub"]),
        include_inactive=include_inactive,
        course_id=course_id,
    )


@router.post(
    "/activities",
    response_model=ActivityRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[require_teacher()],
)
async def create_activity(
    body: ActivityCreate,
    payload: CurrentUserPayload,
    db=Depends(get_db),
):
    service = GamificationService(db)
    activity = await service.create_activity(
        tenant_id=uuid.UUID(payload["tenant_id"]),
        created_by=uuid.UUID(payload["sub"]),
        data=body,
    )
    return ActivityRead(
        id=activity.id,
        title=activity.title,
        description=activity.description,
        points=activity.points,
        category=activity.category,
        course_id=activity.course_id,
        created_by=activity.created_by,
        is_active=activity.is_active,
        created_at=activity.created_at,
        completed=False,
        completed_at=None,
        completion_count=0,
    )


@router.patch(
    "/activities/{activity_id}",
    response_model=ActivityRead,
    dependencies=[require_teacher()],
)
async def update_activity(
    activity_id: uuid.UUID,
    body: ActivityUpdate,
    payload: CurrentUserPayload,
    db=Depends(get_db),
):
    service = GamificationService(db)
    activity = await service.update_activity(
        activity_id=activity_id,
        tenant_id=uuid.UUID(payload["tenant_id"]),
        data=body,
    )
    items = await service.list_activities(
        tenant_id=uuid.UUID(payload["tenant_id"]),
        user_id=uuid.UUID(payload["sub"]),
        include_inactive=True,
    )
    return next((i for i in items if i.id == activity.id))


@router.delete(
    "/activities/{activity_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[require_teacher()],
)
async def delete_activity(
    activity_id: uuid.UUID,
    payload: CurrentUserPayload,
    db=Depends(get_db),
):
    service = GamificationService(db)
    await service.delete_activity(
        activity_id=activity_id,
        tenant_id=uuid.UUID(payload["tenant_id"]),
    )


@router.post(
    "/activities/{activity_id}/complete",
    response_model=PointEntryRead,
    status_code=status.HTTP_201_CREATED,
)
async def complete_activity(
    activity_id: uuid.UUID,
    payload: CurrentUserPayload,
    db=Depends(get_db),
):
    service = GamificationService(db)
    entry = await service.complete_activity(
        activity_id=activity_id,
        user_id=uuid.UUID(payload["sub"]),
        tenant_id=uuid.UUID(payload["tenant_id"]),
    )
    return PointEntryRead.model_validate(entry)
