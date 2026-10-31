import json
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from fastapi import HTTPException
from sqlalchemy import select, delete
from .db import now, rows
from .models import *

def fail(message, code=409):
    raise HTTPException(code, message)

def data(obj):
    return {column.name: getattr(obj, column.name) for column in obj.__table__.columns}

def owned(db, model, ident, user_id):
    found = rows(db, select(model).where(model.id == ident, model.user_id == user_id), 'Проверка принадлежности данных')
    if not found:
        fail('Объект не найден', 404)
    return found[0]

def require(db, model, ident):
    found = rows(db, select(model).where(model.id == ident), 'Поиск объекта каталога')
    if not found:
        fail('Объект не найден', 404)
    return found[0]

def balance(db, subscription):
    ops = rows(db, select(Operation).where(Operation.subscription_id == subscription.id), 'Расчёт остатка абонемента')
    reserved = sum(o.amount if o.kind == 'reserve' else -o.amount if o.kind in ('release', 'consume') else 0 for o in ops)
    used = sum(o.amount for o in ops if o.kind == 'consume')
    total = subscription.quantity + sum(o.amount for o in ops if o.kind == 'adjust')
    return {**data(subscription), 'total': total, 'reserved': reserved, 'used': used, 'available': total - reserved - used}

def subscriptions(db, uid):
    return [balance(db, s) for s in rows(db, select(Subscription).where(Subscription.user_id == uid).order_by(Subscription.id), 'Абонементы клиента')]

def lesson_data(db, lesson):
    course = require(db, Course, lesson.course_id)
    teacher = require(db, Teacher, lesson.teacher_id)
    topic = require(db, Topic, lesson.topic_id)
    bookings = rows(db, select(Booking).where(Booking.lesson_id == lesson.id, Booking.status != 'cancelled'), 'Количество занятых мест')
    return {**data(lesson), 'course_title': course.title, 'teacher_name': teacher.name, 'topic_title': topic.title,
            'places_left': max(lesson.capacity - len(bookings), 0)}

def catalog(db):
    return {'courses': [{**data(c), 'topics': [data(t) for t in rows(db, select(Topic).where(Topic.course_id == c.id).order_by(Topic.position), 'Темы курса')]}
                        for c in rows(db, select(Course).where(Course.active.is_(True)), 'Каталог курсов')],
            'teachers': [data(t) for t in rows(db, select(Teacher).where(Teacher.active.is_(True)), 'Преподаватели')],
            'plans': [data(p) for p in rows(db, select(Plan).where(Plan.active.is_(True)), 'Доступные абонементы')],
            'lessons': [lesson_data(db, l) for l in rows(db, select(Lesson).where(Lesson.status == 'scheduled', Lesson.starts_at > now()).order_by(Lesson.starts_at), 'Будущее расписание')]}

def personal(db, uid):
    enrollments = []
    for e in rows(db, select(Enrollment).where(Enrollment.user_id == uid), 'Изучаемые курсы'):
        topics = rows(db, select(Topic).where(Topic.course_id == e.course_id).order_by(Topic.position), 'Программа обучения')
        done = {p.topic_id for p in rows(db, select(Progress).where(Progress.user_id == uid, Progress.completed.is_(True)), 'Пройденные темы')}
        enrollments.append({**data(e), 'course_title': require(db, Course, e.course_id).title,
                            'topics': [{**data(t), 'completed': t.id in done} for t in topics],
                            'progress': round(100 * sum(t.id in done for t in topics) / max(len(topics), 1))})
    return {'subscriptions': subscriptions(db, uid),
            'purchases': [data(p) for p in rows(db, select(Purchase).where(Purchase.user_id == uid).order_by(Purchase.id.desc()), 'История покупок')],
            'bookings': [{**data(b), 'lesson': lesson_data(db, require(db, Lesson, b.lesson_id))}
                         for b in rows(db, select(Booking).where(Booking.user_id == uid).order_by(Booking.id.desc()), 'Записи клиента')],
            'enrollments': enrollments}

def ensure_enrollment(db, uid, cid):
    found = rows(db, select(Enrollment).where(Enrollment.user_id == uid, Enrollment.course_id == cid))
    if found:
        return found[0]
    entry = Enrollment(user_id=uid, course_id=cid)
    db.add(entry)
    db.flush()
    return entry

def update_progress(db, uid, topic_id, completed=True):
    topic = require(db, Topic, topic_id)
    found = rows(db, select(Progress).where(Progress.user_id == uid, Progress.topic_id == topic_id))
    if found:
        found[0].completed = completed
    else:
        db.add(Progress(user_id=uid, topic_id=topic_id, completed=completed))
    db.flush()
    recalculate_enrollment(db, uid, topic.course_id)

def recalculate_enrollment(db, uid, course_id):
    entry = ensure_enrollment(db, uid, course_id)
    topics = rows(db, select(Topic).where(Topic.course_id == course_id))
    done = rows(db, select(Progress).where(Progress.user_id == uid, Progress.topic_id.in_([t.id for t in topics]), Progress.completed.is_(True)))
    entry.status = 'completed' if topics and len(done) == len(topics) else 'studying'
    entry.completed_at = now() if entry.status == 'completed' else None

def purchase(db, uid, kind, target_id):
    cls = {'course': Course, 'plan': Plan, 'lesson': Lesson}.get(kind)
    if not cls:
        fail('Неизвестный вид покупки', 422)
    target = require(db, cls, target_id)
    if cls in (Course, Plan) and not target.active:
        fail('Предложение больше недоступно')
    if cls is Lesson and (target.status != 'scheduled' or target.starts_at <= now()):
        fail('Занятие больше недоступно')
    if cls is Course and rows(db, select(Purchase).where(Purchase.user_id == uid, Purchase.kind == 'course', Purchase.course_id == target_id)):
        fail('Курс уже приобретён')
    title = target.title if cls is not Lesson else require(db, Course, target.course_id).title + ' · разовое занятие'
    p = Purchase(user_id=uid, kind=kind, price=target.price, title=title,
                 status='available' if kind == 'lesson' else 'completed', **{f'{kind}_id': target.id})
    db.add(p)
    db.flush()
    if kind == 'plan':
        db.add(Subscription(user_id=uid, plan_id=target.id, purchase_id=p.id, format=target.format, quantity=target.quantity))
    elif kind == 'course':
        ensure_enrollment(db, uid, target.id)
    return f'Учебная покупка оформлена: {title}'

def booking_check(db, uid, lesson_id):
    lesson = require(db, Lesson, lesson_id)
    if lesson.status != 'scheduled' or lesson.starts_at <= now():
        fail('Записаться можно только на будущее занятие')
    if not require(db, Course, lesson.course_id).active or not require(db, Teacher, lesson.teacher_id).active:
        fail('Курс или преподаватель недоступен')
    live = rows(db, select(Booking).where(Booking.lesson_id == lesson_id, Booking.status != 'cancelled'), 'Проверка свободных мест')
    if any(b.user_id == uid for b in live):
        fail('Вы уже записаны на это занятие')
    if len(live) >= lesson.capacity:
        fail('Свободных мест больше нет')
    overlap = rows(db, select(Booking).join(Lesson, Booking.lesson_id == Lesson.id).where(
        Booking.user_id == uid, Booking.status == 'reserved', Lesson.starts_at < lesson.ends_at, Lesson.ends_at > lesson.starts_at), 'Проверка пересечений записей')
    if overlap:
        fail('В это время у вас уже есть занятие')
    balances = subscriptions(db, uid)
    sub = next((s for s in balances if s['format'] == lesson.format and s['available'] > 0), None)
    single = None
    if not sub:
        singles = rows(db, select(Purchase).join(Lesson, Purchase.lesson_id == Lesson.id).where(
            Purchase.user_id == uid, Purchase.kind == 'lesson', Purchase.status == 'available',
            Lesson.course_id == lesson.course_id, Lesson.format == lesson.format).order_by(Purchase.id), 'Поиск разовой покупки')
        single = next((p for p in singles if p.lesson_id == lesson_id or require(db, Lesson, p.lesson_id).status == 'cancelled'), None)
    return lesson, sub, single, balances

def book(db, uid, lesson_id):
    lesson, sub, single, _ = booking_check(db, uid, lesson_id)
    if not sub and not single:
        fail('Нет подходящего абонемента или разовой покупки. Сначала оформите учебную покупку')
    b = Booking(user_id=uid, lesson_id=lesson_id, subscription_id=sub['id'] if sub else None, purchase_id=single.id if single else None)
    db.add(b)
    db.flush()
    if sub:
        db.add(Operation(subscription_id=sub['id'], booking_id=b.id, kind='reserve'))
    else:
        single.status = 'reserved'
    ensure_enrollment(db, uid, lesson.course_id)
    return 'Запись подтверждена. Занятие зарезервировано.'

def cancel_booking(db, uid, booking_id, school=False):
    booking = owned(db, Booking, booking_id, uid)
    lesson = require(db, Lesson, booking.lesson_id)
    if booking.status == 'cancelled':
        return 'Запись уже отменена'
    if booking.status != 'reserved':
        fail('Посещение уже учтено; отмена невозможна')
    if not school and lesson.starts_at <= now():
        fail('Отменить запись можно только до начала занятия')
    booking.status = 'cancelled'
    if booking.subscription_id:
        db.add(Operation(subscription_id=booking.subscription_id, booking_id=booking.id, kind='release', reason='Отмена школой' if school else 'Отмена клиентом'))
    if booking.purchase_id:
        require(db, Purchase, booking.purchase_id).status = 'available'
    return 'Запись отменена. Резерв освобождён.'

def attendance(db, booking_id, status):
    if status not in ('attended', 'absent'):
        fail('Выберите посещение или неявку', 422)
    booking = require(db, Booking, booking_id)
    if booking.status == status:
        return
    if booking.status != 'reserved':
        fail('Посещение уже обработано или запись отменена')
    lesson = require(db, Lesson, booking.lesson_id)
    if lesson.ends_at > now():
        fail('Посещение можно отметить после окончания занятия')
    booking.status = status
    if booking.subscription_id:
        db.add(Operation(subscription_id=booking.subscription_id, booking_id=booking.id, kind='consume'))
    if booking.purchase_id:
        require(db, Purchase, booking.purchase_id).status = 'used'
    if status == 'attended':
        update_progress(db, booking.user_id, lesson.topic_id)
    # Занятие завершается после обработки всех записей, иначе остаются неучтённые посещения.
    db.flush()
    remaining = rows(db, select(Booking).where(Booking.lesson_id == lesson.id, Booking.status == 'reserved'))
    if not remaining:
        lesson.status = 'completed'

def save_memory(db, uid, category, content, source=None):
    if category not in ('goal', 'level', 'interest', 'time', 'format') or not content.strip() or len(content) > 2000:
        fail('Недопустимая категория или содержание памяти', 422)
    previous = rows(db, select(Memory).where(Memory.user_id == uid, Memory.category == category).order_by(Memory.id.desc()), 'Проверка актуальной памяти')
    if previous and not previous[0].active:
        return 'Категория удалена пользователем. Её восстановление доступно в разделе «Память».'
    if previous:
        previous[0].content = content.strip()
        previous[0].source_message_id = source
        previous[0].updated_at = now()
    else:
        db.add(Memory(user_id=uid, category=category, content=content.strip(), source_message_id=source))
    return 'Сведения сохранены'

def clear_memory_context(db, uid):
    for c in rows(db, select(Conversation).where(Conversation.user_id == uid)):
        c.summary = ''

def date_label(value):
    return value.replace(tzinfo=timezone.utc).astimezone(ZoneInfo('Europe/Moscow')).strftime('%d.%m.%Y в %H:%M МСК')

def action_snapshot(target):
    return {key: getattr(target, key).isoformat() if isinstance(getattr(target, key), datetime) else getattr(target, key)
            for key in ('title', 'price', 'starts_at', 'ends_at', 'format', 'quantity', 'course_id', 'topic_id', 'teacher_id') if hasattr(target, key)}

def prepare_action(db, uid, kind, target_id, message_id=None, booking_lesson_id=None):
    target = None
    formats = {'group': 'групповое', 'individual': 'индивидуальное'}
    if kind == 'book':
        l = require(db, Lesson, target_id)
        target = l
        label = f'Записаться: {require(db, Course, l.course_id).title}, {date_label(l.starts_at)}, {formats[l.format]} занятие. Преподаватель: {require(db, Teacher, l.teacher_id).name}. Одна единица подходящего абонемента или разовая покупка.'
    elif kind == 'cancel':
        b = owned(db, Booking, target_id, uid)
        l = require(db, Lesson, b.lesson_id)
        label = f'Отменить запись: {require(db, Course, l.course_id).title}, {date_label(l.starts_at)}. Резерв будет освобождён.'
    elif kind in ('buy_course', 'buy_plan', 'buy_lesson'):
        cls = {'buy_course': Course, 'buy_plan': Plan, 'buy_lesson': Lesson}[kind]
        t = require(db, cls, target_id)
        target = t
        title = t.title if cls is not Lesson else f'{require(db, Course, t.course_id).title}, {date_label(t.starts_at)}, {formats[t.format]} занятие'
        extra = f' {t.quantity} занятий, {formats[t.format]} обучение.' if cls is Plan else ' Посещения оплачиваются отдельно.' if cls is Course else ''
        label = f'Учебная покупка: {title}. Стоимость {t.price / 100:,.0f} ₽.{extra} Реальная оплата не производится.'
    else:
        fail('Неизвестное действие', 422)
    # Один и тот же инструмент в рамках ответа не создаёт дубликаты предложений.
    details = {'target_id': target_id, 'snapshot': action_snapshot(target) if target else {}}
    if booking_lesson_id is not None:
        details['booking_lesson_id'] = booking_lesson_id
    payload = json.dumps(details, ensure_ascii=False)
    if message_id:
        existing = rows(db, select(PendingAction).where(PendingAction.message_id == message_id, PendingAction.kind == kind, PendingAction.payload == payload, PendingAction.status == 'pending'))
        if existing:
            return existing[0]
        if kind in ('buy_plan', 'buy_lesson'):
            # Повторный вызов инструмента моделью не дублирует уже предложенную покупку.
            candidates = rows(db, select(PendingAction).where(PendingAction.message_id == message_id,
                PendingAction.user_id == uid, PendingAction.kind == kind, PendingAction.status == 'pending'))
            for candidate in candidates:
                previous = json.loads(candidate.payload)
                previous_lesson = previous.get('booking_lesson_id')
                if previous['target_id'] == target_id and (booking_lesson_id is None or previous_lesson in (None, booking_lesson_id)):
                    if booking_lesson_id is not None:
                        candidate.payload = payload
                    return candidate
    action = PendingAction(user_id=uid, kind=kind, payload=payload, description=label, message_id=message_id)
    db.add(action)
    db.flush()
    return action

def prepare_booking_offer(db, uid, lesson_id, message_id):
    lesson, sub, single, balances = booking_check(db, uid, lesson_id)
    if sub or single:
        return {'can_book': True, 'action': data(prepare_action(db, uid, 'book', lesson_id, message_id))}
    format_label = 'групповые' if lesson.format == 'group' else 'индивидуальные'
    has_matching = any(s['format'] == lesson.format for s in balances)
    reason = (f'В абонементе на {format_label} занятия нет доступного остатка' if has_matching
              else f'У вас нет абонемента на {format_label} занятия')
    reason += ', а разовое посещение этого урока ещё не приобретено.'
    for old in rows(db, select(PendingAction).where(PendingAction.user_id == uid,
            PendingAction.kind == 'book', PendingAction.status == 'pending'), 'Закрытие преждевременных предложений записи'):
        if json.loads(old.payload)['target_id'] == lesson_id:
            old.status = 'cancelled'
            old.result = reason + ' Сначала выберите вариант учебной покупки.'
    plans = rows(db, select(Plan).where(Plan.active.is_(True), Plan.format == lesson.format).order_by(Plan.price, Plan.id), 'Подбор абонементов нужного формата')
    options = [{'kind': 'buy_lesson', 'target_id': lesson_id, 'title': 'Одно занятие', 'quantity': 1, 'price': lesson.price}]
    options += [{'kind': 'buy_plan', 'target_id': p.id, 'title': p.title, 'quantity': p.quantity, 'price': p.price} for p in plans]
    actions = [data(prepare_action(db, uid, option['kind'], option['target_id'], message_id, lesson_id)) for option in options]
    return {'can_book': False, 'requires_purchase': True, 'reason': reason, 'lesson_id': lesson_id,
            'format': lesson.format, 'options': options, 'actions': actions,
            'next_step': 'Предложите выбрать ОДИН вариант покупки, сообщите количество занятий и стоимость каждого. Покупка требует подтверждения. После неё появится отдельное подтверждение записи; сейчас записи ещё нет.'}

def execute_action(db, action):
    payload = json.loads(action.payload)
    target = payload['target_id']
    cls = {'book': Lesson, 'buy_lesson': Lesson, 'buy_course': Course, 'buy_plan': Plan}.get(action.kind)
    if cls and payload.get('snapshot') != action_snapshot(require(db, cls, target)):
        fail('Условия предложения изменились. Отмените его и создайте новое, чтобы проверить актуальные условия')
    if action.kind == 'book':
        if action.message_id:
            offer = prepare_booking_offer(db, action.user_id, target, action.message_id)
            if offer.get('requires_purchase'):
                action.status = 'cancelled'
                action.result = offer['reason'] + ' Выберите разовое занятие или подходящий абонемент в предложенных карточках.'
                return action.result
        result = book(db, action.user_id, target)
    elif action.kind == 'cancel':
        result = cancel_booking(db, action.user_id, target)
    else:
        result = purchase(db, action.user_id, action.kind.removeprefix('buy_'), target)
    action.status = 'confirmed'
    if action.kind in ('buy_plan', 'buy_lesson') and payload.get('booking_lesson_id') and action.message_id:
        lesson_id = payload['booking_lesson_id']
        for other in rows(db, select(PendingAction).where(PendingAction.user_id == action.user_id,
                PendingAction.message_id == action.message_id, PendingAction.id != action.id,
                PendingAction.status == 'pending', PendingAction.kind.in_(['buy_plan', 'buy_lesson'])), 'Закрытие альтернатив выбранной покупки'):
            if json.loads(other.payload).get('booking_lesson_id') == lesson_id:
                other.status = 'cancelled'
                other.result = 'Выбран другой вариант покупки.'
        db.flush()
        try:
            lesson, sub, single, _ = booking_check(db, action.user_id, lesson_id)
            if sub or single:
                prepare_action(db, action.user_id, 'book', lesson_id, action.message_id)
                result += '. Теперь подтвердите запись на выбранное занятие в отдельной карточке.'
            else:
                result += '. Для выбранного занятия пока нет подходящего остатка.'
        except HTTPException as exc:
            result += '. Покупка сохранена, но записаться сейчас нельзя: ' + str(exc.detail)
    action.result = result
    return result

def parse_date(value):
    try:
        dt = datetime.fromisoformat(str(value).replace('Z', '+00:00'))
        return dt.astimezone(timezone.utc).replace(tzinfo=None) if dt.tzinfo else dt
    except (ValueError, TypeError):
        fail('Некорректная дата', 422)

def validate_lesson(db, lesson):
    if lesson.format not in ('group', 'individual') or lesson.capacity < 1 or lesson.ends_at <= lesson.starts_at:
        fail('Проверьте формат, вместимость и время занятия', 422)
    if lesson.format == 'individual' and lesson.capacity != 1:
        fail('Индивидуальное занятие рассчитано на одного клиента', 422)
    if require(db, Topic, lesson.topic_id).course_id != lesson.course_id:
        fail('Тема не принадлежит выбранному курсу', 422)
    require(db, Course, lesson.course_id)
    require(db, Teacher, lesson.teacher_id)
    conflicts = rows(db, select(Lesson).where(Lesson.id != (lesson.id or -1), Lesson.teacher_id == lesson.teacher_id,
        Lesson.status != 'cancelled', Lesson.starts_at < lesson.ends_at, Lesson.ends_at > lesson.starts_at))
    if conflicts:
        fail('У преподавателя уже есть занятие в это время')
