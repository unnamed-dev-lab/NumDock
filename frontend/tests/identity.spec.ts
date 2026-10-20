import { expect, test } from "@playwright/test";

test("registration, persistent session, revocation and sign in", async ({
  page,
}) => {
  const email = `browser-${Date.now()}@example.com`;
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/register");
  await page.getByLabel("Full name").fill("Alex Morgan");
  await page.getByLabel("Workspace name").fill("Harbor Studio");
  await page.getByLabel("Email address").fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("a browser test passphrase");
  await page
    .getByRole("button", { name: "Create workspace", exact: true })
    .click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(
    page.getByRole("heading", { name: "Harbor Studio" }),
  ).toBeVisible();
  await expect(page.getByText(email).last()).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Harbor Studio" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/workspace-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("heading", { name: "Harbor Studio" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/workspace-mobile.png",
    fullPage: true,
  });
  const sidebarTrigger = page.getByRole("button", {
    name: "Toggle sidebar",
    exact: true,
  });
  await sidebarTrigger.click();
  const sidebar = page.getByRole("dialog", {
    name: "Workspace navigation",
    exact: true,
  });
  await expect(sidebar).toBeVisible();
  await expect.poll(async () => (await sidebar.boundingBox())?.x ?? -100).toBeGreaterThanOrEqual(-0.5);
  await expect(
    sidebar.getByRole("button", { name: "Close sidebar", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    sidebar.getByRole("button", { name: "Settings", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    sidebar.getByRole("button", { name: "Close sidebar", exact: true }),
  ).toBeFocused();
  await page.screenshot({
    path: "test-results/workspace-mobile-sidebar.png",
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await expect(sidebar).not.toBeVisible();
  await expect(sidebarTrigger).toBeFocused();
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Email address").fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("an incorrect browser password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "Email or password is incorrect.",
  );
  await page
    .getByLabel("Password", { exact: true })
    .fill("a browser test passphrase");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
  expect(errors).toEqual([]);
});

test("workspace shows honest unavailable states and redirects old routes", async ({
  page,
}) => {
  const email = `states-${Date.now()}@example.com`;
  await page.goto("/register");
  await page.getByLabel("Full name").fill("State Tester");
  await page.getByLabel("Workspace name").fill("State Studio");
  await page.getByLabel("Email address").fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("a state test passphrase");
  await page.getByRole("button", { name: "Create workspace", exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);

  await expect(page.getByText("Identity active", { exact: true })).toBeVisible();
  await expect(page.getByText("LIVE API", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Bandwidth", { exact: true })).toHaveCount(0);

  const pages: Array<[string, string, string]> = [
    ["/app/numbers", "Numbers", "No numbers yet"],
    ["/app/messages", "Messages", "No inbound messages"],
    ["/app/billing", "Billing", "No billing data"],
    ["/app/developers", "API & webhooks", "API access is not enabled"],
    ["/app/settings", "Settings", email],
  ];

  for (const [path, heading, text] of pages) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible();
    await expect(page.getByText(text, { exact: false }).first()).toBeVisible();
  }

  const redirects: Array<[string, RegExp]> = [
    ["/app/catalog", /\/app\/numbers$/],
    ["/app/inbox", /\/app\/messages$/],
    ["/app/orders", /\/app\/billing$/],
    ["/app/keys", /\/app\/developers$/],
    ["/app/admin", /\/app\/settings$/],
  ];

  for (const [path, target] of redirects) {
    await page.goto(path);
    await expect(page).toHaveURL(target);
  }

  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/app/numbers");
  await expect(page).toHaveURL(/\/login$/);
});

test("theme uses native transitions, persists, follows system and supports keyboard", async ({
  page,
}) => {
  await page.emulateMedia({
    colorScheme: "light",
    reducedMotion: "no-preference",
  });
  await page.goto("/login");
  await expect(
    page.getByRole("button", { name: "Theme: system" }),
  ).toBeVisible();
  await page.evaluate(() => {
    const original = document.startViewTransition.bind(document);
    Object.assign(window, { transitionCalls: 0 });
    document.startViewTransition = (...args: Parameters<typeof original>) => {
      Reflect.set(
        window,
        "transitionCalls",
        Number(Reflect.get(window, "transitionCalls")) + 1,
      );
      return original(...args);
    };
  });
  await page.getByRole("button", { name: "Theme: system" }).click();
  await page.getByRole("menuitemradio", { name: "Dark", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("button", { name: "Theme: dark" })).toBeEnabled();
  expect(
    await page.evaluate(() => Reflect.get(window, "transitionCalls")),
  ).toBe(1);
  await page.screenshot({
    path: "test-results/login-dark.png",
    fullPage: true,
  });
  await page.reload();
  await expect(page.getByRole("button", { name: "Theme: dark" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Theme: dark" }).focus();
  await page.keyboard.press("Enter");
  await page
    .getByRole("menuitemradio", { name: "System", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: "Theme: system" }),
  ).toBeEnabled();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("theme menu dismisses with Escape and restores trigger focus", async ({
  page,
}) => {
  await page.goto("/login");
  const trigger = page.getByRole("button", { name: "Theme: system" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menu")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test("authenticated workspace is reachable after SSR session validation", async ({
  page,
}) => {
  const email = `workspace-${Date.now()}@example.com`;
  const csrfResponse = await page.request.get("/v1/auth/csrf");
  expect(csrfResponse.ok()).toBe(true);
  const { token } = (await csrfResponse.json()) as { token: string };
  const registration = await page.request.post("/v1/auth/register", {
    headers: {
      Origin: "http://localhost:3000",
      "X-CSRF-Token": token,
    },
    data: {
      email,
      password: "a workspace test passphrase",
      name: "Workspace Tester",
      organization_name: "Workspace Studio",
    },
  });
  expect(registration.status()).toBe(201);

  await page.goto("/app");
  await expect(
    page.getByRole("heading", { name: "Workspace Studio" }),
  ).toBeVisible();

  await page.getByRole("button", { name: /^Numbers/ }).click();
  await expect(page).toHaveURL(/\/app\/numbers$/);
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(
    page.getByRole("heading", { name: "Workspace Studio" }),
  ).toBeVisible();
});

test("reduced motion and unsupported API switch theme without animation", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.goto("/login");
  await page.evaluate(() => {
    Object.assign(window, { transitionCalls: 0 });
    document.startViewTransition = () => {
      Reflect.set(
        window,
        "transitionCalls",
        Number(Reflect.get(window, "transitionCalls")) + 1,
      );
      throw new Error("must not animate reduced motion");
    };
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.getByRole("button", { name: "Theme: system" }).click();
  await page.getByRole("menuitemradio", { name: "Dark", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(
    await page.evaluate(() => Reflect.get(window, "transitionCalls")),
  ).toBe(0);
  await expect(page.getByRole("menu")).not.toBeVisible();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.evaluate(() => {
    Object.defineProperty(document, "startViewTransition", {
      value: undefined,
      configurable: true,
    });
  });
  await page.getByRole("button", { name: "Theme: dark" }).click();
  await page.getByRole("menuitemradio", { name: "Light", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(errors).toEqual([]);
});

test("validation, network error and narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/register");
  await page
    .getByRole("button", { name: "Create workspace", exact: true })
    .click();
  await expect(
    page.getByText("Enter your name.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Full name")).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/register-mobile.png",
    fullPage: true,
  });
  await page.goto("/login");
  await page.route("**/v1/auth/csrf", (route) => route.abort());
  await page.getByLabel("Email address").fill("offline@example.com");
  await page
    .getByLabel("Password", { exact: true })
    .fill("a browser test passphrase");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Unable to connect");
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeEnabled();
});

test("transition failure and unavailable storage do not block theme changes", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get: () => {
        throw new DOMException("Storage unavailable", "SecurityError");
      },
    });
  });
  await page.emulateMedia({
    reducedMotion: "no-preference",
    colorScheme: "light",
  });
  await page.goto("/login");
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.evaluate(() => {
    document.startViewTransition = () => {
      throw new Error("transition unavailable");
    };
  });
  await page.getByRole("button", { name: "Theme: system" }).click();
  await page.getByRole("menuitemradio", { name: "Dark", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("button", { name: "Theme: dark" })).toBeEnabled();
  expect(errors).toEqual([]);
});
