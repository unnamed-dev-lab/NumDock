import { expect, test } from "@playwright/test";
test("Mock workspace completes credit, lease, encrypted inbox, refund, key and webhook workflows", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/register");
  await page.getByLabel("Full name").fill("Mock Tester");
  await page.getByLabel("Workspace name").fill("Mock Workflow");
  await page.getByLabel("Email address").fill(`mock-${Date.now()}@example.com`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("a complete mock test passphrase");
  await page
    .getByRole("button", { name: "Create workspace", exact: true })
    .click();
  await expect(page).toHaveURL(/\/app$/);
  await page.goto("/app/billing");
  await page.getByRole("button", { name: "Add balance", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Amount (USD)").fill("0.001");
  await dialog.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(
    dialog.getByText("Enter a value within the allowed range."),
  ).toBeVisible();
  await dialog.getByLabel("Amount (USD)").fill("100.25");
  await dialog.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByText("$100.25", { exact: true }).first(),
  ).toBeVisible();
  await page.goto("/app/numbers?capability=sms");
  await page.getByRole("button", { name: "Lease number", exact: true }).click();
  await expect(
    page.getByRole("tab", { name: "Catalog", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page
    .getByRole("button", { name: "Lease number", exact: true })
    .first()
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("switch", { name: /I confirm this number/ }).check();
  await dialog.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("tab", { name: "Your numbers", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.getByText("Development", { exact: true })).toHaveCount(1);
  await expect(page.getByText("Mock environment", { exact: true })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "Release", exact: true }),
  ).toBeEnabled();
  await page.screenshot({
    path: "test-results/mock-numbers-desktop.png",
    fullPage: true,
  });
  // An uncertain response can be retried without generating a second message.
  const smsKeys: string[] = [];
  let lostResponse = true;
  await page.route("**/messages/simulate", async (route) => {
    smsKeys.push(route.request().headers()["idempotency-key"] ?? "");
    const response = await route.fetch();
    if (lostResponse) {
      lostResponse = false;
      await route.abort();
    } else await route.fulfill({ response });
  });
  const sms = page.getByRole("button", { name: "Test SMS", exact: true });
  await sms.click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("alert")).toContainText("Unable to connect");
  await sms.click();
  await expect(
    page.getByRole("status").filter({ hasText: "Saved successfully." }),
  ).toHaveCount(1);
  expect(smsKeys).toHaveLength(2);
  expect(smsKeys[0]).toBeTruthy();
  expect(smsKeys[0]).toBe(smsKeys[1]);
  await page.unroute("**/messages/simulate");
  await page.goto("/app/messages");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.getByRole("button", { name: "Open message", exact: true }).click();
  dialog = page.getByRole("dialog");
  await expect(
    dialog.getByText(/Your support request has been updated/),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(
    page.locator("tbody").getByText("Read", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.screenshot({
    path: "test-results/mock-messages-desktop.png",
    fullPage: true,
  });
  await page.goto("/app/numbers");
  await page.getByRole("button", { name: "Release", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.locator("tbody").getByText("Released", { exact: true }),
  ).toBeVisible();
  await page.goto("/app/billing");
  await page.getByRole("button", { name: "Refund", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByText("$100.25", { exact: true }).first(),
  ).toBeVisible();
  await page
    .getByRole("tab", { name: "Immutable ledger", exact: true })
    .click();
  await expect(page.locator("tbody tr")).toHaveCount(4);
  await page.screenshot({
    path: "test-results/mock-billing-desktop.png",
    fullPage: true,
  });
  await page.goto("/app/developers");
  await page
    .getByRole("button", { name: "Create API key", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Key name", { exact: true }).fill("Browser workflow");
  await dialog.getByRole("button", { name: "Confirm", exact: true }).click();
  const secret = dialog.getByRole("textbox", { name: "One-time secret" });
  await expect(secret).toHaveValue(/^nd_mock_/);
  await dialog
    .getByRole("button", { name: "Close", exact: true })
    .last()
    .click();
  await expect(
    page.getByRole("textbox", { name: "One-time secret" }),
  ).toHaveCount(0);
  await expect(
    page.locator("tbody").getByText("Browser workflow"),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Webhooks", exact: true }).click();
  await page
    .getByRole("button", { name: "Create endpoint", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(
    dialog.getByRole("textbox", { name: "One-time secret" }),
  ).toHaveValue(/^whsec_/);
  await dialog
    .getByRole("button", { name: "Close", exact: true })
    .last()
    .click();
  await page.getByRole("button", { name: "Disable", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Enable", exact: true }),
  ).toBeEnabled();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Enable", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Disable", exact: true }),
  ).toBeEnabled();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const testSent = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      /\/webhooks\/[^/]+\/test$/.test(new URL(response.url()).pathname),
  );
  await page
    .getByRole("button", { name: "Send test event", exact: true })
    .click();
  expect((await testSent).ok()).toBe(true);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("tab", { name: "Deliveries", exact: true }).click();
  await expect(
    page.locator("tbody").getByText("Delivered", { exact: true }).first(),
  ).toBeVisible({ timeout: 12000 });
  await page.screenshot({
    path: "test-results/mock-deliveries-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Language", exact: true }).click();
  await page
    .getByRole("menuitemradio", { name: "简体中文", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "API 与 Webhook", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const panel = await page
    .getByRole("tabpanel", { name: "投递记录", exact: true })
    .boundingBox({ timeout: 5000 });
  expect(panel).not.toBeNull();
  expect(panel!.x).toBeLessThan(100);
  await page.screenshot({
    path: "test-results/mock-developers-mobile-zh.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
