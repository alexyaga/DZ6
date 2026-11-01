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
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { api, setCsrf, money, date, fmt, status } from "./api";
import { sortCoursesByPrice, type CourseSortOrder } from "./courseSort";

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

function Login({ onLogin }: any) {
  const [register, setRegister] = useState(false),
    [login, setLogin] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: any) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      onLogin(
        await api(register ? "/auth/register" : "/auth/login", "POST", {
          login,
          password,
          ...(register ? { name } : {}),
        }),
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <section className="auth-art">
        <a className="brand">
          <span className="brand-mark">
            <Code2 />
          </span>
          <span>IT School</span>
        </a>
        <div className="auth-message">
          <span className="yellow-label">ВАШ СЛЕДУЮЩИЙ ШАГ В IT</span>
          <h1>
            Новые навыки.
            <br />
            Новые
            <br />
            <span>возможности.</span>
          </h1>
          <p>
            Практические курсы, сильные преподаватели
            <br />и AI-наставник, который помнит ваши цели.
          </p>
          <div className="auth-features">
            <span>
              <CheckCircle2 size={16} /> Практика с первого занятия
            </span>
            <span>
              <CheckCircle2 size={16} /> Ваш собственный темп
            </span>
          </div>
        </div>
        <CodeIllustration />
        <small>УЧИСЬ. СОЗДАВАЙ. РАЗВИВАЙСЯ.</small>
      </section>
      <section className="auth-form-wrap">
        <form className="auth-form" onSubmit={submit}>
          <span className="eyebrow">ДОБРО ПОЖАЛОВАТЬ</span>
          <h2>{register ? "Начните свой путь" : "С возвращением!"}</h2>
          <p>
            {register
              ? "Создайте аккаунт и выберите своё направление."
              : "Войдите, чтобы продолжить учиться и двигаться к цели."}
          </p>
          {error && (
            <div role="alert" className="alert error">
              {error}
            </div>
          )}
          {register && (
            <label>
              Ваше имя
              <input
                required
                value={name}
                maxLength={120}
                onChange={(e) => setName(e.target.value)}
                placeholder="Как к вам обращаться"
                autoComplete="name"
              />
            </label>
          )}
          <label>
            Логин
            <input
              required
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder="Введите логин"
              autoComplete="username"
            />
          </label>
          <label>
            Пароль
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Введите пароль"
              autoComplete={register ? "new-password" : "current-password"}
            />
          </label>
          <button className="primary auth-submit" disabled={busy}>
            {busy
              ? "Подождите…"
              : register
                ? "Создать аккаунт"
                : "Войти в кабинет"}
            <ArrowRight size={18} />
          </button>
          <p className="auth-switch">
            {register ? "Уже есть аккаунт?" : "Ещё нет аккаунта?"}{" "}
            <button
              type="button"
              onClick={() => {
                setRegister(!register);
                setError("");
              }}
            >
              {register ? "Войти" : "Зарегистрироваться"}
            </button>
          </p>
          <div className="demo-box">
            <strong>
              <ShieldCheck size={16} /> Аккаунты для знакомства
            </strong>
            <div>
              <code>anna</code>
              <span>AnnaDemo!2026</span>
            </div>
            <div>
              <code>mikhail</code>
              <span>MikhailDemo!2026</span>
            </div>
            <div>
              <code>admin</code>
              <span>AdminDemo!2026</span>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}

function Dashboard({ user, catalog, learning, go, propose }: any) {
  const active = learning.enrollments.filter(
      (e: any) => e.status === "studying",
    ),
    next = learning.bookings
      .filter((b: any) => b.status === "reserved")
      .sort((a: any, b: any) =>
        a.lesson.starts_at.localeCompare(b.lesson.starts_at),
      );
  const available = learning.subscriptions.reduce(
      (s: number, a: any) => s + a.available,
      0,
    ),
    finished = learning.enrollments.filter(
      (e: any) => e.status === "completed",
    ).length;
  return (
    <>
      <PageTitle
        eyebrow="КАЖДЫЙ ДЕНЬ — ШАГ ВПЕРЁД"
        title={`Привет, ${user.name.split(" ")[0]}!`}
        subtitle="Хороший день, чтобы узнать что-то новое."
      >
        <span className="date-pill">
          <CalendarDays size={16} />
          {new Date().toLocaleDateString("ru-RU", {
            day: "numeric",
            month: "long",
            timeZone: "Europe/Moscow",
          })}
        </span>
      </PageTitle>
      <section className="hero">
        <div className="hero-copy">
          <span className="yellow-label">ОТ ИНТЕРЕСА — К ПРОФЕССИИ</span>
          <h2>
            Ваше будущее в IT
            <br />
            начинается здесь<span>.</span>
          </h2>
          <p>
            Выберите направление, развивайте навыки
            <br />и создавайте то, чем будете гордиться.
          </p>
          <button className="white-button" onClick={() => go("catalog")}>
            Найти свой курс <ArrowUpRight size={18} />
          </button>
        </div>
        <CodeIllustration />
      </section>
      <div className="stats-grid">
        {[
          [
            BookOpen,
            active.length,
            "Курса в процессе",
            "Продолжайте в своём темпе",
          ],
          [CheckCircle2, finished, "Курса завершено", "Ваши первые достижения"],
          [Ticket, available, "Занятий доступно", "По вашим абонементам"],
          [
            CalendarDays,
            next.length,
            "Ближайших записей",
            "Время для новых знаний",
          ],
        ].map(([Icon, n, label, hint]: any, i: number) => (
          <div className="stat-card" key={label}>
            <span className={`stat-icon tone-${i}`}>
              <Icon size={21} />
            </span>
            <div>
              <strong>{n}</strong>
              <span>{label}</span>
              <small>{hint}</small>
            </div>
          </div>
        ))}
      </div>
      <div className="dashboard-columns">
        <section>
          <div className="section-heading">
            <h2>
              Продолжить обучение <span className="count">{active.length}</span>
            </h2>
            <button onClick={() => go("learning")}>
              Все мои курсы <ArrowRight size={16} />
            </button>
          </div>
          <div className="continue-grid">
            {active.length ? (
              active
                .slice(0, 2)
                .map((en: any) => (
                  <CourseCard
                    key={en.id}
                    course={
                      catalog.courses.find(
                        (c: any) => c.id === en.course_id,
                      ) || { id: en.course_id, title: en.course_title }
                    }
                    enrollment={en}
                    onContinue={() => go("learning")}
                  />
                ))
            ) : (
              <Empty
                title="Ваш путь только начинается"
                text="Выберите первый курс в каталоге."
              >
                <button className="primary" onClick={() => go("catalog")}>
                  Открыть каталог
                </button>
              </Empty>
            )}
          </div>
        </section>
        <section>
          <div className="section-heading">
            <h2>Ближайшие занятия</h2>
            <button
              aria-label="Открыть расписание"
              onClick={() => go("schedule")}
            >
              <ArrowUpRight size={19} />
            </button>
          </div>
          <div className="upcoming-card">
            {next.length ? (
              next.slice(0, 3).map((b: any) => (
                <div className="upcoming-item" key={b.id}>
                  <span className="lesson-day">
                    <strong>
                      {new Date(b.lesson.starts_at + "Z").toLocaleDateString(
                        "ru-RU",
                        { day: "2-digit", timeZone: "Europe/Moscow" },
                      )}
                    </strong>
                    <small>
                      {new Date(b.lesson.starts_at + "Z").toLocaleDateString(
                        "ru-RU",
                        { month: "short", timeZone: "Europe/Moscow" },
                      )}
                    </small>
                  </span>
                  <div>
                    <h4>{b.lesson.course_title}</h4>
                    <p>{b.lesson.topic_title}</p>
                    <small>
                      <Clock3 size={13} />
                      {date(b.lesson.starts_at, true)} · {fmt(b.lesson.format)}
                    </small>
                  </div>
                </div>
              ))
            ) : (
              <Empty
                title="Пока нет записей"
                text="Найдите удобное время в расписании."
              />
            )}
            <button className="full-link" onClick={() => go("schedule")}>
              Открыть расписание <ArrowRight size={16} />
            </button>
          </div>
          <div className="mentor-card">
            <span>
              <Sparkles size={22} />
            </span>
            <h3>С чего начать?</h3>
            <p>
              Расскажите наставнику о своих целях. Вместе найдём ваш маршрут.
            </p>
            <button onClick={() => go("chat")}>
              Поговорить с AI <ArrowUpRight size={16} />
            </button>
          </div>
        </section>
      </div>
      <div className="section-heading">
        <h2>Откройте новое направление</h2>
        <button onClick={() => go("catalog")}>
          Весь каталог <ArrowRight size={16} />
        </button>
      </div>
      <div className="recommendations">
        {catalog.courses
          .filter(
            (c: any) =>
              !learning.enrollments.some((e: any) => e.course_id === c.id),
          )
          .slice(0, 2)
          .map((c: any) => {
            const Icon = courseVisuals[(c.id - 1) % 4];
            return (
              <button
                className="recommend-card"
                key={c.id}
                onClick={() => go("catalog")}
              >
                <span
                  className={`recommend-icon ${courseColors[(c.id - 1) % 4]}`}
                >
                  <Icon size={27} />
                </span>
                <div>
                  <small>{c.direction}</small>
                  <h3>{c.title}</h3>
                  <p>
                    {c.level} · {c.topics.length} темы
                  </p>
                </div>
                <ArrowUpRight size={22} />
              </button>
            );
          })}
      </div>
    </>
  );
}

function Catalog({ catalog, learning, propose, go }: any) {
  const [query, setQuery] = useState(""),
    [tab, setTab] = useState("Все направления"),
    [teachers, setTeachers] = useState(false),
    [sortOrder, setSortOrder] = useState<CourseSortOrder>("default");
  const dirs = [
    "Все направления",
    ...new Set<string>(catalog.courses.map((c: any) => c.direction)),
  ];
  return (
    <>
      <PageTitle
        eyebrow="ИНВЕСТИЦИЯ В СЕБЯ"
        title="Найдите своё направление"
        subtitle="Практические навыки для вашей следующей главы."
      />
      <div className="toolbar">
        <div className="tabs">
          {dirs.map((d) => (
            <button
              className={!teachers && d === tab ? "selected" : ""}
              onClick={() => {
                setTab(d);
                setTeachers(false);
              }}
              key={d}
            >
              {d}
            </button>
          ))}
          <button
            className={teachers ? "selected" : ""}
            onClick={() => setTeachers(true)}
          >
            Преподаватели
          </button>
        </div>
        <div className="catalog-controls">
          <div className="search-input">
            <Search size={17} />
            <input
              aria-label="Поиск курса"
              placeholder="Найти курс…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {!teachers && (
            <select
              className="catalog-sort"
              aria-label="Сортировка курсов"
              value={sortOrder}
              onChange={(event) =>
                setSortOrder(event.target.value as CourseSortOrder)
              }
            >
              <option value="default">По умолчанию</option>
              <option value="price-asc">Сначала дешёвые</option>
              <option value="price-desc">Сначала дорогие</option>
            </select>
          )}
        </div>
      </div>
      {teachers ? (
        <div className="teacher-grid">
          {catalog.teachers.map((t: any) => (
            <article className="panel teacher-card" key={t.id}>
              <div className="teacher-avatar">
                {t.name
                  .split(" ")
                  .map((n: string) => n[0])
                  .join("")}
              </div>
              <h3>{t.name}</h3>
              <span className="badge">{t.specialization}</span>
              <p>{t.description}</p>
            </article>
          ))}
        </div>
      ) : (
        <div className="course-grid">
          {sortCoursesByPrice(
            catalog.courses.filter(
              (c: any) =>
                (tab === "Все направления" || c.direction === tab) &&
                `${c.title} ${c.description}`
                  .toLowerCase()
                  .includes(query.toLowerCase()),
            ),
            sortOrder,
          ).map((c: any) => (
            <CourseCard
              key={c.id}
              course={c}
              enrollment={learning.enrollments.find(
                (e: any) => e.course_id === c.id,
              )}
              onContinue={() => go("learning")}
              onBuy={() => propose("buy_course", c.id)}
            />
          ))}
        </div>
      )}
    </>
  );
}

function Schedule({ catalog, learning, propose }: any) {
  const [course, setCourse] = useState(""),
    [format, setFormat] = useState(""),
    [day, setDay] = useState("");
  const lessons = catalog.lessons.filter(
    (l: any) =>
      (!course || l.course_id === Number(course)) &&
      (!format || l.format === format) &&
      (!day ||
        new Date(l.starts_at + "Z").toLocaleDateString("sv-SE", {
          timeZone: "Europe/Moscow",
        }) === day),
  );
  return (
    <>
      <PageTitle
        eyebrow="ВРЕМЯ ДЛЯ НОВЫХ ЗНАНИЙ"
        title="Расписание занятий"
        subtitle="Выбирайте удобное время и учитесь вместе с нами."
      />
      <div className="panel schedule-filters">
        <label>
          Направление
          <select value={course} onChange={(e) => setCourse(e.target.value)}>
            <option value="">Все курсы</option>
            {catalog.courses.map((c: any) => (
              <option value={c.id} key={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Формат
          <select value={format} onChange={(e) => setFormat(e.target.value)}>
            <option value="">Все форматы</option>
            <option value="group">Групповые</option>
            <option value="individual">Индивидуальные</option>
          </select>
        </label>
        <label>
          Дата
          <input
            type="date"
            value={day}
            onChange={(e) => setDay(e.target.value)}
          />
        </label>
        <button
          className="text-button"
          onClick={() => {
            setCourse("");
            setFormat("");
            setDay("");
          }}
        >
          Сбросить
        </button>
      </div>
      <p className="list-caption">
        Найдено занятий: {lessons.length} <span>Московское время · UTC+3</span>
      </p>
      <div className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Занятие</th>
              <th>Дата и время</th>
              <th>Преподаватель</th>
              <th>Формат</th>
              <th>Стоимость</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {lessons.map((l: any) => {
              const b = learning.bookings.find(
                (b: any) => b.lesson_id === l.id && b.status === "reserved",
              );
              return (
                <tr key={l.id}>
                  <td>
                    <strong>{l.course_title}</strong>
                    <small>{l.topic_title}</small>
                  </td>
                  <td>
                    {date(l.starts_at, true)}
                    <small>60 минут</small>
                  </td>
                  <td>{l.teacher_name}</td>
                  <td>
                    <span className={`format-pill ${l.format}`}>
                      {fmt(l.format)}
                    </span>
                    <small>{l.places_left} свободных мест</small>
                  </td>
                  <td>
                    <strong>{money(l.price)}</strong>
                    <small>или 1 занятие пакета</small>
                  </td>
                  <td>
                    {b ? (
                      <button
                        className="secondary compact"
                        onClick={() => propose("cancel", b.id)}
                      >
                        Отменить запись
                      </button>
                    ) : (
                      <div className="table-actions">
                        <button
                          className="primary compact"
                          disabled={!l.places_left}
                          onClick={() => propose("book", l.id)}
                        >
                          Записаться
                        </button>
                        <button
                          className="text-button small-text"
                          onClick={() => propose("buy_lesson", l.id)}
                        >
                          Купить разовое
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!lessons.length && (
          <Empty
            title="Занятий не найдено"
            text="Попробуйте изменить фильтры."
          />
        )}
      </div>
    </>
  );
}

function Learning({ learning, propose, go }: any) {
  return (
    <>
      <PageTitle
        eyebrow="ВАШ ЛИЧНЫЙ МАРШРУТ"
        title="Моё обучение"
        subtitle="Все ваши навыки, достижения и следующие шаги в одном месте."
      />
      <div className="enrollment-list">
        {learning.enrollments.map((e: any) => (
          <section className="panel enrollment" key={e.id}>
            <div className="section-heading">
              <h2>{e.course_title}</h2>
              <Badge value={e.status} />
            </div>
            <div className="progress-label">
              <span>
                Пройдено тем: {e.topics.filter((t: any) => t.completed).length}{" "}
                из {e.topics.length}
              </span>
              <strong>{e.progress}%</strong>
            </div>
            <div className="progress-track">
              <i style={{ width: e.progress + "%" }} />
            </div>
            <div className="topic-list">
              {e.topics.map((t: any) => (
                <div key={t.id} className={t.completed ? "done" : ""}>
                  <span>{t.completed ? <Check size={15} /> : t.position}</span>
                  {t.title}
                </div>
              ))}
            </div>
            {e.status !== "completed" && (
              <button className="course-link" onClick={() => go("schedule")}>
                Выбрать следующее занятие <ArrowRight size={16} />
              </button>
            )}
          </section>
        ))}
      </div>
      {!learning.enrollments.length && (
        <Empty
          title="Начните с первого курса"
          text="В каталоге есть направления для любого уровня."
        >
          <button className="primary" onClick={() => go("catalog")}>
            Выбрать курс
          </button>
        </Empty>
      )}
      <div className="section-heading">
        <h2>История занятий</h2>
      </div>
      <BookingTable bookings={learning.bookings} propose={propose} />
      <div className="section-heading">
        <h2>История покупок</h2>
      </div>
      <PurchaseTable purchases={learning.purchases} />
    </>
  );
}

function Subscriptions({ catalog, learning, propose }: any) {
  return (
    <>
      <PageTitle
        eyebrow="УЧИТЕСЬ В СВОЁМ РИТМЕ"
        title="Мои абонементы"
        subtitle="Один пакет — разные курсы. Выбирайте свой формат."
      />
      <div className="subscription-grid">
        {learning.subscriptions.map((s: any) => (
          <SubscriptionCard key={s.id} sub={s} />
        ))}
      </div>
      {!learning.subscriptions.length && (
        <Empty
          title="У вас пока нет абонементов"
          text="Выберите подходящий пакет ниже."
        />
      )}
      <div className="section-heading">
        <h2>Больше практики — больше возможностей</h2>
      </div>
      <div className="plan-grid">
        {catalog.plans.map((p: any) => (
          <article
            className={`panel plan-card ${p.format === "individual" ? "individual-plan" : ""}`}
            key={p.id}
          >
            <span className="plan-symbol">
              {p.format === "group" ? (
                <UsersRound size={25} />
              ) : (
                <UserRound size={25} />
              )}
            </span>
            <span className="eyebrow">
              {fmt(p.format).toUpperCase()} ОБУЧЕНИЕ
            </span>
            <h2>{p.title}</h2>
            <p>Для любых курсов школы · без срока действия</p>
            <ul>
              <li>
                <Check size={16} /> {p.quantity} занятий с преподавателем
              </li>
              <li>
                <Check size={16} /> Удобное расписание
              </li>
              <li>
                <Check size={16} /> Поддержка AI-наставника
              </li>
            </ul>
            <div className="plan-price">
              {money(p.price)}
              <small>{money(p.price / p.quantity)} за занятие</small>
            </div>
            <button
              className="primary"
              onClick={() => propose("buy_plan", p.id)}
            >
              Оформить учебную покупку <ArrowUpRight size={17} />
            </button>
          </article>
        ))}
      </div>
      <div className="info-note">
        <ShieldCheck size={20} />
        <p>
          Это учебное приложение. Деньги не списываются. При записи занятие
          резервируется, а после посещения списывается из пакета.
        </p>
      </div>
    </>
  );
}

function MemoryPanel({ report, notify }: any) {
  const [items, setItems] = useState<any[]>([]),
    [editing, setEditing] = useState<any>(null);
  async function load() {
    setItems(await api("/me/memories"));
  }
  useEffect(() => {
    load().catch(report);
  }, []);
  async function remove(m: any) {
    try {
      await api("/me/memories/" + m.id, "DELETE");
      await load();
      notify("Сведение удалено из памяти");
    } catch (e) {
      report(e);
    }
  }
  async function save(e: any) {
    e.preventDefault();
    try {
      await api(
        "/me/memories" + (editing.id ? "/" + editing.id : ""),
        editing.id ? "PATCH" : "POST",
        { category: editing.category, content: editing.content },
      );
      setEditing(null);
      await load();
      notify("Память обновлена");
    } catch (e) {
      report(e);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="НАСТАВНИК ПОМНИТ ВАЖНОЕ"
        title="Память обо мне"
        subtitle="Эти сведения помогают подбирать обучение под ваши цели."
      >
        <button
          className="primary"
          onClick={() => setEditing({ category: "goal", content: "" })}
        >
          <Plus size={18} />
          Добавить сведение
        </button>
      </PageTitle>
      <div className="info-note">
        <Database size={22} />
        <p>
          Наставник автоматически сохраняет явно сообщённые цели и предпочтения.
          Вы можете исправить или удалить их в любой момент.
        </p>
      </div>
      <div className="memory-grid">
        {items.map((m) => (
          <article className="panel memory-card" key={m.id}>
            <span className="memory-icon">
              <Sparkles size={20} />
            </span>
            <div className="section-heading">
              <h3>{categoryNames[m.category] || m.category}</h3>
              <div className="inline-actions">
                <button
                  aria-label="Изменить сведение"
                  onClick={() => setEditing(m)}
                >
                  <Pencil size={16} />
                </button>
                <button aria-label="Удалить сведение" onClick={() => remove(m)}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <p>{m.content}</p>
            <small>Обновлено {date(m.updated_at, true)}</small>
          </article>
        ))}
      </div>
      {!items.length && (
        <Empty
          title="Познакомимся поближе?"
          text="Расскажите наставнику о своих целях или добавьте сведения вручную."
        />
      )}
      {editing && (
        <Modal title="Сведение о вас" close={() => setEditing(null)}>
          <form onSubmit={save}>
            <label>
              Категория
              <select
                disabled={!!editing.id}
                value={editing.category}
                onChange={(e) =>
                  setEditing({ ...editing, category: e.target.value })
                }
              >
                {Object.entries(categoryNames).map(([v, t]) => (
                  <option value={v} key={v}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Содержание
              <textarea
                required
                maxLength={2000}
                value={editing.content}
                onChange={(e) =>
                  setEditing({ ...editing, content: e.target.value })
                }
              />
            </label>
            <button className="primary">Сохранить</button>
          </form>
        </Modal>
      )}
    </>
  );
}

function Profile({ user, update, report, notify }: any) {
  const [form, setForm] = useState({
    name: user.name,
    email: user.email,
    phone: user.phone,
  });
  async function save(e: any) {
    e.preventDefault();
    try {
      update(await api("/me/profile", "PATCH", form));
      notify("Профиль сохранён");
    } catch (e) {
      report(e);
    }
  }
  return (
    <>
      <PageTitle title="Мой профиль" subtitle="Давайте оставаться на связи." />
      <section className="panel profile-panel">
        <div className="profile-identity">
          <span className="avatar large">{user.name[0]}</span>
          <div>
            <h2>{user.name}</h2>
            <p>@{user.login} · Студент IT School</p>
          </div>
        </div>
        <form onSubmit={save}>
          {[
            ["name", "Имя"],
            ["email", "Email"],
            ["phone", "Телефон"],
          ].map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                type={key === "email" ? "email" : "text"}
                required={key === "name"}
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </label>
          ))}
          <button className="primary">Сохранить изменения</button>
        </form>
      </section>
    </>
  );
}

export {
  Login,
  Dashboard,
  Catalog,
  Schedule,
  Learning,
  Subscriptions,
  MemoryPanel,
  Profile,
};
