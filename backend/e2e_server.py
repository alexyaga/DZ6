"""Isolated, disposable server for browser tests; never uses the demonstration DB."""
import os
from pathlib import Path

root = Path(__file__).resolve().parents[1]
db_path = root / 'data' / 'e2e.db'
db_path.parent.mkdir(exist_ok=True)
os.environ['DATABASE_URL'] = 'sqlite:///' + db_path.as_posix()
os.environ['APP_ORIGINS'] = 'http://127.0.0.1:8001'

from .db import Base, engine
from .models import *
from .seed import seed
import uvicorn

if __name__ == '__main__':
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    seed()
    uvicorn.run('backend.main:app', host='127.0.0.1', port=8001)
