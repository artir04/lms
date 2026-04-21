import uuid
from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload

from app.models.user import User
from app.models.parent_child import ParentChildLink, ParentChildRelationship
from app.core.exceptions import NotFoundError, ForbiddenError
from app.services.grade_service import GradeService
from app.services.attendance_service import AttendanceService
from app.schemas.grade import StudentGradeSummary
from app.schemas.attendance import StudentAttendanceSummary


class ParentService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.grade_service = GradeService(db)
        self.attendance_service = AttendanceService(db)

    async def verify_parent_child_access(self, parent_id: uuid.UUID, student_id: uuid.UUID, tenant_id: uuid.UUID) -> ParentChildLink:
        """
        Verify that a parent has access to a specific student's data.
        Raises ForbiddenError if no valid parent-child link exists.
        """
        result = await self.db.execute(
            select(ParentChildLink)
            .options(
                selectinload(ParentChildLink.parent),
                selectinload(ParentChildLink.student),
                selectinload(ParentChildLink.relationship)
            )
            .where(
                and_(
                    ParentChildLink.parent_id == parent_id,
                    ParentChildLink.student_id == student_id,
                    ParentChildLink.parent.has(tenant_id=tenant_id),
                    ParentChildLink.student.has(tenant_id=tenant_id)
                )
            )
        )
        link = result.scalar_one_or_none()
        if not link:
            raise ForbiddenError("You do not have permission to access this student's data")
        return link

    async def get_parent_children(self, parent_id: uuid.UUID, tenant_id: uuid.UUID) -> list[dict]:
        """
        Get all children linked to a parent.
        Returns list of student information with relationship details.
        """
        result = await self.db.execute(
            select(ParentChildLink)
            .options(
                selectinload(ParentChildLink.student),
                selectinload(ParentChildLink.relationship)
            )
            .where(
                and_(
                    ParentChildLink.parent_id == parent_id,
                    ParentChildLink.parent.has(tenant_id=tenant_id),
                    ParentChildLink.student.has(is_active=True)
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
                    "last_login": link.student.last_login_at
                })

        return children

    async def get_child_overview(
        self,
        parent_id: uuid.UUID,
        student_id: uuid.UUID,
        tenant_id: uuid.UUID
    ) -> dict:
        """
        Get overview information for a specific child.
        Verifies parent-child access and returns student details.
        """
        link = await self.verify_parent_child_access(parent_id, student_id, tenant_id)

        # Get student details
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
            "is_primary_contact": link.is_primary_contact
        }

    async def get_child_grades(
        self,
        parent_id: uuid.UUID,
        student_id: uuid.UUID,
        tenant_id: uuid.UUID
    ) -> list[StudentGradeSummary]:
        """
        Get grades for a specific child.
        Verifies parent-child access before returning grade data.
        """
        await self.verify_parent_child_access(parent_id, student_id, tenant_id)
        return await self.grade_service.get_student_grades(student_id, tenant_id)

    async def get_child_attendance(
        self,
        parent_id: uuid.UUID,
        student_id: uuid.UUID,
        tenant_id: uuid.UUID,
        date_from: date | None = None,
        date_to: date | None = None
    ) -> list[StudentAttendanceSummary]:
        """
        Get attendance for a specific child.
        Verifies parent-child access before returning attendance data.
        """
        await self.verify_parent_child_access(parent_id, student_id, tenant_id)
        return await self.attendance_service.get_student_attendance_summary(student_id, tenant_id)