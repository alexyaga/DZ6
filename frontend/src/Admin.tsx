import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowUpRight,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Code2,
  Database,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Mic,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Ticket,
  Trash2,
  UserRound,
  UsersRound,
  X,
  Clock3,
  Pencil,
  Monitor,
  Layers,
  Menu,
  Square,
  AlertCircle,
} from "lucide-react";
import { api, setCsrf, money, date, fmt, status } from "./api";
import { CourseSchedule, AdminLessonTable } from "./CourseSchedule";

import {
  Modal,
  PageTitle,
  Empty,
  Badge,
  CodeIllustration,
  CourseCard,
  BookingTable,
  PurchaseTable,
  SubscriptionCard,
  TracePanel,
  categoryNames,
  courseVisuals,
  courseColors,
} from "./shared";

function AdminHome({ go, report }: any) {
  const [users, setUsers] = useState<any[]>([]),
    [lessons, setLessons] = useState<any[]>([]),
    [settings, setSettings] = useState<any>({});
  useEffect(() => {
    Promise.all([
      api("/admin/users"),
      api("/admin/lessons"),
      api("/admin/settings"),
    ])
      .then(([u, l, s]) => {
        setUsers(u);
        setLessons(l);
        setSettings(s);
      })
      .catch(report);
  }, []);
  return (
    <>
      <PageTitle
        eyebrow="УПРАВЛЕНИЕ ШКОЛОЙ"
        title="Всё начинается с хорошего обучения"
        subtitle="Помогайте студентам расти, а школе — работать слаженно."
      />
      <div className="admin-hero">
        <div>
          <span className="yellow-label">
            IT SCHOOL · ПАНЕЛЬ АДМИНИСТРАТОРА
          </span>
          <h2>
            Знания объединяют.
            <br />
            Вы задаёте направление.
          </h2>
          <p>Клиенты, преподаватели и занятия — в одном пространстве.</p>
          <button className="white-button" onClick={() => go("users")}>
            Перейти к клиентам <ArrowUpRight size={18} />
          </button>
        </div>
        <GraduationCap size={145} strokeWidth={0.8} />
      </div>
      <div className="stats-grid">
        {[
          [
            UsersRound,
            users.filter((u) => u.role === "client").length,
            "Клиентов",
          ],
          [
            CalendarDays,
            lessons.filter((l) => l.status === "scheduled").length,
            "Занятий в расписании",
          ],
          [
            ShieldCheck,
            users.filter((u) => u.active).length,
            "Активных аккаунтов",
          ],
          [
            Sparkles,
            settings.verified ? "Готов" : "Не настроен",
            "AI-наставник",
          ],
        ].map(([Icon, n, t]: any) => (
          <div className="stat-card" key={t}>
            <span className="stat-icon">
              <Icon size={22} />
            </span>
            <div>
              <strong>{n}</strong>
              <span>{t}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="section-heading">
        <h2>Быстрый доступ</h2>
      </div>
      <div className="admin-quick">
        {[
          [
            "users",
            "Клиенты и обучение",
            "Покупки, посещения, прогресс и память",
            UsersRound,
          ],
          [
            "lessons",
            "Расписание школы",
            "Занятия, преподаватели и свободные места",
            CalendarDays,
          ],
          [
            "settings",
            "Подключение OpenAI",
            "API-ключ, модель и проверка подключения",
            Settings2,
          ],
        ].map(([id, t, d, Icon]: any) => (
          <button className="panel" key={id} onClick={() => go(id)}>
            <Icon size={28} />
            <h3>{t}</h3>
            <p>{d}</p>
            <ArrowUpRight size={20} />
          </button>
        ))}
      </div>
    </>
  );
}

function localDate(value: string) {
  const d = new Date(value + "Z");
  return new Date(d.getTime() + 180 * 60000).toISOString().slice(0, 16);
}

const FIELD_LABELS: any = {
  title: "Название",
  description: "Описание",
  direction: "Направление",
  level: "Уровень",
  price: "Стоимость, ₽",
  active: "Активен",
  name: "Имя",
  specialization: "Специализация",
  course_id: "Курс",
  topic_id: "Тема",
  teacher_id: "Преподаватель",
  starts_at: "Начало (Москва)",
  ends_at: "Окончание (Москва)",
  format: "Формат",
  capacity: "Количество мест",
  status: "Статус",
  quantity: "Количество занятий",
  position: "Порядок темы",
};
const entityTitles: any = {
  courses: "Курсы",
  teachers: "Преподаватели",
  lessons: "Занятия",
  plans: "Абонементы",
  topics: "Темы курса",
};
const ENTITY_FIELDS: any = {
  courses: ["title", "description", "direction", "level", "price", "active"],
  teachers: ["name", "specialization", "description", "active"],
  lessons: [
    "course_id",
    "topic_id",
    "teacher_id",
    "starts_at",
    "ends_at",
    "format",
    "price",
    "capacity",
    "status",
  ],
  plans: ["title", "format", "quantity", "price", "active"],
  topics: ["course_id", "title", "position"],
};

function EntityForm({ entity, initial, catalog, topics, onSave, close }: any) {
  const defaults: any = {
    courses: {
      title: "",
      description: "",
      direction: "Разработка",
      level: "Начинающий",
      price: 0,
      active: true,
    },
    teachers: { name: "", specialization: "", description: "", active: true },
    plans: { title: "", format: "group", quantity: 8, price: 0, active: true },
    lessons: {
      course_id: catalog.courses[0]?.id || 1,
      topic_id: topics[0]?.id || 1,
      teacher_id: catalog.teachers[0]?.id || 1,
      starts_at: "",
      ends_at: "",
      format: "group",
      price: 1500,
      capacity: 8,
      status: "scheduled",
    },
    topics: { course_id: initial?.course_id || 1, title: "", position: 1 },
  };
  const [form, setForm] = useState<any>(() => {
      const f = { ...defaults[entity], ...initial };
      if (entity === "lessons" && !initial?.topic_id) {
        f.topic_id =
          topics.find((t: any) => t.course_id === Number(f.course_id))?.id ||
          "";
      }
      if (initial?.price !== undefined) f.price = initial.price / 100;
      for (const key of ["starts_at", "ends_at"])
        if (initial?.[key]) f[key] = localDate(initial[key]);
      return f;
    }),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: any) {
    e.preventDefault();
    setBusy(true);
    try {
      const p: any = {};
      for (const key of ENTITY_FIELDS[entity]) {
        p[key] = form[key];
        if (key === "price") p[key] = Math.round(Number(form[key]) * 100);
        if (
          [
            "capacity",
            "quantity",
            "position",
            "course_id",
            "topic_id",
            "teacher_id",
          ].includes(key)
        )
          p[key] = Number(form[key]);
        if (["starts_at", "ends_at"].includes(key))
          p[key] = new Date(form[key] + "+03:00").toISOString();
      }
      await onSave(p);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={
        (initial?.id ? "Редактировать: " : "Добавить: ") +
        entityTitles[entity].toLowerCase()
      }
      close={close}
    >
      <form onSubmit={submit}>
        {error && (
          <div role="alert" className="alert error">
            {error}
          </div>
        )}
        <div className="form-grid">
          {ENTITY_FIELDS[entity].map((key: string) => {
            const update = (v: any) =>
              setForm({
                ...form,
                [key]: v,
                ...(key === "course_id" && entity === "lessons"
                  ? {
                      topic_id:
                        topics.find((t: any) => t.course_id === Number(v))
                          ?.id || "",
                    }
                  : {}),
                ...(key === "format" &&
                v === "individual" &&
                entity === "lessons"
                  ? { capacity: 1 }
                  : {}),
              });
            let options: any[] =
              key === "course_id"
                ? catalog.courses.map((c: any) => [c.id, c.title])
                : key === "teacher_id"
                  ? catalog.teachers.map((t: any) => [t.id, t.name])
                  : key === "topic_id"
                    ? topics
                        .filter(
                          (t: any) => t.course_id === Number(form.course_id),
                        )
                        .map((t: any) => [t.id, t.title])
                    : key === "format"
                      ? [
                          ["group", "Групповое"],
                          ["individual", "Индивидуальное"],
                        ]
                      : key === "status"
                        ? [
                            ["scheduled", "Запланировано"],
                            ["completed", "Завершено"],
                            ["cancelled", "Отменено"],
                          ]
                        : [];
            return (
              <label
                className={key === "description" ? "full-field" : ""}
                key={key}
              >
                {FIELD_LABELS[key]}
                {key === "active" ? (
                  <select
                    value={String(form[key])}
                    onChange={(e) => update(e.target.value === "true")}
                  >
                    <option value="true">Да</option>
                    <option value="false">Нет (архив)</option>
                  </select>
                ) : options.length ||
                  [
                    "course_id",
                    "teacher_id",
                    "topic_id",
                    "format",
                    "status",
                  ].includes(key) ? (
                  <select
                    required
                    value={form[key]}
                    onChange={(e) => update(e.target.value)}
                  >
                    <option value="">Выберите…</option>
                    {options.map(([v, t]) => (
                      <option key={v} value={v}>
                        {t}
                      </option>
                    ))}
                  </select>
                ) : key === "description" ? (
                  <textarea
                    value={form[key]}
                    onChange={(e) => update(e.target.value)}
                  />
                ) : (
                  <input
                    required
                    type={
                      ["price", "capacity", "quantity", "position"].includes(
                        key,
                      )
                        ? "number"
                        : ["starts_at", "ends_at"].includes(key)
                          ? "datetime-local"
                          : "text"
                    }
                    min={
                      ["quantity", "capacity", "position"].includes(key) ? 1 : 0
                    }
                    step={key === "price" ? ".01" : 1}
                    value={form[key]}
                    onChange={(e) => update(e.target.value)}
                  />
                )}
              </label>
            );
          })}
        </div>
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={close}>
            Отмена
          </button>
          <button className="primary" disabled={busy}>
            {busy ? "Сохраняем…" : "Сохранить"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function AdminCatalog({ entity, catalog, refresh, report, notify }: any) {
  const [items, setItems] = useState<any[]>([]),
    [topics, setTopics] = useState<any[]>([]),
    [editing, setEditing] = useState<any>(null),
    [selectedCourseId, setSelectedCourseId] = useState<number | null>(null),
    [school, setSchool] = useState<any>({
      courses: [],
      teachers: [],
      lessons: [],
    }),
    [courseLessonEdit, setCourseLessonEdit] = useState<any>(null),
    [topicEdit, setTopicEdit] = useState<any>(null);
  async function load() {
    const itemsRequest = api("/admin/" + entity);
    const [i, t, courses, teachers, lessons] = await Promise.all([
      itemsRequest,
      api("/admin/topics"),
      entity === "courses" ? itemsRequest : api("/admin/courses"),
      entity === "teachers" ? itemsRequest : api("/admin/teachers"),
      entity === "lessons" ? itemsRequest : api("/admin/lessons"),
    ]);
    setItems(i);
    setTopics(t);
    setSchool({ courses, teachers, lessons });
  }
  useEffect(() => {
    load().catch(report);
  }, []);
  async function save(payload: any) {
    await api(
      "/admin/" + entity + (editing?.id ? "/" + editing.id : ""),
      editing?.id ? "PATCH" : "POST",
      payload,
    );
    setEditing(null);
    await load();
    await refresh();
    notify("Изменения сохранены");
  }
  async function archive(item: any) {
    try {
      await api("/admin/" + entity + "/" + item.id, "DELETE");
      await load();
      await refresh();
      notify("Запись перемещена в архив");
    } catch (e) {
      report(e);
    }
  }
  const selectedCourse = school.courses.find(
    (c: any) => c.id === selectedCourseId,
  );
  return (
    <>
      {selectedCourse && (
        <button
          className="text-button course-back"
          onClick={() => setSelectedCourseId(null)}
        >
          ← Назад к курсам
        </button>
      )}
      <PageTitle
        eyebrow="АДМИНИСТРИРОВАНИЕ"
        title={selectedCourse?.title || entityTitles[entity]}
        subtitle={
          selectedCourse
            ? "Программа обучения и расписание занятий по курсу."
            : "Управляйте программой обучения и предложениями школы."
        }
      >
        <button
          className="primary"
          onClick={() => setEditing(selectedCourse || {})}
        >
          {selectedCourse ? <Pencil size={17} /> : <Plus size={17} />}
          {selectedCourse ? "Редактировать курс" : "Добавить"}
        </button>
      </PageTitle>
      {selectedCourse ? (
        <CourseSchedule
          key={selectedCourse.id}
          course={selectedCourse}
          topics={topics}
          school={school}
          onAddTopic={setTopicEdit}
          onEditTopic={setTopicEdit}
          onAddLesson={() =>
            setCourseLessonEdit({ course_id: selectedCourse.id })
          }
          onEditLesson={setCourseLessonEdit}
        />
      ) : entity === "lessons" ? (
        <AdminLessonTable
          lessons={items}
          topics={topics}
          courses={school.courses}
          teachers={school.teachers}
          onEdit={setEditing}
        />
      ) : (
        <div className="panel table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>{entity === "lessons" ? "Занятие" : "Название / имя"}</th>
                <th>Подробности</th>
                <th>Статус</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id}>
                  <td className="muted">#{i.id}</td>
                  <td>
                    <strong>
                      {entity === "courses" ? (
                        <button
                          className="course-title-button"
                          onClick={() => setSelectedCourseId(i.id)}
                        >
                          {i.title}
                          <ArrowUpRight size={15} />
                        </button>
                      ) : (
                        i.title ||
                        i.name ||
                        catalog.courses.find((c: any) => c.id === i.course_id)
                          ?.title ||
                        `Курс #${i.course_id}`
                      )}
                    </strong>
                    {i.starts_at && <small>{date(i.starts_at, true)}</small>}
                  </td>
                  <td>
                    {entity === "courses"
                      ? `${i.direction} · ${money(i.price)}`
                      : entity === "teachers"
                        ? i.specialization
                        : entity === "plans"
                          ? `${i.quantity} занятий · ${fmt(i.format)} · ${money(i.price)}`
                          : `${fmt(i.format)} · ${i.capacity} мест · ${money(i.price)}`}
                  </td>
                  <td>
                    {i.status ? (
                      <Badge value={i.status} />
                    ) : (
                      <span
                        className={`badge ${i.active ? "completed" : "cancelled"}`}
                      >
                        {i.active ? "Активен" : "Архив"}
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="inline-actions">
                      {entity === "courses" && (
                        <button
                          className="text-button"
                          onClick={() => setSelectedCourseId(i.id)}
                        >
                          Расписание и темы
                        </button>
                      )}
                      <button
                        aria-label="Редактировать запись"
                        onClick={() => setEditing(i)}
                      >
                        <Pencil size={17} />
                      </button>
                      {entity !== "lessons" && i.active && (
                        <button aria-label="В архив" onClick={() => archive(i)}>
                          <Trash2 size={17} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <EntityForm
          entity={entity}
          initial={editing}
          catalog={school}
          topics={topics}
          onSave={save}
          close={() => setEditing(null)}
        />
      )}{" "}
      {courseLessonEdit && (
        <EntityForm
          entity="lessons"
          initial={courseLessonEdit}
          catalog={school}
          topics={topics}
          close={() => setCourseLessonEdit(null)}
          onSave={async (payload: any) => {
            await api(
              "/admin/lessons" +
                (courseLessonEdit.id ? "/" + courseLessonEdit.id : ""),
              courseLessonEdit.id ? "PATCH" : "POST",
              payload,
            );
            setCourseLessonEdit(null);
            await load();
            await refresh();
            notify("Расписание курса обновлено");
          }}
        />
      )}
      {topicEdit && (
        <EntityForm
          entity="topics"
          initial={topicEdit}
          catalog={school}
          topics={topics}
          close={() => setTopicEdit(null)}
          onSave={async (p: any) => {
            await api(
              "/admin/topics" + (topicEdit.id ? "/" + topicEdit.id : ""),
              topicEdit.id ? "PATCH" : "POST",
              p,
            );
            setTopicEdit(null);
            await load();
            await refresh();
          }}
        />
      )}
    </>
  );
}

function AdminUsers({ catalog, report, notify, dialogs }: any) {
  const [users, setUsers] = useState<any[]>([]),
    [detail, setDetail] = useState<any>(null),
    [form, setForm] = useState<any>(null),
    [transcript, setTranscript] = useState<any>(null),
    [memory, setMemory] = useState<any>(null),
    [adjust, setAdjust] = useState<any>(null),
    [purchase, setPurchase] = useState<any>(null),
    [query, setQuery] = useState(""),
    [localError, setLocalError] = useState(""),
    [promotion, setPromotion] = useState<any>(null),
    [promotionBusy, setPromotionBusy] = useState(false),
    [promotionError, setPromotionError] = useState("");
  async function load() {
    setUsers(await api("/admin/users"));
  }
  useEffect(() => {
    load().catch(report);
  }, []);
  async function read(id: number) {
    setDetail(await api(`/admin/users/${id}/details`));
  }
  async function changeBooking(id: number, p: any) {
    try {
      await api("/admin/bookings/" + id, "PATCH", p);
      await read(detail.user.id);
      notify("Запись обновлена");
    } catch (e) {
      report(e);
    }
  }
  async function submit(e: any) {
    e.preventDefault();
    try {
      if (form.id)
        await api("/admin/users/" + form.id, "PATCH", {
          name: form.name,
          email: form.email,
          phone: form.phone,
          active: form.active,
          ...(form.password ? { password: form.password } : {}),
        });
      else
        await api("/admin/users", "POST", {
          login: form.login,
          name: form.name,
          password: form.password,
        });
      setForm(null);
      setLocalError("");
      await load();
      if (detail) await read(detail.user.id);
    } catch (e: any) {
      setLocalError(e.message);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="ЛЮДИ — ГЛАВНОЕ"
        title={dialogs ? "Диалоги и память" : "Пользователи школы"}
        subtitle={
          dialogs
            ? "Выберите клиента, чтобы просмотреть диалоги и сохранённые сведения."
            : "Клиенты, администраторы и управление доступом к школе."
        }
      >
        <button
          className="primary"
          onClick={() => {
            setLocalError("");
            setForm({ name: "", login: "", password: "" });
          }}
        >
          <Plus size={17} />
          Новый клиент
        </button>
      </PageTitle>
      <div className="search-input user-search">
        <Search size={17} />
        <input
          placeholder="Имя или логин пользователя…"
          aria-label="Поиск пользователя"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Пользователь</th>
              <th>Контакты</th>
              <th>Роль</th>
              <th>Статус</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {users
              .filter((u) =>
                `${u.name} ${u.login}`
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              )
              .map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="person-cell">
                      <span className="avatar">{u.name[0]}</span>
                      <div>
                        <strong>{u.name}</strong>
                        <small>@{u.login}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    {u.email || "—"}
                    <small>{u.phone}</small>
                  </td>
                  <td>
                    <span
                      className={`badge ${u.role === "admin" ? "reserved" : ""}`}
                    >
                      {u.role === "admin" ? "Администратор" : "Клиент"}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`badge ${u.active ? "completed" : "cancelled"}`}
                    >
                      {u.active ? "Активен" : "Заблокирован"}
                    </span>
                  </td>
                  <td>
                    <button
                      className="course-link"
                      onClick={() => read(u.id).catch(report)}
                    >
                      Открыть карточку <ArrowUpRight size={16} />
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {detail && (
        <section className="client-detail">
          <div className="section-heading">
            <div>
              <span className="eyebrow">
                КАРТОЧКА ПОЛЬЗОВАТЕЛЯ ·{" "}
                {detail.user.role === "admin" ? "АДМИНИСТРАТОР" : "КЛИЕНТ"}
              </span>
              <h2>{detail.user.name}</h2>
            </div>
            <div className="inline-actions">
              {detail.user.role !== "admin" && (
                <button
                  className="primary"
                  disabled={!detail.user.active}
                  title={
                    !detail.user.active
                      ? "Сначала разблокируйте пользователя"
                      : "Предоставить полные права администратора"
                  }
                  onClick={() => {
                    setPromotion(detail.user);
                    setPromotionError("");
                  }}
                >
                  <ShieldCheck size={16} />
                  Назначить администратором
                </button>
              )}
              <button
                className="secondary"
                disabled={detail.user.role === "admin"}
                title={
                  detail.user.role === "admin"
                    ? "Учётная запись администратора защищена"
                    : "Редактировать профиль"
                }
                onClick={() => {
                  setForm({ ...detail.user, password: "" });
                  setLocalError("");
                }}
              >
                <Pencil size={16} />
                Профиль
              </button>
              <button
                aria-label="Закрыть карточку"
                onClick={() => setDetail(null)}
              >
                <X size={21} />
              </button>
            </div>
          </div>
          <div className="subscription-grid">
            {detail.subscriptions.map((s: any) => (
              <SubscriptionCard key={s.id} sub={s}>
                <button
                  className="course-link"
                  onClick={() => setAdjust({ id: s.id, amount: 1, reason: "" })}
                >
                  Корректировать баланс <Pencil size={15} />
                </button>
              </SubscriptionCard>
            ))}
          </div>
          <div className="section-heading">
            <h3>Покупки</h3>
            <button
              className="primary compact"
              onClick={() => setPurchase({ kind: "plan", target_id: "" })}
            >
              <Plus size={15} />
              Оформить покупку
            </button>
          </div>
          <PurchaseTable purchases={detail.purchases} />
          <div className="section-heading">
            <h3>Записи и посещения</h3>
          </div>
          <BookingTable
            admin
            bookings={detail.bookings}
            catalog={catalog}
            onChange={changeBooking}
          />
          <div className="section-heading">
            <h3>Прогресс обучения</h3>
          </div>
          <div className="panel progress-editor">
            {detail.enrollments.map((en: any) => (
              <div key={en.id}>
                <h4>
                  {en.course_title} · {en.progress}%
                </h4>
                {en.topics.map((t: any) => (
                  <label className="checkbox-label" key={t.id}>
                    <input
                      type="checkbox"
                      checked={t.completed}
                      onChange={async (e) => {
                        try {
                          await api(
                            `/admin/users/${detail.user.id}/progress`,
                            "POST",
                            { topic_id: t.id, completed: e.target.checked },
                          );
                          await read(detail.user.id);
                        } catch (err) {
                          report(err);
                        }
                      }}
                    />
                    {t.title}
                  </label>
                ))}
              </div>
            ))}
          </div>
          <div className="section-heading">
            <h3>Сохранённая память</h3>
          </div>
          <div className="panel">
            {detail.memories.map((m: any) => (
              <div className="admin-memory" key={m.id}>
                <div>
                  <small>{categoryNames[m.category]}</small>
                  <p>{m.content}</p>
                </div>
                <button
                  aria-label="Редактировать память"
                  onClick={() => setMemory(m)}
                >
                  <Pencil size={16} />
                </button>
                <button
                  aria-label="Удалить память"
                  onClick={async () => {
                    try {
                      await api("/admin/memories/" + m.id, "PATCH", {
                        active: false,
                      });
                      await read(detail.user.id);
                    } catch (e) {
                      report(e);
                    }
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            {!detail.memories.length && (
              <p className="muted">Нет сохранённых сведений.</p>
            )}
          </div>
          <div className="section-heading">
            <h3>Диалоги клиента</h3>
          </div>
          <div className="panel">
            {detail.conversations.map((c: any) => (
              <div className="admin-memory" key={c.id}>
                <div>
                  <strong>{c.title}</strong>
                  <small>{date(c.updated_at, true)}</small>
                </div>
                <button
                  className="text-button"
                  onClick={async () => {
                    try {
                      setTranscript(await api("/admin/conversations/" + c.id));
                    } catch (e) {
                      report(e);
                    }
                  }}
                >
                  Прочитать
                </button>
                <button
                  aria-label="Удалить диалог клиента"
                  onClick={async () => {
                    try {
                      await api("/admin/conversations/" + c.id, "DELETE");
                      await read(detail.user.id);
                    } catch (e) {
                      report(e);
                    }
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            {!detail.conversations.length && (
              <p className="muted">Диалогов пока нет.</p>
            )}
          </div>
        </section>
      )}
      {promotion && (
        <Modal
          title="Назначить администратора"
          close={() => !promotionBusy && setPromotion(null)}
        >
          {promotionError && (
            <div role="alert" className="alert error">
              {promotionError}
            </div>
          )}
          <p className="confirmation-text">
            <strong>{promotion.name}</strong> получит полный доступ к
            пользователям, курсам, расписанию и настройкам OpenAI, включая
            назначение других администраторов.
          </p>
          <div className="modal-actions">
            <button
              className="secondary"
              disabled={promotionBusy}
              onClick={() => setPromotion(null)}
            >
              Отмена
            </button>
            <button
              className="primary"
              disabled={promotionBusy}
              onClick={async () => {
                setPromotionBusy(true);
                try {
                  await api(`/admin/users/${promotion.id}/promote`, "POST");
                  await load();
                  await read(promotion.id);
                  setPromotion(null);
                  notify(
                    "Права администратора назначены. Пользователь увидит админку после обновления страницы.",
                  );
                } catch (error: any) {
                  setPromotionError(error.message);
                } finally {
                  setPromotionBusy(false);
                }
              }}
            >
              {promotionBusy ? "Назначаем…" : "Назначить"}
            </button>
          </div>
        </Modal>
      )}
      {form && (
        <Modal
          title={form.id ? "Профиль клиента" : "Новый клиент"}
          close={() => setForm(null)}
        >
          <form onSubmit={submit}>
            {localError && <div className="alert error">{localError}</div>}
            {(form.id
              ? ["name", "email", "phone", "password"]
              : ["name", "login", "password"]
            ).map((k) => (
              <label key={k}>
                {
                  {
                    name: "Имя",
                    email: "Email",
                    phone: "Телефон",
                    password: form.id
                      ? "Новый пароль (необязательно)"
                      : "Пароль",
                    login: "Логин",
                  }[k]
                }
                <input
                  required={
                    ["name", "login"].includes(k) ||
                    (k === "password" && !form.id)
                  }
                  type={k === "password" ? "password" : "text"}
                  value={form[k]}
                  onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                />
              </label>
            ))}
            {form.id && (
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) =>
                    setForm({ ...form, active: e.target.checked })
                  }
                />
                Аккаунт активен
              </label>
            )}
            <button className="primary">Сохранить</button>
          </form>
        </Modal>
      )}
      {memory && (
        <Modal title="Изменить память клиента" close={() => setMemory(null)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api("/admin/memories/" + memory.id, "PATCH", {
                  content: memory.content,
                });
                setMemory(null);
                await read(detail.user.id);
              } catch (e) {
                report(e);
              }
            }}
          >
            <label>
              Содержание
              <textarea
                required
                value={memory.content}
                onChange={(e) =>
                  setMemory({ ...memory, content: e.target.value })
                }
              />
            </label>
            <button className="primary">Сохранить</button>
          </form>
        </Modal>
      )}
      {adjust && (
        <Modal title="Корректировка абонемента" close={() => setAdjust(null)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api(`/admin/subscriptions/${adjust.id}/adjust`, "POST", {
                  amount: Number(adjust.amount),
                  reason: adjust.reason,
                });
                setAdjust(null);
                await read(detail.user.id);
              } catch (e) {
                report(e);
              }
            }}
          >
            <label>
              Добавить / убрать занятий
              <input
                type="number"
                required
                value={adjust.amount}
                onChange={(e) =>
                  setAdjust({ ...adjust, amount: e.target.value })
                }
              />
            </label>
            <label>
              Причина
              <textarea
                required
                value={adjust.reason}
                onChange={(e) =>
                  setAdjust({ ...adjust, reason: e.target.value })
                }
              />
            </label>
            <button className="primary">Применить</button>
          </form>
        </Modal>
      )}
      {purchase && (
        <Modal
          title="Учебная покупка для клиента"
          close={() => setPurchase(null)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api(`/admin/users/${detail.user.id}/purchase`, "POST", {
                  kind: purchase.kind,
                  target_id: Number(purchase.target_id),
                });
                setPurchase(null);
                await read(detail.user.id);
              } catch (e) {
                report(e);
              }
            }}
          >
            <label>
              Вид покупки
              <select
                value={purchase.kind}
                onChange={(e) =>
                  setPurchase({ kind: e.target.value, target_id: "" })
                }
              >
                <option value="plan">Абонемент</option>
                <option value="course">Курс</option>
                <option value="lesson">Разовое занятие</option>
              </select>
            </label>
            <label>
              Предложение
              <select
                required
                value={purchase.target_id}
                onChange={(e) =>
                  setPurchase({ ...purchase, target_id: e.target.value })
                }
              >
                <option value="">Выберите…</option>
                {(purchase.kind === "plan"
                  ? catalog.plans
                  : purchase.kind === "course"
                    ? catalog.courses
                    : catalog.lessons
                ).map((i: any) => (
                  <option value={i.id} key={i.id}>
                    {i.title ||
                      `${i.course_title} · ${date(i.starts_at, true)}`}{" "}
                    · {money(i.price)}
                  </option>
                ))}
              </select>
            </label>
            <button className="primary">Оформить</button>
          </form>
        </Modal>
      )}
      {transcript && (
        <Modal
          title={transcript.conversation.title}
          close={() => setTranscript(null)}
        >
          <div className="admin-transcript">
            {transcript.messages.map((m: any) => (
              <div key={m.id}>
                <strong>{m.role === "user" ? "Клиент" : "Наставник"}</strong>
                <p>{m.content}</p>
                {m.role === "assistant" && <TracePanel traces={m.traces} />}
              </div>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}

function AISettings({ report, notify }: any) {
  const [settings, setSettings] = useState<any>({ model: "", has_key: false, database_configured: false }),
    [busy, setBusy] = useState(false);
  async function load() {
    setSettings(await api("/admin/settings"));
  }
  useEffect(() => {
    load().catch(report);
  }, []);
  async function test() {
    setBusy(true);
    try {
      const r = await api("/admin/settings/test", "POST");
      notify(r.message);
    } catch (e) {
      report(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="ИНТЕЛЛЕКТ ВАШЕЙ ШКОЛЫ"
        title="Настройки AI"
        subtitle="Секреты и параметры подключения задаются в .env на сервере."
      />
      <div className="settings-layout">
        <section className="panel ai-settings">
          <div className="section-heading">
            <h2>
              <Sparkles size={23} />
              OpenAI
            </h2>
            <span className={`badge ${settings.configured ? "completed" : "cancelled"}`}>
              {settings.configured ? "Настроено через .env" : "Требуется настройка"}
            </span>
          </div>
          <div className="setup-guide">
            <p><strong>OpenAI API-ключ:</strong> {settings.has_key ? "задан" : "не задан"}</p>
            <p><strong>Модель:</strong> {settings.model || "не задана"}</p>
            <p><strong>База Turso:</strong> {settings.database_configured ? "параметры заданы" : "параметры не заданы"}</p>
            <p>На локальном сервере укажите значения в файле .env и перезапустите приложение. Для Vercel задайте те же имена в Environment Variables проекта.</p>
            <div className="settings-actions">
              <button className="secondary" disabled={busy || !settings.configured} onClick={test}>
                <ShieldCheck size={16} />
                {busy ? "Проверяем…" : "Проверить подключение OpenAI"}
              </button>
            </div>
          </div>
        </section>
        <aside className="panel setup-guide">
          <span className="stat-icon">
            <ShieldCheck size={24} />
          </span>
          <h3>Параметры в .env</h3>
          <ol>
            <li>TURSO_DATABASE_URL и TURSO_AUTH_TOKEN — база Turso.</li>
            <li>OPENAI_API_KEY и OPENAI_MODEL — AI-наставник.</li>
            <li>После изменения локального .env перезапустите сервер.</li>
          </ol>
          <p>
            Проверка делает небольшой реальный API-запрос с вызовом инструмента.
            Расходы учитываются в вашем аккаунте OpenAI.
          </p>
          <p>
            API-ключ не показывается в интерфейсе и не хранится в таблицах приложения.
          </p>
        </aside>
      </div>
    </>
  );
}

export { AdminHome, AdminCatalog, AdminUsers, AISettings };
