import { test, expect, NO_AUTH_STATE, CUSTOMER_STATE } from "./fixtures/base";

test.use({ storageState: NO_AUTH_STATE });

test.describe("Sign in", () => {
  test("customer logs in and lands on /dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.fill("#email", "ricky+1@doorsteplaundrylc.com");
    await page.fill("#password", "mypass1.");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("staff logs in and lands on /wash", async ({ page }) => {
    await page.goto("/login");
    await page.fill("#email", "ricky+staff1@doorsteplaundrylc.com");
    await page.fill("#password", "mypass1.");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/wash/, { timeout: 15_000 });
    await expect(page).toHaveURL(/\/wash/);
  });

  test("wrong password shows an error", async ({ page }) => {
    await page.goto("/login");
    await page.fill("#email", "ricky+1@doorsteplaundrylc.com");
    await page.fill("#password", "wrongpassword");
    await page.click('button[type="submit"]');
    await expect(page.getByText(/invalid email or password/i)).toBeVisible({ timeout: 8_000 });
    await expect(page).toHaveURL(/\/login/);
  });

});

test.describe("Role-based redirects", () => {
  test("unauthenticated visit to /dashboard redirects to /login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/, { timeout: 8_000 });
  });

  test("unauthenticated visit to /book redirects to /login", async ({ page }) => {
    await page.goto("/book");
    await expect(page).toHaveURL(/\/login/, { timeout: 8_000 });
  });

  test("unauthenticated visit to /admin redirects to /login", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/, { timeout: 8_000 });
  });
});

test.describe("Already-authenticated redirects", () => {
  test.use({ storageState: CUSTOMER_STATE });

  test("logged-in customer visiting /login is redirected to /welcome then /dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.waitForURL(/\/dashboard/, { timeout: 8_000 });
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
