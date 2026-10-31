"""Allow existing clients to be promoted to administrators without losing data."""
from alembic import op
import sqlalchemy as sa

revision = '002_multiple_admins'
down_revision = '001_initial'
branch_labels = None
depends_on = None

def upgrade():
    op.drop_index('one_administrator', table_name='users')

def downgrade():
    count = op.get_bind().execute(sa.text('SELECT COUNT(*) FROM users WHERE role_id = 1')).scalar_one()
    if count > 1:
        raise RuntimeError('Cannot restore single-admin restriction while multiple administrators exist.')
    op.create_index('one_administrator', 'users', ['role_id'], unique=True, sqlite_where=sa.text('role_id = 1'))
