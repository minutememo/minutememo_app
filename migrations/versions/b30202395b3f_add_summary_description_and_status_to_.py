"""Add summary, description, and status to ActionItem

Revision ID: b30202395b3f
Revises: e7833f4af1f1
Create Date: 2024-09-17 17:59:34.652463

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'b30202395b3f'
down_revision = 'e7833f4af1f1'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('action_item', schema=None) as batch_op:
        batch_op.add_column(sa.Column('summary', sa.String(length=128), nullable=False, server_default='No summary'))
        batch_op.add_column(sa.Column('status', sa.String(length=50), nullable=False, server_default='explicit'))
        # If the description already exists, it won't be added again
        batch_op.alter_column('description', existing_type=sa.Text, nullable=True)


def downgrade():
    with op.batch_alter_table('action_item', schema=None) as batch_op:
        batch_op.drop_column('status')
        batch_op.drop_column('summary')