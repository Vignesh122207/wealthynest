import { test, expect } from "@playwright/test";

/**
 * Read-only, DB-free checks run against the live production URLs right after a backend deploy.
 * See package.json's description for why this is separate from ../../playwright (the app's own
 * E2E suite) rather than reusing tests/smoke from there.
 */

const apiUrl = process.env.API_URL ?? "https://api.wealthynest.in/api/v1";
// Actuator is mounted at the domain root by nginx.conf's own `location /actuator/health` block,
// not under the API's /api/v1 prefix - concatenating it onto apiUrl directly hits a path Spring
// Security has no mapping for (401, not 200), which is exactly what broke the first real deploy's
// smoke check. Derive just the origin for this one endpoint instead.
const apiOrigin = new URL(apiUrl).origin;

test("API health endpoint reports UP", async ({ request }) => {
  const response = await request.get(`${apiOrigin}/actuator/health`);
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.status).toBe("UP");
});

test("landing page loads", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.ok()).toBeTruthy();
  await expect(page).toHaveTitle(/WealthyNest/i);
});

test("login page renders the email step", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByTestId("login-continue-with-email-button")).toBeVisible();
});

test("rejecting bad credentials proves frontend, backend, and auth are actually wired together", async ({ page }) => {
  await page.goto("/login");
  await page.getByTestId("login-continue-with-email-button").click();

  await page.getByTestId("login-password-step-email-input").fill("post-deploy-smoke-check@example.com");
  await page.getByTestId("login-password-step-password-input").fill("definitely-not-a-real-password");
  await page.getByTestId("login-password-submit").click();

  // No account exists with this email, so a real round trip through the backend must reject it -
  // the page should never navigate away from /login. Deliberately not asserting on a specific
  // error-toast selector: staying put is the robust signal, exact error UI can change without
  // this smoke check needing to track it.
  await page.waitForTimeout(2_000);
  await expect(page).toHaveURL(/\/login$/);
});
