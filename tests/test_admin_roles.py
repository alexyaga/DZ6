from sqlalchemy import select, func
from backend.db import SessionLocal
from backend.models import User, Audit, Purchase, Memory

def test_client_cannot_promote_anyone(anna):
    assert anna.post('/api/admin/users/2/promote').status_code == 403
    assert anna.post('/api/admin/users/3/promote').status_code == 403

def test_any_admin_can_promote_and_student_data_is_preserved(admin, anna, mikhail):
    with SessionLocal() as db:
        before=[db.scalar(select(func.count()).select_from(cls).where(cls.user_id==2)) for cls in (Purchase,Memory)]
    response=admin.post('/api/admin/users/2/promote')
    assert response.status_code==200 and response.json()['role']=='admin'
    assert anna.get('/api/admin/settings').status_code==200
    assert anna.post('/api/admin/users/3/promote').status_code==200
    assert mikhail.get('/api/admin/users').status_code==200
    assert anna.get('/api/auth/me').json()['role']=='admin'
    assert all(u['role']=='admin' for u in admin.get('/api/admin/users').json())
    with SessionLocal() as db:
        assert before==[db.scalar(select(func.count()).select_from(cls).where(cls.user_id==2)) for cls in (Purchase,Memory)]
        audits=list(db.scalars(select(Audit).where(Audit.action=='promote_admin').order_by(Audit.id)))
        assert [a.actor_id for a in audits]==[1,2]
        assert db.scalar(select(func.count()).select_from(User).where(User.role_id==1))==3

def test_promotion_idempotence_and_blocked_account(admin):
    assert admin.post('/api/admin/users/2/promote').status_code==200
    assert admin.post('/api/admin/users/2/promote').status_code==200
    assert admin.post('/api/admin/users/1/promote').status_code==200
    assert admin.patch('/api/admin/users/3',json={'active':False}).status_code==200
    assert admin.post('/api/admin/users/3/promote').status_code==409
    assert admin.post('/api/admin/users/9999/promote').status_code==404
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(Audit).where(Audit.action=='promote_admin'))==1
        assert db.get(User,3).role_id==2

def test_promotion_requires_csrf(admin):
    admin.headers['x-csrf-token']='invalid'
    assert admin.post('/api/admin/users/2/promote').status_code==403
