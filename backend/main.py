import json
from contextlib import asynccontextmanager
from datetime import timedelta
from pathlib import Path
from urllib.parse import urlsplit

from fastapi import FastAPI, Depends, HTTPException, Request, Response
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.concurrency import run_in_threadpool
from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy import select, delete, update
from sqlalchemy.exc import IntegrityError, OperationalError
from openai import OpenAI

from .db import SessionLocal, get_db, now, ROOT, rows, trace_context, trace_purpose
from .config import APP_ORIGINS, OPENAI_API_KEY, OPENAI_MODEL, OPENAI_TRANSCRIPTION_MODEL, ai_is_configured, turso_is_configured
from .models import *
from .security import current_user, admin_user, new_session, user_info, password_matches, hasher, check_credentials
from .services import *
from .agent import process_message, TOOLS
from .speech import transcribe_audio, MAX_AUDIO_BYTES, AUDIO_FORMATS, TRANSCRIPTION_MODEL

@asynccontextmanager
async def lifespan(app):
    # Миграции запускаются скриптом запуска; импорт приложения не меняет схему.
    yield

app = FastAPI(title='IT School', lifespan=lifespan)
ORIGINS = APP_ORIGINS


def allowed_origin(request: Request) -> bool:
    origin = request.headers.get('origin', '')
    if origin in ORIGINS:
        return True
    parsed = urlsplit(origin)
    # Preview, production and custom Vercel domains are allowed only for their own host.
    return (parsed.scheme == 'https' and parsed.netloc == request.headers.get('host', '')
            and not parsed.path and not parsed.query and not parsed.fragment)

@app.middleware('http')
async def protect_origin(request, call_next):
    if request.url.path.startswith('/api/') and request.method not in ('GET', 'HEAD', 'OPTIONS'):
        if not allowed_origin(request):
            return JSONResponse({'detail': 'Недопустимый Origin запроса'}, status_code=403)
    response = await call_next(request)
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['Referrer-Policy'] = 'same-origin'
    if request.url.path.startswith('/api/'):
        response.headers['Cache-Control'] = 'no-store'
    return response

@app.exception_handler(IntegrityError)
async def integrity_error(request, exc):
    return JSONResponse({'detail': 'Данные связаны с другими записями или нарушают ограничение уникальности'}, status_code=409)

@app.exception_handler(OperationalError)
async def database_error(request, exc):
    return JSONResponse({'detail': 'База данных занята. Повторите запрос через несколько секунд'}, status_code=409)

class Credentials(BaseModel):
    login: str = Field(max_length=80)
    password: str = Field(max_length=200)

class Registration(Credentials):
    model_config = ConfigDict(extra='forbid')
    name: str = Field(min_length=1, max_length=120)

class ProfileInput(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: str = Field(default='', max_length=200)
    phone: str = Field(default='', max_length=50)

class MessageInput(BaseModel):
    content: str = Field(min_length=1, max_length=12000)

class MemoryInput(BaseModel):
    category: str
    content: str = Field(min_length=1, max_length=2000)

class ActionInput(BaseModel):
    kind: str
    target_id: int

class DecisionInput(BaseModel):
    confirm: bool

def audit(db, actor, action, details):
    db.add(Audit(actor_id=actor.id, action=action, details=json.dumps(details, ensure_ascii=False, default=str)))

@app.get('/api/health')
def health():
    return {'status': 'ok'}

@app.get('/api/ai/status')
def ai_status(user=Depends(current_user), db=Depends(get_db)):
    return {'available': ai_is_configured(),
            'transcription_available': bool(OPENAI_API_KEY), 'transcription_model': OPENAI_TRANSCRIPTION_MODEL}

@app.post('/api/ai/transcribe')
async def transcribe(request: Request, user=Depends(current_user), db=Depends(get_db)):
    mime = request.headers.get('content-type', '').split(';')[0].strip().lower()
    if mime not in AUDIO_FORMATS:
        raise HTTPException(415, 'Неподдерживаемый формат аудиозаписи')
    if not OPENAI_API_KEY:
        raise HTTPException(503, 'Для распознавания задайте OPENAI_API_KEY в файле .env и перезапустите сервер.')
    db.rollback()  # Не удерживаем транзакцию БД во время передачи аудио и запроса к OpenAI.
    audio = bytearray()
    async for chunk in request.stream():
        if len(audio) + len(chunk) > MAX_AUDIO_BYTES:
            raise HTTPException(413, 'Запись слишком большая. Максимальный размер — 4 МБ.')
        audio.extend(chunk)
    if not audio:
        raise HTTPException(422, 'Запись пустая. Повторите запись с микрофона.')
    return await run_in_threadpool(transcribe_audio, bytes(audio), mime, OPENAI_API_KEY)

@app.post('/api/auth/login')
def login(payload: Credentials, response: Response, db=Depends(get_db)):
    user = db.scalar(select(User).where(User.login == payload.login.lower()))
    # Хеш проверяется и для неизвестного пользователя, чтобы не раскрывать наличие логина.
    valid = password_matches(user.password_hash if user else DUMMY_HASH, payload.password)
    if not user or not valid or not user.active:
        fail('Неверный логин или пароль', 401)
    return new_session(db, user, response)

DUMMY_HASH = hasher.hash('not-a-real-password')

@app.post('/api/auth/register')
def register(payload: Registration, response: Response, db=Depends(get_db)):
    check_credentials(payload.login, payload.password)
    if not payload.name.strip():
        fail('Укажите имя', 422)
    user = User(login=payload.login.lower(), password_hash=hasher.hash(payload.password), role_id=2)
    db.add(user)
    db.flush()
    db.add(Profile(user_id=user.id, name=payload.name.strip()))
    return new_session(db, user, response)

@app.get('/api/auth/me')
def me(request: Request, user=Depends(current_user), db=Depends(get_db)):
    return {**user_info(db, user), 'csrf': request.state.session.csrf}

@app.post('/api/auth/logout')
def logout(request: Request, response: Response, user=Depends(current_user), db=Depends(get_db)):
    db.delete(request.state.session)
    db.commit()
    response.delete_cookie('school_session')
    return {'ok': True}

@app.patch('/api/me/profile')
def edit_profile(payload: ProfileInput, user=Depends(current_user), db=Depends(get_db)):
    if not payload.name.strip():
        fail('Укажите имя', 422)
    profile = db.scalar(select(Profile).where(Profile.user_id == user.id))
    for key, value in payload.model_dump().items():
        setattr(profile, key, value.strip())
    db.commit()
    return user_info(db, user)

@app.get('/api/catalog/all')
def get_catalog(user=Depends(current_user), db=Depends(get_db)):
    return catalog(db)

@app.get('/api/me/learning')
def get_learning(user=Depends(current_user), db=Depends(get_db)):
    return personal(db, user.id)

@app.get('/api/me/memories')
def get_memories(user=Depends(current_user), db=Depends(get_db)):
    return [data(m) for m in db.scalars(select(Memory).where(Memory.user_id == user.id, Memory.active.is_(True)).order_by(Memory.id))]

@app.post('/api/me/memories')
def add_memory(payload: MemoryInput, user=Depends(current_user), db=Depends(get_db)):
    old = db.scalar(select(Memory).where(Memory.user_id == user.id, Memory.category == payload.category).order_by(Memory.id.desc()))
    if old:
        old.active = True  # Явное ручное восстановление разрешено владельцу.
    save_memory(db, user.id, payload.category, payload.content)
    clear_memory_context(db, user.id)
    db.commit()
    return {'ok': True}

@app.patch('/api/me/memories/{ident}')
def edit_memory(ident: int, payload: MemoryInput, user=Depends(current_user), db=Depends(get_db)):
    memory = owned(db, Memory, ident, user.id)
    if payload.category != memory.category:
        fail('Для смены категории создайте новое сведение', 422)
    # Старый текст остаётся tombstone, чтобы не возвращаться из истории.
    memory.active = False
    memory.updated_at = now()
    db.add(Memory(user_id=user.id, category=payload.category, content=payload.content, source_message_id=memory.source_message_id))
    clear_memory_context(db, user.id)
    db.commit()
    return {'ok': True}

@app.delete('/api/me/memories/{ident}')
def remove_memory(ident: int, user=Depends(current_user), db=Depends(get_db)):
    memory = owned(db, Memory, ident, user.id)
    memory.active = False
    memory.updated_at = now()
    clear_memory_context(db, user.id)
    db.commit()
    return {'ok': True}

@app.get('/api/conversations')
def conversations(user=Depends(current_user), db=Depends(get_db)):
    return [data(c) for c in db.scalars(select(Conversation).where(Conversation.user_id == user.id).order_by(Conversation.updated_at.desc()))]

@app.post('/api/conversations')
def new_conversation(user=Depends(current_user), db=Depends(get_db)):
    c = Conversation(user_id=user.id)
    db.add(c)
    db.commit()
    return data(c)

def conversation_contents(db, conversation):
    # A terminated function must not leave a conversation blocked forever.
    db.execute(update(Message).where(Message.conversation_id == conversation.id,
              Message.status == 'processing', Message.created_at < now() - timedelta(minutes=10))
              .values(status='error'))
    db.commit()
    result = []
    for message in db.scalars(select(Message).where(Message.conversation_id == conversation.id).order_by(Message.id)):
        result.append({**data(message), 'actions': [data(a) for a in db.scalars(select(PendingAction).where(PendingAction.message_id == message.id))],
                       'traces': [data(t) for t in db.scalars(select(SqlTrace).where(SqlTrace.message_id == message.id))]})
    return {'conversation': data(conversation), 'messages': result}

@app.get('/api/conversations/{ident}')
def read_conversation(ident: int, user=Depends(current_user), db=Depends(get_db)):
    return conversation_contents(db, owned(db, Conversation, ident, user.id))

@app.delete('/api/conversations/{ident}')
def delete_conversation(ident: int, user=Depends(current_user), db=Depends(get_db)):
    db.delete(owned(db, Conversation, ident, user.id))
    db.commit()
    return {'ok': True}

@app.post('/api/conversations/{ident}/messages')
def send_message(ident: int, payload: MessageInput, user=Depends(current_user), db=Depends(get_db)):
    return process_message(db, user, ident, content=payload.content)

@app.post('/api/conversations/{ident}/messages/{message_id}/retry')
def retry_message(ident: int, message_id: int, user=Depends(current_user), db=Depends(get_db)):
    return process_message(db, user, ident, retry_id=message_id)

@app.post('/api/actions')
def propose(payload: ActionInput, user=Depends(current_user), db=Depends(get_db)):
    result = data(prepare_action(db, user.id, payload.kind, payload.target_id))
    db.commit()
    return result

@app.post('/api/actions/{ident}/decision')
def decision(ident: int, payload: DecisionInput, user=Depends(current_user), db=Depends(get_db)):
    # Keep capacity/balance checks and mutations inside one database transaction.
    db.rollback()
    db.connection().exec_driver_sql('BEGIN IMMEDIATE')
    action = owned(db, PendingAction, ident, user.id)
    if action.status != 'pending':
        return data(action)
    traces = []
    token = trace_context.set(traces)
    purpose = trace_purpose.set('Подтверждение действия клиента')
    try:
        if payload.confirm:
            execute_action(db, action)
        else:
            action.status = 'cancelled'
            action.result = 'Действие отменено'
        db.flush()
    finally:
        trace_context.reset(token)
        trace_purpose.reset(purpose)
    if action.message_id:
        for trace in traces:
            db.add(SqlTrace(message_id=action.message_id, **trace))
    db.commit()
    return data(action)

ADMIN_ENTITIES = {
    'courses': (Course, ['title', 'description', 'direction', 'level', 'price', 'active']),
    'topics': (Topic, ['course_id', 'title', 'position']),
    'teachers': (Teacher, ['name', 'specialization', 'description', 'active']),
    'teacher-courses': (TeacherCourse, ['teacher_id', 'course_id']),
    'lessons': (Lesson, ['course_id', 'topic_id', 'teacher_id', 'starts_at', 'ends_at', 'format', 'price', 'capacity', 'status']),
    'plans': (Plan, ['title', 'format', 'quantity', 'price', 'active']),
}

@app.get('/api/admin/users')
def admin_users(actor=Depends(admin_user), db=Depends(get_db)):
    return [user_info(db, u) for u in db.scalars(select(User).order_by(User.role_id.desc(), User.id))]

@app.post('/api/admin/users/{uid}/promote')
def promote_admin(uid: int, actor=Depends(admin_user), db=Depends(get_db)):
    db.rollback()
    db.connection().exec_driver_sql('BEGIN IMMEDIATE')
    target = require(db, User, uid)
    if target.role_id == 1:
        return user_info(db, target)
    if not target.active:
        fail('Сначала разблокируйте пользователя, затем назначьте его администратором')
    target.role_id = 1
    audit(db, actor, 'promote_admin', {'user_id': uid, 'from_role': 'client', 'to_role': 'admin'})
    db.commit()
    return user_info(db, target)

@app.post('/api/admin/users')
def admin_create_user(payload: Registration, actor=Depends(admin_user), db=Depends(get_db)):
    check_credentials(payload.login, payload.password)
    if not payload.name.strip():
        fail('Укажите имя', 422)
    u = User(login=payload.login.lower(), password_hash=hasher.hash(payload.password), role_id=2)
    db.add(u)
    db.flush()
    db.add(Profile(user_id=u.id, name=payload.name))
    audit(db, actor, 'create_user', {'user_id': u.id})
    db.commit()
    return user_info(db, u)

@app.patch('/api/admin/users/{uid}')
def admin_edit_user(uid: int, payload: dict, actor=Depends(admin_user), db=Depends(get_db)):
    u = require(db, User, uid)
    if u.role_id == 1:
        fail('Учётная запись администратора защищена', 403)
    if set(payload) - {'name', 'email', 'phone', 'active', 'password'}:
        fail('Недопустимые поля', 422)
    profile = db.scalar(select(Profile).where(Profile.user_id == uid))
    for key in ('name', 'email', 'phone'):
        if key in payload:
            if not isinstance(payload[key], str) or len(payload[key]) > 200 or (key == 'name' and not payload[key].strip()):
                fail('Некорректные данные профиля', 422)
            setattr(profile, key, payload[key].strip())
    if 'active' in payload:
        if not isinstance(payload['active'], bool):
            fail('active должен быть логическим значением', 422)
        u.active = payload['active']
    if payload.get('password'):
        check_credentials(u.login, payload['password'])
        u.password_hash = hasher.hash(payload['password'])
    if not u.active or payload.get('password'):
        db.execute(delete(LoginSession).where(LoginSession.user_id == uid))
    audit(db, actor, 'edit_user', {'user_id': uid, 'fields': list(payload)})
    db.commit()
    return user_info(db, u)

@app.get('/api/admin/users/{uid}/details')
def admin_user_details(uid: int, actor=Depends(admin_user), db=Depends(get_db)):
    u = require(db, User, uid)
    return {'user': user_info(db, u), **personal(db, uid),
            'memories': [data(m) for m in db.scalars(select(Memory).where(Memory.user_id == uid, Memory.active.is_(True)))],
            'conversations': [data(c) for c in db.scalars(select(Conversation).where(Conversation.user_id == uid))]}

@app.get('/api/admin/conversations/{ident}')
def admin_conversation(ident: int, actor=Depends(admin_user), db=Depends(get_db)):
    return conversation_contents(db, require(db, Conversation, ident))

@app.delete('/api/admin/conversations/{ident}')
def admin_delete_conversation(ident: int, actor=Depends(admin_user), db=Depends(get_db)):
    db.delete(require(db, Conversation, ident))
    audit(db, actor, 'delete_conversation', {'id': ident})
    db.commit()
    return {'ok': True}

@app.patch('/api/admin/memories/{ident}')
def admin_memory(ident: int, payload: dict, actor=Depends(admin_user), db=Depends(get_db)):
    memory = require(db, Memory, ident)
    if set(payload) - {'content', 'active'} or ('content' in payload and (not isinstance(payload['content'], str) or not 1 <= len(payload['content']) <= 2000)):
        fail('Некорректное содержание памяти', 422)
    if 'active' in payload and not isinstance(payload['active'], bool):
        fail('Некорректный статус', 422)
    if 'content' in payload:
        memory.active = False
        memory.updated_at = now()
        db.add(Memory(user_id=memory.user_id, category=memory.category, content=payload['content'], source_message_id=memory.source_message_id))
    else:
        memory.active = payload.get('active', memory.active)
        memory.updated_at = now()
    clear_memory_context(db, memory.user_id)
    audit(db, actor, 'edit_memory', {'id': ident})
    db.commit()
    return {'ok': True}

@app.post('/api/admin/subscriptions/{ident}/adjust')
def admin_adjust(ident: int, payload: dict, actor=Depends(admin_user), db=Depends(get_db)):
    db.rollback()
    db.connection().exec_driver_sql('BEGIN IMMEDIATE')
    sub = require(db, Subscription, ident)
    amount, reason = payload.get('amount'), payload.get('reason', '')
    if not isinstance(amount, int) or isinstance(amount, bool) or not isinstance(reason, str) or not reason.strip() or abs(amount) > 1000:
        fail('Укажите целое изменение баланса и причину', 422)
    if balance(db, sub)['available'] + amount < 0:
        fail('Корректировка сделает доступный остаток отрицательным')
    db.add(Operation(subscription_id=ident, kind='adjust', amount=amount, reason=reason[:1000]))
    audit(db, actor, 'adjust_subscription', {'id': ident, 'amount': amount, 'reason': reason[:1000]})
    db.commit()
    return balance(db, sub)

@app.patch('/api/admin/bookings/{ident}')
def admin_booking(ident: int, payload: dict, actor=Depends(admin_user), db=Depends(get_db)):
    if len(payload) != 1 or set(payload) - {'status', 'lesson_id'}:
        fail('Укажите статус или новое занятие', 422)
    if 'lesson_id' in payload and (not isinstance(payload['lesson_id'], int) or isinstance(payload['lesson_id'], bool) or payload['lesson_id'] < 1):
        fail('Некорректный идентификатор занятия', 422)
    db.rollback()
    db.connection().exec_driver_sql('BEGIN IMMEDIATE')
    b = require(db, Booking, ident)
    if 'lesson_id' in payload:
        cancel_booking(db, b.user_id, b.id, school=True)
        book(db, b.user_id, int(payload['lesson_id']))
    elif payload.get('status') == 'cancelled':
        cancel_booking(db, b.user_id, b.id, school=True)
    else:
        attendance(db, b.id, payload.get('status'))
    audit(db, actor, 'edit_booking', {'id': ident, **payload})
    db.commit()
    return {'ok': True}

@app.post('/api/admin/users/{uid}/progress')
def admin_progress(uid: int, payload: dict, actor=Depends(admin_user), db=Depends(get_db)):
    require(db, User, uid)
    if not isinstance(payload.get('completed'), bool) or not isinstance(payload.get('topic_id'), int):
        fail('Укажите тему и признак прохождения', 422)
    update_progress(db, uid, payload['topic_id'], payload['completed'])
    audit(db, actor, 'edit_progress', {'user_id': uid, **payload})
    db.commit()
    return {'ok': True}

@app.post('/api/admin/users/{uid}/purchase')
def admin_purchase(uid: int, payload: ActionInput, actor=Depends(admin_user), db=Depends(get_db)):
    require(db, User, uid)
    result = purchase(db, uid, payload.kind, payload.target_id)
    audit(db, actor, 'create_purchase', {'user_id': uid, **payload.model_dump()})
    db.commit()
    return {'result': result}

@app.get('/api/admin/settings')
def settings(actor=Depends(admin_user), db=Depends(get_db)):
    return {
        'has_key': bool(OPENAI_API_KEY),
        'model': OPENAI_MODEL,
        'configured': ai_is_configured(),
        'database_configured': turso_is_configured(),
        'verified': ai_is_configured(),
    }

@app.get('/api/admin/models')
def list_models(actor=Depends(admin_user), db=Depends(get_db)):
    if not OPENAI_API_KEY:
        fail('Задайте OPENAI_API_KEY в файле .env и перезапустите сервер', 422)
    try:
        client = OpenAI(api_key=OPENAI_API_KEY, timeout=25, max_retries=0)
        return sorted(m.id for m in client.models.list())
    except Exception:
        fail('Не удалось получить список моделей. Проверьте ключ и сеть', 502)

@app.post('/api/admin/settings/test')
def test_settings(actor=Depends(admin_user), db=Depends(get_db)):
    if not ai_is_configured():
        fail('Задайте OPENAI_API_KEY и OPENAI_MODEL в файле .env и перезапустите сервер', 422)
    try:
        client = OpenAI(api_key=OPENAI_API_KEY, timeout=30, max_retries=0)
        response = client.responses.create(model=OPENAI_MODEL, input='Вызови get_catalog для проверки подключения.',
            tools=[TOOLS[0]], tool_choice={'type': 'function', 'name': 'get_catalog'}, store=False, max_output_tokens=400)
        if not any(item.type == 'function_call' and item.name == 'get_catalog' for item in response.output):
            raise ValueError('Model did not call tool')
        return {'ok': True, 'message': 'Подключение и вызов инструментов работают'}
    except Exception:
        fail('Проверка не пройдена. Проверьте ключ, сеть и поддержку Responses API с инструментами выбранной моделью', 502)

@app.get('/api/admin/{entity}')
def admin_list(entity: str, actor=Depends(admin_user), db=Depends(get_db)):
    if entity not in ADMIN_ENTITIES:
        fail('Раздел не найден', 404)
    model, fields = ADMIN_ENTITIES[entity]
    return [data(o) for o in db.scalars(select(model).order_by(model.id))]

def mutate_entity(db, actor, entity, payload, ident=None):
    if entity not in ADMIN_ENTITIES:
        fail('Раздел не найден', 404)
    model, fields = ADMIN_ENTITIES[entity]
    if set(payload) - set(fields):
        fail('Недопустимые поля', 422)
    if model is Lesson:
        payload = dict(payload)
        for key in ('starts_at', 'ends_at'):
            if key in payload:
                payload[key] = parse_date(payload[key])
    for key, value in payload.items():
        column_type = model.__table__.columns[key].type
        if isinstance(column_type, Boolean) and not isinstance(value, bool):
            fail(f'{key}: ожидается логическое значение', 422)
        if isinstance(column_type, Integer) and (not isinstance(value, int) or isinstance(value, bool)):
            fail(f'{key}: ожидается целое число', 422)
        if isinstance(column_type, (String, Text)) and (not isinstance(value, str) or len(value) > 10000):
            fail(f'{key}: ожидается строка', 422)
        if key in ('title', 'name', 'specialization') and not value.strip():
            fail(f'{key}: поле не может быть пустым', 422)
    if any(payload.get(k, 1) < 0 for k in ('price', 'quantity', 'capacity', 'position')):
        fail('Цена и количества не могут быть отрицательными', 422)
    if model is Plan and ('quantity' in payload and payload['quantity'] < 1):
        fail('Пакет должен содержать хотя бы одно занятие', 422)
    if 'format' in payload and payload['format'] not in ('group', 'individual'):
        fail('Неизвестный формат', 422)
    if model is Topic and ident:
        original_topic = require(db, Topic, ident)
        if 'course_id' in payload and payload['course_id'] != original_topic.course_id:
            fail('Нельзя переносить существующую тему в другой курс', 422)
    if ident:
        obj = require(db, model, ident)
        if model is Lesson:
            live = rows(db, select(Booking).where(Booking.lesson_id == ident, Booking.status != 'cancelled'))
            if live and any(k in payload and payload[k] != getattr(obj, k) for k in ('starts_at', 'ends_at', 'course_id', 'topic_id', 'format', 'teacher_id')):
                fail('У занятия есть записи. Отмените занятие и создайте новое; записи можно перенести в карточке клиента')
            if 'capacity' in payload and payload['capacity'] < len(live):
                fail('Вместимость меньше количества записей')
            if payload.get('status') == 'cancelled':
                for b in live:
                    if b.status == 'reserved':
                        cancel_booking(db, b.user_id, b.id, school=True)
            if payload.get('status') == 'completed' and any(b.status == 'reserved' for b in live):
                fail('Сначала отметьте посещения всех клиентов')
        for key, value in payload.items():
            setattr(obj, key, value)
    else:
        required = {'courses': ['title'], 'topics': ['course_id', 'title'], 'teachers': ['name', 'specialization'],
                    'teacher-courses': ['teacher_id', 'course_id'], 'lessons': ['course_id', 'topic_id', 'teacher_id', 'starts_at', 'ends_at', 'format', 'price', 'capacity'],
                    'plans': ['title', 'format', 'quantity', 'price']}[entity]
        if any(k not in payload or payload[k] == '' for k in required):
            fail('Заполните обязательные поля: ' + ', '.join(required), 422)
        obj = model(**payload)
        if model is Lesson:
            obj.status = payload.get('status', 'scheduled')
        db.add(obj)
    with db.no_autoflush:
        if model is Lesson:
            if obj.status not in ('scheduled', 'completed', 'cancelled'):
                fail('Некорректный статус занятия', 422)
            validate_lesson(db, obj)
    db.flush()
    if model is Topic:
        for enrollment in rows(db, select(Enrollment).where(Enrollment.course_id == obj.course_id)):
            recalculate_enrollment(db, enrollment.user_id, obj.course_id)
    if model is Lesson:
        link = db.scalar(select(TeacherCourse).where(TeacherCourse.teacher_id == obj.teacher_id, TeacherCourse.course_id == obj.course_id))
        if not link:
            db.add(TeacherCourse(teacher_id=obj.teacher_id, course_id=obj.course_id))
    audit(db, actor, 'edit_' + entity if ident else 'create_' + entity, {'id': obj.id})
    db.commit()
    return data(obj)

@app.post('/api/admin/{entity}')
def admin_create(entity: str, payload: dict, actor=Depends(admin_user), db=Depends(get_db)):
    db.rollback()
    db.connection().exec_driver_sql('BEGIN IMMEDIATE')
    return mutate_entity(db, actor, entity, payload)

@app.patch('/api/admin/{entity}/{ident}')
def admin_edit(entity: str, ident: int, payload: dict, actor=Depends(admin_user), db=Depends(get_db)):
    db.rollback()
    db.connection().exec_driver_sql('BEGIN IMMEDIATE')
    return mutate_entity(db, actor, entity, payload, ident)

@app.delete('/api/admin/{entity}/{ident}')
def admin_archive(entity: str, ident: int, actor=Depends(admin_user), db=Depends(get_db)):
    if entity not in ADMIN_ENTITIES:
        fail('Раздел не найден', 404)
    model, fields = ADMIN_ENTITIES[entity]
    if 'active' not in fields:
        fail('Для этого объекта используйте редактирование или отмену', 422)
    obj = require(db, model, ident)
    obj.active = False
    audit(db, actor, 'archive_' + entity, {'id': ident})
    db.commit()
    return {'ok': True}

DIST = ROOT / 'frontend' / 'dist'
if (DIST / 'assets').exists():
    app.mount('/assets', StaticFiles(directory=DIST / 'assets'), name='assets')

@app.get('/{path:path}')
def frontend(path: str):
    if path.startswith('api/'):
        fail('Маршрут не найден', 404)
    if (DIST / 'index.html').exists():
        return FileResponse(DIST / 'index.html')
    return JSONResponse({'message': 'Сначала соберите frontend: pnpm --dir frontend build'}, status_code=503)
