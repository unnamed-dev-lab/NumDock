import { expect, test } from "@playwright/test";
test("customer account completes payment, lease, encrypted inbox and refund workflows", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/register");
  await page.getByLabel("Full name").fill("Mock Tester");
  await page.getByLabel("Email address").fill(`mock-${Date.now()}@example.com`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("a complete mock test passphrase");
  await page
    .getByRole("button", { name: "Create account", exact: true })
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
  await page.getByRole("button", { name: "Pay now", exact: true }).click();
  await expect(
    page.getByText("Payment received. Your balance has been updated.", {
      exact: true,
    }),
  ).toBeVisible();

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
  await expect(
    dialog.getByRole("button", { name: "Confirm lease", exact: true }),
  ).toBeDisabled();
  await dialog
    .getByRole("combobox", { name: "Rental period", exact: true })
    .click();
  await page.getByRole("option", { name: /^30 days/ }).click();
  await expect(
    dialog.getByRole("button", { name: "Confirm lease", exact: true }),
  ).toBeDisabled();
  await dialog.getByRole("checkbox", { name: /I confirm this number/ }).check();
  await dialog
    .getByRole("button", { name: "Confirm lease", exact: true })
    .click();
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
  await page.getByRole("tab", { name: "Orders", exact: true }).click();
  await page.getByRole("button", { name: "Refund", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByText("$100.25", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Balance history", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(4);
  await page.screenshot({
    path: "test-results/mock-billing-desktop.png",
    fullPage: true,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Language", exact: true }).click();
  await page
    .getByRole("menuitemradio", { name: "简体中文", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "账单", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
