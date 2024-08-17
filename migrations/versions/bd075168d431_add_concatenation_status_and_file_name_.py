"""Add concatenation status and file name to Recording

Revision ID: bd075168d431
Revises: 3df72a879e89
Create Date: 2024-08-12 13:18:22.725438

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'bd075168d431'
down_revision = '3df72a879e89'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table('recording', schema=None) as batch_op:
        # Add the new column with a default value for existing records
        batch_op.add_column(sa.Column('concatenation_status', sa.String(length=10), nullable=False, server_default='pending'))
        batch_op.add_column(sa.Column('concatenation_file_name', sa.String(length=256), nullable=True))
        batch_op.alter_column('concatenation_status', server_default=None)  # Remove default for new inserts

    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table('recording', schema=None) as batch_op:
        batch_op.drop_column('concatenation_file_name')
        batch_op.drop_column('concatenation_status')

    # ### end Alembic commands ###
