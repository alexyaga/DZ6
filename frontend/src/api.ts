let csrf = "";
export function setCsrf(value: string) {
  csrf = value;
}
export async function transcribeAudio(
  audio: Blob,
  signal: AbortSignal,
): Promise<string> {
  const response = await fetch("/api/ai/transcribe", {
    method: "POST",
    credentials: "same-origin",
    signal,
    headers: { "Content-Type": audio.type, "X-CSRF-Token": csrf },
    body: audio,
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(
      typeof result.detail === "string"
        ? result.detail
        : "Не удалось распознать речь",
    );
  return result.text;
}
export async function api(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<any> {
  const response = await fetch("/api" + path, {
    method,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const value = await response.json();
  if (!response.ok)
    throw new Error(
      typeof value.detail === "string"
        ? value.detail
        : "Проверьте заполнение полей",
    );
  return value;
}
export const money = (n: number) =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format((n || 0) / 100);
export const date = (value: string, short = false) =>
  new Date(
    value?.endsWith("Z") || /[+]\d\d:\d\d$/.test(value) ? value : value + "Z",
  ).toLocaleString("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "numeric",
    month: short ? "short" : "long",
    ...(short ? {} : { year: "numeric" }),
    hour: "2-digit",
    minute: "2-digit",
  });
export const fmt = (value: string) =>
  value === "group" ? "Групповое" : "Индивидуальное";
export const status = (s: string) =>
  ({
    reserved: "Записан",
    attended: "Посетил",
    absent: "Неявка",
    cancelled: "Отменено",
    completed: "Завершено",
    studying: "В процессе",
    scheduled: "Запланировано",
    available: "Доступно",
    used: "Использовано",
    confirmed: "Подтверждено",
    pending: "Ожидает подтверждения",
  })[s] || s;
