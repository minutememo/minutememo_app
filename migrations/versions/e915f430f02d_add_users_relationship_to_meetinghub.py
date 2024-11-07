"""Add users relationship to MeetingHub

Revision ID: e915f430f02d
Revises: efb60f40c42b
Create Date: 2024-10-23 01:07:05.577499

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = 'e915f430f02d'
down_revision = 'efb60f40c42b'
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
    unique_constraints = [uc['name'] for uc in inspector.get_unique_constraints('meeting_meetinghub')]
    if 'uix_meeting_meetinghub' not in unique_constraints:
        with op.batch_alter_table('meeting_meetinghub', schema=None) as batch_op:
            batch_op.create_unique_constraint('uix_meeting_meetinghub', ['meeting_id', 'meeting_hub_id'])
    else:
        print("Unique constraint 'uix_meeting_meetinghub' already exists. Skipping creation.")
    
    # ### Alter 'user_meeting_hub' Table ###
    columns = [col['name'] for col in inspector.get_columns('user_meeting_hub')]
    if 'visibility_status' not in columns:
        with op.batch_alter_table('user_meeting_hub', schema=None) as batch_op:
            # Step 1: Add the column as nullable with a server default
            batch_op.add_column(sa.Column(
                'visibility_status',
                sa.Enum('VIEWER', 'EDITOR', 'ADMIN', name='visibilitystatus'),
                nullable=True,
                server_default='VIEWER'
            ))
        
        # Step 2: Update existing rows to ensure no NULLs
        op.execute("""
            UPDATE user_meeting_hub
            SET visibility_status = 'VIEWER'
            WHERE visibility_status IS NULL
        """)
        
        with op.batch_alter_table('user_meeting_hub', schema=None) as batch_op:
            # Step 3: Alter the column to set NOT NULL and remove the server default
            batch_op.alter_column(
                'visibility_status',
                existing_type=sa.Enum('VIEWER', 'EDITOR', 'ADMIN', name='visibilitystatus'),
                nullable=False,
                server_default=None
            )
    else:
        print("Column 'visibility_status' already exists. Skipping addition and update.")
    
    # ### Handle Unique Constraints on 'user_meeting_hub' ###
    unique_constraints_user_meeting_hub = [uc['name'] for uc in inspector.get_unique_constraints('user_meeting_hub')]
    if 'uix_user_meeting_hub' not in unique_constraints_user_meeting_hub:
        with op.batch_alter_table('user_meeting_hub', schema=None) as batch_op:
            batch_op.drop_constraint('uix_user_meeting_hub', type_='unique')
            batch_op.create_unique_constraint('uix_user_meeting_hub', ['user_id', 'meeting_hub_id'])
    else:
        print("Unique constraint 'uix_user_meeting_hub' already exists. Skipping modification.")


def downgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    
    # ### Drop 'user_meeting_hub' Alterations ###
    unique_constraints_user_meeting_hub = [uc['name'] for uc in inspector.get_unique_constraints('user_meeting_hub')]
    if 'uix_user_meeting_hub' in unique_constraints_user_meeting_hub:
        with op.batch_alter_table('user_meeting_hub', schema=None) as batch_op:
            batch_op.drop_constraint('uix_user_meeting_hub', type_='unique')
            batch_op.create_unique_constraint('uix_user_meeting_hub', ['user_id', 'meeting_hub_id'])
            if 'visibility_status' in [col['name'] for col in inspector.get_columns('user_meeting_hub')]:
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