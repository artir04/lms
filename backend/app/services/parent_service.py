import uuid
from datetime import date
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy import Numeric, and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import ForbiddenError, NotFoundError
from app.models.assessment import Quiz, Submission
from app.models.attendance import Attendance
from app.models.course import Course, Enrollment, Section
from app.models.grade import GradeEntry
from app.models.parent import ParentStudent
from app.models.parent_child import ParentChildLink
from app.models.user import User
from app.schemas.attendance import StudentAttendanceSummary
from app.schemas.grade import StudentGradeSummary
from app.schemas.parent import (
    ChildAttendanceSummary,
    ChildCourseProgress,
    ChildProgressDetail,
    ChildSummary,
    ParentDigest,
    UpcomingItem,
)
from app.schemas.user import UserSummary
from app.services.attendance_service import AttendanceService
from app.services.grade_service import GradeService


class ParentService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.grade_service = GradeService(db)
        self.attendance_service = AttendanceService(db)

    async def link_child(self, parent_id: uuid.UUID, student_id: uuid.UUID) -> ParentStudent:
        link = ParentStudent(parent_id=parent_id, student_id=student_id)
        self.db.add(link)
        await self.db.flush()
        return link

    async def get_children_ids(self, parent_id: uuid.UUID) -> list[uuid.UUID]:
        result = await self.db.execute(
            select(ParentStudent.student_id).where(ParentStudent.parent_id == parent_id)
        )
        return [r[0] for r in result.all()]

    async def _verify_parent_of(self, parent_id: uuid.UUID, student_id: uuid.UUID) -> None:
        result = await self.db.execute(
            select(ParentStudent).where(
                ParentStudent.parent_id == parent_id,
                ParentStudent.student_id == student_id,
            )
        )
        if not result.scalar_one_or_none():
            raise ForbiddenError("Not linked to this student")

    async def get_digest(self, parent_id: uuid.UUID, tenant_id: uuid.UUID) -> ParentDigest:
        child_ids = await self.get_children_ids(parent_id)
        children = []
        for child_id in child_ids:
            user_r = await self.db.execute(select(User).where(User.id == child_id))
            user = user_r.scalar_one_or_none()
            if not user:
                continue

            course_count = (await self.db.execute(
                select(func.count()).select_from(Enrollment)
                .join(Section, Section.id == Enrollment.section_id)
                .where(Enrollment.student_id == child_id, Enrollment.status == "active")
            )).scalar_one()

            avg_r = await self.db.execute(
                select(func.avg(GradeEntry.grade.cast(Numeric)))
                .where(GradeEntry.student_id == child_id)
            )
            avg = avg_r.scalar_one()
            overall_avg = Decimal(str(round(avg, 2))) if avg else None

            total_att = (await self.db.execute(
                select(func.count()).select_from(Attendance).where(Attendance.student_id == child_id)
            )).scalar_one()
            present_att = (await self.db.execute(
                select(func.count()).select_from(Attendance)
                .where(Attendance.student_id == child_id, Attendance.status == "present")
            )).scalar_one()
            att_rate = Decimal(str(round(present_att / total_att * 100, 1))) if total_att else None

            children.append(ChildSummary(
                student=UserSummary(
                    id=user.id,
                    full_name=user.full_name,
                    email=user.email,
                    avatar_url=user.avatar_url,
                    roles=None,
                ),
                course_count=course_count,
                overall_average=overall_avg,
                attendance_rate=att_rate,
            ))
        return ParentDigest(children=children)

    async def get_child_progress(
        self, parent_id: uuid.UUID, student_id: uuid.UUID, tenant_id: uuid.UUID
    ) -> ChildProgressDetail:
        await self._verify_parent_of(parent_id, student_id)

        user_r = await self.db.execute(select(User).where(User.id == student_id))
        user = user_r.scalar_one_or_none()
        if not user:
            raise NotFoundError("Student")

        courses_r = await self.db.execute(
            select(Course)
            .join(Section, Section.course_id == Course.id)
            .join(Enrollment, Enrollment.section_id == Section.id)
            .where(Enrollment.student_id == student_id, Enrollment.status == "active")
        )
        courses = courses_r.scalars().all()

        course_progress = []
        for course in courses:
            entries_r = await self.db.execute(
                select(GradeEntry).where(
                    GradeEntry.student_id == student_id,
                    GradeEntry.course_id == course.id,
                )
            )
            entries = entries_r.scalars().all()
            if entries:
                total_weight = sum(e.weight for e in entries)
                if total_weight:
                    avg = sum(Decimal(str(e.grade)) * e.weight for e in entries) / total_weight
                else:
                    avg = Decimal("0")
                rounded = int(avg.quantize(Decimal("1"), rounding=ROUND_HALF_UP))
                grade = max(1, min(5, rounded))
            else:
                avg = None
                grade = None

            course_progress.append(ChildCourseProgress(
                course_id=course.id,
                course_title=course.title,
                weighted_average=Decimal(str(round(avg, 2))) if avg is not None else None,
                final_grade=grade,
                entry_count=len(entries),
            ))

        upcoming = []
        for course in courses:
            quizzes_r = await self.db.execute(
                select(Quiz).where(
                    Quiz.course_id == course.id,
                    Quiz.is_published == True,
                    Quiz.due_at != None,
                ).order_by(Quiz.due_at)
            )
            for quiz in quizzes_r.scalars().all():
                sub_r = await self.db.execute(
                    select(func.count()).select_from(Submission).where(
                        Submission.quiz_id == quiz.id,
                        Submission.student_id == student_id,
                    )
                )
                is_submitted = sub_r.scalar_one() > 0
                upcoming.append(UpcomingItem(
                    quiz_id=quiz.id,
                    quiz_title=quiz.title,
                    course_title=course.title,
                    due_at=quiz.due_at,
                    is_submitted=is_submitted,
                ))

        total = (await self.db.execute(
            select(func.count()).select_from(Attendance).where(Attendance.student_id == student_id)
        )).scalar_one()
        present = (await self.db.execute(
            select(func.count()).select_from(Attendance)
            .where(Attendance.student_id == student_id, Attendance.status == "present")
        )).scalar_one()
        absent = (await self.db.execute(
            select(func.count()).select_from(Attendance)
            .where(Attendance.student_id == student_id, Attendance.status == "absent")
        )).scalar_one()
        tardy = (await self.db.execute(
            select(func.count()).select_from(Attendance)
            .where(Attendance.student_id == student_id, Attendance.status == "tardy")
        )).scalar_one()

        return ChildProgressDetail(
            student=UserSummary(
                id=user.id,
                full_name=user.full_name,
                email=user.email,
                avatar_url=user.avatar_url,
                roles=None,
            ),
            courses=course_progress,
            upcoming_assignments=upcoming,
            attendance_summary=ChildAttendanceSummary(
                total_days=total,
                present=present,
                absent=absent,
                tardy=tardy,
                attendance_rate=Decimal(str(round(present / total * 100, 1))) if total else Decimal("0"),
            ),
        )

    async def verify_parent_child_access(self, parent_id: uuid.UUID, student_id: uuid.UUID, tenant_id: uuid.UUID) -> ParentChildLink:
        """Verify that a parent has access to a specific student's data."""
        result = await self.db.execute(
            select(ParentChildLink)
            .options(
                selectinload(ParentChildLink.parent),
                selectinload(ParentChildLink.student),
                selectinload(ParentChildLink.relationship),
            )
            .where(
                and_(
                    ParentChildLink.parent_id == parent_id,
                    ParentChildLink.student_id == student_id,
                    ParentChildLink.parent.has(tenant_id=tenant_id),
                    ParentChildLink.student.has(tenant_id=tenant_id),
                )
            )
        )
        link = result.scalar_one_or_none()
        if not link:
            raise ForbiddenError("You do not have permission to access this student's data")
        return link

    async def get_parent_children(self, parent_id: uuid.UUID, tenant_id: uuid.UUID) -> list[dict]:
        result = await self.db.execute(
            select(ParentChildLink)
            .options(
                selectinload(ParentChildLink.student),
                selectinload(ParentChildLink.relationship),
            )
            .where(
                and_(
                    ParentChildLink.parent_id == parent_id,
                    ParentChildLink.parent.has(tenant_id=tenant_id),
                    ParentChildLink.student.has(is_active=True),
                )
            )
        )
        links = result.scalars().all()

        children = []
        for link in links:
            if link.student:
                children.append({
                    "student_id": link.student.id,
                    "student_name": link.student.full_name,
                    "email": link.student.email,
                    "relationship": link.relationship.name if link.relationship else "unknown",
                    "is_primary_contact": link.is_primary_contact,
                    "school_id": link.student.school_id,
                    "last_login": link.student.last_login_at,
                })

        return children

    async def get_child_overview(
        self,
        parent_id: uuid.UUID,
        student_id: uuid.UUID,
        tenant_id: uuid.UUID,
    ) -> dict:
        link = await self.verify_parent_child_access(parent_id, student_id, tenant_id)

        student_result = await self.db.execute(
            select(User).where(User.id == student_id, User.tenant_id == tenant_id)
        )
        student = student_result.scalar_one_or_none()
        if not student:
            raise NotFoundError("Student")

        return {
            "student_id": student.id,
            "student_name": student.full_name,
            "email": student.email,
            "school_id": student.school_id,
            "is_active": student.is_active,
            "last_login": student.last_login_at,
            "created_at": student.created_at,
            "relationship": link.relationship.name if link.relationship else "unknown",
            "is_primary_contact": link.is_primary_contact,
        }

    async def get_child_grades(
        self,
        parent_id: uuid.UUID,
        student_id: uuid.UUID,
        tenant_id: uuid.UUID,
    ) -> list[StudentGradeSummary]:
        await self.verify_parent_child_access(parent_id, student_id, tenant_id)
        return await self.grade_service.get_student_grades(student_id, tenant_id)

    async def get_child_attendance(
        self,
        parent_id: uuid.UUID,
        student_id: uuid.UUID,
        tenant_id: uuid.UUID,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> list[StudentAttendanceSummary]:
        await self.verify_parent_child_access(parent_id, student_id, tenant_id)
        return await self.attendance_service.get_student_attendance_summary(student_id, tenant_id)
