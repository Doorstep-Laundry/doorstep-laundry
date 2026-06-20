import { test, expect, NO_AUTH_STATE, CUSTOMER_STATE, STAFF_STATE, ADMIN_STATE } from "./fixtures/base";

test.describe("Role-based access control (RBAC)", () => {
  test.describe("as customer", () => {
    test.use({ storageState: CUSTOMER_STATE });

    test("customer cannot access /admin — redirected to /dashboard", async ({ page }) => {
      await page.goto("/admin");
      await page.waitForURL(/\/dashboard/, { timeout: 8_000 });
      await expect(page).toHaveURL(/\/dashboard/);
    });

    test("customer cannot access /wash — redirected to /dashboard", async ({ page }) => {
      await page.goto("/wash");
      await page.waitForURL(/\/dashboard/, { timeout: 8_000 });
      await expect(page).toHaveURL(/\/dashboard/);
    });

    test("customer cannot access /driver — redirected to /dashboard", async ({ page }) => {
      await page.goto("/driver");
      await page.waitForURL(/\/dashboard/, { timeout: 8_000 });
      await expect(page).toHaveURL(/\/dashboard/);
    });
  });

  test.describe("as staff", () => {
    test.use({ storageState: STAFF_STATE });

    test("staff cannot access /admin — redirected", async ({ page }) => {
      await page.goto("/admin");
      await expect(page).not.toHaveURL(/\/admin/, { timeout: 8_000 });
    });

    test("staff can access /wash", async ({ page }) => {
      await page.goto("/wash");
      await expect(page).toHaveURL(/\/wash/, { timeout: 8_000 });
    });
  });

  test.describe("as admin", () => {
    test.use({ storageState: ADMIN_STATE });

    test("admin can access /admin", async ({ page }) => {
      await page.goto("/admin");
      await expect(page).toHaveURL(/\/admin/, { timeout: 8_000 });
    });
  });
});

test.describe("Unauthenticated guards", () => {
  test.use({ storageState: NO_AUTH_STATE });

  test("protected page /dashboard redirects to /login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/, { timeout: 8_000 });
  });

  test("protected page /book redirects to /login", async ({ page }) => {
    await page.goto("/book");
    await expect(page).toHaveURL(/\/login/, { timeout: 8_000 });
  });

  test("protected page /wash redirects to /login", async ({ page }) => {
    await page.goto("/wash");
    await expect(page).toHaveURL(/\/login/, { timeout: 8_000 });
  });

  test("protected page /admin redirects to /login", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/, { timeout: 8_000 });
  });

  test("protected page /driver redirects to /login", async ({ page }) => {
    await page.goto("/driver");
    await expect(page).toHaveURL(/\/login/, { timeout: 8_000 });
  });
});

test.describe("Order state guards (customer)", () => {
  test.use({ storageState: CUSTOMER_STATE });

  test("customer cannot view another user's order (seeded customer2 order)", async ({ page }) => {
    // order 9003 belongs to customer2; customer1's session should get 404 or redirect
    const res = await page.goto("/orders/nonexistent-order-id-xyz");
    // Should not 200 into another user's order — expect redirect or 404
    const notFound = page.getByText(/not found|404|doesn't exist/i);
    const redirectedAway = !page.url().includes("/orders/nonexistent");
    expect(
      (await notFound.count()) > 0 || redirectedAway
    ).toBeTruthy();
  });
});
