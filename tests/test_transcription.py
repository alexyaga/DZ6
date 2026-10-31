from types import SimpleNamespace
from fastapi.testclient import TestClient
from backend.main import app
from backend import speech

def upload(client, audio=b'fake-audio', mime='audio/webm;codecs=opus'):
    return client.post('/api/ai/transcribe', content=audio, headers={'content-type': mime})

def configure(monkeypatch):
    from backend import main, config
    monkeypatch.setattr(main, 'OPENAI_API_KEY', 'test-speech-key')
    monkeypatch.setattr(config, 'OPENAI_API_KEY', 'test-speech-key')

def fake_provider(monkeypatch, text='Хочу изучать Python', error=None):
    calls = []
    class Client:
        def __init__(self, **kwargs):
            self.audio = SimpleNamespace(transcriptions=SimpleNamespace(create=self.create))
            calls.append({'settings': kwargs})
        def __enter__(self): return self
        def __exit__(self, *args): pass
        def create(self, **kwargs):
            calls.append(kwargs)
            if error: raise error
            return SimpleNamespace(text=text)
    monkeypatch.setattr(speech, 'OpenAI', Client)
    return calls

def test_transcription_uses_shared_key_and_cheap_model(anna, admin, monkeypatch):
    configure(monkeypatch)
    calls = fake_provider(monkeypatch)
    response = upload(anna)
    assert response.status_code == 200, response.text
    assert response.json() == {'text':'Хочу изучать Python','model':'gpt-4o-mini-transcribe'}
    assert calls[0]['settings']['api_key'] == 'test-speech-key'
    assert calls[1]['model'] == 'gpt-4o-mini-transcribe'
    assert calls[1]['file'] == ('recording.webm', b'fake-audio', 'audio/webm')
    assert calls[1]['language'] == 'ru'
    assert 'test-speech-key' not in response.text
    assert anna.get('/api/ai/status').json()['transcription_available']

def test_transcription_requires_authentication_and_csrf(anna):
    client = TestClient(app, headers={'origin':'http://127.0.0.1:8000'})
    assert upload(client).status_code == 401
    anna.headers['x-csrf-token'] = 'invalid'
    assert upload(anna).status_code == 403

def test_transcription_requires_saved_key(anna):
    assert upload(anna).status_code == 503

def test_transcription_upload_validation(anna, admin, monkeypatch):
    configure(monkeypatch)
    calls = fake_provider(monkeypatch)
    assert upload(anna, mime='text/plain').status_code == 415
    assert upload(anna, audio=b'').status_code == 422
    assert upload(anna, audio=b'0' * (speech.MAX_AUDIO_BYTES + 1)).status_code == 413
    assert calls == []

def test_transcription_empty_result(anna, admin, monkeypatch):
    configure(monkeypatch)
    fake_provider(monkeypatch, text='  ')
    assert upload(anna).status_code == 422

def test_transcription_error_does_not_expose_secrets(anna, admin, monkeypatch):
    configure(monkeypatch)
    fake_provider(monkeypatch, error=RuntimeError('private provider response test-speech-key'))
    response=upload(anna)
    assert response.status_code == 502
    assert 'private provider' not in response.text and 'test-speech-key' not in response.text
