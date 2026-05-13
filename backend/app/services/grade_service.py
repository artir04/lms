import uuid
from collections import defaultdict
from decimal import Decimal, ROUND_HALF_UP
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update as sa_update

from app.models.grade import GradeEntry
from app.models.course import Course, Section, Enrollment
from app.models.user import User
from app.core.exceptions import NotFoundError, ValidationError
from app.core.grading import weighted_average, round_grade
from app.schemas.grade import (
    GradeBookRead, GradeBookRow, StudentGradeSummary,
    GradeEntryUpdate, GradeEntryRead, GradeEntryCreate,
)

DEFAULT_CATEGORY_WEIGHTS = {"quiz": 0.30, "assignment": 0.25, "exam": 0.30, "participation": 0.15}


class GradeService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_gradebook(self, course_id: uuid.UUID) -> GradeBookRead:
        course_result = await self.db.execute(select(Course).where(Course.id == course_id))
        course = course_result.scalar_one_or_none()
        if not course:
            raise NotFoundError("Course")

        # Fetch all active students in one query
        students_result = await self.db.execute(
            select(User)
            .join(Enrollment, Enrollment.student_id == User.id)
            .join(Section, Section.id == Enrollment.section_id)
            .where(Section.course_id == course_id, Enrollment.status == "active")
        )
        students = students_result.scalars().all()

        # Fetch ALL grades for course in one query — eliminates N+1
        grades_result = await self.db.execute(
            select(GradeEntry).where(GradeEntry.course_id == course_id)
        )
        all_grades = grades_result.scalars().all()

        # Group grades in memory by student_id
        grades_by_student: dict[uuid.UUID, list[GradeEntry]] = defaultdict(list)
        for g in all_grades:
            grades_by_student[g.student_id].append(g)

        rows = []
        for student in students:
            entries = grades_by_student.get(student.id, [])
            avg = weighted_average(entries)
            rows.append(GradeBookRow(
                student_id=student.id,
                student_name=student.full_name,
                email=student.email,
                grades=entries,
                weighted_average=avg,
                final_grade=round_grade(avg),
            ))

        return GradeBookRead(
            course_id=course_id,
            course_title=course.title,
            rows=rows,
        )

    async def get_student_grades(self, student_id: uuid.UUID, tenant_id: uuid.UUID) -> list[StudentGradeSummary]:
        from sqlalchemy.orm import selectinload
        from app.models.assessment import Submission, Quiz, Question
        from app.models.assignment import Assignment, AssignmentSubmission

        courses_result = await self.db.execute(
            select(Course)
            .join(Section, Section.course_id == Course.id)
            .join(Enrollment, Enrollment.section_id == Section.id)
            .where(Course.tenant_id == tenant_id, Enrollment.student_id == student_id, Enrollment.status == "active")
        )
        courses = courses_result.scalars().all()

        if not courses:
            return []

        course_ids = [c.id for c in courses]
        grades_result = await self.db.execute(
            select(GradeEntry).where(
                GradeEntry.student_id == student_id,
                GradeEntry.course_id.in_(course_ids),
            )
        )
        all_grades = grades_result.scalars().all()

        # Look up raw points for quiz- and assignment-linked entries in two batched queries.
        quiz_sub_ids = {g.submission_id for g in all_grades if g.submission_id}
        assign_sub_ids = {g.assignment_submission_id for g in all_grades if g.assignment_submission_id}

        quiz_points: dict[uuid.UUID, tuple[Decimal, Decimal]] = {}
        if quiz_sub_ids:
            q_res = await self.db.execute(
                select(Submission)
                .options(selectinload(Submission.quiz).selectinload(Quiz.questions))
                .where(Submission.id.in_(quiz_sub_ids))
            )
            for sub in q_res.scalars().all():
                total = sum((q.points for q in sub.quiz.questions), Decimal("0")) if sub.quiz else Decimal("0")
                if sub.score is not None and total > 0:
                    earned = (Decimal(sub.score) / Decimal("100") * total).quantize(
                        Decimal("0.01"), rounding=ROUND_HALF_UP
                    )
                else:
                    earned = Decimal("0")
                quiz_points[sub.id] = (earned, total)

        assign_points: dict[uuid.UUID, tuple[Decimal, Decimal]] = {}
        if assign_sub_ids:
            a_res = await self.db.execute(
                select(AssignmentSubmission)
                .options(selectinload(AssignmentSubmission.assignment))
                .where(AssignmentSubmission.id.in_(assign_sub_ids))
            )
            for sub in a_res.scalars().all():
                total = Decimal(sub.assignment.max_score) if sub.assignment else Decimal("0")
                if sub.score is not None and total > 0:
                    earned = (Decimal(sub.score) / Decimal("100") * total).quantize(
                        Decimal("0.01"), rounding=ROUND_HALF_UP
                    )
                else:
                    earned = Decimal("0")
                assign_points[sub.id] = (earned, total)

        grades_by_course: dict[uuid.UUID, list[GradeEntryRead]] = defaultdict(list)
        for g in all_grades:
            entry = GradeEntryRead.model_validate(g)
            if g.submission_id and g.submission_id in quiz_points:
                earned, total = quiz_points[g.submission_id]
                entry.points_earned = earned
                entry.points_possible = total
            elif g.assignment_submission_id and g.assignment_submission_id in assign_points:
                earned, total = assign_points[g.assignment_submission_id]
                entry.points_earned = earned
                entry.points_possible = total
            grades_by_course[g.course_id].append(entry)

        summaries = []
        for course in courses:
            entries = grades_by_course.get(course.id, [])
            # weighted_average expects ORM-like entries with .grade and .weight; both schemas have them.
            avg = weighted_average(entries)
            summaries.append(StudentGradeSummary(
                course_id=course.id,
                course_title=course.title,
                weighted_average=avg,
                final_grade=round_grade(avg),
                entries=entries,
            ))

        return summaries

    async def create_entry(self, course_id: uuid.UUID, data: GradeEntryCreate) -> GradeEntry:
        # Validate: student is enrolled in course
        enrollment_result = await self.db.execute(
            select(func.count())
            .select_from(Enrollment)
            .join(Section, Section.id == Enrollment.section_id)
            .where(
                Section.course_id == course_id,
                Enrollment.student_id == data.student_id,
                Enrollment.status == "active",
            )
        )
        if enrollment_result.scalar_one() == 0:
            raise ValidationError("Student is not enrolled in this course")

        # Determine weight: explicit override or auto-compute from course category config
        weight = data.weight
        if weight <= 0:
            weight = await self._compute_category_weight(course_id, data.student_id, data.category)

        if weight <= 0 or weight > Decimal("1.0"):
            raise ValidationError("Weight must be between 0 and 1.0")

        # Validate total weight across all entries for this student+course does not exceed 1.0
        total_weight_result = await self.db.execute(
            select(func.coalesce(func.sum(GradeEntry.weight), Decimal("0")))
            .where(
                GradeEntry.student_id == data.student_id,
                GradeEntry.course_id == course_id,
            )
        )
        current_total = total_weight_result.scalar_one()
        if current_total + weight > Decimal("1.0"):
            raise ValidationError(
                f"Total weight would exceed 100% (current: {current_total:.3f}, adding: {weight:.3f})"
            )

        entry = GradeEntry(
            student_id=data.student_id,
            course_id=course_id,
            category=data.category,
            label=data.label,
            grade=data.grade,
            weight=weight,
            feedback=data.feedback,
        )
        self.db.add(entry)
        await self.db.flush()
        return entry

    async def update_entry(self, entry_id: uuid.UUID, data: GradeEntryUpdate) -> GradeEntry:
        result = await self.db.execute(select(GradeEntry).where(GradeEntry.id == entry_id))
        entry = result.scalar_one_or_none()
        if not entry:
            raise NotFoundError("Grade entry")

        for field, value in data.model_dump(exclude_none=True).items():
            setattr(entry, field, value)
        await self.db.flush()
        return entry

    async def _compute_category_weight(
        self, course_id: uuid.UUID, student_id: uuid.UUID, category: str
    ) -> Decimal:
        """Auto-compute per-entry weight from course category_weights config.
        Returns category_weight / num_items_in_category (equal share), rebalancing
        existing entries so all items in the category have the same weight.
        """
        course_r = await self.db.execute(select(Course).where(Course.id == course_id))
        course = course_r.scalar_one_or_none()
        weights_config = course.category_weights if course and course.category_weights else DEFAULT_CATEGORY_WEIGHTS
        category_weight = Decimal(str(weights_config.get(category, 0.30)))

        if category_weight <= 0:
            return Decimal("0.30")

        # Count existing entries in this category for this student+course
        count_r = await self.db.execute(
            select(func.count())
            .select_from(GradeEntry)
            .where(
                GradeEntry.student_id == student_id,
                GradeEntry.course_id == course_id,
                GradeEntry.category == category,
            )
        )
        existing_count = count_r.scalar_one()
        new_count = existing_count + 1
        per_entry_weight = (category_weight / Decimal(str(new_count))).quantize(
            Decimal("0.001"), rounding=ROUND_HALF_UP
        )

        # Rebalance existing entries in this category for this student
        if existing_count > 0:
            await self.db.execute(
                sa_update(GradeEntry)
                .where(
                    GradeEntry.student_id == student_id,
                    GradeEntry.course_id == course_id,
                    GradeEntry.category == category,
                )
                .values(weight=per_entry_weight)
            )

        return per_entry_weight

