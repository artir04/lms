"""Add composite index on grade_entries(student_id, course_id)

Revision ID: c1d2e3f4a5b6
Revises: a1b2c3d4e5f6
Create Date: 2026-05-12 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'c1d2e3f4a5b6'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        'ix_grade_entry_student_course',
        'grade_entries',
        ['student_id', 'course_id'],
    )


def downgrade() -> None:
    op.drop_index('ix_grade_entry_student_course', table_name='grade_entries')
