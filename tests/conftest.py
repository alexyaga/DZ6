import os
import tempfile
from pathlib import Path

TEST_DIR = tempfile.TemporaryDirectory(prefix='it-school-tests-')
os.environ['DATABASE_URL'] = 'sqlite:///' + (Path(TEST_DIR.name) / 'test.db').as_posix()

import pytest
from fastapi.testclient import TestClient
from backend.db import Base, engine, SessionLocal
from backend.models import *
from backend.seed import seed
from backend.main import app

@pytest.fixture(autouse=True)
def database():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    seed()
    yield

def pytest_sessionfinish(session, exitstatus):
    engine.dispose()
    TEST_DIR.cleanup()

def login_client(login='anna', password='AnnaDemo!2026'):
    client = TestClient(app, headers={'origin': 'http://127.0.0.1:8000'})
    result = client.post('/api/auth/login', json={'login': login, 'password': password})
    assert result.status_code == 200, result.text
    client.headers['x-csrf-token'] = result.json()['csrf']
    return client

@pytest.fixture
def anna():
    return login_client()

@pytest.fixture
def mikhail():
    return login_client('mikhail', 'MikhailDemo!2026')

@pytest.fixture
def admin():
    return login_client('admin', 'AdminDemo!2026')
