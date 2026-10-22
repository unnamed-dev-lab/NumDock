import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { workspaceReturnTo } from "../app/features/auth/return-to";

test("authentication destinations stay inside the workspace", () => {
  for (const target of [
    "https://example.com",
    "//example.com",
    "/app/../../outside",
    "/app\\\\outside",
    "/app/\\n",
    "/platform",
  ]) {
    expect(workspaceReturnTo(target)).toBe("/app");
  }
  expect(workspaceReturnTo("/app/numbers?tab=catalog&q=%2B14155550102")).toBe(
    "/app/numbers?tab=catalog&q=%2B14155550102",
  );
});

test("visitors browse database numbers and prices without a session", async ({
  page,
  request,
}) => {
  const catalogResponse = await request.get("/v1/catalog/numbers?limit=100");
  expect(catalogResponse.status()).toBe(200);
  const inventory = await catalogResponse.json();
  expect(inventory.items.length).toBeGreaterThan(0);
  const html = await (await request.get("/")).text();
  expect(html).toContain(inventory.items[0].e164);
  expect(html).not.toContain("owner@numdock.test");
  expect((await request.get("/v1/me")).status()).toBe(401);
  expect(
    (
      await request.get(
        "/v1/organizations/d0000000-0000-4000-8000-000000000001/numbers",
      )
    ).status(),
  ).toBe(401);
  await page.goto("/");
  const catalog = page.getByRole("region", { name: "Catalog", exact: true });
  await expect(
    page.getByRole("heading", { name: "Numbers & pricing", exact: true }),
  ).toBeVisible();
  await expect(
    catalog.getByRole("button", { name: "Choose number", exact: true }).first(),
  ).toBeVisible();
  await catalog
    .getByRole("combobox", { name: "Country/Region:", exact: true })
    .click();
  await page.getByRole("option", { name: "Canada (CA)", exact: true }).click();
  await expect(page).toHaveURL(/country=CA/);
  await expect(catalog.locator("tbody tr").first()).toContainText("CA ·");
  await page.reload();
  await expect(
    catalog.getByRole("combobox", { name: "Country/Region:", exact: true }),
  ).toContainText("Canada");
  await page.getByRole("button", { name: "Language", exact: true }).click();
  await page
    .getByRole("menuitemradio", { name: "简体中文", exact: true })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("heading", { name: "号码与定价", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(
    page
      .getByRole("region", { name: "号码目录", exact: true })
      .getByRole("button", { name: "选择号码", exact: true })
      .first(),
  ).toBeVisible();
});

test("a selected public number survives registration and can be leased", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?capability=sms");
  let catalog = page.getByRole("region", { name: "Catalog", exact: true });
  const first = catalog.locator("tbody tr").first();
  const number = (await first.locator("td").first().innerText()).match(
    /\+\d{7,15}/,
  )![0];
  await first
    .getByRole("button", { name: "Choose number", exact: true })
    .click();
  await expect(page).toHaveURL(/\/login\?returnTo=/);
  const target = new URL(page.url()).searchParams.get("returnTo")!;
  expect(new URL(target, "http://localhost").searchParams.get("q")).toBe(
    number,
  );
  await page
    .getByRole("link", { name: "Create an account", exact: true })
    .click();
  expect(new URL(page.url()).searchParams.get("returnTo")).toBe(target);
  await page.getByLabel("Full name").fill("Public Catalog Buyer");
  await page
    .getByLabel("Email address")
    .fill("public-buyer-" + Date.now() + "@example.com");
  await page
    .getByLabel("Password", { exact: true })
    .fill("a public catalog test passphrase");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp("/app/numbers\\?"));
  expect(new URL(page.url()).searchParams.get("q")).toBe(number);
  catalog = page.getByRole("region", { name: "Catalog", exact: true });
  await expect(catalog.locator("tbody tr")).toHaveCount(1);
  await page.getByRole("button", { name: "Add balance", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Amount (USD)").fill("25.50");
  await dialog.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: "Pay now", exact: true }).click();
  await expect(
    page.getByText("Payment received. Your balance has been updated.", {
      exact: true,
    }),
  ).toBeVisible();

  await page
    .getByRole("link", { name: "Continue choosing a number", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp("/app/numbers\\?"));
  await expect
    .poll(() => new URL(page.url()).searchParams.get("q"))
    .toBe(number);
  await catalog
    .getByRole("button", { name: "Lease number", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await expect(dialog).toContainText(number);
  await dialog.getByRole("switch", { name: /I confirm this number/ }).check();
  await dialog.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("tab", { name: "Your numbers", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    page.locator("tbody tr").filter({ hasText: number }),
  ).toBeVisible();
  const publicInventory = await (
    await page.request.get("/v1/catalog/numbers?limit=100")
  ).json();
  expect(
    publicInventory.items.some(
      (item: { e164: string }) => item.e164 === number,
    ),
  ).toBe(false);
  const me = await (await page.request.get("/v1/me")).json();
  const org = me.organizations[0];
  expect(org.slug).toMatch(/^public-catalog-buyer-/);
  await page.goto("/app/numbers?organization=" + org.id + "&tab=numbers");
  await expect(page).toHaveURL(new RegExp("organization=" + org.slug));
  expect(page.url()).not.toContain(org.id);
  await page
    .locator("tbody tr")
    .filter({ hasText: number })
    .getByRole("button", { name: "Release", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.goto("/app?organization=numdock-isolated");
  await expect(
    page.getByRole("heading", { name: "Page not found", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("legacy organization URLs redirect to stable readable handles", async ({
  page,
}) => {
  const password = readFileSync(
    new URL("../../.local/dev-seed-password", import.meta.url),
    "utf8",
  ).trim();
  await page.goto("/login");
  await page.getByLabel("Email address").fill("owner@numdock.test");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
  await page.goto(
    "/app?organization=d0000000-0000-4000-8000-000000000001&days=7",
  );
  await expect(page).toHaveURL(/organization=numdock-development&days=7/);
  await expect(
    page.getByRole("heading", {
      name: "Overview",
      exact: true,
    }),
  ).toBeVisible();
});
