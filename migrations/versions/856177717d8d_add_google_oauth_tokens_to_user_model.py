"""Add Google OAuth tokens to User model

Revision ID: 856177717d8d
Revises: 1fe65f02e979
Create Date: 2024-10-03 22:21:25.442729

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '856177717d8d'
down_revision = '1fe65f02e979'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table('user', schema=None) as batch_op:
        batch_op.add_column(sa.Column('google_oauth_token', sa.String(length=512), nullable=True))
        batch_op.add_column(sa.Column('google_refresh_token', sa.String(length=512), nullable=True))
        batch_op.add_column(sa.Column('google_token_expires_at', sa.DateTime(), nullable=True))

    with op.batch_alter_table('user_meeting', schema=None) as batch_op:
        batch_op.create_unique_constraint(None, ['user_id', 'meeting_id'])

    with op.batch_alter_table('user_meeting_hub', schema=None) as batch_op:
        batch_op.create_unique_constraint(None, ['user_id', 'meeting_hub_id'])

    with op.batch_alter_table('user_meeting_session', schema=None) as batch_op:
        batch_op.create_unique_constraint(None, ['user_id', 'meeting_session_id'])

    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table('user_meeting_session', schema=None) as batch_op:
        batch_op.drop_constraint(None, type_='unique')

    with op.batch_alter_table('user_meeting_hub', schema=None) as batch_op:
        batch_op.drop_constraint(None, type_='unique')

    with op.batch_alter_table('user_meeting', schema=None) as batch_op:
        batch_op.drop_constraint(None, type_='unique')

    with op.batch_alter_table('user', schema=None) as batch_op:
        batch_op.drop_column('google_token_expires_at')
        batch_op.drop_column('google_refresh_token')
        batch_op.drop_column('google_oauth_token')

    # ### end Alembic commands ###
