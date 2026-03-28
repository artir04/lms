import uuid
from decimal import Decimal, ROUND_HALF_UP
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.grade import GradeEntry
from app.models.course import Course, Section, Enrollment
from app.models.user import User
from app.core.exceptions import NotFoundError
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

        students_result = await self.db.execute(
            select(User)
            .join(Enrollment, Enrollment.student_id == User.id)
            .join(Section, Section.id == Enrollment.section_id)
            .where(Section.course_id == course_id, Enrollment.status == "active")
        )
        students = students_result.scalars().all()

        rows = []
        for student in students:
            entries_result = await self.db.execute(
                select(GradeEntry).where(
                    GradeEntry.student_id == student.id,
                    GradeEntry.course_id == course_id,
                )
            )
            entries = entries_result.scalars().all()
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

        summaries = []
        for course in courses:
            entries_result = await self.db.execute(
                select(GradeEntry).where(
                    GradeEntry.student_id == student_id,
                    GradeEntry.course_id == course.id,
                )
            )
            entries = entries_result.scalars().all()
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
        """
        Kosovo grading: weighted average of grades (1-5).

        Example: Test1 grade=5 weight=0.30, Test2 grade=3 weight=0.30,
                 Assignments grade=4 weight=0.40
                 → (5×0.30 + 3×0.30 + 4×0.40) / (0.30+0.30+0.40) = 4.0
        """
        if not entries:
            return Decimal("0")
        total_weight = sum(e.weight for e in entries)
        if not total_weight:
            return Decimal("0")
        weighted_sum = sum(Decimal(str(e.grade)) * e.weight for e in entries)
        return (weighted_sum / total_weight).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    @staticmethod
    def _round_grade(avg: Decimal) -> int | None:
        """Round a weighted average (e.g. 3.67) to the nearest integer grade 1-5."""
        if avg <= 0:
            return None
        rounded = int(avg.quantize(Decimal("1"), rounding=ROUND_HALF_UP))
        return max(1, min(5, rounded))
