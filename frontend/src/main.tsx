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
import "./style.css";
import "./polish.css";

const navClient = [
  ["home", "Главная", LayoutDashboard],
  ["catalog", "Каталог курсов", BookOpen],
  ["schedule", "Расписание", CalendarDays],
  ["learning", "Моё обучение", GraduationCap],
  ["subscriptions", "Абонементы", Ticket],
  ["chat", "AI-наставник", Sparkles],
  ["memory", "Память", Database],
  ["profile", "Профиль", UserRound],
] as const;
const navAdmin = [
  ["home", "Обзор школы", LayoutDashboard],
  ["users", "Пользователи", UsersRound],
  ["courses", "Курсы", BookOpen],
  ["teachers", "Преподаватели", GraduationCap],
  ["lessons", "Занятия", CalendarDays],
  ["plans", "Абонементы", Ticket],
  ["admin-dialogs", "Диалоги и память", MessageSquare],
  ["settings", "Настройки AI", Settings2],
] as const;
import {
  Login,
  Dashboard,
  Catalog,
  Schedule,
  Learning,
  Subscriptions,
  MemoryPanel,
  Profile,
} from "./Student";
import { Chat } from "./Chat";
import { AdminHome, AdminCatalog, AdminUsers, AISettings } from "./Admin";
import { Modal } from "./shared";

function App() {
  const [user, setUser] = useState<any>(null),
    [ready, setReady] = useState(false),
    [page, setPage] = useState("home"),
    [dataReady, setDataReady] = useState(false);
  const [catalog, setCatalog] = useState<any>({
      courses: [],
      teachers: [],
      plans: [],
      lessons: [],
    }),
    [learning, setLearning] = useState<any>({
      subscriptions: [],
      bookings: [],
      enrollments: [],
      purchases: [],
    });
  const [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [modal, setModal] = useState<any>(null),
    [actionBusy, setActionBusy] = useState(false),
    [mobile, setMobile] = useState(false);
  const accountRef = useRef<number | null>(null);
  accountRef.current = user?.id || null;
  const isAdmin = user?.role === "admin";
  function report(err: any) {
    setError(err.message || "Не удалось выполнить действие");
  }
  async function refresh() {
    const uid = user?.id;
    const [c, l] = await Promise.all([
      api("/catalog/all"),
      api("/me/learning"),
    ]);
    if (accountRef.current !== uid) return;
    setCatalog(c);
    setLearning(l);
    setDataReady(true);
  }
  useEffect(() => {
    api("/auth/me")
      .then((u) => {
        setCsrf(u.csrf);
        setUser(u);
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);
  useEffect(() => {
    if (user) {
      setDataReady(false);
      refresh().catch(report);
    }
  }, [user?.id]);
  useEffect(() => {
    if (notice) {
      const t = setTimeout(() => setNotice(""), 5000);
      return () => clearTimeout(t);
    }
  }, [notice]);
  function go(next: string) {
    setPage(next);
    setMobile(false);
    setError("");
  }
  async function propose(kind: string, target_id: number) {
    try {
      setModal(await api("/actions", "POST", { kind, target_id }));
    } catch (e) {
      report(e);
    }
  }
  async function decide(confirm: boolean) {
    setActionBusy(true);
    try {
      const result = await api(`/actions/${modal.id}/decision`, "POST", {
        confirm,
      });
      setModal(null);
      setNotice(result.result);
      await refresh();
    } catch (e) {
      report(e);
    } finally {
      setActionBusy(false);
    }
  }
  async function logout() {
    try {
      await api("/auth/logout", "POST");
      setDataReady(false);
      setUser(null);
      setCsrf("");
      setPage("home");
    } catch (e) {
      report(e);
    }
  }
  const common = {
    catalog,
    learning,
    go,
    propose,
    refresh,
    report,
    notify: setNotice,
    user,
  };
  if (!ready)
    return (
      <div className="loading">
        <span className="brand-mark">
          <Code2 />
        </span>
        <p>Загружаем ваше пространство…</p>
      </div>
    );
  if (!user)
    return (
      <Login
        onLogin={(u) => {
          setCsrf(u.csrf);
          setUser(u);
        }}
      />
    );
  const current = (isAdmin ? navAdmin : navClient).find((n) => n[0] === page);
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobile ? "open" : ""}`}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            go("home");
          }}
        >
          <span className="brand-mark">
            <Code2 size={24} />
          </span>
          <span>
            IT<span className="brand-light"> School</span>
            <small>ПРОСТРАНСТВО ДЛЯ РОСТА</small>
          </span>
        </a>
        <div className="workspace-label">
          {isAdmin ? "УПРАВЛЕНИЕ ШКОЛОЙ" : "ЛИЧНЫЙ КАБИНЕТ"}
        </div>
        <nav>
          {(isAdmin ? navAdmin : navClient).map(([id, label, Icon]) => (
            <button
              key={id}
              className={`nav-item ${page === id ? "active" : ""}`}
              onClick={() => go(id)}
            >
              <Icon size={19} />
              <span>{label}</span>
              {id === "chat" && <span className="ai-badge">AI</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-promo">
            <Sparkles size={22} />
            <strong>
              {isAdmin ? "Всё под контролем" : "Большие цели. Маленькие шаги."}
            </strong>
            <p>
              {isAdmin
                ? "Помогайте студентам двигаться вперёд."
                : "Учитесь в своём темпе. Мы рядом на каждом этапе."}
            </p>
            {!isAdmin && (
              <button onClick={() => go("chat")}>
                Спросить наставника <ArrowUpRight size={16} />
              </button>
            )}
          </div>
          <div className="sidebar-user">
            <span className="avatar">{user.name.slice(0, 1)}</span>
            <div>
              <strong>{user.name.split(" ")[0]}</strong>
              <small>{isAdmin ? "Администратор" : "Студент"}</small>
            </div>
          </div>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu"
              aria-label="Открыть меню"
              onClick={() => setMobile(!mobile)}
            >
              <Menu />
            </button>
            <span>{isAdmin ? "Администрирование" : "Моё пространство"}</span>
            <ChevronRight size={14} />
            <strong>{current?.[1]}</strong>
          </div>
          <div className="topbar-right">
            <span className="demo-indicator">
              <span />
              Учебный проект
            </span>
            <span className="avatar small">{user.name.slice(0, 1)}</span>
            <button
              className="account-logout"
              title="Выйти из аккаунта"
              onClick={logout}
            >
              <LogOut size={17} />
              <span>Выйти</span>
            </button>
          </div>
        </header>
        <div
          className={`content ${dataReady && page === "chat" ? "chat-content" : ""}`}
        >
          {error && (
            <div role="alert" className="alert error">
              <AlertCircle size={18} />
              <span>{error}</span>
              <button aria-label="Закрыть ошибку" onClick={() => setError("")}>
                <X size={17} />
              </button>
            </div>
          )}
          {!dataReady && (
            <div className="panel empty">
              <RefreshCw size={28} />
              <h3>Загружаем ваше пространство…</h3>
              {error && (
                <button
                  className="secondary"
                  onClick={() => refresh().catch(report)}
                >
                  Повторить загрузку
                </button>
              )}
            </div>
          )}
          {dataReady &&
            page === "home" &&
            (isAdmin ? (
              <AdminHome go={go} report={report} />
            ) : (
              <Dashboard {...common} />
            ))}
          {dataReady && page === "catalog" && <Catalog {...common} />}
          {dataReady && page === "schedule" && <Schedule {...common} />}
          {dataReady && page === "learning" && <Learning {...common} />}
          {dataReady && page === "subscriptions" && (
            <Subscriptions {...common} />
          )}
          {dataReady && page === "chat" && <Chat {...common} />}
          {dataReady && page === "memory" && (
            <MemoryPanel report={report} notify={setNotice} />
          )}
          {dataReady && page === "profile" && (
            <Profile
              user={user}
              update={(u) => setUser({ ...user, ...u })}
              report={report}
              notify={setNotice}
            />
          )}
          {dataReady &&
            isAdmin &&
            ["users", "admin-dialogs"].includes(page) && (
              <AdminUsers
                key={page}
                {...common}
                dialogs={dataReady && page === "admin-dialogs"}
              />
            )}
          {dataReady &&
            isAdmin &&
            ["courses", "teachers", "lessons", "plans"].includes(page) && (
              <AdminCatalog key={page} entity={page} {...common} />
            )}
          {dataReady && isAdmin && page === "settings" && (
            <AISettings report={report} notify={setNotice} />
          )}
        </div>
        <footer>
          IT School <span>Учись. Создавай. Развивайся.</span>
          <span>Время занятий — Москва (UTC+3)</span>
        </footer>
      </main>
      {notice && (
        <div role="status" className="toast">
          <CheckCircle2 size={20} />
          {notice}
        </div>
      )}
      {modal && (
        <Modal
          title="Подтвердите действие"
          close={() => !actionBusy && setModal(null)}
        >
          <div className="confirmation-icon">
            <ShieldCheck />
          </div>
          <p className="confirmation-text">{modal.description}</p>
          <p className="muted">Проверьте условия перед подтверждением.</p>
          <div className="modal-actions">
            <button
              className="secondary"
              disabled={actionBusy}
              onClick={() => decide(false)}
            >
              Отмена
            </button>
            <button
              className="primary"
              disabled={actionBusy}
              onClick={() => decide(true)}
            >
              {actionBusy ? "Проверяем…" : "Подтвердить"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
