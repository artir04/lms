"""Add course grading config and grade feedback, remove quiz weight

Revision ID: e3f4a5b6c7d8
Revises: d2e3f4a5b6c7
Create Date: 2026-05-13 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


revision: str = 'e3f4a5b6c7d8'
down_revision: Union[str, None] = 'd2e3f4a5b6c7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('grade_entries', sa.Column('feedback', sa.Text(), nullable=True))
    op.add_column('courses', sa.Column('category_weights', JSONB, nullable=True))
    op.add_column('courses', sa.Column('grade_thresholds', JSONB, nullable=True))
    op.drop_column('quizzes', 'weight')


def downgrade() -> None:
    op.add_column('quizzes', sa.Column('weight', sa.Numeric(4, 3), server_default='0.300', nullable=True))
    op.drop_column('courses', 'grade_thresholds')
    op.drop_column('courses', 'category_weights')
    op.drop_column('grade_entries', 'feedback')
