from datetime import datetime
from sqlalchemy import String, Text, Integer, Boolean, DateTime, ForeignKey, UniqueConstraint, Index, text
from sqlalchemy.orm import Mapped, mapped_column
from .db import Base, now

class Role(Base):
    __tablename__ = 'roles'
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(20), unique=True)

class User(Base):
    __tablename__ = 'users'
    id: Mapped[int] = mapped_column(primary_key=True)
    login: Mapped[str] = mapped_column(String(80), unique=True)
    password_hash: Mapped[str] = mapped_column(Text)
    role_id: Mapped[int] = mapped_column(ForeignKey('roles.id'))
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)

class Profile(Base):
    __tablename__ = 'user_profiles'
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(200), default='')
    phone: Mapped[str] = mapped_column(String(50), default='')

class LoginSession(Base):
    __tablename__ = 'sessions'
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'))
    csrf: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[datetime] = mapped_column(DateTime)

class Course(Base):
    __tablename__ = 'courses'
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(180))
    description: Mapped[str] = mapped_column(Text, default='')
    direction: Mapped[str] = mapped_column(String(80), default='Программирование')
    level: Mapped[str] = mapped_column(String(80), default='Начинающий')
    price: Mapped[int] = mapped_column(Integer, default=0)
    active: Mapped[bool] = mapped_column(Boolean, default=True)

class Topic(Base):
    __tablename__ = 'course_topics'
    id: Mapped[int] = mapped_column(primary_key=True)
    course_id: Mapped[int] = mapped_column(ForeignKey('courses.id'))
    title: Mapped[str] = mapped_column(String(180))
    position: Mapped[int] = mapped_column(Integer, default=1)

class Teacher(Base):
    __tablename__ = 'teachers'
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    specialization: Mapped[str] = mapped_column(String(180))
    description: Mapped[str] = mapped_column(Text, default='')
    active: Mapped[bool] = mapped_column(Boolean, default=True)

class TeacherCourse(Base):
    __tablename__ = 'teacher_courses'
    id: Mapped[int] = mapped_column(primary_key=True)
    teacher_id: Mapped[int] = mapped_column(ForeignKey('teachers.id'))
    course_id: Mapped[int] = mapped_column(ForeignKey('courses.id'))
    __table_args__ = (UniqueConstraint('teacher_id', 'course_id'),)

class Lesson(Base):
    __tablename__ = 'lessons'
    id: Mapped[int] = mapped_column(primary_key=True)
    course_id: Mapped[int] = mapped_column(ForeignKey('courses.id'))
    topic_id: Mapped[int] = mapped_column(ForeignKey('course_topics.id'))
    teacher_id: Mapped[int] = mapped_column(ForeignKey('teachers.id'))
    starts_at: Mapped[datetime] = mapped_column(DateTime)
    ends_at: Mapped[datetime] = mapped_column(DateTime)
    format: Mapped[str] = mapped_column(String(20), default='group')
    price: Mapped[int] = mapped_column(Integer, default=150000)
    capacity: Mapped[int] = mapped_column(Integer, default=8)
    status: Mapped[str] = mapped_column(String(20), default='scheduled')

class Plan(Base):
    __tablename__ = 'subscription_plans'
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(150))
    format: Mapped[str] = mapped_column(String(20))
    quantity: Mapped[int] = mapped_column(Integer)
    price: Mapped[int] = mapped_column(Integer)
    active: Mapped[bool] = mapped_column(Boolean, default=True)

class Purchase(Base):
    __tablename__ = 'purchases'
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'), index=True)
    kind: Mapped[str] = mapped_column(String(20))
    course_id: Mapped[int | None] = mapped_column(ForeignKey('courses.id'))
    lesson_id: Mapped[int | None] = mapped_column(ForeignKey('lessons.id'))
    plan_id: Mapped[int | None] = mapped_column(ForeignKey('subscription_plans.id'))
    price: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(20), default='completed')
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)

class Subscription(Base):
    __tablename__ = 'user_subscriptions'
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'), index=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey('subscription_plans.id'))
    purchase_id: Mapped[int] = mapped_column(ForeignKey('purchases.id'), unique=True)
    format: Mapped[str] = mapped_column(String(20))
    quantity: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)

class Booking(Base):
    __tablename__ = 'bookings'
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'), index=True)
    lesson_id: Mapped[int] = mapped_column(ForeignKey('lessons.id'))
    subscription_id: Mapped[int | None] = mapped_column(ForeignKey('user_subscriptions.id'))
    purchase_id: Mapped[int | None] = mapped_column(ForeignKey('purchases.id'))
    status: Mapped[str] = mapped_column(String(20), default='reserved')
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    __table_args__ = (Index('unique_live_booking', 'user_id', 'lesson_id', unique=True, sqlite_where=text("status != 'cancelled'")),)

class Operation(Base):
    __tablename__ = 'subscription_operations'
    id: Mapped[int] = mapped_column(primary_key=True)
    subscription_id: Mapped[int] = mapped_column(ForeignKey('user_subscriptions.id'), index=True)
    booking_id: Mapped[int | None] = mapped_column(ForeignKey('bookings.id'))
    kind: Mapped[str] = mapped_column(String(20))
    amount: Mapped[int] = mapped_column(Integer, default=1)
    reason: Mapped[str] = mapped_column(Text, default='')
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)

class Enrollment(Base):
    __tablename__ = 'course_enrollments'
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'))
    course_id: Mapped[int] = mapped_column(ForeignKey('courses.id'))
    status: Mapped[str] = mapped_column(String(20), default='studying')
    started_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime)
    __table_args__ = (UniqueConstraint('user_id', 'course_id'),)

class Progress(Base):
    __tablename__ = 'topic_progress'
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'))
    topic_id: Mapped[int] = mapped_column(ForeignKey('course_topics.id'))
    completed: Mapped[bool] = mapped_column(Boolean, default=True)
    __table_args__ = (UniqueConstraint('user_id', 'topic_id'),)

class Conversation(Base):
    __tablename__ = 'conversations'
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'), index=True)
    title: Mapped[str] = mapped_column(String(180), default='Новый диалог')
    summary: Mapped[str] = mapped_column(Text, default='')
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now)

class Message(Base):
    __tablename__ = 'messages'
    id: Mapped[int] = mapped_column(primary_key=True)
    conversation_id: Mapped[int] = mapped_column(ForeignKey('conversations.id', ondelete='CASCADE'), index=True)
    role: Mapped[str] = mapped_column(String(20))
    content: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default='completed')
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)

class Memory(Base):
    __tablename__ = 'user_memories'
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'), index=True)
    category: Mapped[str] = mapped_column(String(50))
    content: Mapped[str] = mapped_column(Text)
    source_message_id: Mapped[int | None] = mapped_column(ForeignKey('messages.id', ondelete='SET NULL'))
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now)

class PendingAction(Base):
    __tablename__ = 'pending_actions'
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'), index=True)
    message_id: Mapped[int | None] = mapped_column(ForeignKey('messages.id', ondelete='CASCADE'))
    kind: Mapped[str] = mapped_column(String(30))
    payload: Mapped[str] = mapped_column(Text)
    description: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default='pending')
    result: Mapped[str] = mapped_column(Text, default='')
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)

class SqlTrace(Base):
    __tablename__ = 'sql_traces'
    id: Mapped[int] = mapped_column(primary_key=True)
    message_id: Mapped[int] = mapped_column(ForeignKey('messages.id', ondelete='CASCADE'), index=True)
    sql: Mapped[str] = mapped_column(Text)
    parameters: Mapped[str] = mapped_column(Text)
    row_count: Mapped[int] = mapped_column(Integer)
    purpose: Mapped[str] = mapped_column(String(200))

class Audit(Base):
    __tablename__ = 'audit_events'
    id: Mapped[int] = mapped_column(primary_key=True)
    actor_id: Mapped[int] = mapped_column(ForeignKey('users.id'))
    action: Mapped[str] = mapped_column(String(100))
    details: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
