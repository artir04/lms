import uuid
from fastapi import APIRouter, Depends, Query
from app.db.session import get_db
from app.dependencies import CurrentUserPayload
from app.services.gamification_service import GamificationService
from app.schemas.gamification import StudentPoints, LeaderboardEntry

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
