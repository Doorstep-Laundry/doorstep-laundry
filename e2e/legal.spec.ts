import { test, expect, NO_AUTH_STATE } from "./fixtures/base";

test.use({ storageState: NO_AUTH_STATE });

test.describe("Legal pages", () => {
  test("/legal/terms loads without errors", async ({ page }) => {
    const response = await page.goto("/legal/terms");
    expect(response?.status()).toBeLessThan(400);
    await expect(page.getByRole("main")).toBeVisible();
  });

  test("/legal/privacy loads without errors", async ({ page }) => {
    const response = await page.goto("/legal/privacy");
    expect(response?.status()).toBeLessThan(400);
    await expect(page.getByRole("main")).toBeVisible();
  });

  test("/legal/sms loads without errors", async ({ page }) => {
    const response = await page.goto("/legal/sms");
    expect(response?.status()).toBeLessThan(400);
    await expect(page.getByRole("main")).toBeVisible();
  });
});
