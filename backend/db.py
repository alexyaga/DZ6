import contextvars
import json
import os
from datetime import datetime, timezone

from sqlalchemy import create_engine, event
from sqlalchemy.dialects import registry
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import ROOT, TURSO_AUTH_TOKEN, TURSO_DATABASE_URL, turso_is_configured

registry.register('sqlite.turso_http', 'backend.turso_dialect', 'TursoHttpDialect')


def connect_turso():
    if not turso_is_configured():
        raise RuntimeError('Заполните TURSO_DATABASE_URL и TURSO_AUTH_TOKEN в файле .env')
    import turso_serverless

    return turso_serverless.connect(TURSO_DATABASE_URL, auth_token=TURSO_AUTH_TOKEN)


LOCAL_DATABASE_URL = os.getenv('DATABASE_URL', '').strip()
if LOCAL_DATABASE_URL:
    # Explicit local SQLite override is reserved for isolated test databases.
    engine = create_engine(LOCAL_DATABASE_URL, connect_args={'check_same_thread': False, 'timeout': 30})
else:
    engine = create_engine('sqlite+turso_http://', creator=connect_turso, pool_pre_ping=True)
SessionLocal = sessionmaker(engine, expire_on_commit=False)
trace_context = contextvars.ContextVar('sql_trace', default=None)
trace_purpose = contextvars.ContextVar('sql_purpose', default='Обновление данных')

class Base(DeclarativeBase):
    pass


if LOCAL_DATABASE_URL:
    @event.listens_for(engine, 'connect')
    def configure_local_sqlite(connection, _):
        connection.execute('PRAGMA foreign_keys=ON')
        connection.execute('PRAGMA journal_mode=WAL')
        connection.execute('PRAGMA busy_timeout=30000')
else:
    @event.listens_for(engine, 'connect')
    def configure_turso_foreign_keys(connection, _):
        connection.execute('PRAGMA foreign_keys=ON')

def now():
    return datetime.now(timezone.utc).replace(tzinfo=None)

@event.listens_for(engine, 'after_cursor_execute')
def capture_sql(conn, cursor, statement, parameters, context, many):
    traces = trace_context.get()
    blocked = ('app_settings', 'sessions', 'users', 'sql_traces', 'audit_events')
    if traces is not None and not any(name in statement.lower() for name in blocked):
        affected = max(cursor.rowcount, 0)
        if context.isinsert and not many:
            affected = max(affected, 1)
        traces.append({'sql': statement, 'parameters': json.dumps(parameters, ensure_ascii=False, default=str),
                       'row_count': affected, 'purpose': trace_purpose.get()})

def rows(db, statement, purpose='Чтение данных'):
    token = trace_purpose.set(purpose)
    traces = trace_context.get()
    before = len(traces) if traces is not None else 0
    result = list(db.scalars(statement))
    if traces is not None and len(traces) > before:
        traces[before]['row_count'] = len(result)
    trace_purpose.reset(token)
    return result

def get_db():
    with SessionLocal() as db:
        yield db
