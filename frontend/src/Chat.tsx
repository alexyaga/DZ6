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
import { useVoiceInput } from "./useVoiceInput";

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

function visibleChatActions(actions: any[]) {
  const isPurchase = (action: any) =>
    ["buy_plan", "buy_lesson"].includes(action.kind);
  const lessonId = (action: any) => {
    try {
      return JSON.parse(action.payload || "{}").booking_lesson_id;
    } catch {
      return undefined;
    }
  };
  const chosenLessons = new Set(
    actions
      .filter((action) => isPurchase(action) && action.status === "confirmed")
      .map(lessonId)
      .filter((id) => id !== undefined),
  );
  return actions.filter(
    (action) =>
      !(
        isPurchase(action) &&
        action.status === "cancelled" &&
        chosenLessons.has(lessonId(action))
      ),
  );
}

function Chat({ report, notify, refresh, user }: any) {
  const [conversations, setConversations] = useState<any[]>([]),
    [selected, setSelected] = useState<number | null>(null),
    [messages, setMessages] = useState<any[]>([]),
    [input, setInput] = useState(""),
    [busy, setBusy] = useState(false),
    [sql, setSql] = useState(localStorage.getItem("sql-panel") === "true"),
    [aiAvailable, setAiAvailable] = useState<boolean | null>(null),
    [switching, setSwitching] = useState(false);
  const end = useRef<HTMLDivElement>(null),
    selection = useRef<number | null>(null);
  const { voice, listening, transcribing, starting, voiceBusy } = useVoiceInput(
    (text) => setInput((current) => (current ? current + " " : "") + text),
    report,
  );
  async function loadList() {
    const c = await api("/conversations");
    setConversations(c);
    return c;
  }
  async function read(id: number) {
    const c = await api("/conversations/" + id);
    if (selection.current === id) setMessages(c.messages);
  }
  async function choose(id: number) {
    selection.current = id;
    setSelected(id);
    setMessages([]);
    try {
      await read(id);
    } catch (e) {
      report(e);
    }
  }
  async function create() {
    setSwitching(true);
    selection.current = null;
    setSelected(null);
    setMessages([]);
    try {
      const c = await api("/conversations", "POST");
      await loadList();
      await choose(c.id);
      return c.id;
    } catch (e) {
      report(e);
    } finally {
      setSwitching(false);
    }
  }
  useEffect(() => {
    api("/ai/status")
      .then((s) => setAiAvailable(s.available))
      .catch(report);
    loadList()
      .then((c) => {
        if (c.length) choose(c[0].id);
      })
      .catch(report);
  }, []);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, busy]);
  async function send(e?: any, quick?: string) {
    e?.preventDefault();
    const text = quick || input;
    if (!text.trim() || busy || switching || voiceBusy) return;
    setBusy(true);
    setInput("");
    try {
      let id = selected;
      if (!id) id = await create();
      if (!id) return;
      setMessages((m) => [
        ...m,
        { id: -1, role: "user", content: text, actions: [], traces: [] },
      ]);
      const result = await api(`/conversations/${id}/messages`, "POST", {
        content: text,
      });
      if (!result.ok) report(new Error(result.error));
      await read(id);
      await loadList();
      await refresh();
    } catch (e) {
      report(e);
    } finally {
      setBusy(false);
    }
  }
  async function retry(m: any) {
    setBusy(true);
    try {
      const result = await api(
        `/conversations/${selected}/messages/${m.id}/retry`,
        "POST",
      );
      if (!result.ok) report(new Error(result.error));
      await read(selected!);
      await refresh();
    } catch (e) {
      report(e);
    } finally {
      setBusy(false);
    }
  }
  async function decide(a: any, confirm: boolean) {
    setBusy(true);
    try {
      const r = await api(`/actions/${a.id}/decision`, "POST", { confirm });
      notify(r.result);
      await read(selected!);
      await refresh();
    } catch (e) {
      report(e);
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: number) {
    try {
      await api("/conversations/" + id, "DELETE");
      const c = await loadList();
      if (selected === id) {
        selection.current = null;
        setSelected(null);
        setMessages([]);
        if (c.length) choose(c[0].id);
      }
    } catch (e) {
      report(e);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="ВАШ ПЕРСОНАЛЬНЫЙ ПОМОЩНИК"
        title="AI-наставник"
        subtitle="Подберём курс, найдём время и спланируем следующий шаг."
      >
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={sql}
            onChange={(e) => {
              setSql(e.target.checked);
              localStorage.setItem("sql-panel", String(e.target.checked));
            }}
          />
          <Database size={16} />
          Показывать SQL
        </label>
      </PageTitle>
      <div className="chat-layout">
        <aside className="chat-list">
          <button
            className="primary"
            disabled={busy || switching || voiceBusy}
            onClick={() => create()}
          >
            <Plus size={17} />
            Новый диалог
          </button>
          <span className="workspace-label">ВАШИ ДИАЛОГИ</span>
          {conversations.map((c) => (
            <div
              className={`conversation-item ${selected === c.id ? "selected" : ""}`}
              key={c.id}
            >
              <button
                disabled={busy || switching || voiceBusy}
                onClick={() => choose(c.id)}
              >
                <MessageSquare size={16} />
                <span>
                  {c.title}
                  <small>{date(c.updated_at, true)}</small>
                </span>
              </button>
              <button
                aria-label="Удалить диалог"
                disabled={busy || voiceBusy}
                onClick={() => remove(c.id)}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <div className="chat-privacy">
            <ShieldCheck size={17} />
            <p>Ваши диалоги и данные доступны вам и администратору школы.</p>
          </div>
        </aside>
        <section className="chat-main">
          <div className="chat-top">
            <span className="mentor-avatar">
              <Sparkles size={20} />
            </span>
            <div>
              <strong>Наставник IT School</strong>
              <small>Помогает учиться и двигаться к цели</small>
            </div>
            <span className="badge">AI</span>
          </div>
          <div className="messages">
            {aiAvailable === false && (
              <div className="ai-status-note">
                AI пока не подключён. Администратору нужно сохранить API-ключ,
                выбрать модель и проверить подключение. История диалогов
                доступна.
              </div>
            )}
            {!messages.length && (
              <div className="chat-welcome">
                <span className="welcome-spark">
                  <Sparkles size={34} />
                </span>
                <h2>
                  Большие планы начинаются
                  <br />с простого вопроса
                </h2>
                <p>
                  Расскажите, чему хотите научиться.
                  <br />Я помогу найти подходящий курс и занятие.
                </p>
                <div className="quick-prompts">
                  {[
                    "Подбери курс для начинающего",
                    "Сколько занятий у меня осталось?",
                    "Покажи ближайшие занятия",
                  ].map((q) => (
                    <button
                      key={q}
                      disabled={busy || voiceBusy}
                      onClick={() => send(null, q)}
                    >
                      {q}
                      <ArrowUpRight size={15} />
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m) => (
              <div className={`message ${m.role}`} key={m.id}>
                {m.role === "assistant" && (
                  <span className="message-avatar">
                    <Sparkles size={17} />
                  </span>
                )}
                <div className="message-content">
                  <div className="message-bubble">{m.content}</div>
                  {m.status === "error" && (
                    <div className="message-error">
                      <AlertCircle size={14} />
                      Ответ не получен{" "}
                      <button
                        disabled={busy || voiceBusy}
                        onClick={() => retry(m)}
                      >
                        <RefreshCw size={13} />
                        Повторить
                      </button>
                    </div>
                  )}
                  {visibleChatActions(m.actions || []).map((a: any) => (
                    <div className="action-card" key={a.id}>
                      <strong>
                        <ShieldCheck size={16} />
                        Проверьте условия
                      </strong>
                      <p>{a.description}</p>
                      {a.status === "pending" ? (
                        <div>
                          <button
                            className="primary compact"
                            disabled={busy || voiceBusy}
                            onClick={() => decide(a, true)}
                          >
                            Подтвердить
                          </button>
                          <button
                            className="secondary compact"
                            disabled={busy || voiceBusy}
                            onClick={() => decide(a, false)}
                          >
                            Отмена
                          </button>
                        </div>
                      ) : (
                        <span className="action-result">
                          <Check size={16} />
                          {a.result || status(a.status)}
                        </span>
                      )}
                    </div>
                  ))}
                  {sql && m.role === "assistant" && (
                    <TracePanel traces={m.traces || []} />
                  )}
                  <small className="message-time">
                    {m.created_at ? date(m.created_at, true) : "Сейчас"}
                  </small>
                </div>
              </div>
            ))}
            {busy && (
              <div className="typing">
                <Sparkles size={17} />
                <span />
                <span />
                <span />
                <small>Наставник думает…</small>
              </div>
            )}
            <div ref={end} />
          </div>
          <form className="composer" onSubmit={send}>
            <textarea
              disabled={switching}
              aria-label="Сообщение наставнику"
              placeholder="Спросите о курсах, занятиях или своих планах…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={12000}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <button
              type="button"
              className={`mic ${listening ? "listening" : ""}`}
              aria-label={listening ? "Остановить запись" : "Голосовой ввод"}
              title="Распознать речь через OpenAI"
              disabled={starting || transcribing || busy || switching}
              onClick={voice}
            >
              {starting || transcribing ? (
                <RefreshCw size={18} className="voice-spinner" />
              ) : listening ? (
                <Square size={18} />
              ) : (
                <Mic size={20} />
              )}
            </button>
            <button
              type="submit"
              className="send"
              disabled={busy || switching || voiceBusy || !input.trim()}
              aria-label="Отправить сообщение"
            >
              <Send size={19} />
            </button>
          </form>
          <div className="composer-note">
            {starting
              ? "Включаем микрофон…"
              : transcribing
                ? "Распознаём речь через OpenAI…"
                : listening
                  ? "Говорите… Нажмите микрофон ещё раз, чтобы распознать запись. Максимум — 1 минута."
                  : "Голосовой ввод — через OpenAI. Текст можно исправить перед отправкой."}
          </div>
        </section>
      </div>
    </>
  );
}

export { Chat };
