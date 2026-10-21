import { expect, test, type Page } from "@playwright/test";

async function switchLanguage(page: Page, label: "English" | "简体中文") {
  await page.getByRole("button", { name: /^(Language|语言)$/ }).click();
  await page.getByRole("menuitemradio", { name: label, exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute(
    "lang",
    label === "English" ? "en" : "zh-CN",
  );
}

test("SSR negotiates languages and keeps concurrent requests isolated", async ({
  request,
}) => {
  const cases: {
    headers: Record<string, string>;
    locale: string;
    title: string;
  }[] = [
    {
      headers: { "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8" },
      locale: "zh-CN",
      title: "登录 · NumDock",
    },
    {
      headers: { "Accept-Language": "en-US,en;q=0.9" },
      locale: "en",
      title: "Sign in · NumDock",
    },
    {
      headers: { "Accept-Language": "zh-CN", Cookie: "numdock.locale=en" },
      locale: "en",
      title: "Sign in · NumDock",
    },
    {
      headers: { "Accept-Language": "en", Cookie: "numdock.locale=zh-CN" },
      locale: "zh-CN",
      title: "登录 · NumDock",
    },
    {
      headers: {
        "Accept-Language": "fr,zh;q=0,en;q=0.8",
        Cookie: "numdock.locale=invalid",
      },
      locale: "en",
      title: "Sign in · NumDock",
    },
    {
      headers: { "Accept-Language": "zh;q=0.3,en;q=0.9" },
      locale: "en",
      title: "Sign in · NumDock",
    },
    {
      headers: { "Accept-Language": "fr-FR" },
      locale: "en",
      title: "Sign in · NumDock",
    },
  ];
  await Promise.all(
    [...cases, ...cases].map(async ({ headers, locale, title }) => {
      const response = await request.get("/login", { headers });
      expect(response.status()).toBe(200);
      const html = await response.text();
      expect(html).toContain(`<html lang="${locale}"`);
      expect(html).toContain(`<title>${title}</title>`);
      expect(response.headers()["cache-control"]).toContain("private");
      expect(response.headers()["content-language"]).toBe(locale);
      expect(response.headers()["vary"]).toContain("Accept-Language");
    }),
  );
});

test("Chinese first paint works without JavaScript", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    locale: "zh-CN",
    javaScriptEnabled: false,
  });
  const page = await context.newPage();
  await page.goto(`${baseURL}/register`);
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(
    page.getByRole("heading", { name: "创建你的工作区", level: 1 }),
  ).toBeVisible();
  await expect(page.getByLabel("电子邮箱")).toBeVisible();
  await expect(page).toHaveTitle("创建工作区 · NumDock");
  await context.close();
});

test("switching preserves form values and translates existing validation errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/v1/me", (route) =>
    route.fulfill({
      status: 401,
      json: { code: "unauthenticated", message: "Sign in" },
    }),
  );
  await page.goto("/register");
  await page.getByLabel("Email address").fill("alex@example.com");
  await expect(page.getByLabel("Email address")).toHaveValue(
    "alex@example.com",
  );
  await page
    .getByRole("button", { name: "Create workspace", exact: true })
    .click();
  await expect(
    page.getByText("Enter your name.", { exact: true }),
  ).toBeVisible();
  await switchLanguage(page, "简体中文");
  await expect(page.getByText("请输入姓名。", { exact: true })).toBeVisible();
  await expect(page.getByLabel("电子邮箱")).toHaveValue("alex@example.com");
  await expect(page).toHaveTitle("创建工作区 · NumDock");
  await expect(
    page.getByRole("button", { name: "主题：跟随系统" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "创建你的工作区", level: 1 }),
  ).toBeVisible();
  const cookie = (await page.context().cookies()).find(
    (cookie) => cookie.name === "numdock.locale",
  );
  expect(cookie?.value).toBe("zh-CN");
  await page.getByRole("link", { name: "登录", exact: true }).click();
  await expect(page).toHaveTitle("登录 · NumDock");
  await switchLanguage(page, "English");
  await expect(
    page.getByRole("heading", { name: "Welcome back", level: 1 }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("API errors use codes and update when the language changes", async ({
  page,
}) => {
  await page.route("**/v1/me", (route) =>
    route.fulfill({
      status: 401,
      json: { code: "unauthenticated", message: "Sign in" },
    }),
  );
  await page.route("**/v1/auth/csrf", (route) =>
    route.fulfill({ json: { token: "test-csrf" } }),
  );
  let code = "invalid_credentials";
  await page.route("**/v1/auth/login", (route) =>
    route.fulfill({
      status: 401,
      json: { code, message: "Backend diagnostic: do not show this string" },
    }),
  );
  await page.goto("/login");
  await page.getByLabel("Email address").fill("alex@example.com");
  await page
    .getByLabel("Password", { exact: true })
    .fill("an incorrect passphrase");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "Email or password is incorrect.",
  );
  await switchLanguage(page, "简体中文");
  await expect(page.getByRole("alert")).toHaveText("邮箱或密码错误。");
  code = "future_unknown_code";
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "请求暂时无法完成，请重试。",
  );
  await page.route("**/v1/auth/csrf", (route) => route.abort());
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "无法连接，请检查网络后重试。",
  );
});

test("workspace routes, roles, counts, dates and mobile controls are localized", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // Browser request interception cannot replace the server-side auth loader.
  // Register through the real API so SSR and hydration use the same identity.
  const csrfResponse = await page.request.get("/v1/auth/csrf");
  const { token } = await csrfResponse.json();
  const registration = await page.request.post("/v1/auth/register", {
    headers: { Origin: "http://localhost:3000", "X-CSRF-Token": token },
    data: {
      name: "Alex Morgan",
      email: `i18n-${Date.now()}@example.test`,
      password: "i18n browser test passphrase",
      organization_name: "Harbor 1",
    },
  });
  expect(registration.status()).toBe(201);
  const identity = await registration.json();
  const date = (locale: string) =>
    new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(identity.user.created_at));
  await page.goto("/app");
  await expect(page.getByRole("heading", { name: "Harbor 1" })).toBeVisible();
  await expect(page.getByText("1 workspace", { exact: true })).toBeVisible();
  await expect(
    page.getByText(date("en"), { exact: true }).first(),
  ).toBeVisible();
  await switchLanguage(page, "简体中文");
  await expect(page.getByText("1 个工作区", { exact: true })).toBeVisible();
  await expect(page.getByText("所有者", { exact: true }).first()).toBeVisible();
  await expect(
    page.getByText(date("zh-CN"), { exact: true }).first(),
  ).toBeVisible();
  const routes = [
    ["numbers", "号码"],
    ["messages", "消息"],
    ["billing", "账单"],
    ["developers", "API 与 Webhook"],
    ["settings", "设置"],
  ];
  for (const [path, title] of routes) {
    await page.goto(`/app/${path}`);
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await expect(page).toHaveTitle(`${title} · NumDock`);
    expect(await page.locator("main").innerText()).not.toMatch(
      /(?:workspace|common|errors|auth)\.[a-z]/,
    );
  }
  await page.screenshot({
    path: "test-results/i18n-settings-zh-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "主题：跟随系统" }).click();
  await page.getByRole("menuitemradio", { name: "深色", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("button", { name: "主题：深色" })).toBeEnabled();
  await expect(page.getByRole("menu")).not.toBeVisible();
  await page.screenshot({
    path: "test-results/i18n-settings-zh-mobile-dark.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "切换侧边栏" }).click();
  const sidebar = page.getByRole("dialog", { name: "工作区导航" });
  await expect(sidebar).toBeVisible();
  await expect
    .poll(async () => (await sidebar.boundingBox())?.x ?? -100)
    .toBeGreaterThanOrEqual(-0.5);
  await expect(
    sidebar.getByRole("button", { name: "关闭侧边栏", exact: true }),
  ).toBeFocused();
  await page.screenshot({
    path: "test-results/i18n-sidebar-zh-mobile.png",
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await expect(sidebar).not.toBeVisible();
  await expect(page.getByRole("button", { name: "切换侧边栏" })).toBeFocused();
  await switchLanguage(page, "English");
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("missing routes preserve Chinese SSR, status and recovery controls", async ({
  page,
  baseURL,
}) => {
  await page
    .context()
    .addCookies([{ name: "numdock.locale", value: "zh-CN", url: baseURL! }]);
  const response = await page.goto("/missing-i18n-page");
  expect(response?.status()).toBe(404);
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(page.getByText("页面不存在", { exact: true })).toBeVisible();
  await expect(page).toHaveTitle("页面不存在 · NumDock");
  await expect(page.getByRole("link", { name: "打开工作区" })).toHaveAttribute(
    "href",
    "/app",
  );
  await switchLanguage(page, "English");
  await expect(page.getByText("Page not found", { exact: true })).toBeVisible();
});
