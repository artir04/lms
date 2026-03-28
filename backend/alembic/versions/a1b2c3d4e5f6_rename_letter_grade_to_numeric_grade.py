"""Rename letter_grade to numeric_grade (Kosovo grading system 1-5)

Revision ID: a1b2c3d4e5f6
Revises: 32bb53b5b461
Create Date: 2026-03-25 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '32bb53b5b461'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Mapping from American letter grades to Kosovo numeric grades
LETTER_TO_NUMERIC = {
    'A': 5, 'A+': 5, 'A-': 5,
    'B': 4, 'B+': 4, 'B-': 4,
    'C': 3, 'C+': 3, 'C-': 3,
    'D': 2, 'D+': 2, 'D-': 2,
    'F': 1,
}


def upgrade() -> None:
    # Add new numeric_grade column
    op.add_column('grade_entries', sa.Column('numeric_grade', sa.Integer(), nullable=True))

    # Migrate existing letter_grade data to numeric_grade
    conn = op.get_bind()
    for letter, numeric in LETTER_TO_NUMERIC.items():
        conn.execute(
            sa.text("UPDATE grade_entries SET numeric_grade = :numeric WHERE letter_grade = :letter"),
            {"numeric": numeric, "letter": letter},
        )

    # Drop old letter_grade column
    op.drop_column('grade_entries', 'letter_grade')


def downgrade() -> None:
    # Add back letter_grade column
    op.add_column('grade_entries', sa.Column('letter_grade', sa.String(3), nullable=True))

    # Migrate numeric_grade back to letter_grade
    numeric_to_letter = {5: 'A', 4: 'B', 3: 'C', 2: 'D', 1: 'F'}
    conn = op.get_bind()
    for numeric, letter in numeric_to_letter.items():
        conn.execute(
            sa.text("UPDATE grade_entries SET letter_grade = :letter WHERE numeric_grade = :numeric"),
            {"letter": letter, "numeric": numeric},
        )

    # Drop numeric_grade column
    op.drop_column('grade_entries', 'numeric_grade')
