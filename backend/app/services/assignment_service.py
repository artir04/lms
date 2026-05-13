import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.models.assignment import Assignment, AssignmentSubmission
from app.models.course import Course, Section, Enrollment
from app.models.grade import GradeEntry
from app.core.exceptions import NotFoundError, ForbiddenError, BadRequestError
from app.core.grading import score_to_grade
from app.core.pagination import PaginationParams, PaginatedResponse
from app.schemas.assignment import (
    AssignmentCreate, AssignmentUpdate, AssignmentSubmissionCreate,
    AssignmentGradeRequest,
)

DEFAULT_CATEGORY_WEIGHTS = {"quiz": 0.30, "assignment": 0.25, "exam": 0.30, "participation": 0.15}


class AssignmentService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ── Assignment CRUD ──────────────────────────────────────────────────────

    async def list_assignments(self, course_id: uuid.UUID, student_id: uuid.UUID | None = None) -> list[Assignment]:
        result = await self.db.execute(
            select(Assignment)
            .where(Assignment.course_id == course_id)
            .order_by(Assignment.due_at.asc().nullslast())
        )
        assignments = result.scalars().all()

        if student_id:
            for a in assignments:
                sub_r = await self.db.execute(
                    select(func.count())
                    .select_from(AssignmentSubmission)
                    .where(
                        AssignmentSubmission.assignment_id == a.id,
                        AssignmentSubmission.student_id == student_id,
                    )
                )
                a.has_submission = sub_r.scalar_one() > 0

        return assignments

    async def get_assignment(self, assignment_id: uuid.UUID) -> Assignment:
        result = await self.db.execute(
            select(Assignment).where(Assignment.id == assignment_id)
        )
        assignment = result.scalar_one_or_none()
        if not assignment:
            raise NotFoundError("Assignment")
        return assignment

    async def create_assignment(self, course_id: uuid.UUID, data: AssignmentCreate) -> Assignment:
        assignment = Assignment(course_id=course_id, **data.model_dump())
        self.db.add(assignment)
        await self.db.flush()
        return assignment

    async def update_assignment(self, assignment_id: uuid.UUID, data: AssignmentUpdate) -> Assignment:
        assignment = await self.get_assignment(assignment_id)
        for field, value in data.model_dump(exclude_none=True).items():
            setattr(assignment, field, value)
        await self.db.flush()
        return assignment

    # ── Submissions ──────────────────────────────────────────────────────────

    async def submit(self, assignment_id: uuid.UUID, student_id: uuid.UUID, data: AssignmentSubmissionCreate) -> AssignmentSubmission:
        assignment = await self.get_assignment(assignment_id)
        if not assignment.is_published:
            raise ForbiddenError("Assignment is not published")

        # Check for existing submission
        existing_r = await self.db.execute(
            select(AssignmentSubmission).where(
                AssignmentSubmission.assignment_id == assignment_id,
                AssignmentSubmission.student_id == student_id,
            )
        )
        existing = existing_r.scalar_one_or_none()
        if existing:
            existing.text_response = data.text_response
            existing.file_urls = data.file_urls
            existing.submitted_at = datetime.now(timezone.utc)
            existing.status = "submitted"
            await self.db.flush()
            return existing

        submission = AssignmentSubmission(
            assignment_id=assignment_id,
            student_id=student_id,
            text_response=data.text_response,
            file_urls=data.file_urls,
            submitted_at=datetime.now(timezone.utc),
            status="submitted",
        )
        self.db.add(submission)
        await self.db.flush()
        return submission

    async def list_submissions(self, assignment_id: uuid.UUID) -> list[AssignmentSubmission]:
        result = await self.db.execute(
            select(AssignmentSubmission)
            .options(selectinload(AssignmentSubmission.student))
            .where(AssignmentSubmission.assignment_id == assignment_id)
            .order_by(AssignmentSubmission.submitted_at.desc().nullslast())
        )
        return result.scalars().all()

    async def get_submission(self, submission_id: uuid.UUID) -> AssignmentSubmission:
        result = await self.db.execute(
            select(AssignmentSubmission)
            .options(selectinload(AssignmentSubmission.student))
            .where(AssignmentSubmission.id == submission_id)
        )
        submission = result.scalar_one_or_none()
        if not submission:
            raise NotFoundError("Submission")
        return submission

    async def grade_submission(
        self, submission_id: uuid.UUID, grader_id: uuid.UUID, data: AssignmentGradeRequest
    ) -> AssignmentSubmission:
        submission = await self.get_submission(submission_id)

        submission.score = data.score
        submission.feedback = data.feedback
        submission.status = "graded"
        submission.graded_by = grader_id
        submission.graded_at = datetime.now(timezone.utc)
        await self.db.flush()

        await self._upsert_grade_entry(submission)
        return submission

    async def _upsert_grade_entry(self, submission: AssignmentSubmission) -> None:
        """Convert assignment score to a Kosovo 1-5 grade and upsert."""
        assignment_r = await self.db.execute(
            select(Assignment).where(Assignment.id == submission.assignment_id)
        )
        assignment = assignment_r.scalar_one()

        course_r = await self.db.execute(select(Course).where(Course.id == assignment.course_id))
        course = course_r.scalar_one_or_none()
        weights_config = course.category_weights if course and course.category_weights else DEFAULT_CATEGORY_WEIGHTS
        category_weight = Decimal(str(weights_config.get("assignment", 0.25)))

        thresholds = course.grade_thresholds if course else None
        max_score = assignment.max_score if assignment.max_score and assignment.max_score > 0 else Decimal("100")
        score_pct = (submission.score / max_score * 100) if submission.score else Decimal("0")
        grade = score_to_grade(score_pct, thresholds)

        # Check if entry already exists for this submission (update case)
        existing = await self.db.execute(
            select(GradeEntry).where(GradeEntry.assignment_submission_id == submission.id)
        )
        entry = existing.scalar_one_or_none()

        # Count existing assignment entries
        count_r = await self.db.execute(
            select(func.count())
            .select_from(GradeEntry)
            .where(
                GradeEntry.student_id == submission.student_id,
                GradeEntry.course_id == assignment.course_id,
                GradeEntry.category == "assignment",
            )
        )
        existing_count = count_r.scalar_one()
        new_count = existing_count if entry else existing_count + 1

        if category_weight <= 0:
            per_entry_weight = Decimal("0.25")
        else:
            per_entry_weight = (
                category_weight / Decimal(str(new_count))
            ).quantize(Decimal("0.001"))

        # Rebalance existing assignment entries for this student
        if existing_count > 0:
            from sqlalchemy import update as sa_update
            await self.db.execute(
                sa_update(GradeEntry)
                .where(
                    GradeEntry.student_id == submission.student_id,
                    GradeEntry.course_id == assignment.course_id,
                    GradeEntry.category == "assignment",
                )
                .values(weight=per_entry_weight)
            )

        if entry:
            entry.grade = grade
            entry.weight = per_entry_weight
            entry.feedback = submission.feedback
        else:
            from app.models.grade import GradeEntry as GE
            self.db.add(GE(
                student_id=submission.student_id,
                course_id=assignment.course_id,
                assignment_id=submission.assignment_id,
                assignment_submission_id=submission.id,
                category="assignment",
                label=None,
                grade=grade,
                weight=per_entry_weight,
                feedback=submission.feedback,
                posted_at=datetime.now(timezone.utc),
            ))
        await self.db.flush()
