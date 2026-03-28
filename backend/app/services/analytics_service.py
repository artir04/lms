import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, Numeric

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

        # Average grade (1-5 scale)
        avg_grade_q = select(func.avg(GradeEntry.grade.cast(Numeric)))
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

        # Single aggregated query instead of 3 queries per day
        day_col = func.date(ActivityLog.occurred_at).label("day")
        q = (
            select(
                day_col,
                ActivityLog.event_type,
                func.count().label("cnt"),
            )
            .where(
                ActivityLog.tenant_id == tenant_id,
                ActivityLog.event_type.in_(["login", "lesson_view", "quiz_submit"]),
                func.date(ActivityLog.occurred_at) >= start,
                func.date(ActivityLog.occurred_at) <= end,
            )
            .group_by(day_col, ActivityLog.event_type)
        )
        rows = (await self.db.execute(q)).all()

        # Build lookup: (date, event_type) -> count
        counts: dict[tuple[date, str], int] = {}
        for row in rows:
            counts[(row.day, row.event_type)] = row.cnt

        points = []
        current = start
        while current <= end:
            points.append(EngagementPoint(
                date=current,
                logins=counts.get((current, "login"), 0),
                lesson_views=counts.get((current, "lesson_view"), 0),
                submissions=counts.get((current, "quiz_submit"), 0),
            ))
            current += timedelta(days=1)

        return EngagementReport(points=points)

    async def get_grade_distribution(self, course_id: uuid.UUID) -> GradeDistribution:
        result = await self.db.execute(
            select(GradeEntry.grade, func.count())
            .where(GradeEntry.course_id == course_id)
            .group_by(GradeEntry.grade)
        )
        rows = result.all()
        total = sum(r[1] for r in rows)
        buckets = [
            GradeDistributionBucket(
                label=str(row[0]),
                count=row[1],
                percentage=Decimal(str(round(row[1] / total * 100, 1))) if total else Decimal("0"),
            )
            for row in rows
        ]

        avg_result = await self.db.execute(
            select(func.avg(GradeEntry.grade.cast(Numeric)))
            .where(GradeEntry.course_id == course_id)
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
