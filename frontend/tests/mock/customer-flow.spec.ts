import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

const MOCK_API = "http://127.0.0.1:8092";
const ORG_ID = "11111111-1111-4111-8111-111111111111";

async function walletMinor(request: APIRequestContext) {
  const response = await request.get(
    `${MOCK_API}/v1/organizations/${ORG_ID}/summary`,
  );
  expect(response.ok()).toBeTruthy();
  const summary = await response.json();
  return summary.wallet.available_minor as number;
}

async function openBilling(page: Page) {
  await page.goto("/app/billing");
  await expect(
    page.getByRole("heading", { name: "Billing", exact: true }),
  ).toBeVisible();
  const addBalance = page.getByRole("button", {
    name: "Add balance",
    exact: true,
  });
  await expect(addBalance).toBeEnabled();
  return addBalance;
}

async function createPayment(page: Page, amount: string) {
  const addBalance = await openBilling(page);
  await addBalance.click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Amount (USD)").fill(amount);
  await dialog.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Pay now", exact: true }),
  ).toBeVisible();
}

async function openCatalog(page: Page) {
  await page.goto("/app/numbers?tab=catalog");
  const lease = page.getByRole("button", {
    name: "Lease number",
    exact: true,
  });
  await expect(lease.first()).toBeEnabled();
  return lease;
}

async function fillLeaseDialog(page: Page) {
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("combobox", { name: "Rental period", exact: true })
    .click();
  await page.getByRole("option", { name: /^30 days/ }).click();
  await dialog.getByRole("checkbox", { name: /I confirm this number/ }).check();
  return dialog;
}

test.beforeEach(async ({ request }) => {
  const response = await request.post(`${MOCK_API}/__reset`);
  expect(response.ok()).toBeTruthy();
});

test("customer adds balance, pays, leases a number and sees it in Your numbers", async ({
  page,
  request,
}) => {
  test.setTimeout(60_000);

  await createPayment(page, "25.50");
  await page.getByRole("button", { name: "Pay now", exact: true }).click();
  await expect(
    page.getByText("Payment received. Your balance has been updated.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText("$25.50", { exact: true }).first()).toBeVisible();
  expect(await walletMinor(request)).toBe(2550);

  const lease = await openCatalog(page);
  await lease.first().click();
  const dialog = await fillLeaseDialog(page);
  await dialog
    .getByRole("button", { name: "Confirm lease", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();

  await expect(
    page.getByRole("tab", { name: "Your numbers", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  const leasedRow = page
    .locator("tbody tr")
    .filter({ hasText: "+14155550101" });
  await expect(leasedRow).toBeVisible();
  await expect(leasedRow.getByText("OpenAI", { exact: true })).toBeVisible();
  expect(await walletMinor(request)).toBe(2200);

  await page.goto("/app/billing");
  await expect(page.getByText("$22.00", { exact: true }).first()).toBeVisible();
});

test("mobile dark mode completes payment and lease without horizontal overflow", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 844 });

  await openBilling(page);
  await page.getByRole("button", { name: "Theme: system" }).click();
  await page.getByRole("menuitemradio", { name: "Dark", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(
    page.getByRole("button", { name: "Theme: dark" }),
  ).toBeEnabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);

  await createPayment(page, "10.00");
  await page.getByRole("button", { name: "Pay now", exact: true }).click();
  await expect(
    page.getByText("Payment received. Your balance has been updated.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);

  const lease = await openCatalog(page);
  await lease.first().click();
  const dialog = await fillLeaseDialog(page);
  await dialog
    .getByRole("button", { name: "Confirm lease", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("tab", { name: "Your numbers", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    page.locator("tbody tr").filter({ hasText: "+14155550101" }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("payment confirmation refreshes another billing page through SSE", async ({
  page,
  context,
  request,
}) => {
  test.setTimeout(60_000);

  await createPayment(page, "10.00");
  const second = await context.newPage();
  await second.goto("/app/billing");
  await expect(
    second.getByText("$0.00", { exact: true }).first(),
  ).toBeVisible();

  await expect
    .poll(async () => {
      const response = await request.get(`${MOCK_API}/__sse-count`);
      return ((await response.json()).count as number) ?? 0;
    })
    .toBeGreaterThanOrEqual(2);

  await page.getByRole("button", { name: "Pay now", exact: true }).click();
  await expect(
    page.getByText("Payment received. Your balance has been updated.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    second.getByText("$10.00", { exact: true }).first(),
  ).toBeVisible();
  await second.close();
});

test("leasing without balance keeps the confirmation open and explains the error", async ({
  page,
  request,
}) => {
  test.setTimeout(60_000);

  const lease = await openCatalog(page);
  await lease.first().click();
  const dialog = await fillLeaseDialog(page);
  await dialog
    .getByRole("button", { name: "Confirm lease", exact: true })
    .click();

  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("alert")).toContainText(
    "Insufficient Mock balance",
  );
  expect(await walletMinor(request)).toBe(0);
});

test("inventory failure keeps the catalog and wallet unchanged", async ({
  page,
  request,
}) => {
  test.setTimeout(60_000);

  const lease = await openCatalog(page);
  await lease.first().click();
  const dialog = await fillLeaseDialog(page);
  await request.post(`${MOCK_API}/__fail-next-order`);
  await dialog
    .getByRole("button", { name: "Confirm lease", exact: true })
    .click();

  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("alert")).toContainText(
    "This number is no longer available",
  );
  expect(await walletMinor(request)).toBe(0);
});

test("pending payment can be canceled without changing the balance", async ({
  page,
  request,
}) => {
  test.setTimeout(60_000);

  await createPayment(page, "10.00");
  await page
    .getByRole("button", { name: "Cancel payment", exact: true })
    .click();
  await expect(
    page.getByText("Payment canceled. Your balance has not changed.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText("$0.00", { exact: true }).first()).toBeVisible();
  expect(await walletMinor(request)).toBe(0);
});

test("retrying a lost payment confirmation reuses the idempotency key and credits once", async ({
  page,
  request,
}) => {
  test.setTimeout(60_000);
  await page.addInitScript(() => {
    Object.defineProperty(window, "EventSource", {
      value: class {
        onmessage = null;
        close() {}
      },
    });
  });

  await createPayment(page, "10.00");
  const keys: string[] = [];
  let lose = true;
  await page.route("**/billing/payments/*/confirm", async (route) => {
    keys.push(route.request().headers()["idempotency-key"] ?? "");
    const response = await route.fetch();
    if (lose) {
      lose = false;
      await route.abort();
    } else {
      await route.fulfill({ response });
    }
  });

  await page.getByRole("button", { name: "Pay now", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page.getByRole("button", { name: "Pay now", exact: true }).click();
  await expect(
    page.getByText("Payment received. Your balance has been updated.", {
      exact: true,
    }),
  ).toBeVisible();

  expect(keys).toHaveLength(2);
  expect(keys[0]).toBeTruthy();
  expect(keys[0]).toBe(keys[1]);
  expect(await walletMinor(request)).toBe(1000);
});

test("SSE wallet updates invalidate the summary without a reload", async ({
  page,
  request,
}) => {
  test.setTimeout(60_000);

  await openBilling(page);
  await expect(page.getByText("$0.00", { exact: true }).first()).toBeVisible();
  await expect
    .poll(async () => {
      const response = await request.get(`${MOCK_API}/__sse-count`);
      return ((await response.json()).count as number) ?? 0;
    })
    .toBeGreaterThan(0);

  const credit = await request.post(`${MOCK_API}/__credit`, {
    data: { amount_minor: 500 },
  });
  expect(credit.ok()).toBeTruthy();

  await expect(page.getByText("$5.00", { exact: true }).first()).toBeVisible();
  expect(await walletMinor(request)).toBe(500);
});
