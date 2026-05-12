import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload

from app.models.course import Course, Section, Enrollment
from app.models.user import User, UserRole, Role as RoleModel
from app.core.exceptions import NotFoundError, ForbiddenError, ConflictError, BadRequestError
from app.core.pagination import PaginationParams, PaginatedResponse
from app.core.permissions import Role
from app.schemas.course import CourseCreate, CourseUpdate, SectionCreate, EnrollmentCreate


class CourseService:
    def __init__(self, db: AsyncSession):
        self.db = db

    def _course_query(self, tenant_id: uuid.UUID):
        return (
            select(Course)
            .options(
                selectinload(Course.teacher)
                .selectinload(User.user_roles)
                .selectinload(UserRole.role)
            )
            .where(Course.tenant_id == tenant_id)
        )

    async def get_by_id(self, course_id: uuid.UUID, tenant_id: uuid.UUID) -> Course:
        result = await self.db.execute(
            self._course_query(tenant_id).where(Course.id == course_id)
        )
        course = result.scalar_one_or_none()
        if not course:
            raise NotFoundError("Course")
        return course

    async def list_courses(self, tenant_id: uuid.UUID, params: PaginationParams, teacher_id: uuid.UUID | None = None, student_id: uuid.UUID | None = None, search: str | None = None) -> PaginatedResponse[Course]:
        query = self._course_query(tenant_id).where(Course.is_archived == False)

        if teacher_id:
            query = query.where(Course.teacher_id == teacher_id)

        if student_id:
            query = query.join(Section).join(Enrollment).where(
                Enrollment.student_id == student_id, Enrollment.status == "active"
            )
        else:
            query = query.where(Course.is_published == True)

        if search:
            query = query.where(Course.title.ilike(f"%{search}%"))

        total_result = await self.db.execute(select(func.count()).select_from(query.subquery()))
        total = total_result.scalar_one()

        result = await self.db.execute(query.offset(params.offset).limit(params.limit))
        return PaginatedResponse.create(result.scalars().all(), total, params)

    async def list_admin(
        self,
        tenant_id: uuid.UUID,
        params: PaginationParams,
        *,
        search: str | None = None,
        teacher_id: uuid.UUID | None = None,
        school_id: uuid.UUID | None = None,
        status: str | None = None,  # "published" | "draft" | "archived" | "all"
    ) -> PaginatedResponse[dict]:
        query = (
            select(Course, User)
            .join(User, User.id == Course.teacher_id)
            .where(Course.tenant_id == tenant_id)
        )
        if search:
            query = query.where(Course.title.ilike(f"%{search}%"))
        if teacher_id:
            query = query.where(Course.teacher_id == teacher_id)
        if school_id:
            query = query.where(Course.school_id == school_id)
        if status == "published":
            query = query.where(Course.is_published == True, Course.is_archived == False)
        elif status == "draft":
            query = query.where(Course.is_published == False, Course.is_archived == False)
        elif status == "archived":
            query = query.where(Course.is_archived == True)
        elif status in (None, "active", ""):
            query = query.where(Course.is_archived == False)

        total = (await self.db.execute(select(func.count()).select_from(query.subquery()))).scalar_one()

        rows = (
            await self.db.execute(
                query.order_by(Course.created_at.desc()).offset(params.offset).limit(params.limit)
            )
        ).all()

        course_ids = [c.id for c, _ in rows]
        section_counts: dict[uuid.UUID, int] = {}
        enrollment_counts: dict[uuid.UUID, int] = {}
        if course_ids:
            sec_rows = (
                await self.db.execute(
                    select(Section.course_id, func.count())
                    .where(Section.course_id.in_(course_ids))
                    .group_by(Section.course_id)
                )
            ).all()
            section_counts = {cid: cnt for cid, cnt in sec_rows}

            enr_rows = (
                await self.db.execute(
                    select(Section.course_id, func.count(Enrollment.id))
                    .join(Enrollment, Enrollment.section_id == Section.id)
                    .where(Section.course_id.in_(course_ids), Enrollment.status == "active")
                    .group_by(Section.course_id)
                )
            ).all()
            enrollment_counts = {cid: cnt for cid, cnt in enr_rows}

        items = [
            {
                "id": str(c.id),
                "title": c.title,
                "subject": c.subject,
                "grade_level": c.grade_level,
                "teacher_id": str(c.teacher_id),
                "teacher_name": f"{t.first_name} {t.last_name}",
                "teacher_email": t.email,
                "is_published": c.is_published,
                "is_archived": c.is_archived,
                "section_count": section_counts.get(c.id, 0),
                "enrollment_count": enrollment_counts.get(c.id, 0),
                "school_id": str(c.school_id) if c.school_id else None,
                "created_at": c.created_at,
            }
            for c, t in rows
        ]
        return PaginatedResponse.create(items, total, params)

    async def create_course(self, data: CourseCreate, teacher_id: uuid.UUID, tenant_id: uuid.UUID) -> Course:
        course = Course(
            tenant_id=tenant_id,
            teacher_id=teacher_id,
            **data.model_dump(),
        )
        self.db.add(course)
        await self.db.flush()
        return await self.get_by_id(course.id, tenant_id)

    async def update_course(self, course_id: uuid.UUID, data: CourseUpdate, user_id: uuid.UUID, tenant_id: uuid.UUID, is_admin: bool = False) -> Course:
        course = await self.get_by_id(course_id, tenant_id)
        if not is_admin and course.teacher_id != user_id:
            raise ForbiddenError("Only the course teacher can edit this course")
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(course, field, value)
        await self.db.flush()
        return course

    async def delete_course(self, course_id: uuid.UUID, tenant_id: uuid.UUID) -> None:
        course = await self.get_by_id(course_id, tenant_id)
        course.is_published = False
        await self.db.flush()

    async def archive_course(self, course_id: uuid.UUID, tenant_id: uuid.UUID, archive: bool = True) -> Course:
        course = await self.get_by_id(course_id, tenant_id)
        course.is_archived = archive
        if archive:
            course.is_published = False
        await self.db.flush()
        return course

    async def reassign_teacher(self, course_id: uuid.UUID, new_teacher_id: uuid.UUID, tenant_id: uuid.UUID) -> Course:
        course = await self.get_by_id(course_id, tenant_id)
        teacher_q = await self.db.execute(
            select(User)
            .options(selectinload(User.user_roles).selectinload(UserRole.role))
            .where(User.id == new_teacher_id, User.tenant_id == tenant_id, User.is_active == True)
        )
        teacher = teacher_q.scalar_one_or_none()
        if not teacher:
            raise NotFoundError("Teacher")
        if not any(ur.role and ur.role.name in (Role.TEACHER.value, Role.ADMIN.value, Role.SUPERADMIN.value) for ur in teacher.user_roles):
            raise BadRequestError("Target user does not have a teaching role")
        course.teacher_id = new_teacher_id
        await self.db.flush()
        return await self.get_by_id(course.id, tenant_id)

    # --- Sections ---
    async def create_section(self, course_id: uuid.UUID, data: SectionCreate, tenant_id: uuid.UUID) -> Section:
        await self.get_by_id(course_id, tenant_id)
        section = Section(course_id=course_id, **data.model_dump())
        self.db.add(section)
        await self.db.flush()
        return section

    async def list_sections(self, course_id: uuid.UUID, tenant_id: uuid.UUID) -> list[Section]:
        await self.get_by_id(course_id, tenant_id)
        result = await self.db.execute(
            select(Section).where(Section.course_id == course_id)
        )
        return result.scalars().all()

    async def list_enrollments(self, course_id: uuid.UUID, tenant_id: uuid.UUID) -> list[dict]:
        """Get all enrolled students for a course as a simplified list."""
        await self.get_by_id(course_id, tenant_id)

        result = await self.db.execute(
            select(Enrollment, User)
            .join(Section)
            .join(User, Enrollment.student_id == User.id)
            .where(
                Section.course_id == course_id,
                Enrollment.status == "active"
            )
            .order_by(User.last_name, User.first_name)
        )

        rows = result.unique().all()

        return [
            {
                "id": str(user.id),
                "student_id": str(user.id),
                "full_name": f"{user.first_name} {user.last_name}",
                "email": user.email,
            }
            for enrollment, user in rows
        ]

    # --- Enrollments ---
    async def enroll_student(self, section_id: uuid.UUID, student_id: uuid.UUID, tenant_id: uuid.UUID) -> Enrollment:
        existing = await self.db.execute(
            select(Enrollment).where(
                Enrollment.section_id == section_id, Enrollment.student_id == student_id
            )
        )
        existing_row = existing.scalar_one_or_none()
        if existing_row:
            if existing_row.status == "active":
                raise ConflictError("Student already enrolled")
            existing_row.status = "active"
            await self.db.flush()
            return existing_row
        enrollment = Enrollment(section_id=section_id, student_id=student_id, status="active")
        self.db.add(enrollment)
        await self.db.flush()
        return enrollment

    async def drop_student(self, section_id: uuid.UUID, student_id: uuid.UUID) -> None:
        result = await self.db.execute(
            select(Enrollment).where(
                Enrollment.section_id == section_id, Enrollment.student_id == student_id
            )
        )
        enrollment = result.scalar_one_or_none()
        if enrollment:
            enrollment.status = "dropped"
            await self.db.flush()

    async def is_enrolled(self, course_id: uuid.UUID, student_id: uuid.UUID) -> bool:
        result = await self.db.execute(
            select(func.count())
            .select_from(Enrollment)
            .join(Section)
            .where(
                Section.course_id == course_id,
                Enrollment.student_id == student_id,
                Enrollment.status == "active",
            )
        )
        return result.scalar_one() > 0
