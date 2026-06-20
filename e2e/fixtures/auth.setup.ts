import { test as setup, expect, type Page } from "@playwright/test";
import path from "path";

const CUSTOMER_STATE = path.join(__dirname, "../.auth/customer.json");
const STAFF_STATE = path.join(__dirname, "../.auth/staff.json");
const ADMIN_STATE = path.join(__dirname, "../.auth/admin.json");

async function loginAndSave(
  page: Page,
  email: string,
  expectedPath: string,
  statePath: string
) {
  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", "mypass1.");
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => url.pathname === expectedPath, { timeout: 15_000 });
  await expect(page).toHaveURL(new RegExp(expectedPath));
  await page.context().storageState({ path: statePath });
}

setup("save customer auth state", async ({ page }) => {
  await loginAndSave(page, "ricky+1@doorsteplaundrylc.com", "/dashboard", CUSTOMER_STATE);
});

setup("save staff auth state", async ({ page }) => {
  await loginAndSave(page, "ricky+staff1@doorsteplaundrylc.com", "/wash", STAFF_STATE);
});

setup("save admin auth state", async ({ page }) => {
  await loginAndSave(page, "ricky@doorsteplaundrylc.com", "/wash", ADMIN_STATE);
});
