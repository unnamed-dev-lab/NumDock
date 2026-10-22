import { expect, test, type Page } from "@playwright/test";

async function register(page: Page) {
  await page.goto("/register");
  await expect(page.getByLabel("Workspace name")).toHaveCount(0);
  await page.getByLabel("Full name").fill("Payment Buyer");
  await page
    .getByLabel("Email address")
    .fill("payment-" + Date.now() + "@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("a payment browser passphrase");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp("/app$"));
  await expect(page.getByText("Organization", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("navigation", { name: "Developer", exact: true }),
  ).toHaveCount(0);
  await page.goto("/app/billing");
}
async function create(page: Page, amount: string) {
  await page.getByRole("button", { name: "Add balance", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Amount (USD)").fill(amount);
  await dialog.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Pay now", exact: true }),
  ).toBeVisible();
  return new URL(page.url()).searchParams.get("payment")!;
}
async function snapshot(page: Page) {
  const me = await (await page.request.get("/v1/me")).json();
  const org = me.organizations[0].id;
  return (
    await page.request.get(
      "/v1/organizations/" + org + "/summary",
    )
  ).json();
}
test("pending payments survive reload, cancel without credit, and successful payments credit once", async ({
  page,
}) => {
  test.setTimeout(60000);
  await register(page);
  const first = await create(page, "25.50");
  expect((await snapshot(page)).wallet.available_minor).toBe(0);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Pay now", exact: true }),
  ).toBeVisible();
  expect(new URL(page.url()).searchParams.get("payment")).toBe(first);
  await page
    .getByRole("button", { name: "Cancel payment", exact: true })
    .click();
  await expect(
    page.getByText("Payment canceled. Your balance has not changed.", {
      exact: true,
    }),
  ).toBeVisible();
  expect((await snapshot(page)).wallet.available_minor).toBe(0);
  await create(page, "10.25");
  await page.getByRole("button", { name: "Pay now", exact: true }).dblclick();
  await expect(
    page.getByText("Payment received. Your balance has been updated.", {
      exact: true,
    }),
  ).toBeVisible();
  expect((await snapshot(page)).wallet.available_minor).toBe(1025);
  await page.reload();
  await expect(
    page.getByText("Payment received. Your balance has been updated.", {
      exact: true,
    }),
  ).toBeVisible();
  expect((await snapshot(page)).wallet.available_minor).toBe(1025);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Language", exact: true }).click();
  await page
    .getByRole("menuitemradio", { name: "简体中文", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "确认支付", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("lost payment responses can be retried with the same idempotency key", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "EventSource", {
      value: class {
        onmessage = null;
        close() {}
      },
    });
  });
  await register(page);
  await create(page, "7.75");
  const keys: string[] = [];
  let lose = true;
  await page.route("**/billing/payments/*/confirm", async (route) => {
    keys.push(route.request().headers()["idempotency-key"]!);
    const response = await route.fetch();
    if (lose) {
      lose = false;
      await route.abort();
    } else await route.fulfill({ response });
  });
  await page.getByRole("button", { name: "Pay now", exact: true }).click();
  const paid = page.getByText(
    "Payment received. Your balance has been updated.",
    { exact: true },
  );
  if (!(await paid.isVisible())) {
    await expect(page.getByRole("alert")).toBeVisible();
    await page.getByRole("button", { name: "Pay now", exact: true }).click();
  }
  await expect(paid).toBeVisible();
  if (keys.length > 1) expect(keys[0]).toBe(keys[1]);
  expect((await snapshot(page)).wallet.available_minor).toBe(775);
});
