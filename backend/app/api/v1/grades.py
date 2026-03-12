import uuid
from fastapi import APIRouter, Depends
from app.db.session import get_db
from app.dependencies import CurrentUserPayload, require_roles
from app.services.grade_service import GradeService
from app.core.permissions import Role
from app.schemas.grade import GradeBookRead, GradeEntryUpdate, GradeEntryRead, StudentGradeSummary

router = APIRouter(prefix="/gradebook", tags=["grades"])


@router.get("/courses/{course_id}", response_model=GradeBookRead, dependencies=[require_roles(Role.TEACHER, Role.ADMIN)])
async def get_gradebook(course_id: uuid.UUID, db=Depends(get_db)):
    return await GradeService(db).get_gradebook(course_id)


@router.patch("/entries/{entry_id}", response_model=GradeEntryRead, dependencies=[require_roles(Role.TEACHER, Role.ADMIN)])
async def update_entry(entry_id: uuid.UUID, data: GradeEntryUpdate, db=Depends(get_db)):
    return await GradeService(db).update_entry(entry_id, data)


@router.get("/me", response_model=list[StudentGradeSummary])
async def my_grades(payload: CurrentUserPayload, db=Depends(get_db)):
    return await GradeService(db).get_student_grades(uuid.UUID(payload["sub"]), uuid.UUID(payload["tenant_id"]))
