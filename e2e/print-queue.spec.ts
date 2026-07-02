import { test, expect, ADMIN_STATE } from "./fixtures/base";

test.use({ storageState: ADMIN_STATE });

test.describe("Admin debug – label printer", () => {
  test("label printer section is visible in the Debug tab", async ({ page }) => {
    await page.goto("/admin");
    await page.getByRole("tab", { name: /debug/i }).click();
    await expect(page.getByRole("heading", { name: /label printer/i })).toBeVisible();
  });

  test("send test print creates a job and shows the job ID", async ({ page }) => {
    await page.goto("/admin");
    await page.getByRole("tab", { name: /debug/i }).click();

    await page.getByLabel(/order number/i).fill("ORDER-20260702-9999");
    await page.getByLabel(/load #/i).fill("1");
    await page.getByLabel(/total loads/i).fill("2");

    await page.getByRole("button", { name: /send test print/i }).click();

    await expect(page.getByText(/sent \(jobid:/i)).toBeVisible({ timeout: 10_000 });
  });
});
