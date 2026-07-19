import type {Page, Response} from "@playwright/test";

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
 * `{ allowError: true }` for the rare test that's deliberately asserting an error response. */
export async function waitForApiResponse(
  page: Page, urlPattern: string | RegExp, method = "POST", opts?: { allowError?: boolean }
): Promise<Response> {
  const res = await page.waitForResponse(
    (res) => {
      const matchesUrl = typeof urlPattern === "string" ? res.url().includes(urlPattern) : urlPattern.test(res.url());
      return matchesUrl && res.request().method() === method;
    },
    { timeout: 15000 }
  );
  if (!opts?.allowError && !res.ok()) {
    const body = await res.text().catch(() => "<unreadable body>");
    throw new Error(`Expected a successful response for ${method} ${res.url()}, got ${res.status()}: ${body}`);
  }
  return res;
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
  await page.getByTestId("modal-overlay-backdrop").first().waitFor({ state: "detached", timeout: 15000 }).catch(() => {});
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
