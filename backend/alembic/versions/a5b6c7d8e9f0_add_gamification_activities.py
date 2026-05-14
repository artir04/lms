"""Add gamification_activities and activity_completions tables

Revision ID: a5b6c7d8e9f0
Revises: f4a5b6c7d8e9
Create Date: 2026-05-14 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision: str = 'a5b6c7d8e9f0'
# Merge prior heads: assignments branch and the drop-parent-child-links branch
down_revision: Union[str, Sequence[str], None] = ('f4a5b6c7d8e9', 'b7c4d2e9f8a1')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'gamification_activities',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('description', sa.String(2000), nullable=False),
        sa.Column('points', sa.Integer(), nullable=False, server_default='10'),
        sa.Column('category', sa.String(50), nullable=False, server_default='general'),
        sa.Column('course_id', UUID(as_uuid=True), sa.ForeignKey('courses.id', ondelete='SET NULL'), nullable=True),
        sa.Column('tenant_id', UUID(as_uuid=True), sa.ForeignKey('districts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('created_by', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('ix_gamification_activities_course_id', 'gamification_activities', ['course_id'])
    op.create_index('ix_gamification_activities_tenant_id', 'gamification_activities', ['tenant_id'])

    op.create_table(
        'activity_completions',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('activity_id', UUID(as_uuid=True), sa.ForeignKey('gamification_activities.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.UniqueConstraint('activity_id', 'user_id', name='uq_activity_completion_user'),
    )
    op.create_index('ix_activity_completions_activity_id', 'activity_completions', ['activity_id'])
    op.create_index('ix_activity_completions_user_id', 'activity_completions', ['user_id'])


def downgrade() -> None:
    op.drop_index('ix_activity_completions_user_id', table_name='activity_completions')
    op.drop_index('ix_activity_completions_activity_id', table_name='activity_completions')
    op.drop_table('activity_completions')
    op.drop_index('ix_gamification_activities_tenant_id', table_name='gamification_activities')
    op.drop_index('ix_gamification_activities_course_id', table_name='gamification_activities')
    op.drop_table('gamification_activities')
