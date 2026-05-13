"""
Seed — idempotent, safe to re-run.

Populates every table with enough rows to fill the gradebook:
  - 1 district, 1 school
  - 1 admin, 2 teachers, 4 students, 1 parent
  - 2 courses (1 per teacher), each with 1 module / 2 lessons / 1 quiz
  - Every student submits every quiz, gets full grades (quiz/assignment/participation/exam)
  - Every student submits every assignment
  - Attendance, badges, points, notifications, activity logs, reports
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
from app.models.assignment import Assignment, AssignmentSubmission
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


# Per-student grade profile: (quiz, assignment, participation, exam) in Kosovo 1-5
STUDENT_GRADES = [
    {"first": "Olivia", "last": "Smith",   "grades": {"quiz": 4, "assignment": 5, "participation": 4, "exam": 3}},
    {"first": "Liam",   "last": "Johnson",  "grades": {"quiz": 3, "assignment": 5, "participation": 3, "exam": 4}},
    {"first": "Emma",   "last": "Williams", "grades": {"quiz": 2, "assignment": 3, "participation": 4, "exam": 2}},
    {"first": "Noah",   "last": "Brown",    "grades": {"quiz": 1, "assignment": 2, "participation": 2, "exam": 1}},
]

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
        print("Seeding demo data...")

        # ── Roles (idempotent) ──
        for role_name in ("admin", "teacher", "student", "parent"):
            if not (await db.execute(select(Role).where(Role.name == role_name))).scalar_one_or_none():
                db.add(Role(name=role_name))
        await db.flush()

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
                f"student{i+1:03d}@lincoln-unified.edu", s["first"], s["last"], "Student123!", "student")
            for i, s in enumerate(STUDENT_GRADES)
        ]
        parent = await create_user(db, district.id, school.id,
            "parent001@lincoln-unified.edu", "Maria", "Garcia", "Parent123!", "parent")

        # Link parent to student001
        if not (await db.execute(select(ParentStudent).where(
            ParentStudent.parent_id == parent.id,
            ParentStudent.student_id == students[0].id))).scalar_one_or_none():
            db.add(ParentStudent(parent_id=parent.id, student_id=students[0].id))

        await db.commit()
        print(f"  1 admin, {len(teachers)} teachers, {len(students)} students, 1 parent")

        # ── Courses, modules, lessons, quizzes ──
        created_courses = []
        course_sections = {}
        created_quizzes = {}
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
                    category_weights={"quiz": 0.30, "assignment": 0.25, "exam": 0.30, "participation": 0.15},
                    grade_thresholds={"5": 90, "4": 75, "3": 60, "2": 45},
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
            created_quizzes[course.id] = quiz

        await db.commit()
        print(f"  {len(created_courses)} courses with modules, lessons, and quizzes")

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
        print("  Enrollments")

        # ── Quiz submissions: every student submits every quiz ──
        submissions_by_student = {}
        for course in created_courses:
            quiz = created_quizzes[course.id]
            questions = (await db.execute(
                select(Question).where(Question.quiz_id == quiz.id).order_by(Question.position)
            )).scalars().all()

            for student in students:
                existing = (await db.execute(select(Submission).where(
                    Submission.quiz_id == quiz.id,
                    Submission.student_id == student.id))).scalar_one_or_none()
                if existing:
                    submissions_by_student.setdefault(student.id, {})[course.id] = existing
                    continue

                started = now_utc() - timedelta(days=2, hours=random.randint(0, 24))
                grade_info = STUDENT_GRADES[students.index(student)]["grades"]
                quiz_grade = grade_info["quiz"]

                # Convert Kosovo grade back to a score percentage for realism
                score_map = {5: 92, 4: 80, 3: 68, 2: 55, 1: 40}
                score_pct = score_map[quiz_grade]

                sub = Submission(
                    quiz_id=quiz.id, student_id=student.id,
                    attempt_num=1, started_at=started,
                    submitted_at=started + timedelta(minutes=random.randint(5, 25)),
                    status="graded",
                    score=Decimal(str(score_pct)),
                    graded_by=course.teacher_id,
                    graded_at=started + timedelta(hours=random.randint(1, 4)),
                )
                db.add(sub)
                await db.flush()
                submissions_by_student.setdefault(student.id, {})[course.id] = sub

                for q in questions:
                    opts = (await db.execute(select(QuestionOption).where(
                        QuestionOption.question_id == q.id))).scalars().all()
                    if q.question_type in ("mcq", "true_false"):
                        correct = next((o for o in opts if o.is_correct), None)
                        # Higher-grade students get correct answers more often
                        got_it = random.random() < (quiz_grade / 5.0)
                        db.add(Answer(
                            submission_id=sub.id, question_id=q.id,
                            selected_option_id=correct.id if got_it and correct else None,
                            is_correct=got_it,
                            points_earned=q.points if got_it else 0))
                    else:
                        db.add(Answer(
                            submission_id=sub.id, question_id=q.id,
                            text_response="Sample student response.",
                            is_correct=None,
                            points_earned=Decimal(str(round(score_pct * q.points / 100, 1))),
                            feedback="Good effort." if quiz_grade >= 3 else "Needs improvement. Review the material."))

        await db.commit()
        print(f"  Quiz submissions ({len(created_courses) * len(students)} total)")

        # ── Grade entries: every student gets all 4 categories per course ──
        grade_labels = {
            "quiz": None,
            "assignment": "Homework 1",
            "participation": "Class Participation",
            "exam": "Midterm Exam",
        }
        grade_feedback = {
            "quiz": "Solid work on the quiz. Keep reviewing the material.",
            "assignment": "Good job on the homework.",
            "participation": "Actively participates in class discussions.",
            "exam": "Review the chapters covered and practice more.",
        }
        grade_count = 0
        for student in students:
            grade_info = STUDENT_GRADES[students.index(student)]["grades"]
            for course in created_courses:
                quiz = created_quizzes[course.id]
                sub = submissions_by_student[student.id][course.id]
                for category in ["quiz", "assignment", "participation", "exam"]:
                    existing = (await db.execute(select(GradeEntry).where(
                        GradeEntry.student_id == student.id,
                        GradeEntry.course_id == course.id,
                        GradeEntry.category == category))).scalar_one_or_none()
                    if existing:
                        continue
                    weight = Decimal({
                        "quiz": "0.300", "assignment": "0.250",
                        "participation": "0.150", "exam": "0.300",
                    }[category])
                    kwargs = {
                        "student_id": student.id,
                        "course_id": course.id,
                        "category": category,
                        "label": grade_labels[category],
                        "grade": grade_info[category],
                        "weight": weight,
                        "feedback": grade_feedback[category],
                        "posted_at": now_utc() - timedelta(days=random.randint(1, 10)),
                    }
                    if category == "quiz":
                        kwargs["quiz_id"] = quiz.id
                        kwargs["submission_id"] = sub.id
                    db.add(GradeEntry(**kwargs))
                    grade_count += 1

        await db.commit()
        print(f"  Grade entries ({grade_count} total)")

        # ── Assignments: 1 per course, submissions from every student ──
        for course in created_courses:
            assignment = (await db.execute(select(Assignment).where(
                Assignment.course_id == course.id, Assignment.title == "Homework 2"))).scalar_one_or_none()
            if not assignment:
                assignment = Assignment(
                    course_id=course.id,
                    title="Homework 2",
                    description="Solve the problems in the attached worksheet. Show all steps.",
                    due_at=now_utc() + timedelta(days=7),
                    max_score=Decimal("100"),
                    is_published=True,
                    allows_file_upload=True,
                    allowed_file_types="pdf,docx",
                )
                db.add(assignment)
                await db.flush()

            for student in students:
                existing_assign_sub = (await db.execute(select(AssignmentSubmission).where(
                    AssignmentSubmission.assignment_id == assignment.id,
                    AssignmentSubmission.student_id == student.id))).scalar_one_or_none()
                if existing_assign_sub:
                    continue
                grade_info = STUDENT_GRADES[students.index(student)]["grades"]
                assign_grade = grade_info["assignment"]
                score_map = {5: 95, 4: 82, 3: 70, 2: 58, 1: 42}
                score = score_map[assign_grade]
                db.add(AssignmentSubmission(
                    assignment_id=assignment.id,
                    student_id=student.id,
                    text_response="Here is my completed homework assignment.",
                    submitted_at=now_utc() - timedelta(hours=random.randint(1, 24)),
                    score=Decimal(str(score)),
                    status="graded",
                    graded_by=course.teacher_id,
                    graded_at=now_utc() - timedelta(hours=random.randint(0, 6)),
                    feedback="Well done!" if assign_grade >= 4 else "Good effort, but needs more detail." if assign_grade >= 2 else "Please redo this assignment.",
                ))

        await db.commit()
        print(f"  Assignments with submissions")

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
        print(f"  {attendance_rows} attendance rows (5 school days)")

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

        # Award badges to students based on performance
        for idx, student in enumerate(students):
            grade_info = STUDENT_GRADES[idx]["grades"]
            # First Steps — everyone who submitted gets it
            if not (await db.execute(select(UserBadge).where(
                UserBadge.user_id == student.id,
                UserBadge.badge_id == badges[0].id))).scalar_one_or_none():
                db.add(UserBadge(user_id=student.id, badge_id=badges[0].id,
                                 earned_at=now_utc() - timedelta(days=random.randint(1, 5))))
            # Perfect Score — only top performers
            if grade_info["quiz"] >= 4 and not (await db.execute(select(UserBadge).where(
                UserBadge.user_id == student.id,
                UserBadge.badge_id == badges[1].id))).scalar_one_or_none():
                db.add(UserBadge(user_id=student.id, badge_id=badges[1].id,
                                 earned_at=now_utc() - timedelta(days=random.randint(1, 3))))

        # Points for every student
        for student in students:
            if not (await db.execute(select(PointEntry).where(
                PointEntry.user_id == student.id))).scalars().first():
                db.add(PointEntry(user_id=student.id, points=10, reason="quiz_completed"))
                db.add(PointEntry(user_id=student.id, points=5, reason="lesson_viewed"))

        await db.commit()
        print(f"  {len(badges)} badges + points for all students")

        # ── Notifications for every student ──
        for student in students:
            if not (await db.execute(select(Notification).where(
                Notification.user_id == student.id))).scalars().first():
                db.add(Notification(
                    user_id=student.id, tenant_id=district.id,
                    type="grade_posted",
                    payload={"course_id": str(created_courses[0].id), "grade": STUDENT_GRADES[students.index(student)]["grades"]["quiz"],
                             "category": "quiz", "label": created_quizzes[created_courses[0].id].title},
                    is_read=False))
                db.add(Notification(
                    user_id=student.id, tenant_id=district.id,
                    type="announcement",
                    payload={"message": "Welcome to the new semester!"},
                    is_read=False))

        await db.commit()
        print("  Notifications")

        # ── Activity logs for all users ──
        for user in [admin, *teachers, *students]:
            if not (await db.execute(select(ActivityLog).where(
                ActivityLog.user_id == user.id))).scalars().first():
                for event in ["login", "course_viewed", "lesson_viewed"]:
                    db.add(ActivityLog(
                        tenant_id=district.id,
                        user_id=user.id,
                        event_type=event,
                        resource_id=created_courses[0].id if event != "login" else None,
                        event_metadata={"ip": "192.168.1.1"},
                        occurred_at=now_utc() - timedelta(hours=random.randint(1, 48))))

        await db.commit()
        print("  Activity logs")

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
                            "lessons_viewed": 12, "quizzes_completed": 8, "messages_sent": 3}
                elif rtype == "course_performance":
                    data = {"courses": [{"title": c.title, "avg_grade": 3.0, "submissions": 4}
                                        for c in created_courses]}
                elif rtype == "attendance_summary":
                    data = {"total_records": 40, "present_pct": 60.0,
                            "absent_pct": 20.0, "tardy_pct": 20.0}
                else:
                    data = {"grade_5": 1, "grade_4": 1, "grade_3": 1, "grade_2": 1, "grade_1": 0}
                db.add(ReportSnapshot(
                    tenant_id=district.id,
                    report_type=rtype,
                    period_start=period_start,
                    period_end=period_end,
                    data=data,
                    generated_at=datetime.combine(period_end, datetime.min.time()).replace(tzinfo=timezone.utc)))

        await db.commit()
        print("  Report snapshots (2 weeks)")

        # ── Summary ──
        print()
        print("=" * 60)
        print("Seed complete!")
        print("=" * 60)
        print()
        print("  District : lincoln-unified")
        print("  School   : Lincoln High School (LHS)")
        print()
        print("  Logins (org: lincoln-unified):")
        print("    admin@lincoln-unified.edu        / Admin123!")
        print("    sarah.chen@lincoln-unified.edu   / Teacher123!  (Algebra I)")
        print("    james.rivera@lincoln-unified.edu / Teacher123!  (Biology)")
        for i, s in enumerate(STUDENT_GRADES):
            grades = s["grades"]
            weighted = (
                grades["quiz"] * 0.30 + grades["assignment"] * 0.25 +
                grades["participation"] * 0.15 + grades["exam"] * 0.30
            )
            print(f"    student{i+1:03d}@lincoln-unified.edu   / Student123!  "
                  f"(quiz={grades['quiz']} assign={grades['assignment']} "
                  f"part={grades['participation']} exam={grades['exam']} "
                  f"wavg={weighted:.2f})")
        print("    parent001@lincoln-unified.edu    / Parent123!   (linked to student001)")
        print()


if __name__ == "__main__":
    asyncio.run(seed())
