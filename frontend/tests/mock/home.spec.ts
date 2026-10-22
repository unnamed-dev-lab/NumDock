import { expect, test } from "@playwright/test";

const MOCK_API = "http://127.0.0.1:8092";

test.beforeEach(async ({ request }) => {
  const response = await request.post(`${MOCK_API}/__reset`);
  expect(response.ok()).toBeTruthy();
});

test("catalog shows a skeleton before the first result arrives", async ({
  page,
}) => {
  await page.route("**/v1/catalog/numbers*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });

  await page.goto("/app/numbers?tab=catalog");
  await expect(page.locator('[data-slot="skeleton"]').first()).toBeVisible();
  await expect(page.locator('[data-slot="data-table"]')).toBeVisible();
});

test("homepage More menu exposes additional use cases", async ({ page }) => {
  await page.goto("/");

  const more = page.getByRole("button", { name: "More", exact: true });
  await expect(more).toBeVisible();
  await more.click();
  await page.getByRole("menuitem", { name: "TikTok", exact: true }).click();

  await expect(page).toHaveURL(/use_case=tiktok/);
  const catalog = page.getByRole("region", { name: "Catalog", exact: true });
  await expect(
    catalog.getByRole("combobox", { name: "Use case", exact: true }),
  ).toContainText("TikTok");
  await expect(
    catalog.locator("tbody tr").filter({ hasText: "+14155550103" }),
  ).toBeVisible();
});
