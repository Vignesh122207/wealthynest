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

// Polls instead of a single request: deploy-backend.sh's own local health check already passed
// before this suite ever starts, but the symlink-flip + systemd restart it just did can leave the
// service flapping for up to ~90s afterward (a real, reproduced restart race, not theoretical) -
// backend.yml's own external health check step already tolerates exactly this with the same
// polling/timeout shape. A single fast request here (Playwright's default retry fires almost
// immediately, not with real delay) was catching that same window and rolling back releases that
// were actually fine moments later.
//
// test.setTimeout(...) here, not a bump to the whole file/project's `timeout` in
// playwright.config.ts: the first version of this fix used expect.poll()'s own 90s/2s timeout but
// left the *test's* timeout at the config's global 30s default, which killed the test (and the
// poll along with it) at ~28-30s every time, before the poll ever got the extra 60s it was
// supposedly given - confirmed by the real failure timing (three ~28.3s failures, not the
// expected up-to-90s). The other three tests in this file are fast checks with no reason to
// share this one test's patience, so this stays scoped to just the test that needs it.
//
// 150s poll / 170s test timeout, not 90s: deploy-backend.sh's own wait_for_health() already
// confirms the app itself is healthy *locally* before SSM ever reports success, so whatever gap
// remains before the site is reachable externally is somewhere in the nginx/Cloudflare path, not
// app startup - and the only real data point on how long that gap lasts (one observed incident,
// ~90-110s before external recovery) was a single sample, not a proven ceiling. Two real deploys
// in a row have now hit this exact window; picking a number that just barely matches the one
// anecdote risks a third false rollback for the same reason. 150s gives real margin beyond that
// single observation instead of re-guessing the same number again.
test("API health endpoint reports UP", async ({ request }) => {
  test.setTimeout(170_000);
  await expect.poll(async () => {
    const response = await request.get(`${apiOrigin}/actuator/health`);
    // TEMPORARY diagnostic logging - real status/body/headers on every attempt, since three real
    // runs have now failed with the actual response swallowed down to a bare `null`. Remove once
    // the real cause (suspected Cloudflare-side block of this specific request, independent of
    // app health or deploy timing - confirmed by a standalone run with no deploy in progress
    // failing identically) is confirmed and fixed.
    console.log(`[diag] status=${response.status()} headers=${JSON.stringify(response.headers())}`);
    if (!response.ok()) {
      console.log(`[diag] body=${(await response.text()).slice(0, 500)}`);
      return null;
    }
    const body = await response.json();
    return body.status;
  }, { timeout: 150_000, intervals: [3_000] }).toBe("UP");
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
