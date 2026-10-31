import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / '.env')

TURSO_DATABASE_URL = os.getenv('TURSO_DATABASE_URL', '').strip()
TURSO_AUTH_TOKEN = os.getenv('TURSO_AUTH_TOKEN', '').strip()
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', '').strip()
OPENAI_MODEL = os.getenv('OPENAI_MODEL', '').strip()
OPENAI_TRANSCRIPTION_MODEL = os.getenv('OPENAI_TRANSCRIPTION_MODEL', 'gpt-4o-mini-transcribe').strip()
APP_ORIGINS = {
    origin.strip()
    for origin in os.getenv(
        'APP_ORIGINS',
        'http://127.0.0.1:8000,http://localhost:8000,http://localhost:5173,http://127.0.0.1:5173',
    ).split(',')
    if origin.strip()
}


def ai_is_configured() -> bool:
    return bool(OPENAI_API_KEY and OPENAI_MODEL)


def turso_is_configured() -> bool:
    return bool(TURSO_DATABASE_URL and TURSO_AUTH_TOKEN)
