import uuid
from datetime import date
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy import Numeric, and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.models.assessment import Quiz, Submission
from app.models.attendance import Attendance
from app.models.course import Course, Enrollment, Section
from app.models.grade import GradeEntry
from app.models.parent import ParentStudent
from app.models.parent_child import ParentChildLink, ParentChildRelationship
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
        existing = await self.db.execute(
            select(ParentStudent).where(
                ParentStudent.parent_id == parent_id,
                ParentStudent.student_id == student_id,
            )
        )
        if existing.scalar_one_or_none():
            raise ConflictError("Parent is already linked to this student")

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

    # --- Admin link management ---
    async def list_relationships(self) -> list[ParentChildRelationship]:
        result = await self.db.execute(select(ParentChildRelationship).order_by(ParentChildRelationship.id))
        return list(result.scalars().all())

    async def list_links_admin(
        self,
        tenant_id: uuid.UUID,
        *,
        search: str | None = None,
        page: int = 1,
        page_size: int = 25,
    ) -> dict:
        parent_user = User.__table__.alias("parent_u")
        student_user = User.__table__.alias("student_u")

        query = (
            select(ParentChildLink)
            .options(
                selectinload(ParentChildLink.parent),
                selectinload(ParentChildLink.student),
                selectinload(ParentChildLink.relationship),
            )
            .join(parent_user, parent_user.c.id == ParentChildLink.parent_id)
            .where(parent_user.c.tenant_id == tenant_id)
        )

        if search:
            term = f"%{search}%"
            query = (
                query.join(student_user, student_user.c.id == ParentChildLink.student_id)
                .where(
                    or_(
                        parent_user.c.email.ilike(term),
                        parent_user.c.first_name.ilike(term),
                        parent_user.c.last_name.ilike(term),
                        student_user.c.email.ilike(term),
                        student_user.c.first_name.ilike(term),
                        student_user.c.last_name.ilike(term),
                    )
                )
            )

        total = (
            await self.db.execute(select(func.count()).select_from(query.subquery()))
        ).scalar_one()

        offset = (page - 1) * page_size
        result = await self.db.execute(
            query.order_by(ParentChildLink.created_at.desc()).offset(offset).limit(page_size)
        )
        rows = result.scalars().unique().all()
        items = [
            {
                "id": link.id,
                "parent_id": link.parent_id,
                "parent_name": link.parent.full_name if link.parent else "",
                "parent_email": link.parent.email if link.parent else "",
                "student_id": link.student_id,
                "student_name": link.student.full_name if link.student else "",
                "student_email": link.student.email if link.student else "",
                "relationship_name": link.relationship.name if link.relationship else None,
                "is_primary_contact": link.is_primary_contact,
                "created_at": link.created_at,
            }
            for link in rows
        ]
        pages = max(1, -(-total // page_size))
        return {"items": items, "total": total, "page": page, "page_size": page_size, "pages": pages}

    async def create_link_admin(
        self,
        tenant_id: uuid.UUID,
        parent_id: uuid.UUID,
        student_id: uuid.UUID,
        relationship_id: int | None,
        is_primary_contact: bool,
    ) -> ParentChildLink:
        parent_r = await self.db.execute(
            select(User).where(User.id == parent_id, User.tenant_id == tenant_id)
        )
        parent = parent_r.scalar_one_or_none()
        if not parent:
            raise NotFoundError("Parent user")
        student_r = await self.db.execute(
            select(User).where(User.id == student_id, User.tenant_id == tenant_id)
        )
        student = student_r.scalar_one_or_none()
        if not student:
            raise NotFoundError("Student user")

        existing = await self.db.execute(
            select(ParentChildLink).where(
                ParentChildLink.parent_id == parent_id,
                ParentChildLink.student_id == student_id,
            )
        )
        if existing.scalar_one_or_none():
            raise ConflictError("This parent is already linked to this student")

        rel_id = relationship_id
        if rel_id is None:
            other = await self.db.execute(
                select(ParentChildRelationship).where(ParentChildRelationship.name == "other")
            )
            other_row = other.scalar_one_or_none()
            if not other_row:
                first = await self.db.execute(select(ParentChildRelationship).limit(1))
                other_row = first.scalar_one_or_none()
            if not other_row:
                raise NotFoundError("Relationship type")
            rel_id = other_row.id

        link = ParentChildLink(
            parent_id=parent_id,
            student_id=student_id,
            relationship_id=rel_id,
            is_primary_contact=is_primary_contact,
        )
        self.db.add(link)
        await self.db.flush()
        return link

    async def delete_link_admin(self, tenant_id: uuid.UUID, link_id: uuid.UUID) -> ParentChildLink:
        result = await self.db.execute(
            select(ParentChildLink)
            .options(selectinload(ParentChildLink.parent), selectinload(ParentChildLink.student))
            .where(ParentChildLink.id == link_id)
        )
        link = result.scalar_one_or_none()
        if not link:
            raise NotFoundError("Parent-child link")
        if link.parent and link.parent.tenant_id != tenant_id:
            raise ForbiddenError("Link is not in your tenant")
        await self.db.delete(link)
        await self.db.flush()
        return link
