"""Admin oversight features: school metadata, course archival, audit log

Revision ID: d2e3f4a5b6c7
Revises: c1d2e3f4a5b6, add_parent_child_relationships
Create Date: 2026-05-12 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'd2e3f4a5b6c7'
down_revision: Union[str, Sequence[str], None] = ('c1d2e3f4a5b6', 'add_parent_child_relationships')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'schools',
        sa.Column('academic_year', sa.String(length=20), nullable=True),
    )
    op.add_column(
        'schools',
        sa.Column('principal_id', postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        'fk_schools_principal_id_users',
        'schools',
        'users',
        ['principal_id'],
        ['id'],
        ondelete='SET NULL',
    )

    op.add_column(
        'courses',
        sa.Column('is_archived', sa.Boolean(), nullable=False, server_default=sa.text('false')),
    )
    op.create_index('ix_courses_is_archived', 'courses', ['is_archived'])

    op.create_table(
        'audit_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('actor_user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('actor_email', sa.String(length=255), nullable=True),
        sa.Column('actor_role', sa.String(length=50), nullable=True),
        sa.Column('action', sa.String(length=80), nullable=False),
        sa.Column('target_type', sa.String(length=60), nullable=True),
        sa.Column('target_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('summary', sa.String(length=500), nullable=True),
        sa.Column('ip_address', sa.String(length=64), nullable=True),
        sa.Column('user_agent', sa.String(length=255), nullable=True),
        sa.Column('event_metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['tenant_id'], ['districts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['actor_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_audit_logs_tenant_created', 'audit_logs', ['tenant_id', 'created_at'])
    op.create_index('ix_audit_logs_action', 'audit_logs', ['action'])
    op.create_index('ix_audit_logs_actor_user_id', 'audit_logs', ['actor_user_id'])


def downgrade() -> None:
    op.drop_index('ix_audit_logs_actor_user_id', table_name='audit_logs')
    op.drop_index('ix_audit_logs_action', table_name='audit_logs')
    op.drop_index('ix_audit_logs_tenant_created', table_name='audit_logs')
    op.drop_table('audit_logs')

    op.drop_index('ix_courses_is_archived', table_name='courses')
    op.drop_column('courses', 'is_archived')

    op.drop_constraint('fk_schools_principal_id_users', 'schools', type_='foreignkey')
    op.drop_column('schools', 'principal_id')
    op.drop_column('schools', 'academic_year')
