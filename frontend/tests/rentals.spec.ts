import { expect, test } from "@playwright/test";

test("rental selection requires consent and charges the quoted 3, 7 and 30 day terms", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto("/register");
  await page.getByLabel("Full name").fill("Rental Buyer");
  await page
    .getByLabel("Email address")
    .fill("rental-" + Date.now() + "@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("a rental browser test passphrase");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page).toHaveURL(/\/app$/);
  await page.goto("/app/billing");
  await page.getByRole("button", { name: "Add balance", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Amount (USD)").fill("100");
  await dialog.getByRole("button", { name: "Confirm", exact: true }).click();
  await page.getByRole("button", { name: "Pay now", exact: true }).click();
  await expect(
    page.getByText("Payment received. Your balance has been updated.", {
      exact: true,
    }),
  ).toBeVisible();
  let available = 10000;
  let purchaseRequests = 0;
  page.on("request", (req) => {
    if (
      req.method() === "POST" &&
      /\/v1\/organizations\/[^/]+\/orders$/.test(new URL(req.url()).pathname)
    )
      purchaseRequests++;
  });
  for (const days of [3, 7, 30]) {
    const inventory = await (
      await page.request.get("/v1/catalog/numbers?capability=sms&limit=1")
    ).json();
    const item = inventory.items[0];
    const quote = item.rental_options.find(
      (option: { days: number }) => option.days === days,
    );
    await page.goto(
      "/app/numbers?tab=catalog&q=" + encodeURIComponent(item.e164),
    );
    await page
      .getByRole("button", { name: "Lease number", exact: true })
      .click();
    dialog = page.getByRole("dialog");
    const confirm = dialog.getByRole("button", {
      name: "Confirm lease",
      exact: true,
    });
    const consent = dialog.getByRole("checkbox", {
      name: /I confirm this number/,
    });
    await expect(confirm).toBeDisabled();
    await expect(
      dialog.getByText("Choose a rental period.", { exact: true }),
    ).toBeVisible();
    await expect(
      dialog.getByText("Check the box to confirm your authorized use.", {
        exact: true,
      }),
    ).toBeVisible();
    await consent.check();
    await expect(confirm).toBeDisabled();
    await consent.uncheck();
    if (days === 3)
      await page.screenshot({ path: "../.local/rental-required-desktop.png" });
    await dialog
      .getByRole("combobox", { name: "Rental period", exact: true })
      .click();
    await page
      .getByRole("option", { name: new RegExp("^" + days + " days") })
      .click();
    await expect(confirm).toBeDisabled();
    await consent.focus();
    await page.keyboard.press("Space");
    await expect(consent).toBeChecked();
    await expect(confirm).toBeEnabled();
    await consent.uncheck();
    await expect(confirm).toBeDisabled();
    await consent.check();
    expect(purchaseRequests).toBe([3, 7, 30].indexOf(days));
    if (days === 7) {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: "../.local/rental-selected-mobile.png" });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.setViewportSize({ width: 1280, height: 900 });
    }
    const [response] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.request().method() === "POST" &&
          /\/organizations\/[^/]+\/orders$/.test(new URL(res.url()).pathname),
      ),
      confirm.click(),
    ]);
    expect(response.status()).toBe(200);
    expect(response.request().postDataJSON().rental_days).toBe(days);
    const result = await response.json();
    expect(result.order.rental_days).toBe(days);
    expect(result.order.amount_minor).toBe(quote.amount_minor);
    available -= quote.amount_minor;
    expect(result.wallet.available_minor).toBe(available);
    const elapsed =
      Date.parse(result.number.expires_at) -
      Date.parse(result.number.started_at);
    expect(Math.abs(elapsed - days * 86400000)).toBeLessThan(2000);
    await expect(dialog).not.toBeVisible();
    const row = page.locator("tbody tr").filter({ hasText: item.e164 });
    await expect(row).toContainText(days + " days");
    await row.getByRole("button", { name: "Release", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm", exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
  }
  expect(purchaseRequests).toBe(3);
  await page.getByRole("button", { name: "Language", exact: true }).click();
  await page
    .getByRole("menuitemradio", { name: "简体中文", exact: true })
    .click();
  await page.goto("/app/numbers?tab=catalog&capability=sms");
  await page
    .getByRole("button", { name: "申请号码", exact: true })
    .first()
    .click();
  dialog = page.getByRole("dialog");
  await expect(dialog.getByText("请选择租期。", { exact: true })).toBeVisible();
  await expect(
    dialog.getByText("请勾选确认授权用途。", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "确认申请", exact: true }),
  ).toBeDisabled();
  await dialog.getByRole("combobox", { name: "租期", exact: true }).click();
  await page.getByRole("option", { name: /^7 天/ }).click();
  await dialog.getByRole("checkbox", { name: /我确认此号码/ }).check();
  await expect(
    dialog.getByRole("button", { name: "确认申请", exact: true }),
  ).toBeEnabled();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "../.local/rental-chinese-mobile.png" });
  await dialog.getByRole("button", { name: "取消", exact: true }).click();
});
