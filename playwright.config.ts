import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

// Load .env so DATABASE_URL_TEST etc. are available in this config process
config();

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const testDbUrl = process.env.DATABASE_URL_TEST;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["html", { open: "on-failure" }]],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium",
      dependencies: ["setup"],
      testIgnore: /auth\.setup\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      // Only override DATABASE_URL when a test-specific URL is set.
      // If unset, Next.js loads DATABASE_URL from .env itself.
      ...(testDbUrl ? { DATABASE_URL: testDbUrl } : {}),
      NEXTAUTH_URL: BASE_URL,
    },
  },
});
