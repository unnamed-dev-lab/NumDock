import { existsSync, readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
const file = new URL("../../.local/dev-seed-password", import.meta.url);
const password =
  process.env.DEV_SEED_PASSWORD ??
  (existsSync(file) ? readFileSync(file, "utf8").trim() : "");
test("seeded developer resources load and a missing backend is not shown as disabled", async ({
  page,
}) => {
  test.skip(!password, "Run development seed");
  test.setTimeout(60000);
  await page.goto("/login");
  await page.getByLabel("Email address").fill("owner@numdock.test");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
  await page.goto("/app/developers");
  await expect(
    page.getByRole("button", { name: "Create API key", exact: true }),
  ).toBeEnabled();
  await expect(
    page.locator("tbody").getByText("Read-only development sample (Mock)"),
  ).toBeVisible();
  await expect(
    page.locator("tbody").getByText("Revoked development sample (Mock)"),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Webhooks", exact: true }).click();
  await expect(
    page.locator("tbody").getByText("mock://failure", { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator("tbody").getByText("Disabled", { exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Deliveries", exact: true }).click();
  await expect(page.locator("tbody tr").first()).toBeVisible();
  await page.screenshot({
    path: "test-results/developer-seed-deliveries.png",
    fullPage: true,
  });
  await page.route("**/v1/organizations/*/workspace*", (route) =>
    route.fulfill({
      status: 404,
      json: {
        code: "not_found",
        message: "Not found",
        request_id: "old-backend-example",
      },
    }),
  );
  await page.reload();
  await expect(
    page.getByText(
      "Unable to load this workspace. Retry after checking the connected backend service.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create API key", exact: true }),
  ).toBeDisabled();
  await page.screenshot({
    path: "test-results/developer-backend-unavailable.png",
    fullPage: true,
  });
  await page.unroute("**/v1/organizations/*/workspace*");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Create API key", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Language", exact: true }).click();
  await page
    .getByRole("menuitemradio", { name: "简体中文", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "创建 API 密钥", exact: true }),
  ).toBeEnabled();
  await page.screenshot({
    path: "test-results/developer-seed-zh.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/developer-seed-mobile-zh.png",
    fullPage: true,
  });
});
