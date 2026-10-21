import { readFileSync, existsSync } from "node:fs";
import { expect, test } from "@playwright/test";

const passwordFile = new URL("../../.local/dev-seed-password", import.meta.url);
const seedPassword =
  process.env.DEV_SEED_PASSWORD ??
  (existsSync(passwordFile) ? readFileSync(passwordFile, "utf8").trim() : "");

test("seeded overview shows organization-scoped samples, period changes and localized charts", async ({
  page,
}) => {
  test.skip(
    !seedPassword,
    "Run the development seed task or set DEV_SEED_PASSWORD",
  );
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/login");
  await page.getByLabel("Email address").fill("owner@numdock.test");
  await page.getByLabel("Password", { exact: true }).fill(seedPassword);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
  const dashboard = page.getByRole("region", {
    name: "Activity overview",
    exact: true,
  });
  await expect(page.getByText("Development", { exact: true })).toBeVisible();
  await expect(
    dashboard.getByText("Historical samples", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(dashboard.locator("tbody tr")).toHaveCount(30);
  await expect(
    dashboard.getByText("Not configured", { exact: true }),
  ).toBeVisible();
  await expect(
    dashboard.locator("[data-slot=chart] svg").first(),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/overview-desktop.png",
    fullPage: true,
  });
  await dashboard
    .getByRole("combobox", { name: "Reporting period", exact: true })
    .click();
  await page.getByRole("option", { name: "Last 7 days", exact: true }).click();
  await expect(page).toHaveURL(/days=7/);
  await expect(dashboard.locator("tbody tr")).toHaveCount(7);
  await page.reload();
  await expect(
    dashboard.getByRole("combobox", { name: "Reporting period", exact: true }),
  ).toContainText("Last 7 days");
  await expect(dashboard.locator("tbody tr")).toHaveCount(7);
  await page.getByRole("button", { name: "Theme: system" }).click();
  await page.getByRole("menuitemradio", { name: "Dark", exact: true }).click();
  await expect(page.getByRole("button", { name: "Theme: dark" })).toBeEnabled();
  await page.getByRole("button", { name: "Language", exact: true }).click();
  await page
    .getByRole("menuitemradio", { name: "简体中文", exact: true })
    .click();
  const chinese = page.getByRole("region", { name: "业务概览", exact: true });
  await expect(page.getByText("开发", { exact: true })).toBeVisible();
  await expect(
    chinese.getByRole("combobox", { name: "统计周期", exact: true }),
  ).toContainText("最近 7 天");
  await page.screenshot({
    path: "test-results/overview-dark-zh.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(
    chinese.getByRole("button", { name: "刷新", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/overview-mobile.png",
    fullPage: true,
  });
  await page.route("**/v1/organizations/*/overview*", (route) =>
    route.fulfill({
      status: 503,
      json: {
        code: "not_ready",
        message: "Unavailable",
        request_id: "overview-ui-test",
      },
    }),
  );
  await chinese.getByRole("button", { name: "刷新", exact: true }).click();
  await expect(chinese.getByRole("alert")).toBeVisible();
  await page.unroute("**/v1/organizations/*/overview*");
  await chinese.getByRole("button", { name: "重试", exact: true }).click();
  await expect(chinese.getByRole("alert")).toHaveCount(0);
  await expect(chinese.locator("tbody tr")).toHaveCount(7);
  expect(errors).toEqual([]);
});

test("a new organization has an honest empty overview", async ({ page }) => {
  await page.goto("/register");
  await page.getByLabel("Full name").fill("Overview Tester");
  await page.getByLabel("Workspace name").fill("Empty Overview Workspace");
  await page
    .getByLabel("Email address")
    .fill(`overview-${Date.now()}@example.test`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("overview browser test password");
  await page
    .getByRole("button", { name: "Create workspace", exact: true })
    .click();
  await expect(page).toHaveURL(/\/app$/);
  const dashboard = page.getByRole("region", {
    name: "Activity overview",
    exact: true,
  });
  await expect(
    dashboard.getByText("No overview samples yet", { exact: true }),
  ).toBeVisible();
  await expect(dashboard.locator("[data-slot=chart]")).toHaveCount(0);
  await expect(
    dashboard.getByText("Development preview", { exact: true }),
  ).toHaveCount(0);
});

test("first period change retains chart and metrics, then uses cached periods and reduced motion", async ({
  page,
}) => {
  test.skip(!seedPassword, "Run development seed first");
  test.setTimeout(60000);
  // Isolate report cache behavior from workspace realtime invalidations.
  await page.route("**/events/stream", (route) => route.abort());
  let release!: () => void;
  let started!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const requested = new Promise<void>((resolve) => {
    started = resolve;
  });
  const calls = { seven: 0, thirty: 0 };
  await page.route("**/v1/organizations/*/overview*", async (route) => {
    const days = new URL(route.request().url()).searchParams.get("days");
    if (days === "7") {
      calls.seven++;
      started();
      await gate;
    } else {
      calls.thirty++;
    }
    await route.continue();
  });
  try {
    await page.goto("/login");
    await page.getByLabel("Email address").fill("owner@numdock.test");
    await page.getByLabel("Password", { exact: true }).fill(seedPassword);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/app$/);
    const dashboard = page.getByRole("region", {
      name: "Activity overview",
      exact: true,
    });
    await expect(dashboard.locator("tbody tr")).toHaveCount(30);
    await requested;
    const chart = await dashboard
      .locator('[data-slot="chart"]')
      .elementHandle();
    const stats = await dashboard
      .locator('[data-slot="overview-stats"]')
      .elementHandle();
    const oldText = await dashboard
      .locator('[data-slot="overview-stats"]')
      .innerText();
    await dashboard
      .getByRole("combobox", { name: "Reporting period", exact: true })
      .click();
    await page
      .getByRole("option", { name: "Last 7 days", exact: true })
      .click();
    await expect(page).toHaveURL(/days=7/);
    await expect(
      dashboard.getByText(
        "Loading Last 7 days; keeping the current results visible.",
      ),
    ).toBeVisible();
    await expect(dashboard.locator("tbody tr")).toHaveCount(30);
    await expect
      .poll(() => dashboard.locator('[data-slot="overview-stats"]').innerText())
      .toBe(oldText);
    expect(await chart!.evaluate((node) => node.isConnected)).toBe(true);
    expect(await stats!.evaluate((node) => node.isConnected)).toBe(true);
    await page.screenshot({
      path: "test-results/overview-period-loading.png",
      fullPage: true,
    });
    release();
    await expect(dashboard.locator("tbody tr")).toHaveCount(7);
    await expect(
      dashboard.getByText(
        "Loading Last 7 days; keeping the current results visible.",
      ),
    ).toHaveCount(0);
    expect(await chart!.evaluate((node) => node.isConnected)).toBe(true);
    const cached = { ...calls };
    await dashboard
      .getByRole("combobox", { name: "Reporting period", exact: true })
      .click();
    await page
      .getByRole("option", { name: "Last 30 days", exact: true })
      .click();
    await expect(dashboard.locator("tbody tr")).toHaveCount(30);
    expect(calls).toEqual(cached);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await dashboard
      .getByRole("combobox", { name: "Reporting period", exact: true })
      .click();
    await page
      .getByRole("option", { name: "Last 7 days", exact: true })
      .click();
    await expect(dashboard.locator("tbody tr")).toHaveCount(7);
    expect(calls).toEqual(cached);
    await page.screenshot({
      path: "test-results/overview-period-cached.png",
      fullPage: true,
    });
  } finally {
    release();
  }
});
