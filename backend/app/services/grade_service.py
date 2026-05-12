import uuid
from collections import defaultdict
from decimal import Decimal, ROUND_HALF_UP
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update as sa_update

from app.models.grade import GradeEntry
from app.models.course import Course, Section, Enrollment
from app.models.user import User
from app.core.exceptions import NotFoundError, ValidationError
from app.schemas.grade import (
    GradeBookRead, GradeBookRow, StudentGradeSummary,
    GradeEntryUpdate, GradeEntryRead, GradeEntryCreate, CategoryWeightUpdate,
)


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
            avg = self._weighted_average(entries)
            rows.append(GradeBookRow(
                student_id=student.id,
                student_name=student.full_name,
                email=student.email,
                grades=entries,
                weighted_average=avg,
                final_grade=self._round_grade(avg),
            ))

        return GradeBookRead(
            course_id=course_id,
            course_title=course.title,
            rows=rows,
        )

    async def get_student_grades(self, student_id: uuid.UUID, tenant_id: uuid.UUID) -> list[StudentGradeSummary]:
        courses_result = await self.db.execute(
            select(Course)
            .join(Section, Section.course_id == Course.id)
            .join(Enrollment, Enrollment.section_id == Section.id)
            .where(Course.tenant_id == tenant_id, Enrollment.student_id == student_id, Enrollment.status == "active")
        )
        courses = courses_result.scalars().all()

        if not courses:
            return []

        # Fetch all grades for this student across courses in one query
        course_ids = [c.id for c in courses]
        grades_result = await self.db.execute(
            select(GradeEntry).where(
                GradeEntry.student_id == student_id,
                GradeEntry.course_id.in_(course_ids),
            )
        )
        all_grades = grades_result.scalars().all()

        grades_by_course: dict[uuid.UUID, list[GradeEntry]] = defaultdict(list)
        for g in all_grades:
            grades_by_course[g.course_id].append(g)

        summaries = []
        for course in courses:
            entries = grades_by_course.get(course.id, [])
            avg = self._weighted_average(entries)
            summaries.append(StudentGradeSummary(
                course_id=course.id,
                course_title=course.title,
                weighted_average=avg,
                final_grade=self._round_grade(avg),
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

        # Auto-inherit weight from existing entries in the same column
        weight = data.weight
        if weight <= 0:
            existing = await self.db.execute(
                select(GradeEntry.weight)
                .where(
                    GradeEntry.course_id == course_id,
                    GradeEntry.label == data.label,
                )
                .limit(1)
            )
            row = existing.scalar_one_or_none()
            weight = row if row is not None else Decimal("0.30")

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

    async def update_category_weight(self, course_id: uuid.UUID, data: CategoryWeightUpdate) -> None:
        """Update weight for all entries matching the given label in this course."""
        # Get old weight for this label
        old_r = await self.db.execute(
            select(GradeEntry.weight)
            .where(GradeEntry.course_id == course_id, GradeEntry.label == data.label)
            .limit(1)
        )
        old_weight = old_r.scalar_one_or_none()
        if old_weight is None:
            raise NotFoundError("No entries found for this label")

        diff = data.weight - old_weight

        # Check all students with this label — would their new total exceed 100%?
        affected = await self.db.execute(
            select(GradeEntry.student_id, func.sum(GradeEntry.weight).label("total"))
            .where(GradeEntry.course_id == course_id)
            .group_by(GradeEntry.student_id)
        )
        for row in affected.all():
            # Only check students who actually have an entry with this label
            has_label = await self.db.execute(
                select(func.count())
                .select_from(GradeEntry)
                .where(
                    GradeEntry.course_id == course_id,
                    GradeEntry.student_id == row.student_id,
                    GradeEntry.label == data.label,
                )
            )
            if has_label.scalar_one() > 0 and row.total + diff > Decimal("1.0"):
                raise ValidationError(
                    "This weight change would cause some students to exceed 100% total weight"
                )

        await self.db.execute(
            sa_update(GradeEntry)
            .where(
                GradeEntry.course_id == course_id,
                GradeEntry.label == data.label,
            )
            .values(weight=data.weight)
        )
        await self.db.flush()

    @staticmethod
    def _weighted_average(entries: list[GradeEntry]) -> Decimal:
        if not entries:
            return Decimal("0")
        total_weight = sum(e.weight for e in entries)
        if not total_weight:
            raise ValidationError("Total weight of grade entries must be greater than 0")
        weighted_sum = sum(Decimal(str(e.grade)) * e.weight for e in entries)
        return (weighted_sum / total_weight).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    @staticmethod
    def _round_grade(avg: Decimal | None) -> int | None:
        if avg is None or avg == Decimal("0"):
            return None
        if avg < Decimal("0.5"):
            return None
        rounded = avg.quantize(Decimal("1"), rounding=ROUND_HALF_UP)
        grade_int = int(rounded)
        return max(1, min(5, grade_int))
