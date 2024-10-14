"""Add user suspension and subscription management fields

Revision ID: 847569e32eb3
Revises: 7be08e6a2735
Create Date: 2024-10-14 22:26:59.156756

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '847569e32eb3'
down_revision = '7be08e6a2735'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table('user', schema=None) as batch_op:
        batch_op.add_column(sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'))
        batch_op.add_column(sa.Column('is_suspended', sa.Boolean(), nullable=False, server_default='false'))
        batch_op.add_column(sa.Column('is_banned', sa.Boolean(), nullable=False, server_default='false'))

    # Remove the default after applying, so that future inserts don’t use server defaults
    with op.batch_alter_table('user', schema=None) as batch_op:
        batch_op.alter_column('is_active', server_default=None)
        batch_op.alter_column('is_suspended', server_default=None)
        batch_op.alter_column('is_banned', server_default=None)
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table('user', schema=None) as batch_op:
        batch_op.drop_column('is_banned')
        batch_op.drop_column('is_suspended')
        batch_op.drop_column('is_active')
    # ### end Alembic commands ###