"""Add summary fields to MeetingSession

Revision ID: 65bf60f48eb0
Revises: 3d41ce810966
Create Date: 2024-09-19 22:32:37.733661

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '65bf60f48eb0'
down_revision = '3d41ce810966'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table('meeting_session', schema=None) as batch_op:
        batch_op.add_column(sa.Column('short_summary', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('long_summary', sa.Text(), nullable=True))

    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table('meeting_session', schema=None) as batch_op:
        batch_op.drop_column('long_summary')
        batch_op.drop_column('short_summary')

    # ### end Alembic commands ###
