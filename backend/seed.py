from datetime import timedelta
from sqlalchemy import select
from .db import SessionLocal, now
from .models import *
from .security import hasher
from .services import purchase, book, attendance, ensure_enrollment, update_progress, save_memory

def seed():
    with SessionLocal() as db:
        # Одна атомарная первоначальная загрузка; существующая база никогда не перезаписывается.
        db.connection().exec_driver_sql('BEGIN IMMEDIATE')
        if db.get(Role, 1):
            db.rollback()
            return
        db.add_all([Role(id=1, name='admin'), Role(id=2, name='client')])
        db.flush()
        for login, password, name, role in [('admin', 'AdminDemo!2026', 'Администратор', 1), ('anna', 'AnnaDemo!2026', 'Анна Смирнова', 2), ('mikhail', 'MikhailDemo!2026', 'Михаил Волков', 2)]:
            u = User(login=login, password_hash=hasher.hash(password), role_id=role)
            db.add(u)
            db.flush()
            db.add(Profile(user_id=u.id, name=name, email=f'{login}@example.test'))
        courses = [
            ('Основы Python', 'От первой строки кода до собственного приложения. Практика, понятные примеры и поддержка преподавателя.', 'Разработка', 1290000, ['Переменные и типы', 'Функции и коллекции']),
            ('SQL и базы данных', 'Научитесь задавать правильные вопросы данным: запросы, связи и аналитика на реальных задачах.', 'Аналитика', 1490000, ['SELECT и фильтрация', 'Связи и JOIN', 'Группировка и агрегаты', 'Проектирование БД']),
            ('IT Support', 'Компьютеры, сети и диагностика. Соберите уверенную базу для старта карьеры в IT.', 'Инфраструктура', 990000, ['Устройство компьютера', 'Сети и диагностика']),
            ('Веб-разработка', 'Создавайте современные интерфейсы: от HTML и CSS до интерактивных приложений.', 'Разработка', 1690000, ['HTML и семантика', 'CSS и адаптивность', 'JavaScript', 'React и компоненты'])]
        for title, description, direction, price, topics in courses:
            c = Course(title=title, description=description, direction=direction, price=price)
            db.add(c)
            db.flush()
            for pos, title in enumerate(topics, 1):
                db.add(Topic(course_id=c.id, title=title, position=pos))
        teachers = [('Алексей Морозов', 'Python · SQL', 'Backend-разработчик, 8 лет практики. Объясняет сложное на простых примерах.'),
                    ('Елена Соколова', 'Frontend · React', 'Frontend-разработчик. Помогает превратить идеи в работающие интерфейсы.'),
                    ('Дмитрий Ким', 'Сети · IT Support', 'Системный инженер. Практический подход к инфраструктуре и диагностике.')]
        for name, specialization, description in teachers:
            db.add(Teacher(name=name, specialization=specialization, description=description))
        db.flush()
        for teacher, course in [(1, 1), (1, 2), (2, 4), (3, 3)]:
            db.add(TeacherCourse(teacher_id=teacher, course_id=course))
        db.add_all([Plan(title='Групповой старт · 8 занятий', format='group', quantity=8, price=960000),
                    Plan(title='Личный трек · 5 занятий', format='individual', quantity=5, price=1250000)])
        db.flush()
        base = now().replace(hour=16, minute=0, second=0, microsecond=0)
        # Будущее расписание: четыре недели, оба формата, каждый курс.
        for week in range(4):
            for course_id in range(1, 5):
                topics = list(db.scalars(select(Topic).where(Topic.course_id == course_id).order_by(Topic.position)))
                teacher_id = {1: 1, 2: 1, 3: 3, 4: 2}[course_id]
                for fmt, hour in [('group', 16), ('individual', 18)]:
                    start = (base + timedelta(days=2 + week * 7 + course_id)).replace(hour=hour)
                    if course_id == 4 and fmt == 'individual':
                        start = (base + timedelta(days=((5 - base.weekday()) % 7 or 7) + week * 7)).replace(hour=hour)
                    db.add(Lesson(course_id=course_id, topic_id=topics[week % len(topics)].id, teacher_id=teacher_id,
                                  starts_at=start, ends_at=start + timedelta(hours=1), format=fmt,
                                  capacity=8 if fmt == 'group' else 1, price=150000 if fmt == 'group' else 300000))
        db.flush()
        for uid, finished, current, plan_id, count, fmt in [(2, 1, 2, 1, 3, 'group'), (3, 3, 4, 2, 2, 'individual')]:
            purchase(db, uid, 'course', finished)
            purchase(db, uid, 'course', current)
            purchase(db, uid, 'plan', plan_id)
            for p in db.scalars(select(Purchase).where(Purchase.user_id == uid)):
                p.created_at = base - timedelta(days=50 if p.course_id == finished else 22)
            for s in db.scalars(select(Subscription).where(Subscription.user_id == uid)):
                s.created_at = base - timedelta(days=22)
            for enrollment in db.scalars(select(Enrollment).where(Enrollment.user_id == uid)):
                enrollment.started_at = base - timedelta(days=50 if enrollment.course_id == finished else 22)
            # Завершённый курс: реальные посещения через отдельные разовые покупки.
            for index, topic in enumerate(db.scalars(select(Topic).where(Topic.course_id == finished))):
                start = base - timedelta(days=40 - index * 7)
                l = Lesson(course_id=finished, topic_id=topic.id, teacher_id=1 if finished == 1 else 3,
                           starts_at=start + timedelta(days=90), ends_at=start + timedelta(days=90, hours=1), format=fmt, capacity=1, price=150000)
                db.add(l)
                db.flush()
                purchase(db, uid, 'lesson', l.id)
                # Явно используем разовую покупку для истории завершённого курса.
                single = db.scalar(select(Purchase).where(Purchase.user_id == uid, Purchase.lesson_id == l.id))
                single.created_at = start - timedelta(days=1)
                b = Booking(user_id=uid, lesson_id=l.id, purchase_id=single.id)
                db.add(b)
                db.flush()
                single.status = 'reserved'
                l.starts_at = start
                l.ends_at = start + timedelta(hours=1)
                attendance(db, b.id, 'attended')
                b.created_at = start - timedelta(days=1)
            current_topics = list(db.scalars(select(Topic).where(Topic.course_id == current)))
            for index in range(count):
                start = base + timedelta(days=100 + index)
                l = Lesson(course_id=current, topic_id=current_topics[index % len(current_topics)].id,
                           teacher_id=1 if current == 2 else 2, starts_at=start, ends_at=start + timedelta(hours=1), format=fmt,
                           capacity=8 if fmt == 'group' else 1, price=150000)
                db.add(l)
                db.flush()
                book(db, uid, l.id)
                l.starts_at = base - timedelta(days=14 - index * 3)
                l.ends_at = l.starts_at + timedelta(hours=1)
                db.flush()
                b = db.scalar(select(Booking).where(Booking.user_id == uid, Booking.lesson_id == l.id))
                attendance(db, b.id, 'attended')
                b.created_at = l.starts_at - timedelta(days=1)
            future = list(db.scalars(select(Lesson).where(Lesson.course_id == current, Lesson.format == fmt, Lesson.status == 'scheduled').order_by(Lesson.starts_at)))
            for l in future[:2 if uid == 2 else 1]:
                book(db, uid, l.id)
            preferences = [('time', 'Мне удобнее заниматься в будни после 19:00'), ('goal', 'Хочу стать аналитиком данных')] if uid == 2 else [('time', 'Предпочитаю заниматься по выходным'), ('goal', 'Хочу найти первую работу в IT')]
            for index in range(2):
                conv = Conversation(user_id=uid, title=['Мой учебный маршрут', 'Планы и расписание'][index])
                db.add(conv)
                db.flush()
                category, fact = preferences[index]
                m = Message(conversation_id=conv.id, role='user', content=fact)
                db.add(m)
                db.flush()
                save_memory(db, uid, category, fact, m.id)
                db.add(Message(conversation_id=conv.id, role='assistant', content='Сохранил ваше предпочтение. Учту его при подборе занятий. Текущие записи и остаток пакета доступны в личном кабинете.'))
        db.commit()

if __name__ == '__main__':
    seed()
