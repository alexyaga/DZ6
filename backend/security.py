import re
import secrets
import os
from datetime import timedelta

from argon2 import PasswordHasher
from argon2.exceptions import VerificationError, InvalidHashError
from fastapi import Depends, HTTPException, Request
from sqlalchemy import select

from .db import get_db, now
from .models import User, Profile, LoginSession

hasher = PasswordHasher()

def check_credentials(login, password):
    if not re.fullmatch(r'[a-zA-Z0-9_.-]{3,80}', login):
        raise HTTPException(422, 'Логин: 3–80 латинских букв, цифр, точек, дефисов или подчёркиваний')
    if len(password) < 8 or len(password) > 200:
        raise HTTPException(422, 'Пароль должен содержать от 8 до 200 символов')

def password_matches(stored, supplied):
    try:
        return hasher.verify(stored, supplied)
    except (VerificationError, InvalidHashError):
        return False

def current_user(request: Request, db=Depends(get_db)):
    session = db.get(LoginSession, request.cookies.get('school_session', ''))
    if not session or session.expires_at < now():
        raise HTTPException(401, 'Войдите в приложение')
    user = db.get(User, session.user_id)
    if not user or not user.active:
        raise HTTPException(401, 'Учётная запись недоступна')
    if request.method not in ('GET', 'HEAD', 'OPTIONS'):
        if not secrets.compare_digest(request.headers.get('x-csrf-token', ''), session.csrf):
            raise HTTPException(403, 'Недействительный CSRF-токен. Обновите страницу')
    request.state.session = session
    return user

def admin_user(user=Depends(current_user)):
    if user.role_id != 1:
        raise HTTPException(403, 'Доступно только администратору')
    return user

def user_info(db, user):
    profile = db.scalar(select(Profile).where(Profile.user_id == user.id))
    return {'id': user.id, 'login': user.login, 'role': 'admin' if user.role_id == 1 else 'client',
            'active': user.active, 'name': profile.name, 'email': profile.email, 'phone': profile.phone}

def new_session(db, user, response):
    session = LoginSession(id=secrets.token_urlsafe(32), user_id=user.id,
                           csrf=secrets.token_urlsafe(32), expires_at=now() + timedelta(days=7))
    db.add(session)
    db.commit()
    response.set_cookie('school_session', session.id, httponly=True, samesite='strict',
                        secure=bool(os.getenv('VERCEL')), max_age=604800)
    return {**user_info(db, user), 'csrf': session.csrf}

