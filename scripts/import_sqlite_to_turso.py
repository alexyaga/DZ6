"""One-time copy of the preserved school.db into an empty Turso database."""

import sqlite3
from pathlib import Path

import turso_serverless

from backend.config import ROOT, TURSO_AUTH_TOKEN, TURSO_DATABASE_URL, turso_is_configured

SOURCE = ROOT / 'data' / 'school.db'
SKIP = {'alembic_version', 'app_settings', 'sqlite_sequence'}
BATCH_SIZE = 100


def ordered_tables(source, names):
    remaining = set(names)
    order = []
    while remaining:
        ready = sorted(
            name for name in remaining
            if not ({row[2] for row in source.execute(f'PRAGMA foreign_key_list("{name}")')}
                    & remaining - {name})
        )
        if not ready:
            raise RuntimeError('Cannot resolve table foreign-key order')
        order.extend(ready)
        remaining.difference_update(ready)
    return order


def main():
    if not turso_is_configured():
        raise RuntimeError('Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in .env')
    if not SOURCE.is_file():
        raise RuntimeError(f'Source database not found: {SOURCE}')
    source = sqlite3.connect(f'file:{SOURCE.as_posix()}?mode=ro', uri=True)
    target = turso_serverless.connect(TURSO_DATABASE_URL, auth_token=TURSO_AUTH_TOKEN)
    try:
        source.execute('BEGIN')
        source_tables = {
            row[0] for row in source.execute("SELECT name FROM sqlite_master WHERE type='table'")
        } - SKIP
        target_tables = {
            row[0] for row in target.execute("SELECT name FROM sqlite_master WHERE type='table'")
        } - SKIP
        if source_tables != target_tables:
            raise RuntimeError(f'Schema mismatch: source-only={sorted(source_tables-target_tables)}, target-only={sorted(target_tables-source_tables)}')
        for table in sorted(target_tables):
            if target.execute(f'SELECT 1 FROM "{table}" LIMIT 1').fetchone():
                raise RuntimeError(f'Turso table {table} already contains data; import requires an empty database')
        target.execute('PRAGMA foreign_keys=ON')
        target.execute('BEGIN IMMEDIATE')
        for table in ordered_tables(source, source_tables):
            columns = [row[1] for row in source.execute(f'PRAGMA table_info("{table}")')]
            quoted = ', '.join(f'"{column}"' for column in columns)
            placeholders = ', '.join('?' for _ in columns)
            rows = source.execute(f'SELECT {quoted} FROM "{table}"')
            count = 0
            while batch := rows.fetchmany(BATCH_SIZE):
                values = ', '.join(f'({placeholders})' for _ in batch)
                parameters = tuple(value for row in batch for value in row)
                target.execute(f'INSERT INTO "{table}" ({quoted}) VALUES {values}', parameters)
                count += len(batch)
            print(f'{table}: {count}')
        target.commit()
        print('Import committed')
    except BaseException:
        target.rollback()
        raise
    finally:
        target.close()
        source.close()


if __name__ == '__main__':
    main()
