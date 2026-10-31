import { test, expect } from "@playwright/test";

test("admin opens course program and plans a lesson with visible topic and teacher", async ({
  page,
}) => {
  await login(page, "admin", "AdminDemo!2026");
  await page.getByRole("button", { name: "Курсы", exact: true }).click();
  await page
    .getByRole("button", { name: "Основы Python", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Программа курса" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Расписание курса" }),
  ).toBeVisible();
  await expect(
    page.getByText("Переменные и типы", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Тема урока" }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "Алексей Морозов", exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("row").filter({ hasText: "SQL и базы данных" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Прошедшие", exact: true }).click();
  await expect(page.getByRole("cell", { name: "Посетил" })).toHaveCount(0);
  await expect(
    page.getByRole("cell", { name: "Завершено" }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Предстоящие", exact: true }).click();
  await page
    .getByRole("button", { name: "Добавить занятие", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("combobox", { name: "Курс", exact: true }),
  ).toHaveValue("1");
  await dialog
    .getByRole("combobox", { name: "Курс", exact: true })
    .selectOption("2");
  await expect(
    dialog.getByRole("combobox", { name: "Тема", exact: true }),
  ).toHaveValue("3");
  await dialog
    .getByRole("combobox", { name: "Курс", exact: true })
    .selectOption("1");
  await expect(
    dialog.getByRole("combobox", { name: "Тема", exact: true }),
  ).toHaveValue("1");
  await dialog
    .getByRole("combobox", { name: "Тема", exact: true })
    .selectOption({ label: "Функции и коллекции" });
  await dialog
    .getByRole("combobox", { name: "Преподаватель", exact: true })
    .selectOption({ label: "Алексей Морозов" });
  const day = new Date(Date.now() + 45 * 86400000).toISOString().slice(0, 10);
  await dialog
    .getByLabel("Начало (Москва)", { exact: true })
    .fill(day + "T14:00");
  await dialog
    .getByLabel("Окончание (Москва)", { exact: true })
    .fill(day + "T15:00");
  await dialog.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const lesson = page
    .getByRole("row")
    .filter({ hasText: "Функции и коллекции" })
    .filter({ hasText: "14:00" });
  await expect(lesson).toContainText("Алексей Морозов");
  await page.screenshot({
    path: "../data/qa/course-schedule.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Занятия", exact: true }).click();
  await expect(
    page.getByRole("columnheader", { name: "Тема урока" }),
  ).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Преподаватель" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: "Функции и коллекции" })
      .filter({ hasText: "14:00" }),
  ).toContainText("Основы Python");
});

test("new course can receive topics before scheduling", async ({ page }) => {
  await login(page, "admin", "AdminDemo!2026");
  await page.getByRole("button", { name: "Курсы", exact: true }).click();
  await page.getByRole("button", { name: "Добавить", exact: true }).click();
  await page.getByLabel("Название", { exact: true }).fill("План нового курса");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "План нового курса", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Добавить занятие", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Добавить тему", exact: true })
    .click();
  await page.getByLabel("Название", { exact: true }).fill("Вводный урок");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", {
      name: "Изменить тему: Вводный урок",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Добавить занятие", exact: true }),
  ).toBeEnabled();
});

async function login(page: any, login = "anna", password = "AnnaDemo!2026") {
  await page.goto("/");
  await page.getByLabel("Логин", { exact: true }).fill(login);
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Войти в кабинет" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

test("administrator can promote a client who can then promote another client", async ({
  page,
}) => {
  async function createAndPromote(name: string, username: string) {
    await page
      .getByRole("button", { name: "Пользователи", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Новый клиент", exact: true })
      .click();
    const form = page.getByRole("dialog", { name: "Новый клиент" });
    await form.getByLabel("Имя", { exact: true }).fill(name);
    await form.getByLabel("Логин", { exact: true }).fill(username);
    await form.getByLabel("Пароль", { exact: true }).fill("StaffDemo!2026");
    await form.getByRole("button", { name: "Сохранить", exact: true }).click();
    await expect(form).toHaveCount(0);
    await page.getByLabel("Поиск пользователя").fill(username);
    await page.getByRole("button", { name: "Открыть карточку" }).click();
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Назначить администратором", exact: true })
      .click();
    const confirmation = page.getByRole("dialog", {
      name: "Назначить администратора",
    });
    await expect(confirmation).toContainText(name);
    await confirmation
      .getByRole("button", { name: "Назначить", exact: true })
      .click();
    await expect(confirmation).toHaveCount(0);
    await expect(
      page.getByRole("row").filter({ hasText: username }),
    ).toContainText("Администратор");
    await expect(
      page.getByRole("button", {
        name: "Назначить администратором",
        exact: true,
      }),
    ).toHaveCount(0);
  }
  await login(page, "admin", "AdminDemo!2026");
  await createAndPromote("Новый администратор", "staff_one");
  await page.getByRole("button", { name: "Выйти", exact: true }).click();
  await login(page, "staff_one", "StaffDemo!2026");
  await expect(
    page.getByRole("button", { name: "Настройки AI", exact: true }),
  ).toBeVisible();
  await createAndPromote("Второй администратор", "staff_two");
});
test("client dashboard, confirmation, schedule and chat history", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page);
  await expect(
    page.getByRole("heading", { name: "Привет, Анна!" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "SQL и базы данных", level: 3 }),
  ).toBeVisible();
  await page.screenshot({ path: "../data/qa/dashboard.png", fullPage: true });
  await page.getByRole("button", { name: "Абонементы", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Мои абонементы" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Оформить учебную покупку" })
    .last()
    .click();
  await expect(
    page.getByRole("dialog", { name: "Подтвердите действие" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Подтвердить", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Индивидуальные занятия", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Расписание", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Направление", exact: true })
    .selectOption("3");
  await page
    .getByRole("combobox", { name: "Формат", exact: true })
    .selectOption("individual");
  await page
    .getByRole("button", { name: "Записаться", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Подтвердить", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Отменить запись", exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "AI-наставник" }).click();
  await expect(
    page.getByText("Сохранил ваше предпочтение.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("checkbox", { name: "Показывать SQL" }).check();
  await page.getByRole("button", { name: "Новый диалог", exact: true }).click();
  await page.getByLabel("Сообщение наставнику").fill("Покажи расписание");
  await page.getByRole("button", { name: "Отправить сообщение" }).click();
  await expect(page.getByText("Ответ не получен")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "AI-наставник" }).click();
  await expect(
    page.getByText("Покажи расписание", { exact: true }).first(),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("admin catalog, client details and AI settings", async ({ page }) => {
  await login(page, "admin", "AdminDemo!2026");
  await page.getByRole("button", { name: "Пользователи", exact: true }).click();
  await page.getByRole("button", { name: "Открыть карточку" }).first().click();
  await expect(
    page.getByRole("heading", { name: "Анна Смирнова" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Прочитать", exact: true })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Закрыть", exact: true }).click();
  await page.getByRole("button", { name: "Курсы", exact: true }).click();
  await page.getByRole("button", { name: "Добавить", exact: true }).click();
  await page.getByLabel("Название", { exact: true }).fill("Тестовый курс");
  await page
    .getByLabel("Описание", { exact: true })
    .fill("Практическое обучение");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.getByText("Тестовый курс", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Настройки AI", exact: true }).click();
  await expect(page.getByLabel(/^API-ключ/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Проверить подключение" }),
  ).toBeDisabled();
  await page.screenshot({
    path: "../data/qa/admin-settings.png",
    fullPage: true,
  });
});
test("mobile navigation and memory editing", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "mikhail", "MikhailDemo!2026");
  await page.getByRole("button", { name: "Открыть меню" }).click();
  await page.getByRole("button", { name: "Память", exact: true }).click();
  await page.getByRole("button", { name: "Изменить сведение" }).first().click();
  await page
    .getByRole("textbox", { name: "Содержание", exact: true })
    .fill("Мне удобно заниматься утром");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByText("Мне удобно заниматься утром", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "../data/qa/mobile-memory.png",
    fullPage: true,
  });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
});

async function mockMicrophone(page: any) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: async () => ({
        getTracks: () => [
          {
            stop: () => {
              (window as any).__microphoneStopped = true;
            },
          },
        ],
      }),
    });
    (window as any).MediaRecorder = class {
      static isTypeSupported(type: string) {
        return type.startsWith("audio/webm");
      }
      state = "inactive";
      mimeType: string;
      ondataavailable: any;
      onstop: any;
      onerror: any;
      constructor(_stream: any, options: any) {
        this.mimeType = options.mimeType;
      }
      start() {
        this.state = "recording";
      }
      stop() {
        this.state = "inactive";
        queueMicrotask(() => {
          this.ondataavailable?.({
            data: new Blob(["recorded-audio"], { type: this.mimeType }),
          });
          this.onstop?.();
        });
      }
    };
  });
}

test("OpenAI transcription fills editable draft without sending", async ({
  page,
}) => {
  let sent = 0,
    uploads = 0;
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().endsWith("/messages")) sent++;
  });
  await mockMicrophone(page);
  await page.route("**/api/ai/transcribe", async (route) => {
    uploads++;
    expect(route.request().headers()["content-type"]).toContain("audio/webm");
    expect(route.request().postDataBuffer()?.toString()).toBe("recorded-audio");
    await route.fulfill({
      json: { text: "Хочу изучать Python", model: "gpt-4o-mini-transcribe" },
    });
  });
  await login(page);
  await page.getByRole("button", { name: "AI-наставник" }).click();
  await page.getByLabel("Сообщение наставнику").fill("Моя цель:");
  await page
    .getByRole("button", { name: "Голосовой ввод", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Остановить запись" }),
  ).toBeVisible();
  expect(uploads).toBe(0);
  await page.getByRole("button", { name: "Остановить запись" }).click();
  await expect(page.getByLabel("Сообщение наставнику")).toHaveValue(
    "Моя цель: Хочу изучать Python",
  );
  await page.getByLabel("Сообщение наставнику").fill("Хочу изучать SQL");
  expect(uploads).toBe(1);
  expect(sent).toBe(0);
  expect(await page.evaluate(() => (window as any).__microphoneStopped)).toBe(
    true,
  );
});

test("unsupported recording keeps text input usable", async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).MediaRecorder = undefined;
  });
  await login(page);
  await page.getByRole("button", { name: "AI-наставник" }).click();
  await page.getByRole("button", { name: "Голосовой ввод" }).click();
  await expect(page.getByRole("alert")).toContainText("не поддерживает запись");
  await page.getByLabel("Сообщение наставнику").fill("Обычное сообщение");
  await expect(
    page.getByRole("button", { name: "Отправить сообщение" }),
  ).toBeEnabled();
});

test("OpenAI transcription error preserves draft and releases microphone", async ({
  page,
}) => {
  await mockMicrophone(page);
  await page.route("**/api/ai/transcribe", (route) =>
    route.fulfill({
      status: 502,
      json: { detail: "Не удалось распознать речь через OpenAI" },
    }),
  );
  await login(page);
  await page.getByRole("button", { name: "AI-наставник" }).click();
  await page.getByLabel("Сообщение наставнику").fill("Не потерять этот текст");
  await page.getByRole("button", { name: "Голосовой ввод" }).click();
  await page.getByRole("button", { name: "Остановить запись" }).click();
  await expect(page.getByRole("alert")).toContainText("Не удалось распознать");
  await expect(page.getByLabel("Сообщение наставнику")).toHaveValue(
    "Не потерять этот текст",
  );
  await expect(
    page.getByRole("button", { name: "Голосовой ввод" }),
  ).toBeEnabled();
  expect(await page.evaluate(() => (window as any).__microphoneStopped)).toBe(
    true,
  );
});

test("recording stops automatically after one minute", async ({ page }) => {
  await mockMicrophone(page);
  await page.route("**/api/ai/transcribe", (route) =>
    route.fulfill({
      json: { text: "Короткая запись", model: "gpt-4o-mini-transcribe" },
    }),
  );
  await login(page);
  await page.getByRole("button", { name: "AI-наставник" }).click();
  await page.clock.install();
  await page.getByRole("button", { name: "Голосовой ввод" }).click();
  await expect(
    page.getByRole("button", { name: "Остановить запись" }),
  ).toBeVisible();
  await page.clock.fastForward(60000);
  await expect(page.getByLabel("Сообщение наставнику")).toHaveValue(
    "Короткая запись",
  );
  expect(await page.evaluate(() => (window as any).__microphoneStopped)).toBe(
    true,
  );
});
