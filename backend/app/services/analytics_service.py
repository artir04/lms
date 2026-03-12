import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from app.models.analytics import ActivityLog
from app.models.grade import GradeEntry
from app.models.course import Course, Section, Enrollment
from app.models.user import User, UserRole, Role
from app.schemas.analytics import (
    DashboardSummary, EngagementPoint, EngagementReport, AtRiskStudent, GradeDistribution, GradeDistributionBucket
)


class AnalyticsService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_dashboard(self, tenant_id: uuid.UUID, teacher_id: uuid.UUID | None = None) -> DashboardSummary:
        # Total students
        student_q = (
            select(func.count())
            .select_from(User)
            .join(UserRole, UserRole.user_id == User.id)
            .join(Role, Role.id == UserRole.role_id)
            .where(User.tenant_id == tenant_id, Role.name == "student", User.is_active == True)
        )
        total_students = (await self.db.execute(student_q)).scalar_one()

        # Total courses
        course_q = select(func.count()).select_from(Course).where(Course.tenant_id == tenant_id)
        if teacher_id:
            course_q = course_q.where(Course.teacher_id == teacher_id)
        total_courses = (await self.db.execute(course_q)).scalar_one()

        # Active users today
        today = date.today()
        active_q = (
            select(func.count(ActivityLog.user_id.distinct()))
            .where(
                ActivityLog.tenant_id == tenant_id,
                func.date(ActivityLog.occurred_at) == today,
            )
        )
        active_today = (await self.db.execute(active_q)).scalar_one()

        # Average grade
        avg_grade_q = select(func.avg(GradeEntry.raw_score / GradeEntry.max_score * 100)).where(
            GradeEntry.max_score > 0
        )
        avg_grade = (await self.db.execute(avg_grade_q)).scalar_one() or Decimal("0")

        return DashboardSummary(
            total_students=total_students,
            total_courses=total_courses,
            avg_grade=Decimal(str(round(avg_grade, 2))),
            active_users_today=active_today,
            at_risk_count=0,  # simplified
        )

    async def get_engagement(self, tenant_id: uuid.UUID, days: int = 30) -> EngagementReport:
        end = date.today()
        start = end - timedelta(days=days)
        points = []
        current = start
        while current <= end:
            logins = (await self.db.execute(
                select(func.count()).select_from(ActivityLog).where(
                    ActivityLog.tenant_id == tenant_id,
                    ActivityLog.event_type == "login",
                    func.date(ActivityLog.occurred_at) == current,
                )
            )).scalar_one()

            lesson_views = (await self.db.execute(
                select(func.count()).select_from(ActivityLog).where(
                    ActivityLog.tenant_id == tenant_id,
                    ActivityLog.event_type == "lesson_view",
                    func.date(ActivityLog.occurred_at) == current,
                )
            )).scalar_one()

            submissions = (await self.db.execute(
                select(func.count()).select_from(ActivityLog).where(
                    ActivityLog.tenant_id == tenant_id,
                    ActivityLog.event_type == "quiz_submit",
                    func.date(ActivityLog.occurred_at) == current,
                )
            )).scalar_one()

            points.append(EngagementPoint(date=current, logins=logins, lesson_views=lesson_views, submissions=submissions))
            current += timedelta(days=1)

        return EngagementReport(points=points)

    async def get_grade_distribution(self, course_id: uuid.UUID) -> GradeDistribution:
        result = await self.db.execute(
            select(GradeEntry.letter_grade, func.count()).where(GradeEntry.course_id == course_id).group_by(GradeEntry.letter_grade)
        )
        rows = result.all()
        total = sum(r[1] for r in rows)
        buckets = [
            GradeDistributionBucket(
                label=row[0] or "N/A",
                count=row[1],
                percentage=Decimal(str(round(row[1] / total * 100, 1))) if total else Decimal("0"),
            )
            for row in rows
        ]

        avg_result = await self.db.execute(
            select(func.avg(GradeEntry.raw_score / GradeEntry.max_score * 100))
            .where(GradeEntry.course_id == course_id, GradeEntry.max_score > 0)
        )
        mean = Decimal(str(round(avg_result.scalar_one() or 0, 2)))

        return GradeDistribution(course_id=course_id, buckets=buckets, mean=mean, median=mean)

    async def log_event(self, tenant_id: uuid.UUID, user_id: uuid.UUID, event_type: str, resource_id: uuid.UUID | None = None, metadata: dict | None = None) -> None:
        log = ActivityLog(
            tenant_id=tenant_id,
            user_id=user_id,
            event_type=event_type,
            resource_id=resource_id,
            event_metadata=metadata or {},
            occurred_at=datetime.now(timezone.utc),
        )
        self.db.add(log)
        await self.db.flush()
