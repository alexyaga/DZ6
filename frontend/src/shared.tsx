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

const categoryNames = {
  goal: "Цель обучения",
  level: "Уровень подготовки",
  interest: "Интересы",
  time: "Удобное время",
  format: "Формат занятий",
};
const courseVisuals = [Code2, Database, Monitor, Layers];
const courseColors = ["python", "sql", "support", "web"];

function Modal({ title, close, children }: any) {
  return (
    <div className="modal-backdrop" onClick={close}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-heading">
          <h2>{title}</h2>
          <button aria-label="Закрыть" onClick={close}>
            <X size={21} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function PageTitle({ eyebrow, title, subtitle, children }: any) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function Empty({ title = "Пока здесь пусто", text, children }: any) {
  return (
    <div className="empty">
      <BookOpen size={30} />
      <h3>{title}</h3>
      <p>{text}</p>
      {children}
    </div>
  );
}

function Badge({ value }: any) {
  return <span className={`badge ${value}`}>{status(value)}</span>;
}

function CodeIllustration() {
  return (
    <div className="code-art" aria-hidden="true">
      <div className="orbit orbit-one" />
      <div className="orbit orbit-two" />
      <div className="floating-tag">
        <Database size={18} /> data.skills
      </div>
      <div className="code-window">
        <div className="window-bar">
          <i />
          <i />
          <i />
          <span>your_future.py</span>
          <Code2 size={15} />
        </div>
        <div className="code-lines">
          <p>
            <em>01</em>
            <span className="violet">class</span> <b>YourFuture</b>:
          </p>
          <p>
            <em>02</em>　<span className="violet">def</span>{" "}
            <span className="cyan">__init__</span>(self):
          </p>
          <p>
            <em>03</em>　　self.skills = <span className="yellow">[]</span>
          </p>
          <p>
            <em>04</em>　　self.possibilities = <span className="cyan">∞</span>
          </p>
          <p>
            <em>05</em>
          </p>
          <p>
            <em>06</em>　<span className="violet">def</span>{" "}
            <span className="cyan">grow</span>(self):
          </p>
          <p>
            <em>07</em>　　<span className="violet">return</span>{" "}
            <span className="yellow">"Hello, future!"</span>
          </p>
        </div>
      </div>
      <div className="floating-check">
        <Check size={16} /> Новый навык открыт
      </div>
      <div className="code-cube">
        <Code2 size={32} />
      </div>
    </div>
  );
}

function CourseCard({ course, index, onBuy, enrollment, onContinue }: any) {
  const Icon = courseVisuals[(course.id - 1) % 4];
  return (
    <article className="course-card">
      <div className={`course-cover ${courseColors[(course.id - 1) % 4]}`}>
        <span className="cover-direction">{course.direction}</span>
        <Icon size={65} strokeWidth={1.2} />
        <span className="cover-index">0{course.id}</span>
      </div>
      <div className="course-body">
        <div className="course-meta">
          <span>{course.level}</span>
          <span>{course.topics?.length || 0} темы</span>
        </div>
        <h3>{course.title}</h3>
        <p>{course.description}</p>
        {enrollment ? (
          <>
            <div className="progress-label">
              <span>Ваш прогресс</span>
              <strong>{enrollment.progress}%</strong>
            </div>
            <div className="progress-track">
              <i style={{ width: enrollment.progress + "%" }} />
            </div>
            <button className="course-link" onClick={onContinue}>
              Продолжить обучение <ArrowUpRight size={18} />
            </button>
          </>
        ) : (
          <div className="course-bottom">
            <strong>{money(course.price)}</strong>
            <button className="course-link" onClick={onBuy}>
              Выбрать курс <ArrowUpRight size={17} />
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

function BookingTable({ bookings, propose, admin, onChange, catalog }: any) {
  return (
    <div className="panel table-wrap">
      <table>
        <thead>
          <tr>
            <th>Занятие</th>
            <th>Дата</th>
            <th>Формат</th>
            <th>Статус</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {bookings.map((b: any) => (
            <tr key={b.id}>
              <td>
                <strong>{b.lesson.course_title}</strong>
                <small>{b.lesson.topic_title}</small>
              </td>
              <td>{date(b.lesson.starts_at, true)}</td>
              <td>{fmt(b.lesson.format)}</td>
              <td>
                <Badge value={b.status} />
              </td>
              <td>
                {b.status === "reserved" &&
                  (admin ? (
                    <div className="table-actions">
                      <select
                        aria-label="Изменить посещение"
                        value=""
                        onChange={(e) =>
                          e.target.value &&
                          onChange(b.id, { status: e.target.value })
                        }
                      >
                        <option value="">Действие…</option>
                        <option value="attended">Посетил</option>
                        <option value="absent">Неявка</option>
                        <option value="cancelled">Отменить</option>
                      </select>
                      <select
                        aria-label="Перенести запись"
                        value=""
                        onChange={(e) =>
                          e.target.value &&
                          onChange(b.id, { lesson_id: Number(e.target.value) })
                        }
                      >
                        <option value="">Перенести на…</option>
                        {catalog.lessons
                          .filter((l: any) => l.id !== b.lesson_id)
                          .map((l: any) => (
                            <option key={l.id} value={l.id}>
                              {l.course_title} · {date(l.starts_at, true)}
                            </option>
                          ))}
                      </select>
                    </div>
                  ) : (
                    <button
                      className="text-button"
                      onClick={() => propose("cancel", b.id)}
                    >
                      Отменить
                    </button>
                  ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!bookings.length && (
        <Empty title="Записей пока нет" text="Выберите занятие в расписании." />
      )}
    </div>
  );
}

function PurchaseTable({ purchases }: any) {
  return (
    <div className="panel table-wrap">
      <table>
        <thead>
          <tr>
            <th>Покупка</th>
            <th>Дата</th>
            <th>Сумма</th>
            <th>Статус</th>
          </tr>
        </thead>
        <tbody>
          {purchases.map((p: any) => (
            <tr key={p.id}>
              <td>
                <strong>{p.title}</strong>
                <small>
                  {
                    {
                      course: "Курс",
                      plan: "Абонемент",
                      lesson: "Разовое занятие",
                    }[p.kind]
                  }
                </small>
              </td>
              <td>{date(p.created_at, true)}</td>
              <td>{money(p.price)}</td>
              <td>
                <Badge value={p.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!purchases.length && <Empty title="Покупок пока нет" />}
    </div>
  );
}

function SubscriptionCard({ sub, children }: any) {
  return (
    <article className="subscription-card">
      <div className="subscription-heading">
        <span>
          <Ticket size={24} />
        </span>
        <div>
          <small>ВАШ АБОНЕМЕНТ #{sub.id}</small>
          <h3>
            {sub.format === "group"
              ? "Групповые занятия"
              : "Индивидуальные занятия"}
          </h3>
        </div>
        <span className="badge">Бессрочный</span>
      </div>
      <div className="balance-grid">
        <div>
          <strong>{sub.available}</strong>
          <span>Доступно</span>
        </div>
        <div>
          <strong>{sub.reserved}</strong>
          <span>В резерве</span>
        </div>
        <div>
          <strong>{sub.used}</strong>
          <span>Использовано</span>
        </div>
      </div>
      <div className="progress-track">
        <i style={{ width: (sub.used / Math.max(sub.total, 1)) * 100 + "%" }} />
      </div>
      <small className="muted">
        Всего в пакете: {sub.total} занятий · любые курсы
      </small>
      {children}
    </article>
  );
}

function TracePanel({ traces }: any) {
  return (
    <details className="sql-panel">
      <summary>
        <Database size={15} /> SQL-запросы <span>{traces.length}</span>
        <ChevronDown size={15} />
      </summary>
      {traces.length ? (
        traces.map((t: any) => (
          <div className="sql-query" key={t.id}>
            <strong>{t.purpose}</strong>
            <pre>{t.sql}</pre>
            <p>
              Параметры: <code>{t.parameters}</code>
            </p>
            <small>Строк: {t.row_count}</small>
          </div>
        ))
      ) : (
        <p>Для этого ответа SQL-запросы не выполнялись.</p>
      )}
    </details>
  );
}

export {
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
};
