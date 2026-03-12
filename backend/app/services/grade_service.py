import uuid
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.models.grade import GradeEntry
from app.models.course import Course, Section, Enrollment
from app.models.user import User
from app.models.assessment import Quiz
from app.core.exceptions import NotFoundError
from app.schemas.grade import GradeBookRead, GradeBookRow, StudentGradeSummary, GradeEntryUpdate


class GradeService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_gradebook(self, course_id: uuid.UUID) -> GradeBookRead:
        # Get course
        course_result = await self.db.execute(select(Course).where(Course.id == course_id))
        course = course_result.scalar_one_or_none()
        if not course:
            raise NotFoundError("Course")

        # Get all enrolled students
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
            avg = self._calculate_average(entries)
            rows.append(GradeBookRow(
                student_id=student.id,
                student_name=student.full_name,
                email=student.email,
                grades=entries,
                course_average=avg,
                letter_grade=self._percentage_to_letter(avg),
            ))

        return GradeBookRead(
            course_id=course_id,
            course_title=course.title,
            rows=rows,
        )

    async def get_student_grades(self, student_id: uuid.UUID, tenant_id: uuid.UUID) -> list[StudentGradeSummary]:
        # Get all courses the student is enrolled in
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
            avg = self._calculate_average(entries)
            summaries.append(StudentGradeSummary(
                course_id=course.id,
                course_title=course.title,
                average=avg,
                letter_grade=self._percentage_to_letter(avg),
                entries=entries,
            ))

        return summaries

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
    def _calculate_average(entries: list[GradeEntry]) -> Decimal:
        if not entries:
            return Decimal("0")
        total_weight = sum(e.weight for e in entries)
        if not total_weight:
            return Decimal("0")
        weighted_sum = sum(
            (e.raw_score / e.max_score * 100 * e.weight) if e.max_score else Decimal("0")
            for e in entries
        )
        return weighted_sum / total_weight

    @staticmethod
    def _percentage_to_letter(pct: Decimal) -> str | None:
        if pct >= 90: return "A"
        if pct >= 80: return "B"
        if pct >= 70: return "C"
        if pct >= 60: return "D"
        if pct > 0: return "F"
        return None
