import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.BASE_URL ?? "https://wealthynest.in";

export default defineConfig({
  testDir: ".",
  timeout: 30_000,
  retries: 2,
  workers: 1,
  reporter: [["list"], ["html", { outputFolder: "smoke-report", open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
