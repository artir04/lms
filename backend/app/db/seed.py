"""
Minimal seed — idempotent, safe to re-run.

Populates every table with just enough rows to exercise the UI:
  - 1 district, 1 school
  - 1 admin, 2 teachers, 4 students, 1 parent (linked to student001)
  - 2 courses (1 per teacher), each with 1 module / 2 lessons / 1 quiz
  - One auto-graded submission + one pending-review submission
  - Quiz/assignment/participation/exam grade entries for one student
  - A handful of attendance days, badges, points, notifications, activity logs, reports
"""
import asyncio
import random
from datetime import datetime, timedelta, timezone, date
from decimal import Decimal

from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.models.tenant import District, School
from app.models.user import User, Role, UserRole
from app.models.course import Course, Section, Enrollment
from app.models.content import Module, Lesson
from app.models.assessment import Quiz, Question, QuestionOption, Submission, Answer
from app.models.grade import GradeEntry
from app.models.attendance import Attendance, AttendanceStatus
from app.models.parent import ParentStudent
from app.models.gamification import Badge, UserBadge, PointEntry
from app.models.notification import Notification
from app.models.analytics import ActivityLog, ReportSnapshot
from app.core.security import hash_password

random.seed(42)


def now_utc():
    return datetime.now(timezone.utc)


async def get_or_create(db, model, filters: dict, defaults: dict):
    stmt = select(model)
    for k, v in filters.items():
        stmt = stmt.where(getattr(model, k) == v)
    obj = (await db.execute(stmt)).scalar_one_or_none()
    if not obj:
        obj = model(**filters, **defaults)
        db.add(obj)
        await db.flush()
    return obj


async def get_role(db, name):
    return (await db.execute(select(Role).where(Role.name == name))).scalar_one()


async def create_user(db, tenant_id, school_id, email, first, last, password, role_name):
    existing = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
    if existing:
        return existing
    user = User(
        tenant_id=tenant_id,
        school_id=school_id,
        email=email,
        first_name=first,
        last_name=last,
        password_hash=hash_password(password),
        is_active=True,
    )
    db.add(user)
    await db.flush()
    role = await get_role(db, role_name)
    db.add(UserRole(user_id=user.id, role_id=role.id))
    await db.flush()
    return user


COURSES = [
    {
        "title": "Algebra I",
        "subject": "Mathematics",
        "grade_level": "9",
        "description": "Foundations of algebraic thinking: variables, equations, and functions.",
        "teacher_idx": 0,
        "module": "Unit 1: Variables & Expressions",
        "lessons": [
            ("What is a Variable?", "text", 10),
            ("Evaluating Expressions", "text", 15),
        ],
        "quiz": {
            "title": "Algebra Basics Quiz",
            "questions": [
                {"text": "Which of the following is a variable?", "type": "mcq", "points": 5,
                 "options": [("x", True), ("5", False), ("3.14", False), ("100", False)]},
                {"text": "Algebra uses only numbers, not letters.", "type": "true_false", "points": 5,
                 "options": [("True", False), ("False", True)]},
                {"text": "Write an expression for 'five more than twice a number n'.",
                 "type": "short_answer", "points": 10, "options": []},
            ],
        },
    },
    {
        "title": "Biology",
        "subject": "Science",
        "grade_level": "10",
        "description": "Cells, genetics, and ecosystems.",
        "teacher_idx": 1,
        "module": "Unit 1: Cell Biology",
        "lessons": [
            ("Introduction to the Cell", "text", 15),
            ("Cell Organelles", "video", 20),
        ],
        "quiz": {
            "title": "Cell Biology Quiz",
            "questions": [
                {"text": "Which organelle is the 'powerhouse of the cell'?", "type": "mcq", "points": 5,
                 "options": [("Mitochondria", True), ("Nucleus", False), ("Ribosome", False), ("Vacuole", False)]},
                {"text": "DNA is found in the nucleus.", "type": "true_false", "points": 5,
                 "options": [("True", True), ("False", False)]},
                {"text": "Name the four bases found in DNA.",
                 "type": "short_answer", "points": 10, "options": []},
            ],
        },
    },
]


async def seed():
    async with AsyncSessionLocal() as db:
        print("🌱 Seeding minimal demo data...")

        # ── District & School ──
        district = await get_or_create(db, District,
            {"slug": "lincoln-unified"},
            {"name": "Lincoln Unified School District", "is_active": True})
        school = await get_or_create(db, School,
            {"code": "LHS"},
            {"district_id": district.id, "name": "Lincoln High School", "is_active": True})

        # ── Users ──
        admin = await create_user(db, district.id, school.id,
            "admin@lincoln-unified.edu", "Diana", "Roberts", "Admin123!", "admin")
        teachers = [
            await create_user(db, district.id, school.id,
                "sarah.chen@lincoln-unified.edu", "Sarah", "Chen", "Teacher123!", "teacher"),
            await create_user(db, district.id, school.id,
                "james.rivera@lincoln-unified.edu", "James", "Rivera", "Teacher123!", "teacher"),
        ]
        students = [
            await create_user(db, district.id, school.id,
                f"student{i+1:03d}@lincoln-unified.edu", first, last, "Student123!", "student")
            for i, (first, last) in enumerate([
                ("Olivia", "Smith"), ("Liam", "Johnson"),
                ("Emma", "Williams"), ("Noah", "Brown"),
            ])
        ]
        parent = await create_user(db, district.id, school.id,
            "parent001@lincoln-unified.edu", "Maria", "Garcia", "Parent123!", "parent")

        # Link parent to student001
        if not (await db.execute(select(ParentStudent).where(
            ParentStudent.parent_id == parent.id,
            ParentStudent.student_id == students[0].id))).scalar_one_or_none():
            db.add(ParentStudent(parent_id=parent.id, student_id=students[0].id))

        await db.commit()
        print(f"  ✓ 1 admin, {len(teachers)} teachers, {len(students)} students, 1 parent")

        # ── Courses, modules, lessons, quizzes ──
        created_courses = []
        course_sections = {}
        for cdata in COURSES:
            teacher = teachers[cdata["teacher_idx"]]
            course = (await db.execute(select(Course).where(
                Course.title == cdata["title"],
                Course.tenant_id == district.id))).scalar_one_or_none()
            if not course:
                course = Course(
                    tenant_id=district.id,
                    school_id=teacher.school_id,
                    teacher_id=teacher.id,
                    title=cdata["title"],
                    subject=cdata["subject"],
                    grade_level=cdata["grade_level"],
                    description=cdata["description"],
                    is_published=True,
                    start_date=date.today() - timedelta(days=30),
                    end_date=date.today() + timedelta(days=120),
                )
                db.add(course)
                await db.flush()
            created_courses.append(course)

            section = (await db.execute(select(Section).where(
                Section.course_id == course.id, Section.name == "Period 1"))).scalar_one_or_none()
            if not section:
                section = Section(course_id=course.id, name="Period 1", capacity=30)
                db.add(section)
                await db.flush()
            course_sections[course.id] = section

            module = (await db.execute(select(Module).where(
                Module.course_id == course.id, Module.title == cdata["module"]))).scalar_one_or_none()
            if not module:
                module = Module(course_id=course.id, title=cdata["module"], position=0)
                db.add(module)
                await db.flush()

            for pos, (title, ltype, dur) in enumerate(cdata["lessons"]):
                if not (await db.execute(select(Lesson).where(
                    Lesson.module_id == module.id, Lesson.title == title))).scalar_one_or_none():
                    db.add(Lesson(
                        module_id=module.id, title=title, content_type=ltype,
                        body=f"<h2>{title}</h2><p>Lesson content for {title.lower()}.</p>" if ltype == "text" else None,
                        video_url="https://www.youtube.com/embed/dQw4w9WgXcQ" if ltype == "video" else None,
                        position=pos, duration_min=dur))

            qd = cdata["quiz"]
            quiz = (await db.execute(select(Quiz).where(
                Quiz.course_id == course.id, Quiz.title == qd["title"]))).scalar_one_or_none()
            if not quiz:
                quiz = Quiz(
                    course_id=course.id,
                    title=qd["title"],
                    instructions="Read each question carefully. You have 30 minutes.",
                    time_limit_min=30,
                    max_attempts=1,
                    is_published=True,
                    weight=Decimal("0.300"),
                    due_at=now_utc() + timedelta(days=14),
                )
                db.add(quiz)
                await db.flush()
                for q_pos, q in enumerate(qd["questions"]):
                    question = Question(
                        quiz_id=quiz.id, text=q["text"],
                        question_type=q["type"], points=q["points"], position=q_pos)
                    db.add(question)
                    await db.flush()
                    for text, is_correct in q["options"]:
                        db.add(QuestionOption(question_id=question.id, text=text, is_correct=is_correct))

        await db.commit()
        print(f"  ✓ {len(created_courses)} courses with modules, lessons, and quizzes")

        # ── Enrollments: every student in every course ──
        for student in students:
            for course in created_courses:
                section = course_sections[course.id]
                if not (await db.execute(select(Enrollment).where(
                    Enrollment.section_id == section.id,
                    Enrollment.student_id == student.id))).scalar_one_or_none():
                    db.add(Enrollment(
                        section_id=section.id, student_id=student.id,
                        status="active",
                        enrolled_at=now_utc() - timedelta(days=30)))

        await db.commit()
        print("  ✓ Enrollments")

        # ── Submissions: student001 fully graded, student002 needs review ──
        algebra = created_courses[0]
        algebra_quiz = (await db.execute(select(Quiz).where(Quiz.course_id == algebra.id))).scalar_one()
        algebra_questions = (await db.execute(
            select(Question).where(Question.quiz_id == algebra_quiz.id).order_by(Question.position)
        )).scalars().all()

        async def make_submission(student, status, score):
            existing = (await db.execute(select(Submission).where(
                Submission.quiz_id == algebra_quiz.id,
                Submission.student_id == student.id))).scalar_one_or_none()
            if existing:
                return existing
            started = now_utc() - timedelta(days=2)
            sub = Submission(
                quiz_id=algebra_quiz.id, student_id=student.id,
                attempt_num=1, started_at=started,
                submitted_at=started + timedelta(minutes=15),
                status=status,
                score=Decimal(str(score)) if score is not None else None,
                graded_by=teachers[0].id if status == "graded" else None,
                graded_at=started + timedelta(hours=2) if status == "graded" else None,
            )
            db.add(sub)
            await db.flush()
            return sub

        # student001: graded with score 75 (MCQ + T/F correct, short_answer graded by teacher)
        sub1 = await make_submission(students[0], "graded", 75)
        # student002: submitted but short_answer not yet graded
        sub2 = await make_submission(students[1], "submitted", None)

        for sub, manual_pts in [(sub1, Decimal("7.5")), (sub2, None)]:
            for q in algebra_questions:
                if (await db.execute(select(Answer).where(
                    Answer.submission_id == sub.id, Answer.question_id == q.id))).scalar_one_or_none():
                    continue
                opts = (await db.execute(select(QuestionOption).where(
                    QuestionOption.question_id == q.id))).scalars().all()
                if q.question_type in ("mcq", "true_false"):
                    correct = next((o for o in opts if o.is_correct), None)
                    db.add(Answer(
                        submission_id=sub.id, question_id=q.id,
                        selected_option_id=correct.id if correct else None,
                        is_correct=True,
                        points_earned=q.points))
                else:  # short_answer
                    db.add(Answer(
                        submission_id=sub.id, question_id=q.id,
                        text_response="Sample student response.",
                        is_correct=None,
                        points_earned=manual_pts,
                        feedback="Good explanation." if manual_pts else None))

        await db.commit()
        print("  ✓ 2 submissions (1 graded, 1 pending teacher review)")

        # ── Grade entries for student001 in Algebra ──
        existing_grades = (await db.execute(select(GradeEntry).where(
            GradeEntry.student_id == students[0].id,
            GradeEntry.course_id == algebra.id))).scalars().all()
        if not existing_grades:
            db.add(GradeEntry(
                student_id=students[0].id, course_id=algebra.id,
                quiz_id=algebra_quiz.id, submission_id=sub1.id,
                category="quiz", label=None,
                grade=4, weight=Decimal("0.300"),
                posted_at=now_utc() - timedelta(days=1)))
            db.add(GradeEntry(
                student_id=students[0].id, course_id=algebra.id,
                category="assignment", label="Homework 1",
                grade=5, weight=Decimal("0.250"),
                posted_at=now_utc() - timedelta(days=5)))
            db.add(GradeEntry(
                student_id=students[0].id, course_id=algebra.id,
                category="participation", label="Class Participation",
                grade=4, weight=Decimal("0.150"),
                posted_at=now_utc() - timedelta(days=3)))
            db.add(GradeEntry(
                student_id=students[0].id, course_id=algebra.id,
                category="exam", label="Midterm Exam",
                grade=3, weight=Decimal("0.300"),
                posted_at=now_utc() - timedelta(days=10)))

        await db.commit()
        print("  ✓ Grade entries for student001 in Algebra")

        # ── Attendance: 5 weekdays × every enrollment ──
        check_date = date.today()
        days_logged = 0
        statuses_cycle = [AttendanceStatus.PRESENT, AttendanceStatus.PRESENT,
                          AttendanceStatus.PRESENT, AttendanceStatus.TARDY, AttendanceStatus.ABSENT]
        attendance_rows = 0
        while days_logged < 5:
            check_date -= timedelta(days=1)
            if check_date.weekday() >= 5:
                continue
            days_logged += 1
            for course in created_courses:
                section = course_sections[course.id]
                for idx, student in enumerate(students):
                    if (await db.execute(select(Attendance).where(
                        Attendance.course_id == course.id,
                        Attendance.student_id == student.id,
                        Attendance.date == check_date))).scalar_one_or_none():
                        continue
                    status = statuses_cycle[(idx + days_logged) % len(statuses_cycle)]
                    db.add(Attendance(
                        course_id=course.id, section_id=section.id,
                        student_id=student.id, teacher_id=course.teacher_id,
                        date=check_date, status=status,
                        tenant_id=district.id))
                    attendance_rows += 1

        await db.commit()
        print(f"  ✓ {attendance_rows} attendance rows (5 school days)")

        # ── Badges ──
        badge_defs = [
            ("First Steps", "Complete your first quiz", "rocket", "engagement", "quiz_count", 1),
            ("Perfect Score", "Get a perfect score on a quiz", "star", "academic", "perfect_score", 1),
            ("Rising Star", "Earn 50 points", "trending-up", "engagement", "total_points", 50),
        ]
        badges = []
        for name, desc, icon, cat, ctype, cval in badge_defs:
            badge = await get_or_create(db, Badge, {"name": name},
                {"description": desc, "icon": icon, "category": cat,
                 "criteria_type": ctype, "criteria_value": cval})
            badges.append(badge)

        # Award "First Steps" to student001 (who has the graded submission)
        if not (await db.execute(select(UserBadge).where(
            UserBadge.user_id == students[0].id,
            UserBadge.badge_id == badges[0].id))).scalar_one_or_none():
            db.add(UserBadge(user_id=students[0].id, badge_id=badges[0].id,
                             earned_at=now_utc() - timedelta(days=1)))

        # Points for student001
        if not (await db.execute(select(PointEntry).where(
            PointEntry.user_id == students[0].id))).scalars().first():
            db.add(PointEntry(user_id=students[0].id, points=10, reason="quiz_completed"))
            db.add(PointEntry(user_id=students[0].id, points=5, reason="lesson_viewed"))

        await db.commit()
        print(f"  ✓ {len(badges)} badges + points for student001")

        # ── Notifications ──
        existing_notifs = (await db.execute(select(Notification).where(
            Notification.user_id == students[0].id))).scalars().first()
        if not existing_notifs:
            db.add(Notification(
                user_id=students[0].id, tenant_id=district.id,
                type="grade_posted",
                payload={"course_id": str(algebra.id), "grade": 4,
                         "category": "quiz", "label": algebra_quiz.title},
                is_read=False))
            db.add(Notification(
                user_id=students[0].id, tenant_id=district.id,
                type="announcement",
                payload={"message": "Welcome to the new semester!"},
                is_read=False))

        await db.commit()
        print("  ✓ Notifications")

        # ── Activity logs ──
        existing_logs = (await db.execute(select(ActivityLog).where(
            ActivityLog.user_id == students[0].id))).scalars().first()
        if not existing_logs:
            for user in [admin, teachers[0], students[0]]:
                for event in ["login", "course_viewed", "lesson_viewed"]:
                    db.add(ActivityLog(
                        tenant_id=district.id,
                        user_id=user.id,
                        event_type=event,
                        resource_id=algebra.id if event != "login" else None,
                        event_metadata={"ip": "192.168.1.1"},
                        occurred_at=now_utc() - timedelta(hours=random.randint(1, 48))))

        await db.commit()
        print("  ✓ Activity logs")

        # ── Report snapshots: 2 weeks × 4 types ──
        report_types = ["weekly_engagement", "course_performance",
                        "attendance_summary", "grade_distribution"]
        for weeks_ago in range(2):
            period_end = date.today() - timedelta(weeks=weeks_ago)
            period_start = period_end - timedelta(days=7)
            for rtype in report_types:
                if (await db.execute(select(ReportSnapshot).where(
                    ReportSnapshot.report_type == rtype,
                    ReportSnapshot.period_start == period_start))).scalar_one_or_none():
                    continue
                if rtype == "weekly_engagement":
                    data = {"active_students": 4, "active_teachers": 2,
                            "lessons_viewed": 12, "quizzes_completed": 2, "messages_sent": 3}
                elif rtype == "course_performance":
                    data = {"courses": [{"title": c.title, "avg_grade": 3.5, "submissions": 2}
                                        for c in created_courses]}
                elif rtype == "attendance_summary":
                    data = {"total_records": 40, "present_pct": 60.0,
                            "absent_pct": 20.0, "tardy_pct": 20.0}
                else:
                    data = {"grade_5": 1, "grade_4": 1, "grade_3": 1, "grade_2": 0, "grade_1": 0}
                db.add(ReportSnapshot(
                    tenant_id=district.id,
                    report_type=rtype,
                    period_start=period_start,
                    period_end=period_end,
                    data=data,
                    generated_at=datetime.combine(period_end, datetime.min.time()).replace(tzinfo=timezone.utc)))

        await db.commit()
        print("  ✓ Report snapshots (2 weeks)")

        # ── Summary ──
        print()
        print("=" * 60)
        print("✅ Minimal seed complete!")
        print("=" * 60)
        print()
        print("  District : lincoln-unified")
        print("  School   : Lincoln High School (LHS)")
        print()
        print("  Logins (org: lincoln-unified):")
        print("    admin@lincoln-unified.edu        / Admin123!")
        print("    sarah.chen@lincoln-unified.edu   / Teacher123!  (Algebra I)")
        print("    james.rivera@lincoln-unified.edu / Teacher123!  (Biology)")
        print("    student001@lincoln-unified.edu   / Student123!  (graded quiz + grades)")
        print("    student002@lincoln-unified.edu   / Student123!  (pending teacher review)")
        print("    student003@lincoln-unified.edu   / Student123!  (no quiz yet)")
        print("    student004@lincoln-unified.edu   / Student123!  (no quiz yet)")
        print("    parent001@lincoln-unified.edu    / Parent123!   (linked to student001)")
        print()


if __name__ == "__main__":
    asyncio.run(seed())
