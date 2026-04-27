import uuid
from datetime import date, timedelta, datetime, timezone
from typing import TYPE_CHECKING
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from sqlalchemy.orm import selectinload, joinedload

from app.models.attendance import Attendance, AttendanceStatus
from app.models.course import Course, Section, Enrollment
from app.models.user import User, UserRole
from app.models.tenant import District
from app.core.exceptions import NotFoundError, BadRequestError, ForbiddenError
from app.schemas.attendance import AttendanceCreate, AttendanceReport, AttendanceReportRow, StudentAttendanceSummary

if TYPE_CHECKING:
    from app.schemas.attendance import AttendanceRead


class AttendanceService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_attendance(self, course_id: uuid.UUID, attendance_date: date, tenant_id: uuid.UUID) -> list[Attendance]:
        """Get all attendance records for a course on a specific date."""
        result = await self.db.execute(
            select(Attendance)
            .options(
                selectinload(Attendance.student).selectinload(User.user_roles).selectinload(UserRole.role),
                selectinload(Attendance.teacher).selectinload(User.user_roles).selectinload(UserRole.role)
            )
            .where(
                Attendance.course_id == course_id,
                Attendance.date == attendance_date,
                Attendance.tenant_id == tenant_id
            )
        )
        return list(result.scalars().all())

    async def mark_attendance(
        self,
        course_id: uuid.UUID,
        section_id: uuid.UUID | None,
        attendance_date: date,
        records: list[AttendanceCreate],
        teacher_id: uuid.UUID,
        tenant_id: uuid.UUID
    ) -> list[Attendance]:
        """
        Mark attendance for multiple students.
        Creates or updates attendance records for the given date.
        """
        # Get course
        course_result = await self.db.execute(
            select(Course).where(Course.id == course_id, Course.tenant_id == tenant_id)
        )
        course = course_result.scalar_one_or_none()
        if not course:
            raise NotFoundError("Course")

        # Validation: Date must be in the past (today or before)
        today = date.today()
        if attendance_date > today:
            raise BadRequestError("Cannot mark attendance for future dates")

        # Validation: Date must be within course date range if specified
        if course.start_date and attendance_date < course.start_date:
            raise BadRequestError("Cannot mark attendance before course start date")
        if course.end_date and attendance_date > course.end_date:
            raise BadRequestError("Cannot mark attendance after course end date")

        # Get enrolled students for the section/course
        enrolled_student_ids = set()
        if section_id:
            section_result = await self.db.execute(
                select(Enrollment).where(
                    Enrollment.section_id == section_id,
                    Enrollment.status == "active"
                )
            )
        else:
            # Get all sections for the course
            section_result = await self.db.execute(
                select(Enrollment)
                .join(Section, Section.id == Enrollment.section_id)
                .where(
                    Section.course_id == course_id,
                    Enrollment.status == "active"
                )
            )
        enrolled_student_ids = {e.student_id for e in section_result.scalars().all()}

        # Process each record
        valid_statuses = [
            AttendanceStatus.PRESENT,
            AttendanceStatus.ABSENT,
            AttendanceStatus.TARDY,
            AttendanceStatus.EXCUSED,
        ]
        created_or_updated = []

        for record in records:
            # Validate status
            if record.status not in valid_statuses:
                raise BadRequestError(f"Invalid status: {record.status}. Must be one of: {', '.join(valid_statuses)}")

            # Validate student is enrolled
            if record.student_id not in enrolled_student_ids:
                raise BadRequestError(f"Student {record.student_id} is not enrolled in this course")

            # Check if attendance already exists for this student on this date
            existing_result = await self.db.execute(
                select(Attendance).where(
                    Attendance.course_id == course_id,
                    Attendance.student_id == record.student_id,
                    Attendance.date == attendance_date
                )
            )
            existing = existing_result.scalar_one_or_none()

            if existing:
                # Update existing record
                existing.status = record.status
                existing.notes = record.notes
                existing.teacher_id = teacher_id
                created_or_updated.append(existing)
            else:
                # Create new record
                attendance = Attendance(
                    course_id=course_id,
                    section_id=section_id,
                    student_id=record.student_id,
                    teacher_id=teacher_id,
                    date=attendance_date,
                    status=record.status,
                    notes=record.notes,
                    tenant_id=tenant_id
                )
                self.db.add(attendance)
                created_or_updated.append(attendance)

        await self.db.flush()

        # Re-fetch with eager loading for return
        result_ids = [a.id for a in created_or_updated]
        final_result = await self.db.execute(
            select(Attendance)
            .options(
                selectinload(Attendance.student).selectinload(User.user_roles).selectinload(UserRole.role),
                selectinload(Attendance.teacher).selectinload(User.user_roles).selectinload(UserRole.role)
            )
            .where(Attendance.id.in_(result_ids))
        )
        return list(final_result.scalars().all())

    async def get_attendance_report(
        self,
        course_id: uuid.UUID,
        date_from: date | None,
        date_to: date | None,
        tenant_id: uuid.UUID
    ) -> AttendanceReport:
        """
        Get attendance report for a course within a date range.
        Groups by student and calculates attendance statistics.
        """
        # Verify course exists
        course_result = await self.db.execute(
            select(Course).where(Course.id == course_id, Course.tenant_id == tenant_id)
        )
        course = course_result.scalar_one_or_none()
        if not course:
            raise NotFoundError("Course")

        # Default date_to to today if not provided
        if not date_to:
            date_to = date.today()

        # Get all attendance records for the course in date range
        query = select(Attendance).options(
            selectinload(Attendance.student)
        ).where(
            Attendance.course_id == course_id,
            Attendance.tenant_id == tenant_id
        )

        if date_from:
            query = query.where(Attendance.date >= date_from)
        if date_to:
            query = query.where(Attendance.date <= date_to)

        result = await self.db.execute(query.order_by(Attendance.date))
        attendance_records = result.scalars().all()

        # Group by student
        student_attendance: dict[uuid.UUID, dict] = {}

        for record in attendance_records:
            if record.student_id not in student_attendance:
                student_attendance[record.student_id] = {
                    "student_id": record.student_id,
                    "student_name": record.student.full_name if record.student else "Unknown",
                    "email": record.student.email if record.student else "",
                    "attendance_count": 0,
                    "present_count": 0,
                    "absent_count": 0,
                    "tardy_count": 0,
                }

            data = student_attendance[record.student_id]
            data["attendance_count"] += 1

            if record.status == AttendanceStatus.PRESENT:
                data["present_count"] += 1
            elif record.status == AttendanceStatus.ABSENT:
                data["absent_count"] += 1
            elif record.status == AttendanceStatus.TARDY:
                data["tardy_count"] += 1

        # Calculate attendance rates and build report rows
        rows = []
        for student_id, data in student_attendance.items():
            total = data["attendance_count"]
            attendance_rate = (data["present_count"] / total * 100) if total > 0 else 0.0

            rows.append(AttendanceReportRow(
                student_id=data["student_id"],
                student_name=data["student_name"],
                email=data["email"],
                attendance_count=total,
                present_count=data["present_count"],
                absent_count=data["absent_count"],
                tardy_count=data["tardy_count"],
                attendance_rate=round(attendance_rate, 2)
            ))

        return AttendanceReport(
            course_id=course_id,
            date_range_start=date_from,
            date_range_end=date_to,
            rows=rows
        )

    async def get_student_attendance(
        self,
        student_id: uuid.UUID,
        course_id: uuid.UUID | None,
        tenant_id: uuid.UUID
    ) -> list[Attendance]:
        """
        Get attendance for a specific student.
        If course_id is provided, filter by that course, otherwise return all courses.
        Results ordered by date DESC.
        """
        query = select(Attendance).options(
            selectinload(Attendance.student).selectinload(User.user_roles).selectinload(UserRole.role),
            selectinload(Attendance.teacher).selectinload(User.user_roles).selectinload(UserRole.role)
        ).where(
            Attendance.student_id == student_id,
            Attendance.tenant_id == tenant_id
        )

        if course_id:
            query = query.where(Attendance.course_id == course_id)

        result = await self.db.execute(query.order_by(Attendance.date.desc()))
        return list(result.scalars().all())

    async def get_attendance_by_student(
        self,
        course_id: uuid.UUID,
        student_id: uuid.UUID,
        date_from: date | None,
        date_to: date | None,
        tenant_id: uuid.UUID
    ) -> AttendanceReport:
        """
        Get attendance report for a specific student in a course.
        Returns a report with a single row for that student.
        """
        # Verify course exists
        course_result = await self.db.execute(
            select(Course).where(Course.id == course_id, Course.tenant_id == tenant_id)
        )
        course = course_result.scalar_one_or_none()
        if not course:
            raise NotFoundError("Course")

        # Default date_to to today if not provided
        if not date_to:
            date_to = date.today()

        # Get attendance records for the specific student
        query = select(Attendance).options(
            selectinload(Attendance.student)
        ).where(
            Attendance.course_id == course_id,
            Attendance.student_id == student_id,
            Attendance.tenant_id == tenant_id
        )

        if date_from:
            query = query.where(Attendance.date >= date_from)
        if date_to:
            query = query.where(Attendance.date <= date_to)

        result = await self.db.execute(query.order_by(Attendance.date))
        records = result.scalars().all()

        if not records:
            raise NotFoundError("Attendance records")

        # Get student info
        student_info = records[0].student

        # Calculate statistics
        attendance_count = len(records)
        present_count = sum(1 for r in records if r.status == AttendanceStatus.PRESENT)
        absent_count = sum(1 for r in records if r.status == AttendanceStatus.ABSENT)
        tardy_count = sum(1 for r in records if r.status == AttendanceStatus.TARDY)
        attendance_rate = (present_count / attendance_count * 100) if attendance_count > 0 else 0.0

        row = AttendanceReportRow(
            student_id=student_id,
            student_name=student_info.full_name if student_info else "Unknown",
            email=student_info.email if student_info else "",
            attendance_count=attendance_count,
            present_count=present_count,
            absent_count=absent_count,
            tardy_count=tardy_count,
            attendance_rate=round(attendance_rate, 2)
        )

        return AttendanceReport(
            course_id=course_id,
            date_range_start=date_from,
            date_range_end=date_to,
            rows=[row]
        )

    async def get_student_attendance_summary(
        self,
        student_id: uuid.UUID,
        tenant_id: uuid.UUID
    ) -> list[StudentAttendanceSummary]:
        """
        Get attendance summary for a student across all their enrolled courses.
        """
        # Get all courses the student is enrolled in
        courses_result = await self.db.execute(
            select(Course)
            .join(Section, Section.course_id == Course.id)
            .join(Enrollment, Enrollment.section_id == Section.id)
            .where(
                Course.tenant_id == tenant_id,
                Enrollment.student_id == student_id,
                Enrollment.status == "active"
            )
        )
        courses = courses_result.scalars().all()

        summaries = []
        for course in courses:
            # Get all attendance for this student in this course
            attendance_result = await self.db.execute(
                select(Attendance).options(
                    selectinload(Attendance.student).selectinload(User.user_roles).selectinload(UserRole.role),
                    selectinload(Attendance.teacher).selectinload(User.user_roles).selectinload(UserRole.role)
                ).where(
                    Attendance.course_id == course.id,
                    Attendance.student_id == student_id,
                    Attendance.tenant_id == tenant_id
                ).order_by(Attendance.date.desc())
            )
            records = list(attendance_result.scalars().all())

            # Calculate attendance rate
            total = len(records)
            present_count = sum(1 for r in records if r.status == AttendanceStatus.PRESENT)
            attendance_rate = (present_count / total * 100) if total > 0 else 0.0

            summaries.append(StudentAttendanceSummary(
                course_id=course.id,
                course_title=course.title,
                attendance_records=records,
                attendance_rate=round(attendance_rate, 2)
            ))

        return summaries
