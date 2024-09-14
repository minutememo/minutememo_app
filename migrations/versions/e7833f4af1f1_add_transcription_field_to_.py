"""Add transcription field to MeetingSession

Revision ID: e7833f4af1f1
Revises: e0e384bd2f19
Create Date: 2024-09-13 20:13:43.717051

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e7833f4af1f1'
down_revision = 'e0e384bd2f19'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table('meeting_session', schema=None) as batch_op:
        batch_op.add_column(sa.Column('transcription', sa.Text(), nullable=True))

    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table('meeting_session', schema=None) as batch_op:
        batch_op.drop_column('transcription')

    # ### end Alembic commands ###