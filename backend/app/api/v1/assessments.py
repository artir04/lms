import uuid
from fastapi import APIRouter, Depends, Query
from app.db.session import get_db
from app.dependencies import CurrentUserPayload, require_roles
from app.services.assessment_service import AssessmentService
from app.core.pagination import PaginationParams
from app.core.permissions import Role
from app.schemas.assessment import (
    QuizCreate, QuizUpdate, QuizRead, QuizDetailRead,
    QuestionCreate, QuestionRead,
    SubmissionCreate, SubmissionRead, ManualGradeRequest,
)
from app.schemas.common import MessageResponse

router = APIRouter(prefix="/assessments", tags=["assessments"])


@router.get("/courses/{course_id}/quizzes", response_model=list[QuizRead])
async def list_quizzes(course_id: uuid.UUID, page: int = Query(1), page_size: int = Query(20), db=Depends(get_db)):
    service = AssessmentService(db)
    result = await service.list_quizzes(course_id, PaginationParams(page=page, page_size=page_size))
    return result.items


@router.post("/courses/{course_id}/quizzes", response_model=QuizRead, dependencies=[require_roles(Role.TEACHER, Role.ADMIN)])
async def create_quiz(course_id: uuid.UUID, data: QuizCreate, db=Depends(get_db)):
    service = AssessmentService(db)
    return await service.create_quiz(course_id, data)


@router.get("/quizzes/{quiz_id}", response_model=QuizDetailRead)
async def get_quiz(quiz_id: uuid.UUID, payload: CurrentUserPayload, db=Depends(get_db)):
    service = AssessmentService(db)
    quiz = await service.get_quiz(quiz_id)
    is_student = "student" in payload.get("roles", []) and "teacher" not in payload.get("roles", [])
    if is_student:
        for q in quiz.questions:
            for opt in q.options:
                opt.is_correct = None
    return quiz


@router.patch("/quizzes/{quiz_id}", response_model=QuizRead, dependencies=[require_roles(Role.TEACHER, Role.ADMIN)])
async def update_quiz(quiz_id: uuid.UUID, data: QuizUpdate, db=Depends(get_db)):
    service = AssessmentService(db)
    return await service.update_quiz(quiz_id, data)


@router.post("/quizzes/{quiz_id}/questions", response_model=QuestionRead, dependencies=[require_roles(Role.TEACHER, Role.ADMIN)])
async def add_question(quiz_id: uuid.UUID, data: QuestionCreate, db=Depends(get_db)):
    service = AssessmentService(db)
    return await service.add_question(quiz_id, data)


@router.post("/quizzes/{quiz_id}/submissions", response_model=SubmissionRead)
async def submit_quiz(
    quiz_id: uuid.UUID,
    data: SubmissionCreate,
    payload: CurrentUserPayload,
    db=Depends(get_db),
):
    service = AssessmentService(db)
    student_id = uuid.UUID(payload["sub"])
    submission = await service.start_submission(quiz_id, student_id)
    return await service.submit_answers(submission.id, student_id, data)


@router.get("/quizzes/{quiz_id}/submissions", response_model=list[SubmissionRead], dependencies=[require_roles(Role.TEACHER, Role.ADMIN)])
async def list_submissions(quiz_id: uuid.UUID, db=Depends(get_db)):
    from sqlalchemy import select
    from app.models.assessment import Submission
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(Submission).options(selectinload(Submission.answers)).where(Submission.quiz_id == quiz_id)
    )
    return result.scalars().all()


@router.get("/submissions/{submission_id}", response_model=SubmissionRead)
async def get_submission(
    submission_id: uuid.UUID,
    payload: CurrentUserPayload,
    db=Depends(get_db),
):
    from sqlalchemy import select
    from app.models.assessment import Submission
    from sqlalchemy.orm import selectinload
    from app.core.exceptions import NotFoundError, ForbiddenError
    result = await db.execute(
        select(Submission).options(selectinload(Submission.answers)).where(Submission.id == submission_id)
    )
    sub = result.scalar_one_or_none()
    if not sub:
        raise NotFoundError("Submission")
    if "student" in payload.get("roles", []) and str(sub.student_id) != payload["sub"]:
        raise ForbiddenError()
    return sub


@router.patch("/submissions/{submission_id}/grade", response_model=SubmissionRead, dependencies=[require_roles(Role.TEACHER, Role.ADMIN)])
async def manual_grade(
    submission_id: uuid.UUID,
    grades: list[ManualGradeRequest],
    payload: CurrentUserPayload,
    db=Depends(get_db),
):
    service = AssessmentService(db)
    return await service.manual_grade(submission_id, uuid.UUID(payload["sub"]), grades)
