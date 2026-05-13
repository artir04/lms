"""
Tests for grade_service.py covering:
- round_grade: null, zero, boundary 0.1-0.4, normal rounding, cap 1-5
- weighted_average: normal case, zero-weight validation, empty entries
- create_entry: enrollment validation, weight validation, duplicate check
- get_gradebook: N+1 query fix verification
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, call

import pytest

from app.services.grade_service import GradeService
from app.models.grade import GradeEntry
from app.models.course import Course, Enrollment
from app.models.user import User
from app.schemas.grade import GradeEntryCreate
from app.core.exceptions import ValidationError, ConflictError, NotFoundError
from app.core.grading import round_grade, weighted_average


pytestmark = pytest.mark.unit


# ─── Fixtures ─────────────────────────────────────────────────────────────────


@pytest.fixture
def student_id() -> uuid.UUID:
    return uuid.uuid4()


@pytest.fixture
def course_id() -> uuid.UUID:
    return uuid.uuid4()


@pytest.fixture
def sample_entries(student_id, course_id):
    """Midterm 5x0.30 + Final 3x0.30 + Assignments 4x0.40 -> avg = (1.5+0.9+1.6)/1.0 = 4.0"""
    return [
        GradeEntry(
            student_id=student_id, course_id=course_id,
            category="exam", label="Midterm", grade=5, weight=Decimal("0.30"),
        ),
        GradeEntry(
            student_id=student_id, course_id=course_id,
            category="exam", label="Final", grade=3, weight=Decimal("0.30"),
        ),
        GradeEntry(
            student_id=student_id, course_id=course_id,
            category="assignment", label="Homework", grade=4, weight=Decimal("0.40"),
        ),
    ]


# ─── _round_grade tests ──────────────────────────────────────────────────────


class TestRoundGrade:
    def test_null_returns_none(self):
        assert round_grade(None) is None

    def test_zero_returns_none(self):
        assert round_grade(Decimal("0")) is None

    def test_below_half_returns_none(self):
        """Values 0.1 to 0.4 are too low - return None (no grade yet)."""
        assert round_grade(Decimal("0.1")) is None
        assert round_grade(Decimal("0.3")) is None
        assert round_grade(Decimal("0.49")) is None

    def test_at_half_rounds_up(self):
        """0.5 rounds to 1 (ROUND_HALF_UP)."""
        assert round_grade(Decimal("0.5")) == 1

    def test_normal_rounding(self):
        """Standard ROUND_HALF_UP rounding."""
        assert round_grade(Decimal("3.4")) == 3
        assert round_grade(Decimal("3.5")) == 4
        assert round_grade(Decimal("3.6")) == 4
        assert round_grade(Decimal("4.2")) == 4
        assert round_grade(Decimal("4.8")) == 5

    def test_cap_at_upper_bound(self):
        """Grades above 5 are capped at 5."""
        assert round_grade(Decimal("5.0")) == 5
        assert round_grade(Decimal("5.5")) == 5
        assert round_grade(Decimal("10.0")) == 5

    def test_cap_at_lower_bound(self):
        """Rounded values below 1 are raised to 1."""
        assert round_grade(Decimal("0.5")) == 1
        assert round_grade(Decimal("0.9")) == 1

    def test_student_with_single_grade_5(self):
        """A student with a single perfect grade gets final grade 5."""
        assert round_grade(Decimal("5.0")) == 5


# ─── _weighted_average tests ─────────────────────────────────────────────────


class TestWeightedAverage:
    def test_empty_entries_returns_zero(self):
        assert weighted_average([]) == Decimal("0")

    def test_normal_weighted_average(self, sample_entries):
        """(5x0.30 + 3x0.30 + 4x0.40) / 1.0 = 4.00"""
        result = weighted_average(sample_entries)
        assert result == Decimal("4.00")

    def test_uneven_weights(self, student_id, course_id):
        """Test with weights that don't sum to 1.0."""
        entries = [
            GradeEntry(
                student_id=student_id, course_id=course_id,
                category="quiz", label="Quiz 1", grade=5, weight=Decimal("2.0"),
            ),
            GradeEntry(
                student_id=student_id, course_id=course_id,
                category="quiz", label="Quiz 2", grade=3, weight=Decimal("1.0"),
            ),
        ]
        # (5x2.0 + 3x1.0) / 3.0 = 13.0/3.0 = 4.33
        result = weighted_average(entries)
        assert result == Decimal("4.33")

    def test_single_entry(self, student_id, course_id):
        entries = [
            GradeEntry(
                student_id=student_id, course_id=course_id,
                category="exam", label="Final", grade=4, weight=Decimal("1.0"),
            ),
        ]
        assert weighted_average(entries) == Decimal("4.00")

    def test_all_zero_weights_raises_validation_error(self, student_id, course_id):
        """Bug 2 fix: zero total weight must raise ValidationError."""
        entries = [
            GradeEntry(
                student_id=student_id, course_id=course_id,
                category="exam", label="Midterm", grade=5, weight=Decimal("0"),
            ),
            GradeEntry(
                student_id=student_id, course_id=course_id,
                category="exam", label="Final", grade=3, weight=Decimal("0"),
            ),
        ]
        with pytest.raises(ValidationError, match="Total weight"):
            weighted_average(entries)


# ─── create_entry validation tests ────────────────────────────────────────────


class TestCreateEntryValidation:
    @pytest.mark.asyncio
    async def test_unenrolled_student_raises_error(self, course_id, student_id):
        """Bug 3 fix: student not enrolled in course -> ValidationError."""
        mock_db = AsyncMock()
        svc = GradeService(mock_db)

        mock_result = MagicMock()
        mock_result.scalar_one.return_value = 0
        mock_db.execute.return_value = mock_result

        data = GradeEntryCreate(
            student_id=student_id,
            category="quiz",
            label="Test 1",
            grade=4,
            weight=Decimal("0.30"),
        )

        with pytest.raises(ValidationError, match="not enrolled"):
            await svc.create_entry(course_id, data)

    @pytest.mark.asyncio
    async def test_weight_out_of_range_raises_error(self, course_id, student_id):
        """Bug 3 fix: weight <= 0 or > 1.0 -> ValidationError."""
        mock_db = AsyncMock()
        svc = GradeService(mock_db)

        # Mock enrollment check -> 1 (enrolled), duplicate check not reached
        mock_result = MagicMock()
        mock_result.scalar_one.return_value = 1
        mock_db.execute.return_value = mock_result

        data = GradeEntryCreate(
            student_id=student_id,
            category="quiz",
            label="Test 1",
            grade=4,
            weight=Decimal("1.5"),  # out of range
        )

        with pytest.raises(ValidationError, match="Weight"):
            await svc.create_entry(course_id, data)

    @pytest.mark.asyncio
    async def test_zero_weight_auto_computes(self, course_id, student_id):
        """weight = 0 triggers auto-compute from course category_weights config."""
        mock_db = AsyncMock()
        svc = GradeService(mock_db)

        # Mock course with category_weights
        mock_course = MagicMock(spec=Course)
        mock_course.category_weights = {"quiz": 0.30, "exam": 0.40, "assignment": 0.30}

        mock_enrolled = MagicMock()
        mock_enrolled.scalar_one.return_value = 1

        mock_course_result = MagicMock()
        mock_course_result.scalar_one_or_none.return_value = mock_course

        mock_count = MagicMock()
        mock_count.scalar_one.return_value = 0  # no existing entries

        mock_total = MagicMock()
        mock_total.scalar_one.return_value = Decimal("0")

        mock_db.execute = AsyncMock(side_effect=[
            mock_enrolled,       # enrollment check
            mock_course_result,  # course lookup for category_weights
            mock_count,          # count existing entries in category
            mock_total,          # total weight check
        ])

        data = GradeEntryCreate(
            student_id=student_id,
            category="quiz",
            label="Test 1",
            grade=4,
            weight=Decimal("0"),  # zero weight -> auto-compute
        )

        entry = await svc.create_entry(course_id, data)
        assert entry.weight == Decimal("0.300")  # 0.30 / 1 = 0.300
        assert entry.grade == 4

    @pytest.mark.asyncio
    async def test_total_weight_exceeds_100_percent_raises_error(self, course_id, student_id):
        """Total weight across all entries must not exceed 1.0 (100%)."""
        mock_db = AsyncMock()
        svc = GradeService(mock_db)

        mock_enrolled = MagicMock()
        mock_enrolled.scalar_one.return_value = 1
        mock_total = MagicMock()
        mock_total.scalar_one.return_value = Decimal("0.80")  # already 80% used
        mock_db.execute = AsyncMock(side_effect=[mock_enrolled, mock_total])

        data = GradeEntryCreate(
            student_id=student_id,
            category="quiz",
            label="Test 2",
            grade=4,
            weight=Decimal("0.30"),  # 0.80 + 0.30 > 1.0
        )

        with pytest.raises(ValidationError, match="100%|exceed|weight"):
            await svc.create_entry(course_id, data)

    @pytest.mark.asyncio
    async def test_duplicate_category_raises_conflict(self, course_id, student_id):
        """Bug 3 fix: duplicate category for same student+course -> ConflictError."""
        mock_db = AsyncMock()
        svc = GradeService(mock_db)

        mock_enrolled = MagicMock()
        mock_enrolled.scalar_one.return_value = 1
        mock_total = MagicMock()
        mock_total.scalar_one.return_value = Decimal("0.30")  # existing total weight
        mock_duplicate = MagicMock()
        mock_duplicate.scalar_one.return_value = 1

        mock_db.execute = AsyncMock(side_effect=[mock_enrolled, mock_total, mock_duplicate])

        data = GradeEntryCreate(
            student_id=student_id,
            category="quiz",
            label="Test 1",
            grade=4,
            weight=Decimal("0.30"),
        )

        with pytest.raises(ConflictError, match="already exists"):
            await svc.create_entry(course_id, data)


# ─── get_gradebook N+1 fix test ───────────────────────────────────────────────


class TestGetGradebookNPlusOne:
    @pytest.mark.asyncio
    async def test_get_gradebook_uses_bulk_grade_query(self, course_id, student_id):
        """Verify the N+1 fix: gradebook uses 3 queries total regardless of student count."""
        mock_db = AsyncMock()
        svc = GradeService(mock_db)

        course = MagicMock(spec=Course)
        course.id = course_id
        course.title = "Test Course"

        student = MagicMock(spec=User)
        student.id = student_id
        student.full_name = "Test Student"
        student.email = "test@example.com"

        student2 = MagicMock(spec=User)
        student2.id = uuid.uuid4()
        student2.full_name = "Student Two"
        student2.email = "two@example.com"

        # Build a proper GradeEntry mock with all Pydantic-required fields
        grade = MagicMock(spec=GradeEntry)
        grade.id = uuid.uuid4()
        grade.student_id = student_id
        grade.course_id = course_id
        grade.quiz_id = None
        grade.submission_id = None
        grade.category = "exam"
        grade.label = "Midterm"
        grade.grade = 4
        grade.weight = Decimal("1.0")
        grade.feedback = None
        grade.posted_at = None
        grade.created_at = datetime.now(timezone.utc)

        # Mock results for each query
        mock_course_result = MagicMock()
        mock_course_result.scalar_one_or_none.return_value = course

        mock_students_result = MagicMock()
        mock_students_result.scalars.return_value.all.return_value = [student, student2]

        mock_grades_result = MagicMock()
        mock_grades_result.scalars.return_value.all.return_value = [grade]

        mock_db.execute = AsyncMock(side_effect=[
            mock_course_result,
            mock_students_result,
            mock_grades_result,
        ])

        result = await svc.get_gradebook(course_id)

        # Exactly 3 queries: course lookup, students, bulk grades
        assert mock_db.execute.await_count == 3

        assert result.course_id == course_id
        assert result.course_title == "Test Course"
        assert len(result.rows) == 2
        assert result.rows[0].student_id == student_id


class TestGetGradebookNotFound:
    @pytest.mark.asyncio
    async def test_nonexistent_course_raises_not_found(self):
        mock_db = AsyncMock()
        svc = GradeService(mock_db)

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result

        with pytest.raises(NotFoundError, match="Course"):
            await svc.get_gradebook(uuid.uuid4())
