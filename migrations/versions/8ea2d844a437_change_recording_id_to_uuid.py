"""Change Recording ID to UUID

Revision ID: 8ea2d844a437
Revises: bd075168d431
Create Date: 2024-08-12 22:33:43.934252

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '8ea2d844a437'
down_revision = 'bd075168d431'
branch_labels = None
depends_on = None


def upgrade():
    # Step 1: Drop the existing integer `id` column
    op.drop_column('recording', 'id')

    # Step 2: Add a new UUID `id` column
    op.add_column('recording', sa.Column('id', sa.UUID(), primary_key=True, server_default=sa.text("uuid_generate_v4()")))

    # Step 3: Recreate the primary key constraint
    op.create_primary_key('pk_recording', 'recording', ['id'])

def downgrade():
    # Step 1: Drop the UUID `id` column
    op.drop_column('recording', 'id')

    # Step 2: Add the old integer `id` column back
    op.add_column('recording', sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True))

    # Step 3: Recreate the primary key constraint
    op.create_primary_key('pk_recording', 'recording', ['id'])


    # ### end Alembic commands ###
