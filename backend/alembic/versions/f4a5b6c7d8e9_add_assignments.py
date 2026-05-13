"""Add assignments and assignment_submissions tables

Revision ID: f4a5b6c7d8e9
Revises: e3f4a5b6c7d8
Create Date: 2026-05-13 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB


revision: str = 'f4a5b6c7d8e9'
down_revision: Union[str, None] = 'e3f4a5b6c7d8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'assignments',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('course_id', UUID(as_uuid=True), sa.ForeignKey('courses.id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('due_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('max_score', sa.Numeric(6, 2), server_default='100', nullable=True),
        sa.Column('is_published', sa.Boolean(), server_default='false', nullable=True),
        sa.Column('allows_file_upload', sa.Boolean(), server_default='false', nullable=True),
        sa.Column('allowed_file_types', sa.String(255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('ix_assignments_course_id', 'assignments', ['course_id'])

    op.create_table(
        'assignment_submissions',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('assignment_id', UUID(as_uuid=True), sa.ForeignKey('assignments.id', ondelete='CASCADE'), nullable=False),
        sa.Column('student_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('text_response', sa.Text(), nullable=True),
        sa.Column('file_urls', JSONB, nullable=True),
        sa.Column('submitted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('score', sa.Numeric(6, 2), nullable=True),
        sa.Column('status', sa.String(20), server_default='in_progress', nullable=True),
        sa.Column('graded_by', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('graded_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('feedback', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('ix_assignment_submissions_assignment_id', 'assignment_submissions', ['assignment_id'])
    op.create_index('ix_assignment_submissions_student_id', 'assignment_submissions', ['student_id'])

    op.add_column('grade_entries', sa.Column('assignment_id', UUID(as_uuid=True), sa.ForeignKey('assignments.id', ondelete='SET NULL'), nullable=True))
    op.add_column('grade_entries', sa.Column('assignment_submission_id', UUID(as_uuid=True), sa.ForeignKey('assignment_submissions.id', ondelete='SET NULL'), nullable=True))


def downgrade() -> None:
    op.drop_column('grade_entries', 'assignment_submission_id')
    op.drop_column('grade_entries', 'assignment_id')
    op.drop_index('ix_assignment_submissions_student_id', table_name='assignment_submissions')
    op.drop_index('ix_assignment_submissions_assignment_id', table_name='assignment_submissions')
    op.drop_table('assignment_submissions')
    op.drop_index('ix_assignments_course_id', table_name='assignments')
    op.drop_table('assignments')
