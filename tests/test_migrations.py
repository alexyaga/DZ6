import os
import sqlite3
import subprocess
import sys
from pathlib import Path

def test_fresh_install_with_alembic_and_seed(tmp_path):
    path = tmp_path / 'fresh.db'
    env = {**os.environ, 'DATABASE_URL':'sqlite:///' + path.as_posix()}
    root = Path(__file__).resolve().parents[1]
    for command in [['alembic','upgrade','head'],['backend.seed']]:
        result = subprocess.run([sys.executable,'-m',*command],cwd=root,env=env,capture_output=True,text=True)
        assert result.returncode == 0, result.stderr
    with sqlite3.connect(path) as db:
        assert db.execute('SELECT COUNT(*) FROM users').fetchone()[0] == 3
        assert db.execute('SELECT COUNT(*) FROM users WHERE role_id=1').fetchone()[0] == 1
        assert db.execute('PRAGMA foreign_key_check').fetchall() == []
        assert db.execute('SELECT version_num FROM alembic_version').fetchone()[0] == '003_env_based_secrets'
        assert db.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='app_settings'").fetchone()[0] == 0

def test_multi_admin_migration_preserves_existing_school(tmp_path):
    path=tmp_path/'existing.db'
    env={**os.environ,'DATABASE_URL':'sqlite:///'+path.as_posix()}
    root=Path(__file__).resolve().parents[1]
    def command(*args):
        return subprocess.run([sys.executable,'-m',*args],cwd=root,env=env,capture_output=True,text=True)
    assert command('alembic','upgrade','001_initial').returncode==0
    assert command('backend.seed').returncode==0
    with sqlite3.connect(path) as db:
        counts=[db.execute('SELECT COUNT(*) FROM '+table).fetchone()[0] for table in ('users','purchases','messages','user_memories')]
        db.execute("UPDATE app_settings SET encrypted_key='preserved-encrypted-key'")
        assert db.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name='one_administrator'").fetchone()[0]==1
    result=command('alembic','upgrade','head')
    assert result.returncode==0,result.stderr
    with sqlite3.connect(path) as db:
        assert counts==[db.execute('SELECT COUNT(*) FROM '+table).fetchone()[0] for table in ('users','purchases','messages','user_memories')]
        assert db.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='app_settings'").fetchone()[0]==0
        db.execute('UPDATE users SET role_id=1 WHERE id=2')
        assert db.execute('SELECT COUNT(*) FROM users WHERE role_id=1').fetchone()[0]==2
    # Downgrade must never silently demote an existing administrator.
    assert command('alembic','downgrade','001_initial').returncode!=0
    with sqlite3.connect(path) as db:
        assert db.execute('SELECT version_num FROM alembic_version').fetchone()[0]=='002_multiple_admins'
