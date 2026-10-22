import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
test("developer pages and obsolete resource selectors are removed", async ({
  page,
  request,
}) => {
  await page.goto("/");
  const header = page.getByRole("banner");
  for (const name of ["Platform", "Status", "API docs"])
    await expect(header.getByRole("link", { name, exact: true })).toHaveCount(
      0,
    );
  for (const path of [
    "/platform",
    "/status",
    "/docs/api",
    "/app/developers",
    "/app/keys",
  ]) {
    expect((await request.get(path)).status()).toBe(404);
  }
});
test("account pages read separate resource APIs and protect private data", async ({
  page,
}) => {
  const password = readFileSync(
    new URL("../../.local/dev-seed-password", import.meta.url),
    "utf8",
  ).trim();
  const calls: string[] = [];
  page.on("request", (req) => {
    const url = new URL(req.url());
    if (url.pathname.startsWith("/v1/organizations/"))
      calls.push(url.pathname + url.search);
  });
  await page.goto("/login");
  await page.getByLabel("Email address").fill("owner@numdock.test");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
  await page
    .locator("aside")
    .getByRole("button", { name: "Numbers", exact: true })
    .click();
  await expect(page.locator("tbody tr").first()).toBeVisible();
  await page
    .locator("aside")
    .getByRole("button", { name: "Messages", exact: true })
    .click();
  await expect(page.locator("tbody tr").first()).toBeVisible();
  await page
    .locator("aside")
    .getByRole("button", { name: "Billing", exact: true })
    .click();
  await expect(
    page.getByRole("tab", { name: "Payments", exact: true }),
  ).toBeVisible();
  const identity = await (await page.request.get("/v1/me")).json();
  const prefix = "/v1/organizations/" + identity.organizations[0].id;
  for (const path of [
    "/numbers",
    "/messages",
    "/orders",
    "/billing/ledger",
    "/billing/payments",
  ]) {
    const response = await page.request.get(prefix + path + "?limit=1");
    expect(response.status()).toBe(200);
    const list = await response.json();
    expect(Object.keys(list).sort()).toEqual([
      "items",
      "limit",
      "mode",
      "offset",
      "total",
    ]);
  }
  expect(
    calls.some(
      (path) =>
        path.includes("/workspace") ||
        new URL(path, "http://local").searchParams.has("view"),
    ),
  ).toBe(false);
});
