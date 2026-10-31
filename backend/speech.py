"""Short microphone recordings: memory-only upload to OpenAI with the saved key."""
from fastapi import HTTPException
from openai import OpenAI, AuthenticationError, RateLimitError, BadRequestError, PermissionDeniedError, NotFoundError
from .config import OPENAI_TRANSCRIPTION_MODEL

TRANSCRIPTION_MODEL = OPENAI_TRANSCRIPTION_MODEL
MAX_AUDIO_BYTES = 4 * 1024 * 1024
AUDIO_FORMATS = {'audio/webm': 'webm', 'video/webm': 'webm', 'audio/mp4': 'mp4',
                 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/mpeg': 'mp3'}

def transcribe_audio(audio: bytes, mime: str, api_key: str):
    try:
        with OpenAI(api_key=api_key, timeout=35, max_retries=0) as client:
            result = client.audio.transcriptions.create(
                model=TRANSCRIPTION_MODEL,
                file=('recording.' + AUDIO_FORMATS[mime], audio, mime),
                language='ru', response_format='json',
            )
        text = result.text.strip()
        if not text:
            raise HTTPException(422, 'Речь не распознана. Запишите фразу ещё раз.')
        if len(text) > 12000:
            raise HTTPException(422, 'Распознанный текст слишком длинный. Запишите более короткую фразу.')
        return {'text': text, 'model': TRANSCRIPTION_MODEL}
    except AuthenticationError:
        raise HTTPException(503, 'OpenAI отклонил API-ключ. Проверьте OPENAI_API_KEY в файле .env.') from None
    except RateLimitError:
        raise HTTPException(429, 'Лимит запросов или средств OpenAI исчерпан. Попробуйте позже или проверьте баланс API.') from None
    except (PermissionDeniedError, NotFoundError):
        raise HTTPException(502, 'Модель распознавания недоступна для сохранённого API-ключа.') from None
    except BadRequestError:
        raise HTTPException(422, 'OpenAI не смог прочитать запись. Запишите фразу ещё раз.') from None
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(502, 'Не удалось распознать речь через OpenAI. Проверьте подключение и попробуйте снова; введённый текст сохранён.') from None
