import uuid
from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload

from app.models.assessment import Quiz, Question, QuestionOption, Submission, Answer
from app.models.grade import GradeEntry
from app.core.exceptions import NotFoundError, ForbiddenError, BadRequestError
from app.core.pagination import PaginationParams, PaginatedResponse
from app.schemas.assessment import QuizCreate, QuizUpdate, QuestionCreate, SubmissionCreate, ManualGradeRequest


class AssessmentService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_quiz(self, quiz_id: uuid.UUID, tenant_id: uuid.UUID | None = None) -> Quiz:
        query = select(Quiz).options(selectinload(Quiz.questions).selectinload(Question.options)).where(Quiz.id == quiz_id)
        result = await self.db.execute(query)
        quiz = result.scalar_one_or_none()
        if not quiz:
            raise NotFoundError("Quiz")
        return quiz

    async def list_quizzes(self, course_id: uuid.UUID, params: PaginationParams) -> PaginatedResponse[Quiz]:
        query = select(Quiz).options(selectinload(Quiz.questions).selectinload(Question.options)).where(Quiz.course_id == course_id)
        total = (await self.db.execute(select(func.count()).select_from(select(Quiz).where(Quiz.course_id == course_id).subquery()))).scalar_one()
        result = await self.db.execute(query.offset(params.offset).limit(params.limit))
        return PaginatedResponse.create(result.scalars().all(), total, params)

    async def create_quiz(self, course_id: uuid.UUID, data: QuizCreate) -> Quiz:
        quiz = Quiz(course_id=course_id, **data.model_dump())
        self.db.add(quiz)
        await self.db.flush()
        return quiz

    async def update_quiz(self, quiz_id: uuid.UUID, data: QuizUpdate) -> Quiz:
        quiz = await self.get_quiz(quiz_id)
        for field, value in data.model_dump(exclude_none=True).items():
            setattr(quiz, field, value)
        await self.db.flush()
        return quiz

    async def add_question(self, quiz_id: uuid.UUID, data: QuestionCreate) -> Question:
        question = Question(
            quiz_id=quiz_id,
            text=data.text,
            question_type=data.question_type,
            points=data.points,
            position=data.position,
            explanation=data.explanation,
        )
        self.db.add(question)
        await self.db.flush()

        for opt in data.options:
            self.db.add(QuestionOption(question_id=question.id, text=opt.text, is_correct=opt.is_correct))
        await self.db.flush()
        result = await self.db.execute(
            select(Question).options(selectinload(Question.options)).where(Question.id == question.id)
        )
        return result.scalar_one()

    async def start_submission(self, quiz_id: uuid.UUID, student_id: uuid.UUID) -> Submission:
        quiz = await self.get_quiz(quiz_id)
        if not quiz.is_published:
            raise ForbiddenError("Quiz is not published")

        # Check attempt limit
        attempts_result = await self.db.execute(
            select(func.count()).select_from(Submission).where(
                Submission.quiz_id == quiz_id, Submission.student_id == student_id
            )
        )
        attempt_count = attempts_result.scalar_one()
        if attempt_count >= quiz.max_attempts:
            raise BadRequestError("Maximum attempts reached")

        attempt_num = attempt_count + 1
        submission = Submission(
            quiz_id=quiz_id,
            student_id=student_id,
            attempt_num=attempt_num,
            started_at=datetime.now(timezone.utc),
            status="in_progress",
        )
        self.db.add(submission)
        await self.db.flush()
        return submission

    async def submit_answers(self, submission_id: uuid.UUID, student_id: uuid.UUID, data: SubmissionCreate) -> Submission:
        result = await self.db.execute(
            select(Submission).options(selectinload(Submission.quiz).selectinload(Quiz.questions).selectinload(Question.options))
            .where(Submission.id == submission_id, Submission.student_id == student_id)
        )
        submission = result.scalar_one_or_none()
        if not submission:
            raise NotFoundError("Submission")
        if submission.status != "in_progress":
            raise BadRequestError("Submission already finalized")

        questions_map = {q.id: q for q in submission.quiz.questions}

        total_points = Decimal("0")
        earned_points = Decimal("0")
        has_manual = False

        for ans_data in data.answers:
            question = questions_map.get(ans_data.question_id)
            if not question:
                continue

            answer = Answer(
                submission_id=submission_id,
                question_id=ans_data.question_id,
                selected_option_id=ans_data.selected_option_id,
                text_response=ans_data.text_response,
            )
            total_points += question.points

            # Auto-grade MCQ and True/False
            if question.question_type in ("mcq", "true_false") and ans_data.selected_option_id:
                correct_option = next(
                    (o for o in question.options if o.is_correct), None
                )
                is_correct = correct_option and ans_data.selected_option_id == correct_option.id
                answer.is_correct = is_correct
                answer.points_earned = question.points if is_correct else Decimal("0")
                earned_points += answer.points_earned
            elif question.question_type == "short_answer" and ans_data.text_response:
                # Simple exact-match grading
                correct_option = next((o for o in question.options if o.is_correct), None)
                if correct_option and ans_data.text_response.strip().lower() == correct_option.text.strip().lower():
                    answer.is_correct = True
                    answer.points_earned = question.points
                    earned_points += question.points
                else:
                    answer.is_correct = False
                    answer.points_earned = Decimal("0")
            else:
                # Essay - needs manual grading
                has_manual = True

            self.db.add(answer)

        submission.submitted_at = datetime.now(timezone.utc)
        submission.status = "submitted" if has_manual else "graded"
        if not has_manual:
            submission.score = (earned_points / total_points * 100) if total_points else Decimal("0")

        await self.db.flush()

        # Create grade entry if fully graded
        if not has_manual:
            await self._upsert_grade_entry(submission, earned_points, total_points)

        # Re-fetch with answers eagerly loaded for serialization
        r = await self.db.execute(
            select(Submission).options(selectinload(Submission.answers)).where(Submission.id == submission.id)
        )
        return r.scalar_one()

    async def _upsert_grade_entry(self, submission: Submission, earned: Decimal, total: Decimal) -> None:
        result = await self.db.execute(
            select(GradeEntry).where(GradeEntry.submission_id == submission.id)
        )
        entry = result.scalar_one_or_none()
        course_result = await self.db.execute(
            select(Quiz.course_id).where(Quiz.id == submission.quiz_id)
        )
        course_id = course_result.scalar_one()

        percentage = (earned / total * 100) if total else Decimal("0")
        letter = self._percentage_to_letter(percentage)

        if entry:
            entry.raw_score = earned
            entry.max_score = total
            entry.letter_grade = letter
        else:
            self.db.add(GradeEntry(
                student_id=submission.student_id,
                course_id=course_id,
                quiz_id=submission.quiz_id,
                submission_id=submission.id,
                category="quiz",
                raw_score=earned,
                max_score=total,
                letter_grade=letter,
            ))
        await self.db.flush()

    async def manual_grade(self, submission_id: uuid.UUID, grader_id: uuid.UUID, grades: list[ManualGradeRequest]) -> Submission:
        result = await self.db.execute(
            select(Submission).options(selectinload(Submission.answers).selectinload(Answer.question))
            .where(Submission.id == submission_id)
        )
        submission = result.scalar_one_or_none()
        if not submission:
            raise NotFoundError("Submission")

        answers_map = {a.id: a for a in submission.answers}
        for grade in grades:
            answer = answers_map.get(grade.answer_id)
            if answer:
                answer.points_earned = grade.points_earned
                answer.feedback = grade.feedback
                answer.is_correct = grade.points_earned > 0

        # Recalculate total score
        total = sum(a.question.points for a in submission.answers if a.question)
        earned = sum(a.points_earned or Decimal("0") for a in submission.answers)
        submission.score = (earned / total * 100) if total else Decimal("0")
        submission.status = "graded"
        submission.graded_by = grader_id
        submission.graded_at = datetime.now(timezone.utc)
        await self.db.flush()
        await self._upsert_grade_entry(submission, earned, Decimal(str(total)))
        return submission

    @staticmethod
    def _percentage_to_letter(pct: Decimal) -> str:
        if pct >= 90: return "A"
        if pct >= 80: return "B"
        if pct >= 70: return "C"
        if pct >= 60: return "D"
        return "F"
