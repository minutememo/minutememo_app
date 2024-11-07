"""Implement association object for User and MeetingHub with visibility_status

Revision ID: efb60f40c42b
Revises: 5eea52a414c8
Create Date: 2024-10-23 00:51:11.831848

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = 'efb60f40c42b'
down_revision = '5eea52a414c8'
branch_labels = None
depends_on = None


def upgrade():
    # ### Create Enum Types ###
    visibilitysettings_enum = sa.Enum(
        'ALL_HUB_MEMBERS', 'PARTICIPANTS', 'PRIVATE', 'PUBLIC', 'CONFIDENTIAL', 'DEFAULT',
        name='visibilitysettings'
    )
    visibilitysettings_enum.create(op.get_bind(), checkfirst=True)
    
    visibilitystatus_enum = sa.Enum(
        'VIEWER', 'EDITOR', 'ADMIN',
        name='visibilitystatus'
    )
    visibilitystatus_enum.create(op.get_bind(), checkfirst=True)

    # ### Create 'meeting_participants' Table if Not Exists ###
    bind = op.get_bind()
    inspector = inspect(bind)
    if 'meeting_participants' not in inspector.get_table_names():
        op.create_table(
            'meeting_participants',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('meeting_id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('raci_role_id', sa.Integer(), nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['meeting_id'], ['meeting.id'], ),
            sa.ForeignKeyConstraint(['raci_role_id'], ['raci_role.id'], ),
            sa.ForeignKeyConstraint(['user_id'], ['user.id'], ),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('meeting_id', 'user_id', name='uix_meeting_user')
        )
    
    # ### Alter 'visibility' Column in 'meeting' Table ###
    op.alter_column(
        'meeting',
        'visibility',
        existing_type=sa.VARCHAR(length=32),
        type_=sa.Enum(
            'ALL_HUB_MEMBERS', 'PARTICIPANTS', 'PRIVATE', 'PUBLIC', 'CONFIDENTIAL', 'DEFAULT',
            name='visibilitysettings'
        ),
        existing_nullable=False,
        postgresql_using='visibility::visibilitysettings'
    )
    
    # ### Alter 'meeting_meetinghub' Table ###
    # Check if the unique constraint already exists
    unique_constraints = [uc['name'] for uc in inspector.get_unique_constraints('meeting_meetinghub')]
    if 'uix_meeting_meetinghub' not in unique_constraints:
        with op.batch_alter_table('meeting_meetinghub', schema=None) as batch_op:
            batch_op.create_unique_constraint('uix_meeting_meetinghub', ['meeting_id', 'meeting_hub_id'])
    else:
        print("Unique constraint 'uix_meeting_meetinghub' already exists. Skipping creation.")
    
    # ### Alter 'user_meeting_hub' Table ###
    # Check if the unique constraint already exists
    unique_constraints_user_meeting_hub = [uc['name'] for uc in inspector.get_unique_constraints('user_meeting_hub')]
    if 'uix_user_meeting_hub' not in unique_constraints_user_meeting_hub:
        with op.batch_alter_table('user_meeting_hub', schema=None) as batch_op:
            batch_op.add_column(sa.Column('visibility_status', sa.Enum('VIEWER', 'EDITOR', 'ADMIN', name='visibilitystatus'), nullable=False, server_default='VIEWER'))
            batch_op.drop_constraint('uix_user_meeting_hub', type_='unique')
            batch_op.create_unique_constraint('uix_user_meeting_hub', ['user_id', 'meeting_hub_id'])
    else:
        print("Unique constraint 'uix_user_meeting_hub' already exists. Skipping modification.")

        
def downgrade():
    # ### Drop 'user_meeting_hub' Alterations ###
    bind = op.get_bind()
    inspector = inspect(bind)
    unique_constraints_user_meeting_hub = [uc['name'] for uc in inspector.get_unique_constraints('user_meeting_hub')]
    if 'uix_user_meeting_hub' in unique_constraints_user_meeting_hub:
        with op.batch_alter_table('user_meeting_hub', schema=None) as batch_op:
            batch_op.drop_constraint('uix_user_meeting_hub', type_='unique')
            batch_op.add_constraint(sa.UniqueConstraint('user_id', 'meeting_hub_id', name='uix_user_meeting_hub'))
            batch_op.drop_column('visibility_status')
    else:
        print("Unique constraint 'uix_user_meeting_hub' does not exist. Skipping modification.")
    
    # ### Drop 'meeting_meetinghub' Unique Constraint ###
    unique_constraints = [uc['name'] for uc in inspector.get_unique_constraints('meeting_meetinghub')]
    if 'uix_meeting_meetinghub' in unique_constraints:
        with op.batch_alter_table('meeting_meetinghub', schema=None) as batch_op:
            batch_op.drop_constraint('uix_meeting_meetinghub', type_='unique')
    else:
        print("Unique constraint 'uix_meeting_meetinghub' does not exist. Skipping drop.")
    
    # ### Revert 'visibility' Column in 'meeting' Table ###
    op.alter_column(
        'meeting',
        'visibility',
        existing_type=sa.Enum(
            'ALL_HUB_MEMBERS', 'PARTICIPANTS', 'PRIVATE', 'PUBLIC', 'CONFIDENTIAL', 'DEFAULT',
            name='visibilitysettings'
        ),
        type_=sa.VARCHAR(length=32),
        existing_nullable=False,
        postgresql_using='visibility::VARCHAR'
    )
    
    # ### Drop 'meeting_participants' Table if Exists ###
    if 'meeting_participants' in inspector.get_table_names():
        op.drop_table('meeting_participants')
    else:
        print("Table 'meeting_participants' does not exist. Skipping drop.")
    
    # ### Drop Enum Types ###
    visibilitystatus_enum = sa.Enum('VIEWER', 'EDITOR', 'ADMIN', name='visibilitystatus')
    visibilitystatus_enum.drop(op.get_bind(), checkfirst=True)
    
    visibilitysettings_enum = sa.Enum(
        'ALL_HUB_MEMBERS', 'PARTICIPANTS', 'PRIVATE', 'PUBLIC', 'CONFIDENTIAL', 'DEFAULT',
        name='visibilitysettings'
    )
    visibilitysettings_enum.drop(op.get_bind(), checkfirst=True)