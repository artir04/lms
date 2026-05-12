"""Drop parent_child_links / parent_child_relationships in favor of parent_students

Revision ID: b7c4d2e9f8a1
Revises: add_parent_child_relationships
Create Date: 2026-05-12

The /parents/me/children family of endpoints used a separate `parent_child_links`
table (with a `parent_child_relationships` lookup), while /parents/link and
/parents/digest used `parent_students`. Two writers, two readers, no sync.
We standardize on `parent_students` and drop the unused tables.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'b7c4d2e9f8a1'
# Merges the two prior heads: the parent-child branch and the numeric-grade branch.
down_revision: Union[str, Sequence[str], None] = ('add_parent_child_relationships', 'a1b2c3d4e5f6')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Backfill any parent_child_links that aren't yet in parent_students.
    op.execute(
        """
        INSERT INTO parent_students (id, parent_id, student_id, created_at, updated_at)
        SELECT gen_random_uuid(), pcl.parent_id, pcl.student_id, now(), now()
        FROM parent_child_links pcl
        WHERE NOT EXISTS (
            SELECT 1 FROM parent_students ps
            WHERE ps.parent_id = pcl.parent_id AND ps.student_id = pcl.student_id
        )
        """
    )
    op.drop_index('idx_parent_child_student_id', table_name='parent_child_links')
    op.drop_index('idx_parent_child_parent_id', table_name='parent_child_links')
    op.drop_table('parent_child_links')
    op.drop_table('parent_child_relationships')


def downgrade() -> None:
    op.create_table(
        'parent_child_relationships',
        sa.Column('id', sa.SmallInteger(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=50), nullable=False),
        sa.Column('description', sa.String(length=255), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name'),
    )
    op.bulk_insert(
        sa.table(
            'parent_child_relationships',
            sa.column('id', sa.SmallInteger),
            sa.column('name', sa.String),
            sa.column('description', sa.String),
        ),
        [
            {'id': 1, 'name': 'mother', 'description': 'Biological or adoptive mother'},
            {'id': 2, 'name': 'father', 'description': 'Biological or adoptive father'},
            {'id': 3, 'name': 'guardian', 'description': 'Legal guardian'},
            {'id': 4, 'name': 'step_parent', 'description': 'Step-parent'},
            {'id': 5, 'name': 'grandparent', 'description': 'Grandparent'},
            {'id': 6, 'name': 'other', 'description': 'Other family member or caregiver'},
        ],
    )
    op.create_table(
        'parent_child_links',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('parent_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('student_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('relationship_id', sa.SmallInteger(), nullable=False),
        sa.Column('is_primary_contact', sa.Boolean(), nullable=False, server_default='false'),
        sa.ForeignKeyConstraint(['parent_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['student_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['relationship_id'], ['parent_child_relationships.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('parent_id', 'student_id', name='uq_parent_student'),
    )
    op.create_index('idx_parent_child_parent_id', 'parent_child_links', ['parent_id'])
    op.create_index('idx_parent_child_student_id', 'parent_child_links', ['student_id'])
