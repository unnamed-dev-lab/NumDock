import { expect, test } from "@playwright/test";

test("database catalog filters, pagination, states, themes and URL persistence", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/register");
  await page.getByLabel("Full name").fill("Catalog Tester");
  await page.getByLabel("Workspace name").fill("Catalog Browser Test");
  await page
    .getByLabel("Email address")
    .fill(`catalog-${Date.now()}@example.test`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("catalog browser test password");
  await page
    .getByRole("button", { name: "Create workspace", exact: true })
    .click();
  await expect(page).toHaveURL(/\/app$/);
  const baseline = await (
    await page.request.get("/v1/catalog/numbers?limit=100")
  ).json();
  const total = baseline.total as number;
  const lastOffset = Math.max(0, Math.ceil(total / 10) - 1) * 10;
  const canadian = await (
    await page.request.get("/v1/catalog/numbers?country=CA")
  ).json();
  const ascending = await (
    await page.request.get(
      "/v1/catalog/numbers?sort=monthly_fee_minor&order=asc",
    )
  ).json();
  const descending = await (
    await page.request.get(
      "/v1/catalog/numbers?sort=monthly_fee_minor&order=desc",
    )
  ).json();
  const money = (value: number) =>
    new Intl.NumberFormat("en", { style: "currency", currency: "USD" }).format(
      value / 100,
    );
  await page.goto("/app/numbers?tab=catalog");
  const catalog = page.getByRole("region", { name: "Catalog", exact: true });
  await expect(
    catalog.getByText("Development catalog from PostgreSQL.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    catalog.getByRole("cell", { name: "NumDock Mock", exact: true }),
  ).toHaveCount(10);
  await expect(
    catalog.getByText(`${total} total rows`, { exact: false }),
  ).toBeVisible();
  await expect(
    catalog.getByRole("button", { name: "Buy line", exact: true }),
  ).toHaveCount(0);
  await page.screenshot({
    path: "test-results/catalog-desktop.png",
    fullPage: true,
  });
  await page.goto("/app/numbers?tab=catalog&offset=999");
  await expect(page).toHaveURL(new RegExp(`offset=${lastOffset}`));
  await expect(
    catalog.getByRole("cell", { name: "NumDock Mock", exact: true }),
  ).toHaveCount(total - lastOffset);
  await catalog
    .getByRole("button", { name: "Go to first page", exact: true })
    .click();
  await expect(
    catalog.getByRole("cell", { name: "NumDock Mock", exact: true }),
  ).toHaveCount(10);
  const first = await catalog.locator("tbody tr").first().innerText();
  await catalog
    .getByRole("button", { name: "Go to next page", exact: true })
    .click();
  await expect(page).toHaveURL(/offset=10/);
  await expect(catalog.locator("tbody tr").first()).not.toHaveText(first);
  await catalog
    .getByRole("combobox", { name: "Country/Region:", exact: true })
    .click();
  await page.getByRole("option", { name: "Canada (CA)", exact: true }).click();
  await expect(
    catalog.getByRole("combobox", { name: "Country/Region:", exact: true }),
  ).toBeFocused();
  await expect(page).not.toHaveURL(/offset=/);
  await expect(
    catalog.getByText(`${canadian.total} total rows`, { exact: false }),
  ).toBeVisible();
  await catalog.getByRole("searchbox").fill("no-matching-demo-number");
  await expect(
    catalog.getByText("No matching catalog records.", { exact: false }),
  ).toBeVisible();
  await page.reload();
  await expect(catalog.getByRole("searchbox")).toHaveValue(
    "no-matching-demo-number",
  );
  await catalog.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(
    catalog.getByText(`${total} total rows`, { exact: false }),
  ).toBeVisible();
  await catalog
    .getByRole("button", { name: "Monthly fee", exact: true })
    .click();
  await expect(page).toHaveURL(/sort=monthly_fee_minor/);
 await expect(catalog.getByRole("columnheader",{name:"Monthly fee"})).toHaveAttribute("aria-sort","ascending");
  await expect(catalog.locator("tbody tr").first()).toContainText(
    money(ascending.items[0].monthly_fee_minor),
  );
  await catalog
    .getByRole("button", { name: "Monthly fee", exact: true })
    .click();
  await expect(catalog.locator("tbody tr").first()).toContainText(
    money(descending.items[0].monthly_fee_minor),
  );
  await page.getByRole("button", { name: "Theme: system" }).click();
  await page.getByRole("menuitemradio", { name: "Dark", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("button", { name: "Theme: dark" })).toBeEnabled();
  await page.screenshot({
    path: "test-results/catalog-dark.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Language", exact: true }).click();
  await page
    .getByRole("menuitemradio", { name: "简体中文", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(
    page.getByRole("combobox", { name: "通信能力", exact: true }),
  ).toContainText("全部能力");
  await page.screenshot({
    path: "test-results/catalog-chinese.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "语言", exact: true }).click();
  await page
    .getByRole("menuitemradio", { name: "English", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(catalog.getByRole("searchbox")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/catalog-mobile.png",
    fullPage: true,
  });
  await page.goto("/app/numbers?tab=catalog&country=ZZ");
  await expect(
    catalog.getByText("No matching catalog records.", { exact: false }),
  ).toBeVisible();
  await page.route("**/v1/catalog/numbers*", (route) =>
    route.fulfill({
      status: 503,
      json: {
        code: "not_ready",
        message: "Unavailable",
        request_id: "catalog-ui-test",
      },
    }),
  );
  await page.goto("/app/numbers?tab=catalog&q=error-state");
  await expect(catalog.getByRole("alert")).toBeVisible();
  await page.unroute("**/v1/catalog/numbers*");
  await catalog.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(catalog.getByRole("alert")).toHaveCount(0);
  await expect(
    catalog.getByText("No matching catalog records.", { exact: false }),
  ).toBeVisible();
  await page.route("**/v1/catalog/numbers*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });
  await page.goto("/app/numbers?tab=catalog&q=Toronto");
  await expect(catalog.getByRole("status")).toBeVisible();
  await expect(
    catalog.getByRole("cell", { name: "NumDock Mock", exact: true }),
  ).toHaveCount(10);
  expect(errors).toEqual([]);
});
