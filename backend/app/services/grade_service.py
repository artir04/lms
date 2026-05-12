import uuid
from collections import defaultdict
from decimal import Decimal, ROUND_HALF_UP
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.grade import GradeEntry
from app.models.course import Course, Section, Enrollment
from app.models.user import User
from app.core.exceptions import NotFoundError, ValidationError, ConflictError
from app.schemas.grade import (
    GradeBookRead, GradeBookRow, StudentGradeSummary,
    GradeEntryUpdate, GradeEntryRead, GradeEntryCreate,
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

        # Validate: weight must be > 0 and <= 1.0
        if data.weight <= 0 or data.weight > Decimal("1.0"):
            raise ValidationError("Weight must be between 0 and 1.0")

        # Validate: total weight across all entries for this student+course does not exceed 1.0
        total_weight_result = await self.db.execute(
            select(func.coalesce(func.sum(GradeEntry.weight), Decimal("0")))
            .where(
                GradeEntry.student_id == data.student_id,
                GradeEntry.course_id == course_id,
            )
        )
        current_total = total_weight_result.scalar_one()
        if current_total + data.weight > Decimal("1.0"):
            raise ValidationError(
                f"Total weight would exceed 100% (current: {current_total:.3f}, adding: {data.weight:.3f})"
            )

        # Validate: no duplicate entry in same category for this student+course
        duplicate_result = await self.db.execute(
            select(func.count())
            .select_from(GradeEntry)
            .where(
                GradeEntry.student_id == data.student_id,
                GradeEntry.course_id == course_id,
                GradeEntry.category == data.category,
            )
        )
        if duplicate_result.scalar_one() > 0:
            raise ConflictError(f"Grade entry already exists for category '{data.category}'")

        entry = GradeEntry(
            student_id=data.student_id,
            course_id=course_id,
            category=data.category,
            label=data.label,
            grade=data.grade,
            weight=data.weight,
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
