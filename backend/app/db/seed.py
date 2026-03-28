"""
Full-scale seed script — idempotent, safe to re-run.
Populates the LMS as if used by 100 students and 20 professors.
Includes: districts, schools, users, courses, modules, lessons,
quizzes, submissions, grades (multi-weight), attendance, messages,
notifications, gamification (badges + points), activity logs, and reports.
"""
import asyncio
import random
import uuid
from datetime import datetime, timedelta, timezone, date
from decimal import Decimal

from sqlalchemy import select, func
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
from app.models.parent import ParentStudent
from app.models.gamification import Badge, UserBadge, PointEntry
from app.models.notification import Notification
from app.models.analytics import ActivityLog, ReportSnapshot
from app.core.security import hash_password

# ─────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────
random.seed(42)  # reproducible data

NUM_STUDENTS = 100
NUM_TEACHERS = 20
NUM_PARENTS = 50  # ~half the students have a linked parent
ATTENDANCE_DAYS = 45  # school days of attendance history


def now_utc():
    return datetime.now(timezone.utc)


def rand_past(max_days=60):
    return now_utc() - timedelta(days=random.randint(0, max_days), hours=random.randint(0, 23))


def score_to_grade(pct: float) -> int:
    """Kosovo 1-5 grading scale."""
    if pct >= 90:
        return 5
    if pct >= 75:
        return 4
    if pct >= 60:
        return 3
    if pct >= 45:
        return 2
    return 1


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

async def get_or_create(db, model, filters: dict, defaults: dict):
    """Generic get-or-create helper."""
    stmt = select(model)
    for k, v in filters.items():
        stmt = stmt.where(getattr(model, k) == v)
    r = await db.execute(stmt)
    obj = r.scalar_one_or_none()
    if not obj:
        obj = model(**filters, **defaults)
        db.add(obj)
        await db.flush()
    return obj


async def get_role(db, name: str) -> Role:
    r = await db.execute(select(Role).where(Role.name == name))
    return r.scalar_one()


async def create_user(db, tenant_id, school_id, email, first, last, password, role_name) -> User:
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


# ─────────────────────────────────────────────
# Name banks
# ─────────────────────────────────────────────

FIRST_NAMES_M = [
    "Liam", "Noah", "Oliver", "Elijah", "James", "William", "Benjamin", "Lucas",
    "Henry", "Alexander", "Mason", "Michael", "Ethan", "Daniel", "Jacob", "Logan",
    "Jackson", "Aiden", "Sebastian", "Caleb", "Owen", "Samuel", "Ryan", "Nathan",
    "Adrian", "Isaac", "Leo", "Mateo", "Dylan", "Aaron", "Thomas", "Jaxon",
    "Isaiah", "Ezra", "Charles", "Josiah", "Christian", "Hunter", "Connor", "Eli",
    "Andrew", "Landon", "Jonathan", "Nolan", "Cameron", "Gavin", "Robert", "Brayden",
    "Jordan", "Dominic",
]
FIRST_NAMES_F = [
    "Olivia", "Emma", "Charlotte", "Amelia", "Ava", "Sophia", "Isabella", "Mia",
    "Evelyn", "Harper", "Luna", "Camila", "Gianna", "Elizabeth", "Eleanor", "Ella",
    "Abigail", "Sofia", "Avery", "Scarlett", "Emily", "Aria", "Penelope", "Chloe",
    "Layla", "Mila", "Nora", "Hazel", "Madison", "Ellie", "Lily", "Nova",
    "Violet", "Aurora", "Grace", "Zoey", "Riley", "Willow", "Emilia", "Stella",
    "Zoe", "Victoria", "Hannah", "Addison", "Leah", "Lucy", "Eliana", "Ivy",
    "Everly", "Lillian",
]
LAST_NAMES = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
    "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson",
    "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson",
    "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson", "Walker",
    "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill",
    "Flores", "Green", "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell",
    "Mitchell", "Carter", "Roberts", "Gomez", "Phillips", "Evans", "Turner", "Diaz",
    "Parker", "Cruz", "Edwards", "Collins", "Reyes", "Stewart", "Morris", "Morales",
    "Murphy", "Cook", "Rogers", "Gutierrez", "Ortiz", "Morgan", "Cooper", "Peterson",
    "Bailey", "Reed", "Kelly", "Howard", "Ramos", "Kim", "Cox", "Ward",
]

SUBJECTS = [
    "Mathematics", "Science", "English", "History", "Technology",
    "Physics", "Chemistry", "Art", "Music", "Physical Education",
]

# ─────────────────────────────────────────────
# Course definitions (15 courses)
# ─────────────────────────────────────────────

COURSES = [
    {
        "title": "Algebra I",
        "subject": "Mathematics",
        "grade_level": "9",
        "description": "Foundations of algebraic thinking: variables, equations, inequalities, and functions.",
        "teacher_idx": 0,
        "modules": [
            {"title": "Unit 1: Variables & Expressions", "lessons": [
                ("What is a Variable?", "text", 10),
                ("Writing Algebraic Expressions", "text", 15),
                ("Evaluating Expressions", "text", 12),
            ]},
            {"title": "Unit 2: Equations & Inequalities", "lessons": [
                ("Solving One-Step Equations", "text", 20),
                ("Solving Two-Step Equations", "text", 25),
                ("Graphing Inequalities", "video", 18),
            ]},
            {"title": "Unit 3: Linear Functions", "lessons": [
                ("Slope and Rate of Change", "text", 20),
                ("Graphing Linear Equations", "video", 25),
                ("Systems of Equations", "text", 30),
            ]},
        ],
        "quizzes": [
            {"title": "Unit 1 Quiz — Variables & Expressions", "questions": [
                {"text": "Which of the following is a variable?", "type": "mcq", "points": 5,
                 "options": [("x", True), ("5", False), ("3.14", False), ("100", False)]},
                {"text": "Evaluate 3x + 2 when x = 4.", "type": "mcq", "points": 5,
                 "options": [("14", True), ("12", False), ("18", False), ("10", False)]},
                {"text": "Algebra uses only numbers, not letters.", "type": "true_false", "points": 5,
                 "options": [("True", False), ("False", True)]},
                {"text": "Write an expression for 'five more than twice a number n'.", "type": "short_answer", "points": 10, "options": []},
            ]},
            {"title": "Unit 2 Quiz — Equations & Inequalities", "questions": [
                {"text": "Solve: x + 7 = 15", "type": "mcq", "points": 5,
                 "options": [("8", True), ("22", False), ("7", False), ("15", False)]},
                {"text": "Which symbol means 'less than or equal to'?", "type": "mcq", "points": 5,
                 "options": [("≤", True), ("<", False), ("≥", False), ("≠", False)]},
                {"text": "An equation always has an equal sign.", "type": "true_false", "points": 5,
                 "options": [("True", True), ("False", False)]},
                {"text": "Solve and explain: 2x - 3 = 11", "type": "short_answer", "points": 10, "options": []},
            ]},
        ],
    },
    {
        "title": "Geometry",
        "subject": "Mathematics",
        "grade_level": "10",
        "description": "Explore shapes, angles, proofs, area, volume, and coordinate geometry.",
        "teacher_idx": 0,
        "modules": [
            {"title": "Unit 1: Points, Lines & Planes", "lessons": [
                ("Basic Definitions", "text", 15),
                ("Angle Relationships", "text", 20),
                ("Parallel & Perpendicular Lines", "video", 25),
            ]},
            {"title": "Unit 2: Triangles & Congruence", "lessons": [
                ("Classifying Triangles", "text", 15),
                ("Triangle Congruence Theorems", "text", 30),
                ("Proofs with Triangles", "text", 25),
            ]},
        ],
        "quizzes": [
            {"title": "Geometry: Lines & Angles Quiz", "questions": [
                {"text": "Two angles that sum to 180° are called:", "type": "mcq", "points": 5,
                 "options": [("Supplementary", True), ("Complementary", False), ("Vertical", False), ("Adjacent", False)]},
                {"text": "Parallel lines never intersect.", "type": "true_false", "points": 5,
                 "options": [("True", True), ("False", False)]},
                {"text": "What is the sum of angles in a triangle?", "type": "mcq", "points": 5,
                 "options": [("180°", True), ("360°", False), ("90°", False), ("270°", False)]},
                {"text": "Describe the difference between complementary and supplementary angles.", "type": "short_answer", "points": 10, "options": []},
            ]},
        ],
    },
    {
        "title": "Biology",
        "subject": "Science",
        "grade_level": "10",
        "description": "Explore living organisms, cell biology, genetics, evolution, and ecosystems.",
        "teacher_idx": 1,
        "modules": [
            {"title": "Unit 1: Cell Biology", "lessons": [
                ("Introduction to the Cell", "text", 15),
                ("Cell Organelles", "video", 20),
                ("Cell Division: Mitosis", "text", 25),
            ]},
            {"title": "Unit 2: Genetics", "lessons": [
                ("DNA Structure & Function", "text", 20),
                ("Mendelian Genetics", "text", 30),
                ("Mutations & Variations", "text", 15),
            ]},
            {"title": "Unit 3: Ecosystems", "lessons": [
                ("Food Chains & Webs", "text", 20),
                ("Energy Flow in Ecosystems", "video", 25),
                ("Human Impact on Ecosystems", "text", 20),
            ]},
        ],
        "quizzes": [
            {"title": "Cell Biology Quiz", "questions": [
                {"text": "Which organelle is known as the 'powerhouse of the cell'?", "type": "mcq", "points": 5,
                 "options": [("Mitochondria", True), ("Nucleus", False), ("Ribosome", False), ("Vacuole", False)]},
                {"text": "DNA is found in the nucleus of the cell.", "type": "true_false", "points": 5,
                 "options": [("True", True), ("False", False)]},
                {"text": "What is the process by which a cell duplicates its DNA and divides?", "type": "mcq", "points": 5,
                 "options": [("Mitosis", True), ("Meiosis", False), ("Osmosis", False), ("Diffusion", False)]},
                {"text": "Name the four bases found in DNA.", "type": "short_answer", "points": 10, "options": []},
            ]},
            {"title": "Genetics Quiz", "questions": [
                {"text": "Who is known as the father of genetics?", "type": "mcq", "points": 5,
                 "options": [("Gregor Mendel", True), ("Charles Darwin", False), ("Louis Pasteur", False), ("Watson", False)]},
                {"text": "A dominant allele is always expressed when present.", "type": "true_false", "points": 5,
                 "options": [("True", True), ("False", False)]},
                {"text": "In a Punnett square, Bb x Bb gives what ratio of phenotypes?", "type": "mcq", "points": 5,
                 "options": [("3:1", True), ("1:1", False), ("2:1", False), ("4:0", False)]},
                {"text": "Explain the difference between genotype and phenotype.", "type": "short_answer", "points": 10, "options": []},
            ]},
        ],
    },
    {
        "title": "Chemistry",
        "subject": "Chemistry",
        "grade_level": "11",
        "description": "Atomic structure, periodic table, chemical bonding, reactions, and stoichiometry.",
        "teacher_idx": 2,
        "modules": [
            {"title": "Unit 1: Atomic Structure", "lessons": [
                ("History of the Atom", "text", 20),
                ("Subatomic Particles", "text", 15),
                ("Electron Configuration", "video", 25),
            ]},
            {"title": "Unit 2: Chemical Bonding", "lessons": [
                ("Ionic Bonds", "text", 20),
                ("Covalent Bonds", "text", 20),
                ("Metallic Bonds", "text", 15),
            ]},
        ],
        "quizzes": [
            {"title": "Atomic Structure Quiz", "questions": [
                {"text": "What particle has a positive charge?", "type": "mcq", "points": 5,
                 "options": [("Proton", True), ("Electron", False), ("Neutron", False), ("Photon", False)]},
                {"text": "Electrons orbit the nucleus.", "type": "true_false", "points": 5,
                 "options": [("True", True), ("False", False)]},
                {"text": "The atomic number equals the number of:", "type": "mcq", "points": 5,
                 "options": [("Protons", True), ("Neutrons", False), ("Electrons only", False), ("Nucleons", False)]},
                {"text": "Write the electron configuration for Carbon (Z=6).", "type": "short_answer", "points": 10, "options": []},
            ]},
        ],
    },
    {
        "title": "Physics",
        "subject": "Physics",
        "grade_level": "11",
        "description": "Mechanics, energy, waves, electricity, and magnetism.",
        "teacher_idx": 3,
        "modules": [
            {"title": "Unit 1: Motion & Forces", "lessons": [
                ("Speed, Velocity & Acceleration", "text", 20),
                ("Newton's Laws of Motion", "text", 25),
                ("Free-Body Diagrams", "video", 20),
            ]},
            {"title": "Unit 2: Energy & Work", "lessons": [
                ("Kinetic & Potential Energy", "text", 20),
                ("Conservation of Energy", "text", 25),
                ("Work and Power", "text", 20),
            ]},
        ],
        "quizzes": [
            {"title": "Motion & Forces Quiz", "questions": [
                {"text": "Newton's first law is also called the law of:", "type": "mcq", "points": 5,
                 "options": [("Inertia", True), ("Acceleration", False), ("Gravity", False), ("Momentum", False)]},
                {"text": "F = ma is Newton's second law.", "type": "true_false", "points": 5,
                 "options": [("True", True), ("False", False)]},
                {"text": "A 10 kg object accelerating at 2 m/s² requires a force of:", "type": "mcq", "points": 5,
                 "options": [("20 N", True), ("5 N", False), ("12 N", False), ("10 N", False)]},
                {"text": "Explain the difference between speed and velocity.", "type": "short_answer", "points": 10, "options": []},
            ]},
        ],
    },
    {
        "title": "English Literature",
        "subject": "English",
        "grade_level": "11",
        "description": "Analysis of classic and contemporary literature, narrative techniques, and critical writing.",
        "teacher_idx": 4,
        "modules": [
            {"title": "Module 1: Short Stories", "lessons": [
                ("Elements of a Short Story", "text", 15),
                ("The Tell-Tale Heart — Reading", "text", 30),
                ("Narrative Voice & Point of View", "text", 20),
            ]},
            {"title": "Module 2: Poetry", "lessons": [
                ("Introduction to Poetry", "text", 10),
                ("Figurative Language", "text", 20),
                ("Analyzing a Poem", "text", 25),
            ]},
        ],
        "quizzes": [
            {"title": "Short Story Elements Quiz", "questions": [
                {"text": "The main problem or struggle in a story is called the:", "type": "mcq", "points": 5,
                 "options": [("Conflict", True), ("Setting", False), ("Theme", False), ("Resolution", False)]},
                {"text": "First-person narration uses 'I' to tell the story.", "type": "true_false", "points": 5,
                 "options": [("True", True), ("False", False)]},
                {"text": "Which literary device involves giving human traits to non-human objects?", "type": "mcq", "points": 5,
                 "options": [("Personification", True), ("Simile", False), ("Alliteration", False), ("Hyperbole", False)]},
                {"text": "Describe the setting of a story — what two elements does it include?", "type": "short_answer", "points": 10, "options": []},
            ]},
        ],
    },
    {
        "title": "Creative Writing",
        "subject": "English",
        "grade_level": "10",
        "description": "Develop fiction, poetry, and non-fiction writing skills through workshop-style sessions.",
        "teacher_idx": 4,
        "modules": [
            {"title": "Module 1: Fiction Fundamentals", "lessons": [
                ("Character Development", "text", 20),
                ("Building a Plot", "text", 25),
                ("Setting and Atmosphere", "text", 20),
            ]},
            {"title": "Module 2: Poetry Workshop", "lessons": [
                ("Free Verse vs. Structured Poetry", "text", 15),
                ("Imagery and Sensory Detail", "text", 20),
                ("Writing Your First Poem", "text", 30),
            ]},
        ],
        "quizzes": [
            {"title": "Fiction Fundamentals Quiz", "questions": [
                {"text": "The sequence of events in a story is called the:", "type": "mcq", "points": 5,
                 "options": [("Plot", True), ("Theme", False), ("Motif", False), ("Tone", False)]},
                {"text": "A protagonist is the main character.", "type": "true_false", "points": 5,
                 "options": [("True", True), ("False", False)]},
                {"text": "The turning point of a story is called the:", "type": "mcq", "points": 5,
                 "options": [("Climax", True), ("Exposition", False), ("Denouement", False), ("Prologue", False)]},
                {"text": "Create a brief character sketch in 3-4 sentences.", "type": "essay", "points": 15, "options": []},
            ]},
        ],
    },
    {
        "title": "World History",
        "subject": "History",
        "grade_level": "10",
        "description": "Survey of major civilizations, empires, and global events from ancient times to the modern era.",
        "teacher_idx": 5,
        "modules": [
            {"title": "Unit 1: Ancient Civilizations", "lessons": [
                ("Mesopotamia: The Cradle of Civilization", "text", 20),
                ("Ancient Egypt", "video", 25),
                ("Ancient Greece & Democracy", "text", 20),
            ]},
            {"title": "Unit 2: The Middle Ages", "lessons": [
                ("The Fall of Rome", "text", 15),
                ("Feudalism in Europe", "text", 20),
                ("The Crusades", "text", 25),
            ]},
        ],
        "quizzes": [
            {"title": "Ancient Civilizations Quiz", "questions": [
                {"text": "Which river valley gave rise to Mesopotamian civilization?", "type": "mcq", "points": 5,
                 "options": [("Tigris & Euphrates", True), ("Nile", False), ("Indus", False), ("Yellow River", False)]},
                {"text": "Ancient Egypt was located in South America.", "type": "true_false", "points": 5,
                 "options": [("True", False), ("False", True)]},
                {"text": "Which city-state is credited with inventing democracy?", "type": "mcq", "points": 5,
                 "options": [("Athens", True), ("Sparta", False), ("Rome", False), ("Babylon", False)]},
                {"text": "What was the writing system used in ancient Mesopotamia called?", "type": "short_answer", "points": 10, "options": []},
            ]},
        ],
    },
    {
        "title": "U.S. Government & Civics",
        "subject": "History",
        "grade_level": "12",
        "description": "Branches of government, the Constitution, civil liberties, and citizen participation.",
        "teacher_idx": 5,
        "modules": [
            {"title": "Unit 1: The Constitution", "lessons": [
                ("Origins of the Constitution", "text", 20),
                ("The Bill of Rights", "text", 25),
                ("Amendments 11-27", "text", 20),
            ]},
            {"title": "Unit 2: Branches of Government", "lessons": [
                ("The Executive Branch", "text", 20),
                ("The Legislative Branch", "text", 20),
                ("The Judicial Branch", "video", 25),
            ]},
        ],
        "quizzes": [
            {"title": "Constitution & Bill of Rights Quiz", "questions": [
                {"text": "How many amendments are in the Bill of Rights?", "type": "mcq", "points": 5,
                 "options": [("10", True), ("5", False), ("12", False), ("7", False)]},
                {"text": "The First Amendment protects freedom of speech.", "type": "true_false", "points": 5,
                 "options": [("True", True), ("False", False)]},
                {"text": "Which branch of government interprets laws?", "type": "mcq", "points": 5,
                 "options": [("Judicial", True), ("Executive", False), ("Legislative", False), ("Administrative", False)]},
                {"text": "Explain the system of checks and balances in your own words.", "type": "short_answer", "points": 10, "options": []},
            ]},
        ],
    },
    {
        "title": "Intro to Computer Science",
        "subject": "Technology",
        "grade_level": "9",
        "description": "Fundamentals of computational thinking, programming logic, algorithms, and data structures.",
        "teacher_idx": 6,
        "modules": [
            {"title": "Module 1: What is Computer Science?", "lessons": [
                ("History of Computing", "text", 15),
                ("How Computers Work", "video", 20),
                ("Binary & Number Systems", "text", 25),
            ]},
            {"title": "Module 2: Programming Basics", "lessons": [
                ("Variables & Data Types", "text", 20),
                ("Conditionals & Loops", "text", 30),
                ("Introduction to Functions", "text", 25),
            ]},
        ],
        "quizzes": [
            {"title": "Computer Science Fundamentals Quiz", "questions": [
                {"text": "What does CPU stand for?", "type": "mcq", "points": 5,
                 "options": [("Central Processing Unit", True), ("Computer Processing Utility", False), ("Core Power Unit", False), ("Central Program Utility", False)]},
                {"text": "In binary, the number 1010 equals 10 in decimal.", "type": "true_false", "points": 5,
                 "options": [("True", True), ("False", False)]},
                {"text": "Which of the following is a loop structure?", "type": "mcq", "points": 5,
                 "options": [("for loop", True), ("if statement", False), ("function", False), ("variable", False)]},
                {"text": "What is an algorithm? Give an example.", "type": "short_answer", "points": 10, "options": []},
            ]},
            {"title": "Programming Basics Quiz", "questions": [
                {"text": "A variable stores:", "type": "mcq", "points": 5,
                 "options": [("Data", True), ("Hardware", False), ("Electricity", False), ("Sound", False)]},
                {"text": "A function can return a value.", "type": "true_false", "points": 5,
                 "options": [("True", True), ("False", False)]},
                {"text": "Which keyword is used to define a function in Python?", "type": "mcq", "points": 5,
                 "options": [("def", True), ("func", False), ("function", False), ("define", False)]},
                {"text": "Write a simple function that adds two numbers.", "type": "short_answer", "points": 10, "options": []},
            ]},
        ],
    },
    {
        "title": "Web Development",
        "subject": "Technology",
        "grade_level": "10",
        "description": "Build websites with HTML, CSS, and JavaScript fundamentals.",
        "teacher_idx": 6,
        "modules": [
            {"title": "Module 1: HTML Basics", "lessons": [
                ("Your First Web Page", "text", 20),
                ("HTML Tags & Structure", "text", 25),
                ("Links, Images & Media", "text", 20),
            ]},
            {"title": "Module 2: CSS Styling", "lessons": [
                ("Selectors & Properties", "text", 20),
                ("Box Model & Layout", "text", 25),
                ("Responsive Design", "video", 30),
            ]},
        ],
        "quizzes": [
            {"title": "HTML & CSS Quiz", "questions": [
                {"text": "HTML stands for:", "type": "mcq", "points": 5,
                 "options": [("HyperText Markup Language", True), ("High Tech Modern Language", False), ("Hyper Transfer Markup Language", False), ("Home Tool Markup Language", False)]},
                {"text": "CSS is used for styling web pages.", "type": "true_false", "points": 5,
                 "options": [("True", True), ("False", False)]},
                {"text": "Which tag creates a hyperlink?", "type": "mcq", "points": 5,
                 "options": [("<a>", True), ("<link>", False), ("<href>", False), ("<url>", False)]},
                {"text": "Explain the CSS box model.", "type": "short_answer", "points": 10, "options": []},
            ]},
        ],
    },
    {
        "title": "Art History",
        "subject": "Art",
        "grade_level": "11",
        "description": "Survey of art movements from the Renaissance through contemporary art.",
        "teacher_idx": 7,
        "modules": [
            {"title": "Module 1: Renaissance Art", "lessons": [
                ("The Italian Renaissance", "text", 25),
                ("Leonardo da Vinci", "video", 20),
                ("Michelangelo & the Sistine Chapel", "text", 20),
            ]},
            {"title": "Module 2: Modern Art Movements", "lessons": [
                ("Impressionism", "text", 20),
                ("Cubism and Picasso", "text", 20),
                ("Abstract Expressionism", "text", 25),
            ]},
        ],
        "quizzes": [
            {"title": "Renaissance Art Quiz", "questions": [
                {"text": "Who painted the Mona Lisa?", "type": "mcq", "points": 5,
                 "options": [("Leonardo da Vinci", True), ("Michelangelo", False), ("Raphael", False), ("Donatello", False)]},
                {"text": "The Renaissance began in Italy.", "type": "true_false", "points": 5,
                 "options": [("True", True), ("False", False)]},
                {"text": "Which artist painted the ceiling of the Sistine Chapel?", "type": "mcq", "points": 5,
                 "options": [("Michelangelo", True), ("Da Vinci", False), ("Botticelli", False), ("Caravaggio", False)]},
                {"text": "Describe the key characteristics of Renaissance art.", "type": "short_answer", "points": 10, "options": []},
            ]},
        ],
    },
    {
        "title": "Music Theory",
        "subject": "Music",
        "grade_level": "9",
        "description": "Notes, scales, chords, rhythm, and basic composition.",
        "teacher_idx": 8,
        "modules": [
            {"title": "Module 1: Fundamentals", "lessons": [
                ("Reading Musical Notation", "text", 20),
                ("Scales and Keys", "text", 25),
                ("Rhythm and Time Signatures", "video", 20),
            ]},
            {"title": "Module 2: Harmony & Chords", "lessons": [
                ("Major and Minor Chords", "text", 20),
                ("Chord Progressions", "text", 25),
                ("Writing Simple Melodies", "text", 30),
            ]},
        ],
        "quizzes": [
            {"title": "Music Fundamentals Quiz", "questions": [
                {"text": "How many notes are in a standard musical scale?", "type": "mcq", "points": 5,
                 "options": [("7", True), ("5", False), ("12", False), ("8", False)]},
                {"text": "A treble clef is also called a G clef.", "type": "true_false", "points": 5,
                 "options": [("True", True), ("False", False)]},
                {"text": "In 4/4 time, how many beats are in a measure?", "type": "mcq", "points": 5,
                 "options": [("4", True), ("3", False), ("6", False), ("2", False)]},
                {"text": "Explain the difference between major and minor keys.", "type": "short_answer", "points": 10, "options": []},
            ]},
        ],
    },
    {
        "title": "Physical Education & Health",
        "subject": "Physical Education",
        "grade_level": "9",
        "description": "Fitness, nutrition, team sports, and lifelong wellness habits.",
        "teacher_idx": 9,
        "modules": [
            {"title": "Module 1: Fitness Fundamentals", "lessons": [
                ("Components of Physical Fitness", "text", 15),
                ("Warm-Up and Cool-Down Routines", "video", 10),
                ("Heart Rate and Exercise", "text", 15),
            ]},
            {"title": "Module 2: Nutrition & Wellness", "lessons": [
                ("Macronutrients and Micronutrients", "text", 20),
                ("Hydration and Recovery", "text", 15),
                ("Mental Health & Exercise", "text", 20),
            ]},
        ],
        "quizzes": [
            {"title": "Fitness & Nutrition Quiz", "questions": [
                {"text": "Which is NOT a component of physical fitness?", "type": "mcq", "points": 5,
                 "options": [("Reading speed", True), ("Cardiovascular endurance", False), ("Flexibility", False), ("Muscular strength", False)]},
                {"text": "Stretching before exercise can help prevent injury.", "type": "true_false", "points": 5,
                 "options": [("True", True), ("False", False)]},
                {"text": "Proteins are primarily used for:", "type": "mcq", "points": 5,
                 "options": [("Muscle repair", True), ("Quick energy", False), ("Bone density", False), ("Hydration", False)]},
                {"text": "List three benefits of regular physical exercise.", "type": "short_answer", "points": 10, "options": []},
            ]},
        ],
    },
    {
        "title": "Environmental Science",
        "subject": "Science",
        "grade_level": "12",
        "description": "Climate change, biodiversity, pollution, and sustainable resource management.",
        "teacher_idx": 10,
        "modules": [
            {"title": "Unit 1: Climate & Atmosphere", "lessons": [
                ("The Greenhouse Effect", "text", 20),
                ("Global Climate Patterns", "video", 25),
                ("Climate Change Evidence", "text", 25),
            ]},
            {"title": "Unit 2: Biodiversity & Conservation", "lessons": [
                ("What is Biodiversity?", "text", 15),
                ("Threats to Biodiversity", "text", 20),
                ("Conservation Strategies", "text", 25),
            ]},
        ],
        "quizzes": [
            {"title": "Climate & Environment Quiz", "questions": [
                {"text": "Which gas is the primary driver of the greenhouse effect?", "type": "mcq", "points": 5,
                 "options": [("Carbon dioxide", True), ("Oxygen", False), ("Nitrogen", False), ("Helium", False)]},
                {"text": "Deforestation contributes to climate change.", "type": "true_false", "points": 5,
                 "options": [("True", True), ("False", False)]},
                {"text": "The ozone layer protects Earth from:", "type": "mcq", "points": 5,
                 "options": [("UV radiation", True), ("Asteroids", False), ("Wind", False), ("Sound", False)]},
                {"text": "Propose two actions individuals can take to reduce carbon footprint.", "type": "short_answer", "points": 10, "options": []},
            ]},
        ],
    },
]

# ─────────────────────────────────────────────
# Teacher data for 20 professors
# ─────────────────────────────────────────────
TEACHER_DATA = [
    ("sarah.chen", "Sarah", "Chen"),
    ("james.rivera", "James", "Rivera"),
    ("mike.johnson", "Mike", "Johnson"),
    ("lisa.park", "Lisa", "Park"),
    ("david.oconnell", "David", "O'Connell"),
    ("maria.sanchez", "Maria", "Sanchez"),
    ("robert.kim", "Robert", "Kim"),
    ("anna.petrov", "Anna", "Petrov"),
    ("thomas.wright", "Thomas", "Wright"),
    ("emily.brooks", "Emily", "Brooks"),
    ("ahmed.hassan", "Ahmed", "Hassan"),
    ("jennifer.lee", "Jennifer", "Lee"),
    ("mark.thompson", "Mark", "Thompson"),
    ("sofia.rossi", "Sofia", "Rossi"),
    ("daniel.murphy", "Daniel", "Murphy"),
    ("rachel.green", "Rachel", "Green"),
    ("kevin.nguyen", "Kevin", "Nguyen"),
    ("laura.martinez", "Laura", "Martinez"),
    ("chris.taylor", "Chris", "Taylor"),
    ("natalie.ward", "Natalie", "Ward"),
]



# ─────────────────────────────────────────────
# Main seed function
# ─────────────────────────────────────────────

async def seed():
    async with AsyncSessionLocal() as db:
        print("🌱 Seeding full-scale demo data (100 students, 20 professors)...")

        # ── District & Schools ──────────────────
        district = await get_or_create(db, District,
            {"slug": "lincoln-unified"},
            {"name": "Lincoln Unified School District", "is_active": True})

        high_school = await get_or_create(db, School,
            {"code": "LHS"},
            {"district_id": district.id, "name": "Lincoln High School", "is_active": True})

        middle_school = await get_or_create(db, School,
            {"code": "LMS"},
            {"district_id": district.id, "name": "Lincoln Middle School", "is_active": True})

        academy = await get_or_create(db, School,
            {"code": "LTA"},
            {"district_id": district.id, "name": "Lincoln Tech Academy", "is_active": True})

        schools = [high_school, middle_school, academy]

        # ── Admins ─────────────────────────────
        admin1 = await create_user(db, district.id, high_school.id,
            "admin@lincoln-unified.edu", "Diana", "Roberts", "Admin123!", "admin")
        admin2 = await create_user(db, district.id, middle_school.id,
            "admin2@lincoln-unified.edu", "Marcus", "Hayes", "Admin123!", "admin")

        await db.commit()
        print("  ✓ District, 3 schools, 2 admins")

        # ── Teachers (20) ──────────────────────
        teachers = []
        for i, (username, first, last) in enumerate(TEACHER_DATA):
            school = schools[i % len(schools)]
            t = await create_user(db, district.id, school.id,
                f"{username}@lincoln-unified.edu", first, last, "Teacher123!", "teacher")
            teachers.append(t)

        await db.commit()
        print(f"  ✓ {len(teachers)} teachers")

        # ── Students (100) ─────────────────────
        all_first = FIRST_NAMES_M + FIRST_NAMES_F
        random.shuffle(all_first)
        random.shuffle(LAST_NAMES)

        students = []
        for i in range(NUM_STUDENTS):
            first = all_first[i % len(all_first)]
            last = LAST_NAMES[i % len(LAST_NAMES)]
            school = schools[i % len(schools)]
            s = await create_user(db, district.id, school.id,
                f"student{i+1:03d}@lincoln-unified.edu", first, last,
                "Student123!", "student")
            students.append(s)

        await db.commit()
        print(f"  ✓ {len(students)} students")

        # ── Parents (50) ──────────────────────
        parents = []
        parent_first_names = ["Maria", "Carlos", "Jennifer", "David", "Patricia",
                              "Robert", "Linda", "Michael", "Susan", "Richard",
                              "Barbara", "Joseph", "Margaret", "Thomas", "Dorothy",
                              "Christopher", "Lisa", "Charles", "Nancy", "Matthew",
                              "Karen", "Anthony", "Betty", "Mark", "Sandra",
                              "Donald", "Ashley", "Steven", "Kimberly", "Paul",
                              "Donna", "Andrew", "Emily", "Joshua", "Carol",
                              "Kenneth", "Michelle", "Kevin", "Amanda", "Brian",
                              "Stephanie", "George", "Melissa", "Timothy", "Rebecca",
                              "Ronald", "Sharon", "Edward", "Laura", "Jason"]
        for i in range(NUM_PARENTS):
            first = parent_first_names[i % len(parent_first_names)]
            last = LAST_NAMES[(i + 30) % len(LAST_NAMES)]  # offset so names differ from students
            p = await create_user(db, district.id, schools[i % len(schools)].id,
                f"parent{i+1:03d}@lincoln-unified.edu", first, last,
                "Parent123!", "parent")
            parents.append(p)

        # Link parents to students
        for i, parent in enumerate(parents):
            child = students[i]  # parent i → student i
            existing = await db.execute(
                select(ParentStudent).where(
                    ParentStudent.parent_id == parent.id,
                    ParentStudent.student_id == child.id))
            if not existing.scalar_one_or_none():
                db.add(ParentStudent(parent_id=parent.id, student_id=child.id))

        await db.commit()
        print(f"  ✓ {len(parents)} parents linked to students")

        # ── Courses, Modules, Lessons, Quizzes ──
        created_courses = []
        course_sections = {}  # course.id → [sections]

        for course_data in COURSES:
            teacher = teachers[course_data["teacher_idx"]]
            r = await db.execute(select(Course).where(
                Course.title == course_data["title"],
                Course.tenant_id == district.id))
            course = r.scalar_one_or_none()
            if not course:
                course = Course(
                    tenant_id=district.id,
                    school_id=teacher.school_id,
                    teacher_id=teacher.id,
                    title=course_data["title"],
                    subject=course_data["subject"],
                    grade_level=course_data["grade_level"],
                    description=course_data["description"],
                    is_published=True,
                    start_date=date.today() - timedelta(days=60),
                    end_date=date.today() + timedelta(days=120),
                )
                db.add(course)
                await db.flush()
            created_courses.append(course)

            # Create 2 sections per course
            sections = []
            for sec_num in range(1, 3):
                sec_name = f"Period {sec_num}"
                sec_r = await db.execute(select(Section).where(
                    Section.course_id == course.id, Section.name == sec_name))
                section = sec_r.scalar_one_or_none()
                if not section:
                    section = Section(course_id=course.id, name=sec_name, capacity=30)
                    db.add(section)
                    await db.flush()
                sections.append(section)
            course_sections[course.id] = sections

            # Modules & Lessons
            for mod_pos, mod_data in enumerate(course_data["modules"]):
                mod_r = await db.execute(select(Module).where(
                    Module.course_id == course.id, Module.title == mod_data["title"]))
                mod = mod_r.scalar_one_or_none()
                if not mod:
                    mod = Module(course_id=course.id, title=mod_data["title"], position=mod_pos)
                    db.add(mod)
                    await db.flush()

                for les_pos, (les_title, les_type, les_dur) in enumerate(mod_data["lessons"]):
                    les_r = await db.execute(select(Lesson).where(
                        Lesson.module_id == mod.id, Lesson.title == les_title))
                    if not les_r.scalar_one_or_none():
                        body = (f"<h2>{les_title}</h2><p>This lesson covers the key concepts of "
                                f"<strong>{les_title.lower()}</strong>. Work through the material carefully "
                                f"and complete any practice exercises before moving on.</p>"
                                f"<p>Learning objectives:<ul><li>Understand the core principles</li>"
                                f"<li>Apply concepts through examples</li>"
                                f"<li>Prepare for the upcoming quiz</li></ul></p>")
                        db.add(Lesson(
                            module_id=mod.id, title=les_title,
                            content_type=les_type,
                            body=body if les_type == "text" else None,
                            video_url="https://www.youtube.com/embed/dQw4w9WgXcQ" if les_type == "video" else None,
                            position=les_pos, duration_min=les_dur))

            # Quizzes (multiple per course)
            for quiz_data in course_data["quizzes"]:
                quiz_r = await db.execute(select(Quiz).where(
                    Quiz.course_id == course.id, Quiz.title == quiz_data["title"]))
                quiz = quiz_r.scalar_one_or_none()
                if not quiz:
                    quiz = Quiz(
                        course_id=course.id,
                        title=quiz_data["title"],
                        instructions="Read each question carefully. You have 30 minutes.",
                        time_limit_min=30, max_attempts=2,
                        is_published=True,
                        due_at=now_utc() + timedelta(days=random.randint(7, 30)),
                    )
                    db.add(quiz)
                    await db.flush()

                    for q_pos, q_data in enumerate(quiz_data["questions"]):
                        question = Question(
                            quiz_id=quiz.id, text=q_data["text"],
                            question_type=q_data["type"],
                            points=q_data["points"], position=q_pos)
                        db.add(question)
                        await db.flush()

                        for opt_text, is_correct in q_data["options"]:
                            db.add(QuestionOption(
                                question_id=question.id, text=opt_text, is_correct=is_correct))
                    await db.flush()

            await db.flush()

        await db.commit()
        print(f"  ✓ {len(COURSES)} courses with modules, lessons, and quizzes")

        # ── Enroll students (each student in 5-8 courses) ──
        for i, student in enumerate(students):
            # Deterministic course selection: spread students across courses
            num_courses = 5 + (i % 4)  # 5, 6, 7, or 8 courses
            start_idx = i % len(created_courses)
            student_courses = []
            for j in range(num_courses):
                c_idx = (start_idx + j) % len(created_courses)
                student_courses.append(created_courses[c_idx])

            for course in student_courses:
                sections = course_sections[course.id]
                section = sections[i % len(sections)]  # distribute across sections
                enr_r = await db.execute(select(Enrollment).where(
                    Enrollment.section_id == section.id,
                    Enrollment.student_id == student.id))
                if not enr_r.scalar_one_or_none():
                    db.add(Enrollment(
                        section_id=section.id, student_id=student.id,
                        status="active",
                        enrolled_at=now_utc() - timedelta(days=random.randint(30, 60))))

        await db.commit()
        print(f"  ✓ Enrollments: each student in 5-8 courses")

        # ── Submissions & Grades ─────────────────
        # Student score profiles: each student has a base ability level
        student_ability = {}
        for i, student in enumerate(students):
            # Bell-curve-like distribution centered around 72%
            base = random.gauss(72, 15)
            student_ability[student.id] = max(20, min(100, base))

        grade_categories = [
            ("quiz", 0.30),
            ("assignment", 0.25),
            ("participation", 0.15),
            ("exam", 0.30),
        ]

        for course in created_courses:
            # Load quizzes with questions
            quiz_r = await db.execute(
                select(Quiz).options(
                    selectinload(Quiz.questions).selectinload(Question.options)
                ).where(Quiz.course_id == course.id))
            quizzes = quiz_r.scalars().all()

            # Get enrolled students for this course
            sections = course_sections[course.id]
            enrolled_student_ids = set()
            for section in sections:
                enr_r = await db.execute(select(Enrollment.student_id).where(
                    Enrollment.section_id == section.id, Enrollment.status == "active"))
                for row in enr_r.all():
                    enrolled_student_ids.add(row[0])

            enrolled = [s for s in students if s.id in enrolled_student_ids]

            for quiz in quizzes:
                if not quiz.questions:
                    continue

                total_points = sum(float(q.points) for q in quiz.questions)

                # 80-95% of enrolled students submit each quiz
                num_submit = int(len(enrolled) * random.uniform(0.80, 0.95))
                submitters = random.sample(enrolled, min(num_submit, len(enrolled)))

                for student in submitters:
                    sub_r = await db.execute(select(Submission).where(
                        Submission.quiz_id == quiz.id,
                        Submission.student_id == student.id))
                    if sub_r.scalar_one_or_none():
                        continue

                    ability = student_ability[student.id]
                    # Add some per-quiz variance
                    target_pct = max(10, min(100, ability + random.gauss(0, 10))) / 100.0

                    started = now_utc() - timedelta(days=random.randint(1, 40), hours=random.randint(0, 12))
                    submitted = started + timedelta(minutes=random.randint(8, 28))

                    submission = Submission(
                        quiz_id=quiz.id, student_id=student.id,
                        attempt_num=1, started_at=started, submitted_at=submitted,
                        status="graded",
                        graded_by=course.teacher_id,
                        graded_at=submitted + timedelta(hours=random.randint(1, 48)),
                    )
                    db.add(submission)
                    await db.flush()

                    earned = 0.0
                    for q in quiz.questions:
                        if q.question_type in ("mcq", "true_false"):
                            correct_opt = next((o for o in q.options if o.is_correct), None)
                            wrong_opts = [o for o in q.options if not o.is_correct]
                            give_correct = random.random() < target_pct
                            if give_correct and correct_opt:
                                chosen = correct_opt
                                pts = float(q.points)
                            else:
                                chosen = random.choice(wrong_opts) if wrong_opts else correct_opt
                                pts = 0.0
                            earned += pts
                            db.add(Answer(
                                submission_id=submission.id, question_id=q.id,
                                selected_option_id=chosen.id if chosen else None,
                                is_correct=give_correct and correct_opt is not None,
                                points_earned=pts))
                        else:  # short_answer / essay
                            pts = float(q.points) * target_pct * random.uniform(0.85, 1.0)
                            earned += pts
                            responses = [
                                "The key concept here relates to the fundamental principles we discussed in class.",
                                "Based on what we learned, the answer involves applying the theory step by step.",
                                "This topic connects directly to the main ideas from the reading material.",
                                "I believe the answer is based on the relationship between the core variables.",
                                "Using the method from the textbook, I arrived at this explanation.",
                            ]
                            db.add(Answer(
                                submission_id=submission.id, question_id=q.id,
                                text_response=random.choice(responses),
                                is_correct=None,
                                points_earned=round(pts, 2),
                                feedback=random.choice([None, "Good work!", "Review the textbook section.", "Solid understanding."])))

                    score_pct = (earned / total_points * 100) if total_points > 0 else 0
                    submission.score = round(score_pct, 2)
                    await db.flush()

                    # Grade entry for quiz
                    grade_r = await db.execute(select(GradeEntry).where(
                        GradeEntry.student_id == student.id,
                        GradeEntry.course_id == course.id,
                        GradeEntry.quiz_id == quiz.id))
                    if not grade_r.scalar_one_or_none():
                        db.add(GradeEntry(
                            student_id=student.id, course_id=course.id,
                            quiz_id=quiz.id, submission_id=submission.id,
                            category="quiz", label=quiz.title,
                            grade=score_to_grade(score_pct),
                            weight=Decimal("0.300"),
                            posted_at=submission.graded_at))

            # Additional grade entries (assignments, participation, exams)
            for student in enrolled:
                # Assignment grades (2-3 per course)
                num_assignments = random.randint(2, 3)
                for a_idx in range(num_assignments):
                    label = f"Assignment {a_idx + 1}"
                    gr_r = await db.execute(select(GradeEntry).where(
                        GradeEntry.student_id == student.id,
                        GradeEntry.course_id == course.id,
                        GradeEntry.category == "assignment",
                        GradeEntry.label == label))
                    if not gr_r.scalar_one_or_none():
                        ability = student_ability[student.id]
                        pct = max(20, min(100, ability + random.gauss(0, 12)))
                        db.add(GradeEntry(
                            student_id=student.id, course_id=course.id,
                            category="assignment", label=label,
                            grade=score_to_grade(pct),
                            weight=Decimal("0.250"),
                            posted_at=rand_past(45)))

                # Participation grade
                gr_r = await db.execute(select(GradeEntry).where(
                    GradeEntry.student_id == student.id,
                    GradeEntry.course_id == course.id,
                    GradeEntry.category == "participation"))
                if not gr_r.scalar_one_or_none():
                    pct = max(30, min(100, student_ability[student.id] + random.gauss(5, 8)))
                    db.add(GradeEntry(
                        student_id=student.id, course_id=course.id,
                        category="participation", label="Class Participation",
                        grade=score_to_grade(pct),
                        weight=Decimal("0.150"),
                        posted_at=rand_past(20)))

                # Midterm exam grade
                gr_r = await db.execute(select(GradeEntry).where(
                    GradeEntry.student_id == student.id,
                    GradeEntry.course_id == course.id,
                    GradeEntry.category == "exam",
                    GradeEntry.label == "Midterm Exam"))
                if not gr_r.scalar_one_or_none():
                    pct = max(15, min(100, student_ability[student.id] + random.gauss(-3, 14)))
                    db.add(GradeEntry(
                        student_id=student.id, course_id=course.id,
                        category="exam", label="Midterm Exam",
                        grade=score_to_grade(pct),
                        weight=Decimal("0.300"),
                        posted_at=rand_past(30)))

            await db.commit()

        print(f"  ✓ Submissions, answers, and multi-weight grade entries across all courses")

        # ── Attendance (45 school days) ──────────
        weekdays_generated = 0
        current_date = date.today()

        for course in created_courses:
            teacher = next((t for t in teachers if t.id == course.teacher_id), None)
            if not teacher:
                continue

            sections = course_sections[course.id]

            for section in sections:
                enr_r = await db.execute(select(Enrollment.student_id).where(
                    Enrollment.section_id == section.id, Enrollment.status == "active"))
                enrolled_ids = [row[0] for row in enr_r.all()]

                days_count = 0
                check_date = current_date
                while days_count < ATTENDANCE_DAYS:
                    check_date -= timedelta(days=1)
                    if check_date.weekday() >= 5:  # skip weekends
                        continue
                    days_count += 1

                    for sid in enrolled_ids:
                        existing_r = await db.execute(select(Attendance).where(
                            Attendance.course_id == course.id,
                            Attendance.student_id == sid,
                            Attendance.date == check_date))
                        if existing_r.scalar_one_or_none():
                            continue

                        # Realistic distribution: 85% present, 8% absent, 7% tardy
                        roll = random.random()
                        if roll < 0.85:
                            status = AttendanceStatus.PRESENT
                        elif roll < 0.93:
                            status = AttendanceStatus.ABSENT
                        else:
                            status = AttendanceStatus.TARDY

                        notes = None
                        if status == AttendanceStatus.ABSENT:
                            notes = random.choice([
                                "doctor's appointment", "family emergency", "sick",
                                "excused absence", None, None])
                        elif status == AttendanceStatus.TARDY:
                            notes = random.choice([
                                "bus delay", "arrived 10 min late", None, None])

                        db.add(Attendance(
                            course_id=course.id, section_id=section.id,
                            student_id=sid, teacher_id=teacher.id,
                            date=check_date, status=status,
                            notes=notes, tenant_id=district.id))

                await db.flush()

        await db.commit()
        print(f"  ✓ Attendance records ({ATTENDANCE_DAYS} school days across all courses)")

        # ── Gamification: Badges & Points ─────────
        badge_defs = [
            ("First Steps", "Complete your first quiz", "rocket", "engagement", "quiz_count", 1),
            ("Quiz Whiz", "Complete 5 quizzes", "brain", "academic", "quiz_count", 5),
            ("Quiz Master", "Complete 10 quizzes", "graduation-cap", "academic", "quiz_count", 10),
            ("Perfect Score", "Get a perfect score on a quiz", "star", "academic", "perfect_score", 1),
            ("Triple Perfect", "Get 3 perfect scores", "stars", "academic", "perfect_score", 3),
            ("Rising Star", "Earn 50 points", "trending-up", "engagement", "total_points", 50),
            ("Scholar", "Earn 100 points", "award", "academic", "total_points", 100),
            ("Dedicated Learner", "Earn 200 points", "trophy", "engagement", "total_points", 200),
            ("Knowledge Seeker", "Earn 500 points", "book-open", "academic", "total_points", 500),
            ("Attendance Streak", "Attend 20 classes in a row", "flame", "attendance", "streak", 20),
            ("Perfect Week", "100% attendance for a full week", "calendar-check", "attendance", "streak", 5),
            ("Early Bird", "Submit 3 quizzes before the due date", "clock", "engagement", "completion", 3),
        ]
        badges = []
        for name, desc, icon, cat, ctype, cval in badge_defs:
            r = await db.execute(select(Badge).where(Badge.name == name))
            badge = r.scalar_one_or_none()
            if not badge:
                badge = Badge(name=name, description=desc, icon=icon,
                              category=cat, criteria_type=ctype, criteria_value=cval)
                db.add(badge)
                await db.flush()
            badges.append(badge)

        # Points for all students
        for student in students:
            # Count quiz submissions
            sub_count_r = await db.execute(
                select(func.count()).select_from(Submission).where(
                    Submission.student_id == student.id,
                    Submission.status == "graded"))
            quiz_count = sub_count_r.scalar_one()

            if quiz_count == 0:
                continue

            # Points for each quiz completed
            existing_pts_r = await db.execute(
                select(PointEntry).where(
                    PointEntry.user_id == student.id,
                    PointEntry.reason == "quiz_completed"))
            existing_pt_count = len(existing_pts_r.scalars().all())

            for _ in range(max(0, quiz_count - existing_pt_count)):
                db.add(PointEntry(
                    user_id=student.id, points=10,
                    reason="quiz_completed"))

            # Check for perfect scores (score >= 95)
            perfect_r = await db.execute(
                select(func.count()).select_from(Submission).where(
                    Submission.student_id == student.id,
                    Submission.status == "graded",
                    Submission.score >= 95))
            perfect_count = perfect_r.scalar_one()

            existing_perf_r = await db.execute(
                select(func.count()).select_from(PointEntry).where(
                    PointEntry.user_id == student.id,
                    PointEntry.reason == "perfect_score"))
            existing_perf = existing_perf_r.scalar_one()

            for _ in range(max(0, perfect_count - existing_perf)):
                db.add(PointEntry(
                    user_id=student.id, points=25,
                    reason="perfect_score"))

            # Lesson viewed points (random subset)
            existing_lv_r = await db.execute(
                select(func.count()).select_from(PointEntry).where(
                    PointEntry.user_id == student.id,
                    PointEntry.reason == "lesson_viewed"))
            existing_lv = existing_lv_r.scalar_one()

            lessons_viewed = random.randint(5, 20)
            for _ in range(max(0, lessons_viewed - existing_lv)):
                db.add(PointEntry(
                    user_id=student.id, points=5,
                    reason="lesson_viewed"))

            # Streak bonus (some students)
            if random.random() < 0.3:
                existing_streak_r = await db.execute(
                    select(func.count()).select_from(PointEntry).where(
                        PointEntry.user_id == student.id,
                        PointEntry.reason == "streak_bonus"))
                if existing_streak_r.scalar_one() == 0:
                    db.add(PointEntry(
                        user_id=student.id, points=15,
                        reason="streak_bonus"))

        await db.flush()

        # Award badges based on criteria
        for student in students:
            total_pts_r = await db.execute(
                select(func.coalesce(func.sum(PointEntry.points), 0)).where(
                    PointEntry.user_id == student.id))
            total_pts = total_pts_r.scalar_one()

            quiz_count_r = await db.execute(
                select(func.count()).select_from(PointEntry).where(
                    PointEntry.user_id == student.id,
                    PointEntry.reason == "quiz_completed"))
            quiz_count = quiz_count_r.scalar_one()

            perfect_count_r = await db.execute(
                select(func.count()).select_from(PointEntry).where(
                    PointEntry.user_id == student.id,
                    PointEntry.reason == "perfect_score"))
            perfect_count = perfect_count_r.scalar_one()

            for badge in badges:
                earned = False
                if badge.criteria_type == "total_points" and total_pts >= badge.criteria_value:
                    earned = True
                elif badge.criteria_type == "quiz_count" and quiz_count >= badge.criteria_value:
                    earned = True
                elif badge.criteria_type == "perfect_score" and perfect_count >= badge.criteria_value:
                    earned = True
                elif badge.criteria_type == "streak" and random.random() < 0.25:
                    earned = True
                elif badge.criteria_type == "completion" and quiz_count >= 3 and random.random() < 0.4:
                    earned = True

                if earned:
                    existing_b = await db.execute(
                        select(UserBadge).where(
                            UserBadge.user_id == student.id,
                            UserBadge.badge_id == badge.id))
                    if not existing_b.scalar_one_or_none():
                        db.add(UserBadge(
                            user_id=student.id, badge_id=badge.id,
                            earned_at=rand_past(40)))

        await db.commit()
        print(f"  ✓ {len(badges)} badge types, points, and badge awards for all students")

        # ── Notifications ────────────────────────
        notif_count = 0

        # Grade posted notifications for students
        for student in students:
            grade_r = await db.execute(
                select(GradeEntry).where(GradeEntry.student_id == student.id).limit(5))
            grades = grade_r.scalars().all()
            for ge in grades:
                if random.random() < 0.7:
                    db.add(Notification(
                        user_id=student.id, tenant_id=district.id,
                        type="grade_posted",
                        payload={"course_id": str(ge.course_id), "grade": ge.grade,
                                 "category": ge.category, "label": ge.label or ""},
                        is_read=random.random() < 0.6))
                    notif_count += 1

        # Deadline notifications
        for student in students[:60]:
            db.add(Notification(
                user_id=student.id, tenant_id=district.id,
                type="deadline",
                payload={"message": "Quiz due in 2 days", "course": random.choice(COURSES)["title"]},
                is_read=random.random() < 0.4))
            notif_count += 1

        # Announcement notifications for all
        announcement_texts = [
            "School will be closed on Monday for a holiday.",
            "Report cards will be available next Friday.",
            "Parent-teacher conferences scheduled for next week.",
            "New library resources available online.",
        ]
        for text in announcement_texts:
            for student in random.sample(students, 70):
                db.add(Notification(
                    user_id=student.id, tenant_id=district.id,
                    type="announcement",
                    payload={"message": text},
                    is_read=random.random() < 0.3))
                notif_count += 1

        await db.commit()
        print(f"  ✓ {notif_count} notifications")

        # ── Activity Logs ────────────────────────
        event_types = [
            "login", "logout", "quiz_started", "quiz_submitted",
            "lesson_viewed", "grade_viewed", "message_sent",
            "profile_updated", "course_viewed", "enrollment_created",
        ]

        log_count = 0
        # Generate activity logs for past 30 days
        for student in students:
            num_events = random.randint(15, 60)
            for _ in range(num_events):
                db.add(ActivityLog(
                    tenant_id=district.id,
                    user_id=student.id,
                    event_type=random.choice(event_types),
                    resource_id=random.choice(created_courses).id if random.random() < 0.6 else None,
                    event_metadata={"ip": f"192.168.1.{random.randint(1, 254)}",
                                    "user_agent": "Mozilla/5.0"},
                    occurred_at=rand_past(30)))
                log_count += 1

        for teacher in teachers:
            num_events = random.randint(20, 80)
            for _ in range(num_events):
                db.add(ActivityLog(
                    tenant_id=district.id,
                    user_id=teacher.id,
                    event_type=random.choice(event_types + ["grade_posted", "quiz_created", "attendance_taken"]),
                    resource_id=random.choice(created_courses).id if random.random() < 0.7 else None,
                    event_metadata={"ip": f"10.0.0.{random.randint(1, 50)}",
                                    "user_agent": "Mozilla/5.0"},
                    occurred_at=rand_past(30)))
                log_count += 1

        await db.commit()
        print(f"  ✓ {log_count} activity log entries")

        # ── Report Snapshots ─────────────────────
        report_types = ["weekly_engagement", "course_performance", "attendance_summary", "grade_distribution"]
        report_count = 0

        for weeks_ago in range(8):
            period_end = date.today() - timedelta(weeks=weeks_ago)
            period_start = period_end - timedelta(days=7)

            for rtype in report_types:
                existing_r = await db.execute(select(ReportSnapshot).where(
                    ReportSnapshot.report_type == rtype,
                    ReportSnapshot.period_start == period_start))
                if existing_r.scalar_one_or_none():
                    continue

                if rtype == "weekly_engagement":
                    data = {
                        "active_students": random.randint(70, 100),
                        "active_teachers": random.randint(15, 20),
                        "lessons_viewed": random.randint(400, 900),
                        "quizzes_completed": random.randint(100, 350),
                        "messages_sent": random.randint(50, 200),
                    }
                elif rtype == "course_performance":
                    data = {
                        "courses": [{
                            "title": c.title,
                            "avg_grade": round(random.uniform(2.5, 4.5), 2),
                            "submissions": random.randint(30, 80),
                        } for c in created_courses[:5]]
                    }
                elif rtype == "attendance_summary":
                    data = {
                        "total_records": random.randint(2000, 4000),
                        "present_pct": round(random.uniform(82, 92), 1),
                        "absent_pct": round(random.uniform(5, 12), 1),
                        "tardy_pct": round(random.uniform(3, 8), 1),
                    }
                else:  # grade_distribution
                    data = {
                        "grade_5": random.randint(15, 30),
                        "grade_4": random.randint(20, 35),
                        "grade_3": random.randint(15, 25),
                        "grade_2": random.randint(8, 18),
                        "grade_1": random.randint(3, 10),
                    }

                db.add(ReportSnapshot(
                    tenant_id=district.id,
                    report_type=rtype,
                    period_start=period_start,
                    period_end=period_end,
                    data=data,
                    generated_at=datetime.combine(period_end, datetime.min.time()).replace(tzinfo=timezone.utc)))
                report_count += 1

        await db.commit()
        print(f"  ✓ {report_count} report snapshots (8 weeks)")

        # ── Summary ──────────────────────────────
        print()
        print("=" * 60)
        print("✅ Full-scale seed complete!")
        print("=" * 60)
        print()
        print(f"  District        : lincoln-unified")
        print(f"  Schools         : 3 (LHS, LMS, LTA)")
        print(f"  Admins          : admin@lincoln-unified.edu / Admin123!")
        print(f"                    admin2@lincoln-unified.edu / Admin123!")
        print(f"  Teachers (20)   : sarah.chen@lincoln-unified.edu / Teacher123!")
        print(f"                    james.rivera@lincoln-unified.edu / Teacher123!")
        print(f"                    ... (see TEACHER_DATA for all 20)")
        print(f"  Students (100)  : student001@lincoln-unified.edu / Student123!")
        print(f"                    ... through student100@lincoln-unified.edu")
        print(f"  Parents (50)    : parent001@lincoln-unified.edu / Parent123!")
        print(f"                    ... through parent050@lincoln-unified.edu")
        print(f"  Courses         : {len(COURSES)} courses, multiple quizzes each")
        print(f"  Grade weights   : quiz=30%, assignment=25%, participation=15%, exam=30%")
        print()


if __name__ == "__main__":
    asyncio.run(seed())
