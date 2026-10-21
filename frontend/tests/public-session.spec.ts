import { existsSync, readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
const passwordFile = new URL("../../.local/dev-seed-password", import.meta.url);
const password =
  process.env.DEV_SEED_PASSWORD ??
  (existsSync(passwordFile) ? readFileSync(passwordFile, "utf8").trim() : "");

test("public pages share the authenticated session, backend modes and logout", async ({
  page,
  request,
}) => {
  test.skip(!password, "Run development seed");
  test.setTimeout(60000);
  let identityRequests = 0;
  page.on("request", (req) => {
    if (new URL(req.url()).pathname === "/v1/me") identityRequests++;
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/login");
  await page.getByLabel("Email address").fill("owner@numdock.test");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(
    page.getByRole("heading", {
      name: "NumDock Development (Mock)",
      exact: true,
    }),
  ).toBeVisible();
  const beforeHome = identityRequests;
  await page.getByRole("link", { name: "NumDock home", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  const header = page.getByRole("banner");
  await expect(
    header.getByRole("button", { name: "Account menu" }),
  ).toBeVisible();
  await expect(
    header.getByRole("link", { name: "Sign in", exact: true }),
  ).toHaveCount(0);
  await expect(
    header.getByRole("link", { name: "Create a workspace", exact: true }),
  ).toHaveCount(0);
  expect(identityRequests).toBe(beforeHome);
  await expect(page.getByText("Mock enabled", { exact: true })).toHaveCount(5);
  await header.getByRole("link", { name: "Platform", exact: true }).click();
  await expect(page.getByText("Mock enabled", { exact: true })).toHaveCount(5);
  await expect(
    page.getByText(
      "Live number provider: Not connected · Payment channel: Not connected",
      { exact: true },
    ),
  ).toBeVisible();
  expect(identityRequests).toBe(beforeHome);
  // A public HTML response never embeds the authenticated user's identity.
  const html = await (await page.request.get("/platform")).text();
  expect(html).not.toContain("owner@numdock.test");
  expect(html).not.toContain("Development Owner");
  await page.reload();
  await expect(
    header.getByRole("button", { name: "Account menu" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/public-platform-session.png",
    fullPage: true,
  });
  await header.getByRole("link", { name: "Status", exact: true }).click();
  const refresh = page.getByRole("button", {
    name: "Check again",
    exact: true,
  });
  await page.route("**/v1/status", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.features = {
      ...body.features,
      catalog: "disabled",
      numbers: "disabled",
      messaging: "disabled",
      billing: "disabled",
      developer: "disabled",
    };
    await route.fulfill({ response, json: body });
  });
  await refresh.click();
  await expect(page.getByText("Disabled", { exact: true })).toHaveCount(5);
  await page.unroute("**/v1/status");
  await refresh.click();
  await expect(page.getByText("Mock enabled", { exact: true })).toHaveCount(5);
  await page.route("**/v1/status", (route) => route.abort());
  await refresh.click();
  await expect(page.getByRole("alert")).toContainText(
    "Unable to refresh status",
  );
  await expect(page.getByText("Mock enabled", { exact: true })).toHaveCount(5);
  await page.unroute("**/v1/status");
  await refresh.click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.getByRole("button", { name: "Language", exact: true }).click();
  await page
    .getByRole("menuitemradio", { name: "简体中文", exact: true })
    .click();
  await expect(page.getByText("Mock 已启用", { exact: true })).toHaveCount(5);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/public-status-mobile-zh.png",
    fullPage: true,
  });
  await header.getByRole("button", { name: "账户菜单", exact: true }).click();
  await page.getByRole("menuitem", { name: "打开工作区", exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(
    page.getByRole("heading", {
      name: "NumDock Development (Mock)",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "切换侧边栏", exact: true }).click();
  await page
    .getByRole("dialog", { name: "工作区导航", exact: true })
    .getByRole("link", { name: "NumDock 首页", exact: true })
    .click();
  await header.getByRole("button", { name: "账户菜单", exact: true }).click();
  await page.getByRole("menuitem", { name: "退出登录", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/");
  await expect(
    header.getByRole("link", { name: "登录", exact: true }),
  ).toBeVisible();
  await expect(
    header.getByRole("button", { name: "账户菜单", exact: true }),
  ).toHaveCount(0);
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login$/);
  expect(errors).toEqual([]);
  const status = await request.get("/v1/status");
  expect(status.ok()).toBe(true);
});

test("public session pending and connection errors are not treated as logged out", async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/v1/me", async (route) => {
    await gate;
    await route.abort();
  });
  await page.goto("/");
  const header = page.getByRole("banner");
  await expect(header.getByRole("status")).toContainText("Checking session");
  await expect(
    header.getByRole("link", { name: "Sign in", exact: true }),
  ).toHaveCount(0);
  release();
  await expect(
    header.getByRole("button", { name: "Retry session", exact: true }),
  ).toBeVisible();
  await expect(
    header.getByRole("link", { name: "Sign in", exact: true }),
  ).toHaveCount(0);
  await page.unroute("**/v1/me");
  await header
    .getByRole("button", { name: "Retry session", exact: true })
    .click();
  await expect(
    header.getByRole("link", { name: "Sign in", exact: true }),
  ).toBeVisible();
});

test("revoked sessions replace cached identity without a login redirect loop", async ({
  page,
}) => {
  test.skip(!password, "Run development seed");
  await page.goto("/login");
  await page.getByLabel("Email address").fill("owner@numdock.test");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "NumDock Development (Mock)",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("link", { name: "NumDock home", exact: true }).click();
  await expect(
    page.getByRole("banner").getByRole("button", { name: "Account menu" }),
  ).toBeVisible();
  const csrf = await (await page.request.get("/v1/auth/csrf")).json();
  const revoked = await page.request.post("/v1/auth/logout", {
    headers: { Origin: new URL(page.url()).origin, "X-CSRF-Token": csrf.token },
  });
  expect(revoked.ok()).toBe(true);
  await page
    .getByRole("banner")
    .getByRole("link", { name: "Open workspace", exact: true })
    .click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByLabel("Email address")).toBeVisible();
  await page.getByRole("link", { name: "Back to home", exact: true }).click();
  await expect(
    page
      .getByRole("banner")
      .getByRole("link", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("banner").getByRole("button", { name: "Account menu" }),
  ).toHaveCount(0);
});
