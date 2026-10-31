import json
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from types import SimpleNamespace

from fastapi.testclient import TestClient
from sqlalchemy import select, func
from backend.db import SessionLocal, now, trace_context
from backend.main import app
from backend.models import *
from backend.seed import seed
from backend.services import balance, purchase, prepare_action, book
from backend import agent

def proposal(client, kind, target):
    r = client.post('/api/actions', json={'kind': kind, 'target_id': target})
    assert r.status_code == 200, r.text
    return r.json()['id']

def confirm(client, action):
    return client.post(f'/api/actions/{action}/decision', json={'confirm': True})

def test_registration_and_role_injection():
    c = TestClient(app, headers={'origin': 'http://127.0.0.1:8000'})
    assert c.post('/api/auth/register', json={'login':'newbie','password':'Password123','name':'Тест','role_id':1}).status_code == 422
    r = c.post('/api/auth/register', json={'login':'newbie','password':'Password123','name':'Тест'})
    assert r.status_code == 200 and r.json()['role'] == 'client'
    assert c.post('/api/auth/register', json={'login':'newbie','password':'Password123','name':'Тест'}).status_code == 409

def test_auth_origin_csrf_and_admin_protection(anna):
    assert anna.get('/api/admin/users').status_code == 403
    anna.headers['origin'] = 'http://evil.test'
    assert anna.post('/api/conversations').status_code == 403
    anna.headers['origin'] = 'http://127.0.0.1:8000'
    anna.headers['x-csrf-token'] = 'wrong'
    assert anna.post('/api/conversations').status_code == 403

def test_private_conversations_actions_and_memories(anna, mikhail):
    c = mikhail.get('/api/conversations').json()[0]
    assert anna.get('/api/conversations/'+str(c['id'])).status_code == 404
    assert anna.delete('/api/conversations/'+str(c['id'])).status_code == 404
    memory = mikhail.get('/api/me/memories').json()[0]
    assert anna.delete('/api/me/memories/'+str(memory['id'])).status_code == 404
    action = proposal(mikhail, 'buy_plan', 1)
    assert confirm(anna, action).status_code == 404

def test_seed_balances_history_idempotence(anna, mikhail):
    a = anna.get('/api/me/learning').json()
    m = mikhail.get('/api/me/learning').json()
    assert [a['subscriptions'][0][k] for k in ('available','reserved','used')] == [3,2,3]
    assert [m['subscriptions'][0][k] for k in ('available','reserved','used')] == [2,1,2]
    assert len(anna.get('/api/conversations').json()) == 2
    assert next(e for e in a['enrollments'] if e['course_id'] == 1)['progress'] == 100
    with SessionLocal() as db:
        counts = [db.scalar(select(func.count()).select_from(cls)) for cls in (User, Purchase, Lesson)]
    seed()
    with SessionLocal() as db:
        assert counts == [db.scalar(select(func.count()).select_from(cls)) for cls in (User, Purchase, Lesson)]

def test_purchase_confirmation_and_idempotence(anna):
    before = len(anna.get('/api/me/learning').json()['purchases'])
    action = proposal(anna, 'buy_plan', 2)
    assert len(anna.get('/api/me/learning').json()['purchases']) == before
    assert confirm(anna, action).status_code == 200
    assert confirm(anna, action).status_code == 200
    assert len(anna.get('/api/me/learning').json()['purchases']) == before + 1

def test_booking_reserve_cancel_and_duplicate(anna):
    lesson = next(l for l in anna.get('/api/catalog/all').json()['lessons'] if l['course_id'] == 1 and l['format'] == 'group')
    action = proposal(anna, 'book', lesson['id'])
    assert confirm(anna, action).status_code == 200
    assert confirm(anna, proposal(anna, 'book', lesson['id'])).status_code == 409
    learning = anna.get('/api/me/learning').json()
    assert learning['subscriptions'][0]['available'] == 2
    booking = next(b for b in learning['bookings'] if b['lesson_id'] == lesson['id'])
    assert confirm(anna, proposal(anna, 'cancel', booking['id'])).status_code == 200
    assert anna.get('/api/me/learning').json()['subscriptions'][0]['available'] == 3

def test_wrong_format_and_no_balance(anna):
    lesson = next(l for l in anna.get('/api/catalog/all').json()['lessons'] if l['format'] == 'individual')
    assert confirm(anna, proposal(anna, 'book', lesson['id'])).status_code == 409

def test_attendance_absence_and_progress(admin, anna):
    info = anna.get('/api/me/learning').json()
    booking = next(b for b in info['bookings'] if b['status'] == 'reserved')
    assert admin.patch('/api/admin/bookings/'+str(booking['id']), json={'status':'attended'}).status_code == 409
    with SessionLocal() as db:
        l = db.get(Lesson, booking['lesson_id'])
        l.starts_at = now() - timedelta(hours=2)
        l.ends_at = now() - timedelta(hours=1)
        db.commit()
    assert admin.patch('/api/admin/bookings/'+str(booking['id']), json={'status':'attended'}).status_code == 200
    assert admin.patch('/api/admin/bookings/'+str(booking['id']), json={'status':'attended'}).status_code == 200
    s = anna.get('/api/me/learning').json()['subscriptions'][0]
    assert (s['used'],s['reserved'],s['available']) == (4,1,3)

def test_school_cancel_and_single_reuse(admin, anna):
    lessons = [l for l in anna.get('/api/catalog/all').json()['lessons'] if l['course_id'] == 1 and l['format'] == 'individual']
    first, second = lessons[:2]
    assert confirm(anna, proposal(anna, 'buy_lesson', first['id'])).status_code == 200
    assert confirm(anna, proposal(anna, 'book', first['id'])).status_code == 200
    assert admin.patch('/api/admin/lessons/'+str(first['id']), json={'status':'cancelled'}).status_code == 200
    assert confirm(anna, proposal(anna, 'book', second['id'])).status_code == 200

def test_last_place_concurrent_clients(anna, mikhail):
    lesson = next(l for l in anna.get('/api/catalog/all').json()['lessons'] if l['course_id'] == 3 and l['format'] == 'individual')
    assert confirm(anna, proposal(anna, 'buy_plan', 2)).status_code == 200
    actions = [(anna,proposal(anna,'book',lesson['id'])),(mikhail,proposal(mikhail,'book',lesson['id']))]
    with ThreadPoolExecutor(max_workers=2) as pool:
        codes = list(pool.map(lambda p: confirm(*p).status_code, actions))
    assert sorted(codes) == [200,409]

def test_teacher_and_client_overlap(admin, anna):
    lesson = next(l for l in anna.get('/api/catalog/all').json()['lessons'] if l['course_id']==1 and l['format']=='group')
    payload = {k: lesson[k] for k in ('course_id','topic_id','teacher_id','starts_at','ends_at','format','price','capacity')}
    assert admin.post('/api/admin/lessons', json=payload).status_code == 409
    # Different teacher, same time: valid school schedule but invalid student overlap.
    payload['teacher_id'] = 3
    r = admin.post('/api/admin/lessons', json=payload)
    assert r.status_code == 200, r.text
    assert confirm(anna,proposal(anna,'book',lesson['id'])).status_code == 200
    assert confirm(anna,proposal(anna,'book',r.json()['id'])).status_code == 409

def test_admin_block_adjust_progress_archive(admin, anna):
    assert admin.post('/api/admin/subscriptions/1/adjust', json={'amount':2,'reason':''}).status_code == 422
    assert admin.post('/api/admin/subscriptions/1/adjust', json={'amount':-100,'reason':'Ошибка'}).status_code == 409
    assert admin.post('/api/admin/subscriptions/1/adjust', json={'amount':2,'reason':'Бонус'}).status_code == 200
    assert anna.get('/api/me/learning').json()['subscriptions'][0]['available'] == 5
    assert admin.delete('/api/admin/courses/1').status_code == 200
    assert all(c['id'] != 1 for c in anna.get('/api/catalog/all').json()['courses'])
    assert admin.patch('/api/admin/users/2', json={'role_id':1}).status_code == 422
    assert admin.patch('/api/admin/users/2', json={'active':False}).status_code == 200
    assert anna.get('/api/me/learning').status_code == 401

def test_admin_settings_are_read_only_and_do_not_disclose_key(admin):
    settings = admin.get('/api/admin/settings')
    assert settings.status_code == 200
    assert 'api_key' not in settings.json()
    assert admin.put('/api/admin/settings', json={'api_key': 'secret-test-key'}).status_code == 405


def test_vercel_same_origin_and_secure_session(monkeypatch):
    monkeypatch.setenv('VERCEL', '1')
    client = TestClient(app, base_url='https://dz6.vercel.app',
                        headers={'origin': 'https://dz6.vercel.app'})
    login = client.post('/api/auth/login', json={'login': 'anna', 'password': 'AnnaDemo!2026'})
    assert login.status_code == 200
    assert 'secure' in login.headers['set-cookie'].lower()
    client.headers['x-csrf-token'] = login.json()['csrf']
    assert client.post('/api/conversations').status_code == 200
    client.headers['origin'] = 'https://other.vercel.app'
    assert client.post('/api/conversations').status_code == 403


def test_only_stale_processing_message_is_recoverable(anna):
    cid = anna.post('/api/conversations').json()['id']
    with SessionLocal() as db:
        db.add_all([
            Message(conversation_id=cid, role='user', content='старый', status='processing',
                    created_at=now() - timedelta(minutes=11)),
            Message(conversation_id=cid, role='user', content='новый', status='processing'),
        ])
        db.commit()
    messages = anna.get(f'/api/conversations/{cid}').json()['messages']
    assert [message['status'] for message in messages] == ['error', 'processing']

class FakeResponses:
    def __init__(self, calls, final='Вот данные вашего обучения.'):
        self.calls = calls
        self.inputs = []
        self.final = final
    def create(self, **kwargs):
        self.inputs.append(kwargs)
        if len(self.inputs) == 1:
            return SimpleNamespace(output=[SimpleNamespace(type='function_call',name=name,arguments=json.dumps(args),call_id=str(i)) for i,(name,args) in enumerate(self.calls)], output_text='')
        return SimpleNamespace(output=[], output_text=self.final)

def fake_agent(monkeypatch, calls):
    responses = FakeResponses(calls)
    monkeypatch.setattr(agent, 'client_for', lambda db: (SimpleNamespace(responses=responses),'fake-model'))
    return responses

def test_agent_tools_real_sql_and_persistence(anna, monkeypatch):
    fake_agent(monkeypatch,[('get_my_learning',{}),('remember_fact',{'category':'level','content':'Начинающий','quote':'Я начинающий'})])
    conv = anna.post('/api/conversations').json()['id']
    r = anna.post(f'/api/conversations/{conv}/messages',json={'content':'Я начинающий. Сколько занятий осталось?'})
    assert r.json()['ok'], r.text
    saved = anna.get('/api/conversations/'+str(conv)).json()['messages']
    assert len(saved) == 2 and saved[1]['traces']
    assert any(t['row_count'] > 0 for t in saved[1]['traces'])
    assert all('app_settings' not in t['sql'] and 'password' not in t['sql'] for t in saved[1]['traces'])
    assert any(m['category'] == 'level' for m in anna.get('/api/me/memories').json())

def test_agent_confirmation_sql_trace(anna,monkeypatch):
    fake_agent(monkeypatch,[('propose_action',{'kind':'buy_plan','target_id':2})])
    conv = anna.post('/api/conversations').json()['id']
    anna.post(f'/api/conversations/{conv}/messages',json={'content':'Хочу индивидуальный пакет'})
    saved = anna.get('/api/conversations/'+str(conv)).json()['messages'][-1]
    assert len(saved['actions']) == 1
    assert confirm(anna,saved['actions'][0]['id']).status_code == 200
    saved = anna.get('/api/conversations/'+str(conv)).json()['messages'][-1]
    assert any('INSERT INTO purchases' in t['sql'] for t in saved['traces'])

def test_deleted_memory_not_resurrected(anna,monkeypatch):
    memory = next(m for m in anna.get('/api/me/memories').json() if m['category']=='goal')
    assert anna.delete('/api/me/memories/'+str(memory['id'])).status_code == 200
    response = fake_agent(monkeypatch,[('remember_fact',{'category':'goal','content':memory['content'],'quote':'Привет'})])
    conv = anna.post('/api/conversations').json()['id']
    anna.post(f'/api/conversations/{conv}/messages',json={'content':'Привет'})
    assert memory['content'] not in response.inputs[0]['instructions']
    assert all(m['category']!='goal' for m in anna.get('/api/me/memories').json())

def test_api_error_preserves_message_and_retry(anna,monkeypatch):
    conv = anna.post('/api/conversations').json()['id']
    r = anna.post(f'/api/conversations/{conv}/messages',json={'content':'Покажи расписание'})
    assert not r.json()['ok']
    msgs = anna.get('/api/conversations/'+str(conv)).json()['messages']
    assert len(msgs)==1 and msgs[0]['status']=='error'
    fake_agent(monkeypatch, [('get_catalog',{})])
    retried = anna.post(f'/api/conversations/{conv}/messages/{msgs[0]["id"]}/retry')
    assert retried.json()['ok']
    assert len(anna.get('/api/conversations/'+str(conv)).json()['messages'])==2
    assert anna.post(f'/api/conversations/{conv}/messages/{msgs[0]["id"]}/retry').status_code == 409

def test_memory_edit_and_dialogue_delete_foreign_keys(anna):
    memory = anna.get('/api/me/memories').json()[0]
    assert anna.patch('/api/me/memories/'+str(memory['id']),json={'category':memory['category'],'content':'Новое предпочтение'}).status_code == 200
    with SessionLocal() as db:
        source = db.get(Message,memory['source_message_id'])
        cid = source.conversation_id
    assert anna.delete('/api/conversations/'+str(cid)).status_code == 200
    assert anna.get('/api/conversations/'+str(cid)).status_code == 404

def test_deleted_fact_not_used_from_paraphrased_old_answer(anna,monkeypatch):
    memory = anna.get('/api/me/memories').json()[0]
    with SessionLocal() as db:
        source = db.get(Message,memory['source_message_id'])
        cid = source.conversation_id
        db.add(Message(conversation_id=cid,role='assistant',content='Секретный пересказ прежнего предпочтения'))
        db.commit()
    anna.delete('/api/me/memories/'+str(memory['id']))
    fake = fake_agent(monkeypatch, [])
    anna.post(f'/api/conversations/{cid}/messages',json={'content':'Продолжим'})
    assert 'Секретный пересказ' not in str(fake.inputs[0]['input'])

def test_agent_failure_rolls_back_tools(anna,monkeypatch):
    class Broken(FakeResponses):
        def create(self,**kwargs):
            if self.inputs:
                raise RuntimeError('provider failed')
            return super().create(**kwargs)
    responses = Broken([('propose_action',{'kind':'buy_plan','target_id':1}),('remember_fact',{'category':'level','content':'Начинающий','quote':'Начинающий'})])
    monkeypatch.setattr(agent,'client_for',lambda db:(SimpleNamespace(responses=responses),'fake'))
    cid = anna.post('/api/conversations').json()['id']
    assert not anna.post(f'/api/conversations/{cid}/messages',json={'content':'Начинающий'}).json()['ok']
    assert all(m['category']!='level' for m in anna.get('/api/me/memories').json())
    with SessionLocal() as db:
        assert not db.scalar(select(PendingAction).where(PendingAction.message_id.is_not(None)))

def test_absence_and_late_cancel(anna,admin):
    booking=next(b for b in anna.get('/api/me/learning').json()['bookings'] if b['status']=='reserved')
    with SessionLocal() as db:
        lesson=db.get(Lesson,booking['lesson_id'])
        lesson.starts_at=now()-timedelta(hours=2)
        lesson.ends_at=now()-timedelta(hours=1)
        db.commit()
    assert confirm(anna,proposal(anna,'cancel',booking['id'])).status_code == 409
    assert admin.patch('/api/admin/bookings/'+str(booking['id']),json={'status':'absent'}).status_code == 200
    assert anna.get('/api/me/learning').json()['subscriptions'][0]['used'] == 4

def test_balance_exhaustion_and_admin_reschedule(anna,admin):
    booking=next(b for b in anna.get('/api/me/learning').json()['bookings'] if b['status']=='reserved')
    lesson=next(l for l in anna.get('/api/catalog/all').json()['lessons'] if l['course_id']==1 and l['format']=='group')
    assert admin.patch('/api/admin/bookings/'+str(booking['id']),json={'lesson_id':lesson['id']}).status_code == 200
    assert admin.post('/api/admin/subscriptions/1/adjust',json={'amount':-3,'reason':'Коррекция'}).status_code == 200
    other=next(l for l in anna.get('/api/catalog/all').json()['lessons'] if l['course_id']==3 and l['format']=='group')
    assert confirm(anna,proposal(anna,'book',other['id'])).status_code == 409

def test_real_settings_flow_with_mock_provider(admin,monkeypatch):
    from backend import main, config
    monkeypatch.setattr(main, 'OPENAI_API_KEY', 'fake-key')
    monkeypatch.setattr(main, 'OPENAI_MODEL', 'test-model')
    monkeypatch.setattr(config, 'OPENAI_API_KEY', 'fake-key')
    monkeypatch.setattr(config, 'OPENAI_MODEL', 'test-model')
    monkeypatch.setattr(main,'OpenAI',lambda **kw:SimpleNamespace(models=SimpleNamespace(list=lambda:[SimpleNamespace(id='test-model')]),responses=FakeResponses([('get_catalog',{})])))
    assert admin.get('/api/admin/settings').json()['model'] == 'test-model'
    assert admin.get('/api/admin/models').json()==['test-model']
    assert admin.post('/api/admin/settings/test').json()['ok']
    assert admin.get('/api/admin/settings').json()['verified']
    assert admin.put('/api/admin/settings',json={'model':'another-model'}).status_code == 405

def test_new_topic_recalculates_completed_course(admin,anna):
    assert admin.post('/api/admin/topics',json={'course_id':1,'title':'Новая тема','position':3}).status_code == 200
    enrollment=next(e for e in anna.get('/api/me/learning').json()['enrollments'] if e['course_id']==1)
    assert enrollment['status']=='studying' and enrollment['progress']==67

def test_changed_offer_requires_new_confirmation(admin,anna):
    action=proposal(anna,'buy_plan',1)
    assert admin.patch('/api/admin/plans/1',json={'price':1100000}).status_code == 200
    assert confirm(anna,action).status_code == 409

def group_lesson(client):
    return next(l for l in client.get('/api/catalog/all').json()['lessons'] if l['course_id']==3 and l['format']=='group' and l['topic_title']=='Устройство компьютера')

def agent_booking_offer(client, lesson, monkeypatch):
    fake=fake_agent(monkeypatch,[('propose_action',{'kind':'book','target_id':lesson['id']})])
    cid=client.post('/api/conversations').json()['id']
    response=client.post(f'/api/conversations/{cid}/messages',json={'content':'Запиши меня на это групповое занятие'})
    assert response.json()['ok'],response.text
    content=client.get('/api/conversations/'+str(cid)).json()
    output=next(i for i in fake.inputs[1]['input'] if isinstance(i,dict) and i.get('type')=='function_call_output')
    return cid,content['messages'][-1],json.loads(output['output'])

def test_mentor_offers_single_and_matching_package_before_booking(mikhail,monkeypatch):
    lesson=group_lesson(mikhail)
    _,message,result=agent_booking_offer(mikhail,lesson,monkeypatch)
    assert result['requires_purchase'] and not result['can_book']
    assert 'групповые' in result['reason']
    assert {a['kind'] for a in message['actions']}=={'buy_lesson','buy_plan'}
    assert next(o for o in result['options'] if o['kind']=='buy_plan')['quantity']==8
    assert next(o for o in result['options'] if o['kind']=='buy_lesson')['price']==lesson['price']
    assert mikhail.get('/api/me/learning').json()['subscriptions'][0]['available']==2

def test_mentor_purchase_choice_then_separate_booking_confirmation(mikhail,monkeypatch):
    lesson=group_lesson(mikhail)
    cid,message,_=agent_booking_offer(mikhail,lesson,monkeypatch)
    single=next(a for a in message['actions'] if a['kind']=='buy_lesson')
    package=next(a for a in message['actions'] if a['kind']=='buy_plan')
    before=len(mikhail.get('/api/me/learning').json()['purchases'])
    assert confirm(mikhail,single['id']).status_code==200
    assert confirm(mikhail,single['id']).status_code==200
    assert confirm(mikhail,package['id']).json()['status']=='cancelled'
    learning=mikhail.get('/api/me/learning').json()
    assert len(learning['purchases'])==before+1
    assert not any(b['lesson_id']==lesson['id'] for b in learning['bookings'])
    actions=mikhail.get('/api/conversations/'+str(cid)).json()['messages'][-1]['actions']
    booking=next(a for a in actions if a['kind']=='book' and a['status']=='pending')
    assert confirm(mikhail,booking['id']).status_code==200
    assert confirm(mikhail,booking['id']).status_code==200
    learning=mikhail.get('/api/me/learning').json()
    assert len([b for b in learning['bookings'] if b['lesson_id']==lesson['id']])==1
    assert learning['subscriptions'][0]['available']==2

def test_mentor_package_purchase_also_prepares_booking(mikhail,monkeypatch):
    lesson=group_lesson(mikhail)
    cid,message,_=agent_booking_offer(mikhail,lesson,monkeypatch)
    package=next(a for a in message['actions'] if a['kind']=='buy_plan')
    assert confirm(mikhail,package['id']).status_code==200
    actions=mikhail.get('/api/conversations/'+str(cid)).json()['messages'][-1]['actions']
    assert next(a for a in actions if a['kind']=='buy_lesson')['status']=='cancelled'
    booking=next(a for a in actions if a['kind']=='book')
    assert confirm(mikhail,booking['id']).status_code==200
    group=next(s for s in mikhail.get('/api/me/learning').json()['subscriptions'] if s['format']=='group')
    assert (group['available'],group['reserved'])==(7,1)

def test_mentor_does_not_sell_again_when_payment_exists(mikhail,monkeypatch):
    lesson=group_lesson(mikhail)
    assert confirm(mikhail,proposal(mikhail,'buy_lesson',lesson['id'])).status_code==200
    _,message,result=agent_booking_offer(mikhail,lesson,monkeypatch)
    assert result['can_book'] and [a['kind'] for a in message['actions']]==['book']

def test_mentor_explains_exhausted_package(anna,admin,monkeypatch):
    assert admin.post('/api/admin/subscriptions/1/adjust',json={'amount':-3,'reason':'Тест остатка'}).status_code==200
    _,message,result=agent_booking_offer(anna,group_lesson(anna),monkeypatch)
    assert 'нет доступного остатка' in result['reason']
    assert all(a['kind']!='book' for a in message['actions'])

def test_old_chat_booking_card_changes_to_purchase_choices(mikhail):
    lesson=group_lesson(mikhail)
    with SessionLocal() as db:
        conversation=db.scalar(select(Conversation).where(Conversation.user_id==3))
        message=Message(conversation_id=conversation.id,role='assistant',content='Подтвердите запись')
        db.add(message);db.flush()
        action=prepare_action(db,3,'book',lesson['id'],message.id)
        ident=action.id;mid=message.id;cid=conversation.id
        db.commit()
    response=confirm(mikhail,ident)
    assert response.status_code==200 and response.json()['status']=='cancelled'
    message=next(m for m in mikhail.get('/api/conversations/'+str(cid)).json()['messages'] if m['id']==mid)
    assert {a['kind'] for a in message['actions'] if a['status']=='pending'}=={'buy_lesson','buy_plan'}

def test_repeated_tool_call_does_not_duplicate_purchase_choices(mikhail,monkeypatch):
    lesson=group_lesson(mikhail)
    fake_agent(monkeypatch,[('propose_action',{'kind':'book','target_id':lesson['id']}),
                           ('propose_action',{'kind':'buy_plan','target_id':1}),
                           ('propose_action',{'kind':'buy_lesson','target_id':lesson['id']})])
    cid=mikhail.post('/api/conversations').json()['id']
    assert mikhail.post(f'/api/conversations/{cid}/messages',json={'content':'Запиши на занятие'}).json()['ok']
    actions=mikhail.get('/api/conversations/'+str(cid)).json()['messages'][-1]['actions']
    assert len(actions)==2
    assert all(json.loads(a['payload'])['booking_lesson_id']==lesson['id'] for a in actions)
