"""SQLAlchemy DB-API bridge for Turso's pure-Python HTTP driver."""

from sqlalchemy.dialects.sqlite.base import SQLiteDialect


class TursoHttpDialect(SQLiteDialect):
    driver = 'turso_http'
    supports_statement_cache = True

    @classmethod
    def import_dbapi(cls):
        import turso_serverless

        # SQLAlchemy's SQLite compiler checks this attribute during dialect
        # initialization; the HTTP driver intentionally does not expose it.
        if not hasattr(turso_serverless, 'sqlite_version_info'):
            turso_serverless.sqlite_version_info = (3, 50, 4)
        return turso_serverless

    def create_connect_args(self, url):
        return [], {}

    def on_connect(self):
        # Turso's remote HTTP driver has no SQLite connection-level callbacks.
        return None

    def _get_server_version_info(self, connection):
        version = connection.exec_driver_sql('SELECT sqlite_version()').scalar_one()
        return tuple(int(part) for part in version.split('.')[:3])
