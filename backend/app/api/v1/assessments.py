import uuid
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from app.db.session import get_db
from app.dependencies import CurrentUserPayload, require_roles
from app.services.assessment_service import AssessmentService
from app.core.pagination import PaginationParams
from app.core.permissions import Role
from app.core.exceptions import ForbiddenError, NotFoundError
from app.models.course import Course
from app.models.assessment import Quiz
from app.schemas.assessment import (
    QuizCreate, QuizUpdate, QuizRead, QuizDetailRead,
    QuestionCreate, QuestionRead,
    SubmissionCreate, SubmissionRead, SubmissionListItem, ManualGradeRequest,
)
from app.schemas.common import MessageResponse

router = APIRouter(prefix="/assessments", tags=["assessments"])


async def _assert_course_access(course_id: uuid.UUID, payload: dict, db) -> None:
    """Raise unless caller is admin/superadmin or the course's owning teacher."""
    course_r = await db.execute(
        select(Course).where(
            Course.id == course_id,
            Course.tenant_id == uuid.UUID(payload["tenant_id"]),
        )
    )
    course = course_r.scalar_one_or_none()
    if not course:
        raise NotFoundError("Course")
    roles = payload.get("roles", [])
    if any(r in roles for r in ("admin", "superadmin")):
        return
    if course.teacher_id != uuid.UUID(payload["sub"]):
        raise ForbiddenError("You can only manage assessments on your own courses")


async def _assert_quiz_access(quiz_id: uuid.UUID, payload: dict, db) -> None:
    quiz_r = await db.execute(select(Quiz).where(Quiz.id == quiz_id))
    quiz = quiz_r.scalar_one_or_none()
    if not quiz:
        raise NotFoundError("Quiz")
    await _assert_course_access(quiz.course_id, payload, db)


@router.get("/courses/{course_id}/quizzes", response_model=list[QuizRead])
async def list_quizzes(course_id: uuid.UUID, page: int = Query(1), page_size: int = Query(20), db=Depends(get_db)):
    service = AssessmentService(db)
    result = await service.list_quizzes(course_id, PaginationParams(page=page, page_size=page_size))
    return result.items


@router.post("/courses/{course_id}/quizzes", response_model=QuizRead, dependencies=[require_roles(Role.TEACHER, Role.ADMIN)])
async def create_quiz(course_id: uuid.UUID, data: QuizCreate, payload: CurrentUserPayload, db=Depends(get_db)):
    await _assert_course_access(course_id, payload, db)
    service = AssessmentService(db)
    return await service.create_quiz(course_id, data)


@router.get("/quizzes/{quiz_id}", response_model=QuizDetailRead)
async def get_quiz(quiz_id: uuid.UUID, payload: CurrentUserPayload, db=Depends(get_db)):
    from sqlalchemy import select, func
    from app.models.assessment import Submission

    service = AssessmentService(db)
    quiz = await service.get_quiz(quiz_id)
    is_student = "student" in payload.get("roles", []) and "teacher" not in payload.get("roles", [])
    if is_student:
        # Serialize to Pydantic first to avoid mutating the ORM object.
        # Mutating opt.is_correct = None on an ORM Mapped[bool] (non-nullable) column
        # would be flushed/committed by get_db and cause a DB constraint violation.
        quiz_read = QuizDetailRead.model_validate(quiz)
        for q in quiz_read.questions:
            for opt in q.options:
                opt.is_correct = None

        # Include how many attempts the student has used
        student_id = uuid.UUID(payload["sub"])
        result = await db.execute(
            select(func.count()).select_from(Submission).where(
                Submission.quiz_id == quiz_id, Submission.student_id == student_id
            )
        )
        quiz_read.attempts_used = result.scalar_one()
        return quiz_read
    return quiz


@router.patch("/quizzes/{quiz_id}", response_model=QuizRead, dependencies=[require_roles(Role.TEACHER, Role.ADMIN)])
async def update_quiz(quiz_id: uuid.UUID, data: QuizUpdate, payload: CurrentUserPayload, db=Depends(get_db)):
    await _assert_quiz_access(quiz_id, payload, db)
    service = AssessmentService(db)
    return await service.update_quiz(quiz_id, data)


@router.post("/quizzes/{quiz_id}/questions", response_model=QuestionRead, dependencies=[require_roles(Role.TEACHER, Role.ADMIN)])
async def add_question(quiz_id: uuid.UUID, data: QuestionCreate, payload: CurrentUserPayload, db=Depends(get_db)):
    await _assert_quiz_access(quiz_id, payload, db)
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


@router.get("/quizzes/{quiz_id}/submissions", response_model=list[SubmissionListItem], dependencies=[require_roles(Role.TEACHER, Role.ADMIN)])
async def list_submissions(quiz_id: uuid.UUID, payload: CurrentUserPayload, db=Depends(get_db)):
    await _assert_quiz_access(quiz_id, payload, db)
    from app.models.assessment import Submission, Question, Answer
    from app.models.user import User
    from sqlalchemy.orm import selectinload

    result = await db.execute(
        select(Submission)
        .options(selectinload(Submission.answers).selectinload(Answer.question))
        .where(Submission.quiz_id == quiz_id)
        .order_by(Submission.started_at.desc())
    )
    submissions = result.scalars().all()
    if not submissions:
        return []

    student_ids = {s.student_id for s in submissions}
    users_r = await db.execute(select(User).where(User.id.in_(student_ids)))
    users = {u.id: u for u in users_r.scalars().all()}

    items: list[SubmissionListItem] = []
    for sub in submissions:
        u = users.get(sub.student_id)
        # Submission needs review if any short_answer/essay answer is not yet graded.
        needs_review = any(
            ans.points_earned is None
            and ans.question is not None
            and ans.question.question_type in ("short_answer", "essay")
            for ans in sub.answers
        )
        items.append(SubmissionListItem(
            id=sub.id,
            quiz_id=sub.quiz_id,
            student_id=sub.student_id,
            student_name=(u.first_name + " " + u.last_name) if u else "Unknown",
            student_email=u.email if u else "",
            attempt_num=sub.attempt_num,
            started_at=sub.started_at,
            submitted_at=sub.submitted_at,
            score=sub.score,
            status=sub.status,
            needs_review=needs_review,
        ))
    return items


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
    from app.models.assessment import Submission
    sub_r = await db.execute(select(Submission).where(Submission.id == submission_id))
    sub = sub_r.scalar_one_or_none()
    if not sub:
        raise NotFoundError("Submission")
    await _assert_quiz_access(sub.quiz_id, payload, db)
    service = AssessmentService(db)
    return await service.manual_grade(submission_id, uuid.UUID(payload["sub"]), grades)
