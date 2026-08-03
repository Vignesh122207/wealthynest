import type {Page, Response} from "@playwright/test";
import {env} from "../config/env";

// Mirrors playwright.config.ts's own actionTimeout/navigationTimeout CI split — page.waitForResponse
// and locator.waitFor aren't governed by those action-timeout settings (they're explicit waits, not
// interactions), so this file needs its own CI-aware constant for the same reason.
const WAIT_TIMEOUT = env.isCI ? 30000 : 15000;

// Sonner (wealthynest-web/src/components/ui/ThemedToaster.tsx) stamps every toast it renders with
// a `data-sonner-toast` attribute on its own — no custom data-testid needed on our side.
export function toastLocator(page: Page, text?: string | RegExp) {
  const toasts = page.locator("[data-sonner-toast]");
  return text ? toasts.filter({ hasText: text }) : toasts;
}

/** Waits for the next response to a given API path + method, resolving once the request the
 * triggering action kicks off actually completes — pair with the action via Promise.all so the
 * wait is registered before the click fires it.
 *
 * Asserts a 2xx status by default and throws with the response body otherwise: every caller uses
 * this to know a mutation succeeded before moving on, and a matched-but-failed response (a 4xx
 * validation error, a 5xx) used to be treated as "done" just the same, since only URL+method were
 * checked. That turned real server-side failures into a confusing UI-level timeout several steps
 * later (the app correctly leaves its modal open on error, and the *next* action then hits that
 * modal's backdrop) instead of a clear, immediate "the API rejected this." Pass
 * `{ allowError: true }` for the rare test that's deliberately asserting an error response.
 *
 * A bare 401 (unless allowError) is treated as "not resolved yet," not a failure: auth.store.ts
 * deliberately keeps the access token in memory only, so a fresh page load's first matching
 * request is *expected* to 401 once and get transparently retried by axios.ts's response
 * interceptor (same URL/method, fresh token) — invisible to a real user. Resolving on that
 * transient 401 instead of the retry it's known to trigger turned an app behavior working exactly
 * as designed into a spurious test failure. Any other status still resolves immediately, so a
 * genuine failure is still reported without waiting out the full timeout. */
export async function waitForApiResponse(
  page: Page, urlPattern: string | RegExp, method = "POST", opts?: { allowError?: boolean }
): Promise<Response> {
  const res = await page.waitForResponse(
    (res) => {
      const matchesUrl = typeof urlPattern === "string" ? res.url().includes(urlPattern) : urlPattern.test(res.url());
      if (!matchesUrl || res.request().method() !== method) return false;
      return opts?.allowError || res.status() !== 401;
    },
    { timeout: WAIT_TIMEOUT }
  );
  if (!opts?.allowError && !res.ok()) {
    const body = await res.text().catch(() => "<unreadable body>");
    throw new Error(`Expected a successful response for ${method} ${res.url()}, got ${res.status()}: ${body}`);
  }
  return res;
}

/** Waits for (dashboard)/layout.tsx's own mount-time GET /users/me resync to settle — call right
 * after navigating an authedPage so the rest of the test doesn't race the same 401-then-refresh
 * cycle described on waitForApiResponse above. Two failure modes this closes, both confirmed live:
 * (1) a page object that clicks straight into data that depends on another parallel GET (e.g. an
 * account/category picker fed by useAccounts()) can find that request's own retry still in
 * flight, rendering an empty picker with no option to click; (2) worse, every tests/regression/
 * file shares one worker-scoped browser context (fixtures/index.ts's authedContext) and its one
 * refresh-token cookie — if a test's authedPage fixture calls page.close() while this resync's
 * refresh redemption is still in flight, the response (and the Set-Cookie that rotates the cookie
 * forward) can be dropped, leaving the *already server-side-revoked* old cookie sitting in the
 * shared context for the next test to present. That's tolerated once by AuthServiceImpl's 10s
 * reuse grace window, but repeats across enough back-to-back tests and it eventually gets
 * presented outside that window, which revokes every session for the shared regressionUser and
 * cascades into every regression file still to run (reproduced live via the mass "401 Unauthorized"
 * / forced /login redirects across ~19 unrelated files in the 2026-08-01/02 nightly runs).
 * Short, bounded, and best-effort — a page that never mounts the dashboard layout (login, signup,
 * marketing) never fires this request at all, so this must not fail the test if it doesn't show
 * up. */
export async function waitForDashboardReady(page: Page): Promise<void> {
  await page
    .waitForResponse(
      (res) => res.url().includes("/users/me") && res.request().method() === "GET" && res.status() !== 401,
      { timeout: 5000 }
    )
    .catch(() => {});
}

/** A successful mutation's API response resolves before React actually flushes the DOM removal of
 * its modal — every modal shell in the app (TransactionModalOverlay, AccountFormModal's own
 * bespoke overlay, ConfirmDialog) shares `data-testid="modal-overlay-backdrop"` on its outer
 * backdrop <div> specifically so this can wait for it. `role="dialog"` looked like the same signal
 * but isn't: it's only on the *inner* content wrapper, not the backdrop — so a wait scoped to it
 * resolved before the backdrop itself was actually gone, and the next action (e.g. opening a
 * second modal right after) could still hit that backdrop intercepting the click. Call this after
 * a submit that closes one of these modals, before the next UI action. */
export async function waitForDialogClosed(page: Page): Promise<void> {
  await page.getByTestId("modal-overlay-backdrop").first().waitFor({ state: "detached", timeout: WAIT_TIMEOUT }).catch(() => {});
}

// A previous version of waitForDialogClosed also called page.waitForLoadState("networkidle") here,
// on the theory that it would close the same invalidateQueries-is-a-second-round-trip gap described
// on submitEditAndWait-style helpers (a mutation's onSuccess closes the modal synchronously, but the
// list refetch it also triggers is a separate, later network round trip). It didn't actually fix
// that — the *specific* fix that worked was waiting for the exact follow-up GET response at each
// call site that needed it (see BudgetsPage.submitEditAndWait, GoalsPage.editTargetAmount/
// addSavings). Left in globally, the networkidle wait was pure downside: sonner toasts
// (ThemedToaster.tsx) auto-dismiss on their own timer, and stacking an extra ~1-5s wait here after
// every single modal close was long enough, often enough, to let a success toast expire before a
// test's very next line could assert on it. Removed for that reason — add an explicit
// waitForApiResponse(GET ...) at the specific call site that needs the refetch, not here.
