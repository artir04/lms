import uuid
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, Numeric
from app.db.session import get_db
from app.dependencies import CurrentUserPayload, require_roles
from app.services.analytics_service import AnalyticsService
from app.core.permissions import Role
from app.schemas.analytics import DashboardSummary, EngagementReport, GradeDistribution
from app.schemas.report import AdminReport

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/dashboard", response_model=DashboardSummary, dependencies=[require_roles(Role.TEACHER, Role.ADMIN)])
async def dashboard(payload: CurrentUserPayload, db=Depends(get_db)):
    service = AnalyticsService(db)
    teacher_id = uuid.UUID(payload["sub"]) if "teacher" in payload.get("roles", []) else None
    return await service.get_dashboard(uuid.UUID(payload["tenant_id"]), teacher_id)


@router.get("/engagement", response_model=EngagementReport, dependencies=[require_roles(Role.TEACHER, Role.ADMIN)])
async def engagement(
    payload: CurrentUserPayload,
    db=Depends(get_db),
    days: int = Query(30, ge=7, le=365),
):
    service = AnalyticsService(db)
    return await service.get_engagement(uuid.UUID(payload["tenant_id"]), days)


@router.get("/grade-distribution/{course_id}", response_model=GradeDistribution, dependencies=[require_roles(Role.TEACHER, Role.ADMIN)])
async def grade_distribution(course_id: uuid.UUID, db=Depends(get_db)):
    service = AnalyticsService(db)
    return await service.get_grade_distribution(course_id)


@router.get("/reports", response_model=AdminReport, dependencies=[require_roles(Role.ADMIN, Role.SUPERADMIN)])
async def admin_report(payload: CurrentUserPayload, db=Depends(get_db)):
    """Generate comprehensive admin report."""
    from datetime import datetime, timedelta, timezone
    from decimal import Decimal
    from app.models.user import User, UserRole, Role as RoleModel
    from app.models.course import Course, Section, Enrollment
    from app.models.grade import GradeEntry
    from app.models.attendance import Attendance
    from app.models.analytics import ActivityLog
    from app.schemas.report import CourseReport

    tenant_id = uuid.UUID(payload["tenant_id"])

    # Count all roles in one query
    role_counts_r = await db.execute(
        select(RoleModel.name, func.count())
        .select_from(User)
        .join(UserRole, UserRole.user_id == User.id)
        .join(RoleModel, RoleModel.id == UserRole.role_id)
        .where(User.tenant_id == tenant_id, User.is_active == True)
        .group_by(RoleModel.name)
    )
    role_map = dict(role_counts_r.all())
    total_students = role_map.get("student", 0)
    total_teachers = role_map.get("teacher", 0)
    total_parents = role_map.get("parent", 0)

    total_courses_r = await db.execute(
        select(func.count()).select_from(Course).where(Course.tenant_id == tenant_id)
    )
    total_courses = total_courses_r.scalar_one()

    # Active users in last 30 days
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    active_r = await db.execute(
        select(func.count(ActivityLog.user_id.distinct()))
        .where(ActivityLog.tenant_id == tenant_id, ActivityLog.occurred_at >= thirty_days_ago)
    )
    active_30d = active_r.scalar_one()

    # Platform average grade (1-5 scale)
    avg_grade_r = await db.execute(
        select(func.avg(GradeEntry.grade.cast(Numeric)))
    )
    avg_grade_val = avg_grade_r.scalar_one()
    avg_platform_grade = Decimal(str(round(avg_grade_val, 2))) if avg_grade_val else None

    # Platform attendance rate
    att_r = await db.execute(
        select(
            func.count().label("total"),
            func.count().filter(Attendance.status == "present").label("present"),
        )
        .select_from(Attendance)
        .join(Course, Course.id == Attendance.course_id)
        .where(Course.tenant_id == tenant_id)
    )
    att_row = att_r.one()
    avg_att_rate = Decimal(str(round(att_row.present / att_row.total * 100, 1))) if att_row.total else None

    # --- Per-course aggregates in bulk (eliminates N+1) ---

    # Enrolled counts per course
    enroll_sub = (
        select(
            Section.course_id.label("course_id"),
            func.count().label("enrolled"),
        )
        .select_from(Enrollment)
        .join(Section, Section.id == Enrollment.section_id)
        .where(Enrollment.status == "active")
        .group_by(Section.course_id)
        .subquery()
    )

    # Avg grade per course (1-5 scale)
    grade_sub = (
        select(
            GradeEntry.course_id.label("course_id"),
            func.avg(GradeEntry.grade.cast(Numeric)).label("avg_grade"),
        )
        .group_by(GradeEntry.course_id)
        .subquery()
    )

    # Attendance rate per course
    att_sub = (
        select(
            Attendance.course_id.label("course_id"),
            func.count().label("total"),
            func.count().filter(Attendance.status == "present").label("present"),
        )
        .group_by(Attendance.course_id)
        .subquery()
    )

    # One query for all course data
    courses_q = (
        select(
            Course.id,
            Course.title,
            (User.first_name + " " + User.last_name).label("teacher_name"),
            func.coalesce(enroll_sub.c.enrolled, 0).label("enrolled"),
            grade_sub.c.avg_grade,
            att_sub.c.total.label("att_total"),
            att_sub.c.present.label("att_present"),
        )
        .outerjoin(User, User.id == Course.teacher_id)
        .outerjoin(enroll_sub, enroll_sub.c.course_id == Course.id)
        .outerjoin(grade_sub, grade_sub.c.course_id == Course.id)
        .outerjoin(att_sub, att_sub.c.course_id == Course.id)
        .where(Course.tenant_id == tenant_id)
        .order_by(Course.title)
    )
    courses_r = await db.execute(courses_q)

    course_reports = [
        CourseReport(
            course_id=row.id,
            course_title=row.title,
            teacher_name=row.teacher_name or "Unassigned",
            enrolled_count=row.enrolled,
            avg_grade=Decimal(str(round(row.avg_grade, 2))) if row.avg_grade else None,
            completion_rate=None,
            avg_attendance_rate=Decimal(str(round(row.att_present / row.att_total * 100, 1))) if row.att_total else None,
        )
        for row in courses_r.all()
    ]

    return AdminReport(
        total_students=total_students,
        total_teachers=total_teachers,
        total_courses=total_courses,
        total_parents=total_parents,
        active_users_30d=active_30d,
        avg_platform_grade=avg_platform_grade,
        avg_attendance_rate=avg_att_rate,
        courses=course_reports,
    )
