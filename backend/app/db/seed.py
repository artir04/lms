"""
Demo seed script — idempotent, safe to re-run.
Creates: Lincoln Unified district, 2 schools, 1 admin, 3 teachers,
10 students, 5 courses, modules, lessons, quizzes, enrollments,
submissions, and grade entries.
"""
import asyncio
import random
import uuid
from datetime import datetime, timedelta, timezone, date

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.session import AsyncSessionLocal, engine
from app.db.base import Base
from app.models.tenant import District, School
from app.models.user import User, Role, UserRole
from app.models.course import Course, Section, Enrollment
from app.models.content import Module, Lesson
from app.models.assessment import Quiz, Question, QuestionOption, Submission, Answer
from app.models.grade import GradeEntry
from app.models.attendance import Attendance, AttendanceStatus
from app.core.security import hash_password

# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

def now_utc():
    return datetime.now(timezone.utc)


async def get_or_create_district(db, name: str, slug: str) -> District:
    r = await db.execute(select(District).where(District.slug == slug))
    d = r.scalar_one_or_none()
    if not d:
        d = District(name=name, slug=slug, is_active=True)
        db.add(d)
        await db.flush()
    return d


async def get_or_create_school(db, district_id, name: str, code: str) -> School:
    r = await db.execute(select(School).where(School.code == code))
    s = r.scalar_one_or_none()
    if not s:
        s = School(district_id=district_id, name=name, code=code, is_active=True)
        db.add(s)
        await db.flush()
    return s


async def get_role(db, name: str) -> Role:
    r = await db.execute(select(Role).where(Role.name == name))
    return r.scalar_one()


async def get_or_create_user(db, tenant_id, school_id, email, first, last, password, role_name) -> User:
    r = await db.execute(select(User).where(User.email == email))
    u = r.scalar_one_or_none()
    if not u:
        u = User(
            tenant_id=tenant_id,
            school_id=school_id,
            email=email,
            first_name=first,
            last_name=last,
            password_hash=hash_password(password),
            is_active=True,
        )
        db.add(u)
        await db.flush()
        role = await get_role(db, role_name)
        db.add(UserRole(user_id=u.id, role_id=role.id))
        await db.flush()
    return u


async def get_or_create_course(db, tenant_id, teacher_id, title, subject, grade_level, description) -> Course:
    r = await db.execute(select(Course).where(Course.title == title, Course.tenant_id == tenant_id))
    c = r.scalar_one_or_none()
    if not c:
        c = Course(
            tenant_id=tenant_id,
            teacher_id=teacher_id,
            title=title,
            subject=subject,
            grade_level=grade_level,
            description=description,
            is_published=True,
            start_date=date.today(),
            end_date=date.today() + timedelta(days=180),
        )
        db.add(c)
        await db.flush()
    return c


# ─────────────────────────────────────────────
# Course content data
# ─────────────────────────────────────────────

COURSES = [
    {
        "title": "Algebra I",
        "subject": "Mathematics",
        "grade_level": "9",
        "description": "Foundations of algebraic thinking: variables, equations, inequalities, and functions.",
        "teacher_idx": 0,
        "modules": [
            {
                "title": "Unit 1: Variables & Expressions",
                "lessons": [
                    ("What is a Variable?", "text", 10),
                    ("Writing Algebraic Expressions", "text", 15),
                    ("Evaluating Expressions", "text", 12),
                ],
            },
            {
                "title": "Unit 2: Equations & Inequalities",
                "lessons": [
                    ("Solving One-Step Equations", "text", 20),
                    ("Solving Two-Step Equations", "text", 25),
                    ("Graphing Inequalities", "video", 18),
                ],
            },
        ],
        "quiz": {
            "title": "Unit 1 Quiz — Variables & Expressions",
            "questions": [
                {
                    "text": "Which of the following is a variable?",
                    "type": "mcq",
                    "points": 5,
                    "options": [("x", True), ("5", False), ("3.14", False), ("100", False)],
                },
                {
                    "text": "Evaluate 3x + 2 when x = 4.",
                    "type": "mcq",
                    "points": 5,
                    "options": [("14", True), ("12", False), ("18", False), ("10", False)],
                },
                {
                    "text": "Algebra uses only numbers, not letters.",
                    "type": "true_false",
                    "points": 5,
                    "options": [("True", False), ("False", True)],
                },
                {
                    "text": "Write an expression for 'five more than twice a number n'.",
                    "type": "short_answer",
                    "points": 10,
                    "options": [],
                },
            ],
        },
    },
    {
        "title": "Biology",
        "subject": "Science",
        "grade_level": "10",
        "description": "Explore living organisms, cell biology, genetics, evolution, and ecosystems.",
        "teacher_idx": 0,
        "modules": [
            {
                "title": "Unit 1: Cell Biology",
                "lessons": [
                    ("Introduction to the Cell", "text", 15),
                    ("Cell Organelles", "video", 20),
                    ("Cell Division: Mitosis", "text", 25),
                ],
            },
            {
                "title": "Unit 2: Genetics",
                "lessons": [
                    ("DNA Structure & Function", "text", 20),
                    ("Mendelian Genetics", "text", 30),
                    ("Mutations & Variations", "text", 15),
                ],
            },
        ],
        "quiz": {
            "title": "Cell Biology Quiz",
            "questions": [
                {
                    "text": "Which organelle is known as the 'powerhouse of the cell'?",
                    "type": "mcq",
                    "points": 5,
                    "options": [("Mitochondria", True), ("Nucleus", False), ("Ribosome", False), ("Vacuole", False)],
                },
                {
                    "text": "DNA is found in the nucleus of the cell.",
                    "type": "true_false",
                    "points": 5,
                    "options": [("True", True), ("False", False)],
                },
                {
                    "text": "What is the process by which a cell duplicates its DNA and divides into two identical cells?",
                    "type": "mcq",
                    "points": 5,
                    "options": [("Mitosis", True), ("Meiosis", False), ("Osmosis", False), ("Diffusion", False)],
                },
                {
                    "text": "Name the four bases found in DNA.",
                    "type": "short_answer",
                    "points": 10,
                    "options": [],
                },
            ],
        },
    },
    {
        "title": "English Literature",
        "subject": "English",
        "grade_level": "11",
        "description": "Analysis of classic and contemporary literature, narrative techniques, and critical writing.",
        "teacher_idx": 1,
        "modules": [
            {
                "title": "Module 1: Short Stories",
                "lessons": [
                    ("Elements of a Short Story", "text", 15),
                    ("The Tell-Tale Heart — Reading", "text", 30),
                    ("Narrative Voice & Point of View", "text", 20),
                ],
            },
            {
                "title": "Module 2: Poetry",
                "lessons": [
                    ("Introduction to Poetry", "text", 10),
                    ("Figurative Language", "text", 20),
                    ("Analyzing a Poem", "text", 25),
                ],
            },
        ],
        "quiz": {
            "title": "Short Story Elements Quiz",
            "questions": [
                {
                    "text": "The main problem or struggle in a story is called the:",
                    "type": "mcq",
                    "points": 5,
                    "options": [("Conflict", True), ("Setting", False), ("Theme", False), ("Resolution", False)],
                },
                {
                    "text": "First-person narration uses 'I' to tell the story.",
                    "type": "true_false",
                    "points": 5,
                    "options": [("True", True), ("False", False)],
                },
                {
                    "text": "Which literary device involves giving human traits to non-human objects?",
                    "type": "mcq",
                    "points": 5,
                    "options": [("Personification", True), ("Simile", False), ("Alliteration", False), ("Hyperbole", False)],
                },
                {
                    "text": "Describe the setting of a story in your own words — what two elements does it include?",
                    "type": "short_answer",
                    "points": 10,
                    "options": [],
                },
            ],
        },
    },
    {
        "title": "World History",
        "subject": "History",
        "grade_level": "10",
        "description": "Survey of major civilizations, empires, and global events from ancient times to the modern era.",
        "teacher_idx": 1,
        "modules": [
            {
                "title": "Unit 1: Ancient Civilizations",
                "lessons": [
                    ("Mesopotamia: The Cradle of Civilization", "text", 20),
                    ("Ancient Egypt", "video", 25),
                    ("Ancient Greece & Democracy", "text", 20),
                ],
            },
            {
                "title": "Unit 2: The Middle Ages",
                "lessons": [
                    ("The Fall of Rome", "text", 15),
                    ("Feudalism in Europe", "text", 20),
                    ("The Crusades", "text", 25),
                ],
            },
        ],
        "quiz": {
            "title": "Ancient Civilizations Quiz",
            "questions": [
                {
                    "text": "Which river valley gave rise to Mesopotamian civilization?",
                    "type": "mcq",
                    "points": 5,
                    "options": [("Tigris & Euphrates", True), ("Nile", False), ("Indus", False), ("Yellow River", False)],
                },
                {
                    "text": "Ancient Egypt was located in South America.",
                    "type": "true_false",
                    "points": 5,
                    "options": [("True", False), ("False", True)],
                },
                {
                    "text": "Which city-state is credited with inventing democracy?",
                    "type": "mcq",
                    "points": 5,
                    "options": [("Athens", True), ("Sparta", False), ("Rome", False), ("Babylon", False)],
                },
                {
                    "text": "What was the writing system used in ancient Mesopotamia called?",
                    "type": "short_answer",
                    "points": 10,
                    "options": [],
                },
            ],
        },
    },
    {
        "title": "Intro to Computer Science",
        "subject": "Technology",
        "grade_level": "9",
        "description": "Fundamentals of computational thinking, programming logic, algorithms, and data structures.",
        "teacher_idx": 2,
        "modules": [
            {
                "title": "Module 1: What is Computer Science?",
                "lessons": [
                    ("History of Computing", "text", 15),
                    ("How Computers Work", "video", 20),
                    ("Binary & Number Systems", "text", 25),
                ],
            },
            {
                "title": "Module 2: Programming Basics",
                "lessons": [
                    ("Variables & Data Types", "text", 20),
                    ("Conditionals & Loops", "text", 30),
                    ("Introduction to Functions", "text", 25),
                ],
            },
        ],
        "quiz": {
            "title": "Computer Science Fundamentals Quiz",
            "questions": [
                {
                    "text": "What does CPU stand for?",
                    "type": "mcq",
                    "points": 5,
                    "options": [("Central Processing Unit", True), ("Computer Processing Utility", False), ("Core Power Unit", False), ("Central Program Utility", False)],
                },
                {
                    "text": "In binary, the number 1010 equals 10 in decimal.",
                    "type": "true_false",
                    "points": 5,
                    "options": [("True", True), ("False", False)],
                },
                {
                    "text": "Which of the following is a loop structure?",
                    "type": "mcq",
                    "points": 5,
                    "options": [("for loop", True), ("if statement", False), ("function", False), ("variable", False)],
                },
                {
                    "text": "What is an algorithm? Give an example.",
                    "type": "short_answer",
                    "points": 10,
                    "options": [],
                },
            ],
        },
    },
]

STUDENT_SCORES = [92, 87, 78, 95, 65, 82, 71, 88, 56, 90]


def score_to_grade(pct: float) -> int:
    """Convert quiz score percentage to Kosovo 1-5 grade."""
    if pct >= 90: return 5
    if pct >= 75: return 4
    if pct >= 60: return 3
    if pct >= 45: return 2
    return 1


# ─────────────────────────────────────────────
# Main seed function
# ─────────────────────────────────────────────

async def seed():
    async with AsyncSessionLocal() as db:
        print("🌱 Seeding demo data...")

        # ── District & Schools ──────────────────
        district = await get_or_create_district(db, "Lincoln Unified School District", "lincoln-unified")
        high_school = await get_or_create_school(db, district.id, "Lincoln High School", "LHS")
        middle_school = await get_or_create_school(db, district.id, "Lincoln Middle School", "LMS")

        # ── Admin ───────────────────────────────
        admin = await get_or_create_user(
            db, district.id, high_school.id,
            "admin@lincoln-unified.edu", "Diana", "Roberts",
            "Admin123!", "admin",
        )

        # ── Teachers ────────────────────────────
        teachers = []
        teacher_data = [
            ("sarah.chen@lincoln-unified.edu", "Sarah", "Chen"),
            ("james.rivera@lincoln-unified.edu", "James", "Rivera"),
            ("mike.johnson@lincoln-unified.edu", "Mike", "Johnson"),
        ]
        for email, first, last in teacher_data:
            t = await get_or_create_user(
                db, district.id, high_school.id,
                email, first, last, "Teacher123!", "teacher",
            )
            teachers.append(t)

        # ── Students ────────────────────────────
        student_names = [
            ("Emma", "Wilson"), ("Liam", "Thompson"), ("Olivia", "Martinez"),
            ("Noah", "Anderson"), ("Ava", "Jackson"), ("Ethan", "White"),
            ("Sophia", "Harris"), ("Mason", "Clark"), ("Isabella", "Lewis"),
            ("William", "Walker"),
        ]
        students = []
        for i, (first, last) in enumerate(student_names, 1):
            s = await get_or_create_user(
                db, district.id, high_school.id,
                f"student{i:02d}@lincoln-unified.edu", first, last,
                "Student123!", "student",
            )
            students.append(s)

        await db.commit()
        print(f"  ✓ District, 2 schools, 1 admin, 3 teachers, {len(students)} students")

        # ── Courses, modules, lessons, quizzes ──
        created_courses = []
        for course_data in COURSES:
            teacher = teachers[course_data["teacher_idx"]]
            course = await get_or_create_course(
                db, district.id, teacher.id,
                course_data["title"], course_data["subject"],
                course_data["grade_level"], course_data["description"],
            )
            created_courses.append(course)

            # Section
            sec_r = await db.execute(select(Section).where(Section.course_id == course.id))
            section = sec_r.scalar_one_or_none()
            if not section:
                section = Section(course_id=course.id, name="Period 1", capacity=30)
                db.add(section)
                await db.flush()

            # Enroll all students
            for student in students:
                enr_r = await db.execute(
                    select(Enrollment).where(
                        Enrollment.section_id == section.id,
                        Enrollment.student_id == student.id,
                    )
                )
                if not enr_r.scalar_one_or_none():
                    db.add(Enrollment(
                        section_id=section.id,
                        student_id=student.id,
                        status="active",
                        enrolled_at=now_utc(),
                    ))
            await db.flush()

            # Modules & Lessons
            for mod_pos, mod_data in enumerate(course_data["modules"]):
                mod_r = await db.execute(
                    select(Module).where(Module.course_id == course.id, Module.title == mod_data["title"])
                )
                mod = mod_r.scalar_one_or_none()
                if not mod:
                    mod = Module(course_id=course.id, title=mod_data["title"], position=mod_pos)
                    db.add(mod)
                    await db.flush()

                for les_pos, (les_title, les_type, les_dur) in enumerate(mod_data["lessons"]):
                    les_r = await db.execute(
                        select(Lesson).where(Lesson.module_id == mod.id, Lesson.title == les_title)
                    )
                    if not les_r.scalar_one_or_none():
                        body = f"<h2>{les_title}</h2><p>This lesson covers the key concepts of <strong>{les_title.lower()}</strong>. Work through the material carefully and complete any practice exercises before moving on.</p><p>Learning objectives:<ul><li>Understand the core principles</li><li>Apply concepts through examples</li><li>Prepare for the upcoming quiz</li></ul></p>"
                        db.add(Lesson(
                            module_id=mod.id,
                            title=les_title,
                            content_type=les_type,
                            body=body if les_type == "text" else None,
                            video_url="https://www.youtube.com/embed/dQw4w9WgXcQ" if les_type == "video" else None,
                            position=les_pos,
                            duration_min=les_dur,
                        ))
            await db.flush()

            # Quiz
            quiz_data = course_data["quiz"]
            quiz_r = await db.execute(
                select(Quiz).where(Quiz.course_id == course.id, Quiz.title == quiz_data["title"])
            )
            quiz = quiz_r.scalar_one_or_none()
            if not quiz:
                quiz = Quiz(
                    course_id=course.id,
                    title=quiz_data["title"],
                    instructions="Read each question carefully. You have 30 minutes to complete this quiz.",
                    time_limit_min=30,
                    max_attempts=2,
                    is_published=True,
                    due_at=now_utc() + timedelta(days=14),
                )
                db.add(quiz)
                await db.flush()

                for q_pos, q_data in enumerate(quiz_data["questions"]):
                    question = Question(
                        quiz_id=quiz.id,
                        text=q_data["text"],
                        question_type=q_data["type"],
                        points=q_data["points"],
                        position=q_pos,
                    )
                    db.add(question)
                    await db.flush()

                    for opt_pos, (opt_text, is_correct) in enumerate(q_data["options"]):
                        db.add(QuestionOption(
                            question_id=question.id,
                            text=opt_text,
                            is_correct=is_correct,
                        ))
                await db.flush()

        await db.commit()
        print(f"  ✓ {len(COURSES)} courses with modules, lessons, and quizzes")

        # ── Submissions & Grades ─────────────────
        for course_idx, (course, course_data) in enumerate(zip(created_courses, COURSES)):
            # Load quiz with questions
            quiz_r = await db.execute(
                select(Quiz)
                .options(
                    selectinload(Quiz.questions).selectinload(Question.options)
                )
                .where(Quiz.course_id == course.id)
            )
            quiz = quiz_r.scalar_one_or_none()
            if not quiz or not quiz.questions:
                continue

            mcq_questions = [q for q in quiz.questions if q.question_type in ("mcq", "true_false")]
            total_points = sum(float(q.points) for q in quiz.questions)

            # First 7 students submit the quiz
            for student_idx, student in enumerate(students[:7]):
                sub_r = await db.execute(
                    select(Submission).where(
                        Submission.quiz_id == quiz.id,
                        Submission.student_id == student.id,
                    )
                )
                if sub_r.scalar_one_or_none():
                    continue

                target_pct = STUDENT_SCORES[student_idx] / 100.0
                submission = Submission(
                    quiz_id=quiz.id,
                    student_id=student.id,
                    attempt_num=1,
                    started_at=now_utc() - timedelta(hours=2),
                    submitted_at=now_utc() - timedelta(hours=1),
                    status="graded",
                )
                db.add(submission)
                await db.flush()

                earned = 0.0
                for q in quiz.questions:
                    if q.question_type in ("mcq", "true_false"):
                        correct_opt = next((o for o in q.options if o.is_correct), None)
                        wrong_opt = next((o for o in q.options if not o.is_correct), None)
                        # Give correct answer based on target score
                        give_correct = random.random() < target_pct
                        chosen = correct_opt if give_correct and correct_opt else wrong_opt
                        pts = float(q.points) if give_correct and correct_opt else 0.0
                        earned += pts
                        db.add(Answer(
                            submission_id=submission.id,
                            question_id=q.id,
                            selected_option_id=chosen.id if chosen else None,
                            is_correct=give_correct and correct_opt is not None,
                            points_earned=pts,
                        ))
                    else:  # short_answer / essay
                        pts = float(q.points) * target_pct
                        earned += pts
                        db.add(Answer(
                            submission_id=submission.id,
                            question_id=q.id,
                            text_response="Sample student response demonstrating understanding of the topic.",
                            is_correct=None,
                            points_earned=pts,
                        ))

                score_pct = (earned / total_points * 100) if total_points > 0 else 0
                submission.score = round(score_pct, 2)
                await db.flush()

                # Grade entry (Kosovo 1-5 system)
                grade_r = await db.execute(
                    select(GradeEntry).where(
                        GradeEntry.student_id == student.id,
                        GradeEntry.course_id == course.id,
                        GradeEntry.quiz_id == quiz.id,
                    )
                )
                if not grade_r.scalar_one_or_none():
                    db.add(GradeEntry(
                        student_id=student.id,
                        course_id=course.id,
                        quiz_id=quiz.id,
                        submission_id=submission.id,
                        category="quiz",
                        label=quiz_data["title"],
                        grade=score_to_grade(score_pct),
                        weight=1.0,
                        posted_at=now_utc(),
                    ))

            await db.commit()

        print(f"  ✓ Quiz submissions and grades for 7 students across all courses")

        # ── Attendance ─────────────────────────────────
        # Generate attendance for the past 14 days across all courses
        for course in created_courses:
            # Get course teacher
            teacher = next((t for t in teachers if t.id == course.teacher_id), None)
            if not teacher:
                continue

            # Get course section
            sec_r = await db.execute(
                select(Section).where(Section.course_id == course.id)
            )
            section = sec_r.scalar_one_or_none()
            if not section:
                continue

            # Get all enrolled students
            enr_r = await db.execute(
                select(Enrollment).where(
                    Enrollment.section_id == section.id,
                    Enrollment.status == "active"
                )
            )
            enrollments = enr_r.scalars().all()

            # Generate attendance for past 14 days
            statuses = [AttendanceStatus.PRESENT, AttendanceStatus.PRESENT, AttendanceStatus.PRESENT,
                       AttendanceStatus.ABSENT, AttendanceStatus.TARDY]
            notes_options = ["doctor's note", "field trip", None, None, None]

            for days_ago in range(14):
                attendance_date = date.today() - timedelta(days=days_ago)

                for enrollment in enrollments:
                    # Check if attendance already exists
                    existing_r = await db.execute(
                        select(Attendance).where(
                            Attendance.course_id == course.id,
                            Attendance.student_id == enrollment.student_id,
                            Attendance.date == attendance_date
                        )
                    )
                    if existing_r.scalar_one_or_none():
                        continue

                    # Randomly assign status
                    status = random.choice(statuses)
                    notes = random.choice(notes_options) if status in [AttendanceStatus.ABSENT, AttendanceStatus.TARDY] else None

                    db.add(Attendance(
                        course_id=course.id,
                        section_id=section.id,
                        student_id=enrollment.student_id,
                        teacher_id=teacher.id,
                        date=attendance_date,
                        status=status,
                        notes=notes,
                        tenant_id=district.id
                    ))

            await db.flush()

        await db.commit()

        print(f"  ✓ Attendance records for {len(created_courses)} courses over the past 14 days")

        # ── Parents ───────────────────────────────────
        from app.models.parent import ParentStudent

        parent_data = [
            ("maria.wilson@lincoln-unified.edu", "Maria", "Wilson", "student01"),   # Emma Wilson's parent
            ("carlos.thompson@lincoln-unified.edu", "Carlos", "Thompson", "student02"),  # Liam Thompson's parent
            ("jennifer.martinez@lincoln-unified.edu", "Jennifer", "Martinez", "student03"),  # Olivia Martinez's parent
        ]
        parents_created = []
        for email, first, last, child_prefix in parent_data:
            parent = await get_or_create_user(
                db, district.id, high_school.id,
                email, first, last, "Parent123!", "parent",
            )
            parents_created.append(parent)

            # Find and link child
            child_email = f"{child_prefix}@lincoln-unified.edu"
            child_r = await db.execute(select(User).where(User.email == child_email))
            child = child_r.scalar_one_or_none()
            if child:
                existing_link = await db.execute(
                    select(ParentStudent).where(
                        ParentStudent.parent_id == parent.id,
                        ParentStudent.student_id == child.id,
                    )
                )
                if not existing_link.scalar_one_or_none():
                    db.add(ParentStudent(parent_id=parent.id, student_id=child.id))

        await db.commit()
        print(f"  ✓ {len(parents_created)} parent accounts linked to students")

        # ── Gamification: Badges & Points ─────────────
        from app.models.gamification import Badge, UserBadge, PointEntry
        from datetime import timezone as tz

        badge_defs = [
            ("First Steps", "Complete your first quiz", "rocket", "engagement", "quiz_count", 1),
            ("Quiz Whiz", "Complete 5 quizzes", "brain", "academic", "quiz_count", 5),
            ("Perfect Score", "Get a perfect score on a quiz", "star", "academic", "perfect_score", 1),
            ("Rising Star", "Earn 50 points", "trending-up", "engagement", "total_points", 50),
            ("Scholar", "Earn 100 points", "award", "academic", "total_points", 100),
            ("Dedicated Learner", "Earn 200 points", "trophy", "engagement", "total_points", 200),
        ]
        badges = []
        for name, desc, icon, cat, ctype, cval in badge_defs:
            r = await db.execute(select(Badge).where(Badge.name == name))
            badge = r.scalar_one_or_none()
            if not badge:
                badge = Badge(name=name, description=desc, icon=icon, category=cat, criteria_type=ctype, criteria_value=cval)
                db.add(badge)
                await db.flush()
            badges.append(badge)

        # Award points to students who submitted quizzes
        for student_idx, student in enumerate(students[:7]):
            # Points for quiz completions (one per course)
            for course in created_courses:
                existing_pt = await db.execute(
                    select(PointEntry).where(
                        PointEntry.user_id == student.id,
                        PointEntry.reason == "quiz_completed",
                        PointEntry.resource_id == course.id,
                    )
                )
                if not existing_pt.scalar_one_or_none():
                    db.add(PointEntry(user_id=student.id, points=10, reason="quiz_completed", resource_id=course.id))

            # Perfect score bonus for high scorers
            score = STUDENT_SCORES[student_idx]
            if score >= 95:
                existing_perf = await db.execute(
                    select(PointEntry).where(
                        PointEntry.user_id == student.id,
                        PointEntry.reason == "perfect_score",
                    )
                )
                if not existing_perf.scalar_one_or_none():
                    db.add(PointEntry(user_id=student.id, points=25, reason="perfect_score"))

        await db.flush()

        # Award badges based on criteria
        for student in students[:7]:
            total_pts_r = await db.execute(
                select(func.coalesce(func.sum(PointEntry.points), 0)).where(PointEntry.user_id == student.id)
            )
            total_pts = total_pts_r.scalar_one()
            quiz_count_r = await db.execute(
                select(func.count()).select_from(PointEntry).where(
                    PointEntry.user_id == student.id, PointEntry.reason == "quiz_completed"
                )
            )
            quiz_count = quiz_count_r.scalar_one()
            perfect_count_r = await db.execute(
                select(func.count()).select_from(PointEntry).where(
                    PointEntry.user_id == student.id, PointEntry.reason == "perfect_score"
                )
            )
            perfect_count = perfect_count_r.scalar_one()

            for badge in badges:
                earned = False
                if badge.criteria_type == "total_points" and total_pts >= badge.criteria_value:
                    earned = True
                elif badge.criteria_type == "quiz_count" and quiz_count >= badge.criteria_value:
                    earned = True
                elif badge.criteria_type == "perfect_score" and perfect_count >= badge.criteria_value:
                    earned = True

                if earned:
                    existing_b = await db.execute(
                        select(UserBadge).where(
                            UserBadge.user_id == student.id,
                            UserBadge.badge_id == badge.id,
                        )
                    )
                    if not existing_b.scalar_one_or_none():
                        db.add(UserBadge(user_id=student.id, badge_id=badge.id, earned_at=now_utc()))

        await db.commit()
        print(f"  ✓ Badges and points for students")

        print("✅ Demo seed complete!")
        print()
        print("  District slug : lincoln-unified")
        print("  Admin         : admin@lincoln-unified.edu / Admin123!")
        print("  Teachers      : sarah.chen@lincoln-unified.edu / Teacher123!")
        print("                  james.rivera@lincoln-unified.edu / Teacher123!")
        print("                  mike.johnson@lincoln-unified.edu / Teacher123!")
        print("  Parents       : maria.wilson@lincoln-unified.edu / Parent123!")
        print("                  carlos.thompson@lincoln-unified.edu / Parent123!")
        print("                  jennifer.martinez@lincoln-unified.edu / Parent123!")
        print("  Students      : student01@lincoln-unified.edu … student10@lincoln-unified.edu / Student123!")


if __name__ == "__main__":
    asyncio.run(seed())
