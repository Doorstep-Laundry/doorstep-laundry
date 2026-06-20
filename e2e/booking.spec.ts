import { test, expect, CUSTOMER_STATE } from "./fixtures/base";

test.use({ storageState: CUSTOMER_STATE });

test.describe("Book a pickup", () => {
  test("booking page loads for a customer", async ({ page }) => {
    await page.goto("/book");
    await expect(page.getByRole("heading", { name: /book a pickup/i })).toBeVisible();
  });

  test("starts with one load panel", async ({ page }) => {
    await page.goto("/book");
    await expect(page.getByText(/load 1/i)).toBeVisible();
    await expect(page.getByText(/load 2/i)).not.toBeVisible();
  });

  test("adding a load shows a second load panel", async ({ page }) => {
    await page.goto("/book");
    await page.getByRole("button", { name: /add load preferences/i }).click();
    await expect(page.getByText(/load 2/i)).toBeVisible();
  });

  test("cannot exceed 10 loads — button disappears at max", async ({ page }) => {
    await page.goto("/book");
    for (let i = 0; i < 9; i++) {
      await page.getByRole("button", { name: /add load preferences/i }).click();
    }
    await expect(page.getByText(/load 10/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /add load preferences/i })).not.toBeVisible();
  });

  test("Step 1 continue button is present", async ({ page }) => {
    await page.goto("/book");
    await expect(
      page.getByRole("button", { name: /continue to address/i })
    ).toBeVisible();
  });

  test("Step 2 shows date and time fields after continuing from step 1", async ({ page }) => {
    await page.goto("/book");
    await page.getByRole("button", { name: /continue to address/i }).click();
    await expect(page.getByText(/pickup/i)).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/delivery/i)).toBeVisible();
  });
});
