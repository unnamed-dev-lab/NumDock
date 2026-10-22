import { existsSync, readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
const file = new URL("../../.local/dev-seed-password", import.meta.url);
const password =
  process.env.DEV_SEED_PASSWORD ??
  (existsSync(file) ? readFileSync(file, "utf8").trim() : "");
async function login(page: Page) {
  test.skip(!password, "Run development seed");
  await page.goto("/login");
  await page.getByLabel("Email address").fill("owner@numdock.test");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Overview",
      exact: true,
    }),
  ).toBeVisible();
}

test("mobile record actions stay visible, confirmations survive resizing and filtering keeps the table", async ({
  page,
}) => {
  await login(page);
  await page.goto("/app/numbers");
  const row = page.locator("tbody tr").first();
  await expect(row).toHaveAttribute("data-row-id", /^[0-9a-f-]{36}$/);
  const number = (await row.innerText()).match(/\+\d{10,15}/)![0];
  await page.setViewportSize({ width: 390, height: 844 });
  const release = row.getByRole("button", { name: "Release", exact: true });
  await expect(release).toBeInViewport();
  expect(
    await page
      .locator('[data-slot="table-container"]')
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  await release.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText(number);
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(dialog).toContainText(number);
  await page.setViewportSize({ width: 320, height: 844 });
  await expect(dialog).toContainText(number);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(release).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "../.local/table-mobile-numbers.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  expect(
    await row
      .locator("td")
      .last()
      .evaluate((el) => getComputedStyle(el).position),
  ).toBe("sticky");
  const table = await page.locator('[data-slot="table"]').elementHandle();
  let unblock!: () => void;
  let started!: () => void;
  const gate = new Promise<void>((resolve) => {
    unblock = resolve;
  });
  const requested = new Promise<void>((resolve) => {
    started = resolve;
  });
  await page.route("**/v1/organizations/*/numbers*", async (route) => {
    if (
      new URL(route.request().url()).searchParams.get("status") === "released"
    ) {
      started();
      await gate;
    }
    await route.continue();
  });
  await page
    .getByRole("combobox", { name: "Filter by status", exact: true })
    .click();
  await page.getByRole("option", { name: "Released", exact: true }).click();
  await requested;
  await expect(page.locator('[data-slot="data-table"]')).toHaveAttribute(
    "aria-busy",
    "true",
  );
  expect(
    await page
      .locator('[data-slot="table"]')
      .evaluate((node, old) => node === old, table),
  ).toBe(true);
  await expect(page.locator("tbody")).toHaveAttribute("inert", "");
  unblock();
  await expect(
    page.getByText("No records in this view.", { exact: true }),
  ).toBeVisible();
  expect(
    await page
      .locator('[data-slot="table"]')
      .evaluate((node, old) => node === old, table),
  ).toBe(true);
  await expect(page).toHaveURL(/numbersStatus=released/);
});

test("overview source data uses the shared engine and sorts the full dataset", async ({
  page,
}) => {
  await login(page);
  const daily = page.getByRole("table", {
    name: "Daily source data",
    exact: true,
  });
  await expect(daily.locator("tbody tr")).toHaveCount(30);
  await expect(daily.locator("tbody tr").first()).toHaveAttribute(
    "data-row-id",
    /^\d{4}-\d{2}-\d{2}$/,
  );
  const values = await daily
    .locator("tbody tr td:nth-child(2)")
    .allTextContents();
  const numbers = values.map((value) => Number(value.replaceAll(",", "")));
  await daily
    .getByRole("button", { name: "Messages received", exact: true })
    .click();
  await expect(
    daily.getByRole("columnheader", { name: "Messages received", exact: true }),
  ).toHaveAttribute("aria-sort", "ascending");
  await expect(daily.locator("tbody tr td:nth-child(2)").first()).toHaveText(
    new Intl.NumberFormat("en").format(Math.min(...numbers)),
  );
  await daily
    .getByRole("button", { name: "Messages received", exact: true })
    .click();
  await expect(daily.locator("tbody tr td:nth-child(2)").first()).toHaveText(
    new Intl.NumberFormat("en").format(Math.max(...numbers)),
  );
  await expect(
    page.getByRole("table", {
      name: "Organizations you have access to",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("navigation", { name: "Developer", exact: true }),
  ).toHaveCount(0);
});

test("background workspace updates preserve the open number confirmation", async ({
  page,
}) => {
  let send!: () => void;
  const gate = new Promise<void>((resolve) => {
    send = resolve;
  });
  let changeSummary = false;
  await page.route("**/events/stream", async (route) => {
    await gate;
    await route.fulfill({
      contentType: "text/event-stream",
      body: 'data: {"type":"workspace.changed"}\n\n',
    });
  });
  await page.route("**/v1/organizations/*/summary", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    if (changeSummary) body.counts.unread_messages += 1;
    await route.fulfill({ response, json: body });
  });
  await login(page);
  await page
    .locator("aside")
    .getByRole("button", { name: "Numbers", exact: true })
    .click();
  const row = page
    .locator("tbody tr")
    .filter({ has: page.getByRole("button", { name: "Release", exact: true }) })
    .first();
  const number = (await row.locator("td").first().innerText()).match(
    /\+\d{7,15}/,
  )![0];
  await row.getByRole("button", { name: "Release", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText(number);
  const refreshing = page.waitForResponse((response) =>
    new URL(response.url()).pathname.endsWith("/numbers"),
  );
  const summary = page.waitForResponse((response) =>
    new URL(response.url()).pathname.endsWith("/summary"),
  );
  changeSummary = true;
  send();
  await Promise.all([refreshing, summary]);
  await expect(page.locator('main section[aria-busy="true"]')).toHaveCount(0);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
  );
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(number);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
});
