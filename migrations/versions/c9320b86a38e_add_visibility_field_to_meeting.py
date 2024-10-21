"""Add visibility field to meeting

Revision ID: c9320b86a38e
Revises: 6b4410788666
Create Date: 2024-10-16 22:54:15.590184

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c9320b86a38e'
down_revision = '6b4410788666'
branch_labels = None
depends_on = None


def upgrade():
    # Add the visibility column with a default value for existing rows
    with op.batch_alter_table('meeting', schema=None) as batch_op:
        batch_op.add_column(sa.Column('visibility', sa.String(32), nullable=False, server_default='participants'))

    # Optional: Remove the server_default after the column is created to clean up
    with op.batch_alter_table('meeting', schema=None) as batch_op:
        batch_op.alter_column('visibility', server_default=None)


def downgrade():
    # Drop the visibility column
    with op.batch_alter_table('meeting', schema=None) as batch_op:
        batch_op.drop_column('visibility')