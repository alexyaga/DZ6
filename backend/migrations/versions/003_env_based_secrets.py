"""Remove application settings and encrypted provider credentials from the database."""

from alembic import op
import sqlalchemy as sa

revision = '003_env_based_secrets'
down_revision = '002_multiple_admins'
branch_labels = None
depends_on = None


def upgrade():
    op.drop_table('app_settings')


def downgrade():
    op.create_table(
        'app_settings',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('encrypted_key', sa.Text(), nullable=False),
        sa.Column('model', sa.String(length=180), nullable=False),
        sa.Column('verified', sa.Boolean(), nullable=False),
    )
