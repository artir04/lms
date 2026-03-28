import uuid
from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from app.db.session import get_db
from app.dependencies import CurrentUserPayload, require_roles
from app.services.grade_service import GradeService
from app.core.permissions import Role
from app.schemas.grade import GradeBookRead, GradeEntryUpdate, GradeEntryRead, GradeEntryCreate, StudentGradeSummary
from app.schemas.upcoming import UpcomingAssignment

router = APIRouter(prefix="/gradebook", tags=["grades"])


@router.get("/courses/{course_id}", response_model=GradeBookRead, dependencies=[require_roles(Role.TEACHER, Role.ADMIN)])
async def get_gradebook(course_id: uuid.UUID, db=Depends(get_db)):
    return await GradeService(db).get_gradebook(course_id)


@router.post("/courses/{course_id}/entries", response_model=GradeEntryRead, dependencies=[require_roles(Role.TEACHER, Role.ADMIN)])
async def create_entry(course_id: uuid.UUID, data: GradeEntryCreate, db=Depends(get_db)):
    return await GradeService(db).create_entry(course_id, data)


@router.patch("/entries/{entry_id}", response_model=GradeEntryRead, dependencies=[require_roles(Role.TEACHER, Role.ADMIN)])
async def update_entry(entry_id: uuid.UUID, data: GradeEntryUpdate, db=Depends(get_db)):
    return await GradeService(db).update_entry(entry_id, data)


@router.get("/me", response_model=list[StudentGradeSummary])
async def my_grades(payload: CurrentUserPayload, db=Depends(get_db)):
    return await GradeService(db).get_student_grades(uuid.UUID(payload["sub"]), uuid.UUID(payload["tenant_id"]))


@router.get("/upcoming", response_model=list[UpcomingAssignment])
async def upcoming_assignments(payload: CurrentUserPayload, db=Depends(get_db)):
    """Get upcoming quizzes/assignments for the current student."""
    from datetime import datetime, timezone
    from app.models.assessment import Quiz, Submission
    from app.models.course import Course, Section, Enrollment

    student_id = uuid.UUID(payload["sub"])
    tenant_id = uuid.UUID(payload["tenant_id"])

    courses_result = await db.execute(
        select(Course)
        .join(Section, Section.course_id == Course.id)
        .join(Enrollment, Enrollment.section_id == Section.id)
        .where(Course.tenant_id == tenant_id, Enrollment.student_id == student_id, Enrollment.status == "active")
    )
    courses = courses_result.scalars().all()

    items = []
    now = datetime.now(timezone.utc)
    for course in courses:
        quizzes_result = await db.execute(
            select(Quiz).where(
                Quiz.course_id == course.id,
                Quiz.is_published == True,
            ).order_by(Quiz.due_at.asc().nullslast())
        )
        for quiz in quizzes_result.scalars().all():
            attempts_result = await db.execute(
                select(func.count()).select_from(Submission).where(
                    Submission.quiz_id == quiz.id,
                    Submission.student_id == student_id,
                )
            )
            attempts_used = attempts_result.scalar_one()
            if attempts_used >= quiz.max_attempts:
                continue

            items.append(UpcomingAssignment(
                quiz_id=quiz.id,
                quiz_title=quiz.title,
                course_id=course.id,
                course_title=course.title,
                due_at=quiz.due_at,
                time_limit_min=quiz.time_limit_min,
                max_attempts=quiz.max_attempts,
                attempts_used=attempts_used,
                is_overdue=quiz.due_at < now if quiz.due_at else False,
            ))

    items.sort(key=lambda x: (x.due_at is None, x.due_at))
    return items
