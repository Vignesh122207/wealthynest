import AxeBuilder from "@axe-core/playwright";
import type {Page} from "@playwright/test";
import {expect, test} from "../../fixtures";
import {ROUTES} from "../../constants/routes";

// Read-only — same rationale as responsive.spec.ts: no mutations, so safe to run against the
// shared regressionUser without any of the serial-mode data-collision concerns documented for
// tests/regression/. Asserts on every impact tier (critical/serious/moderate/minor) — critical/
// serious was already clean across all five pages, so this suite was tightened to the full set
// (previously moderate/minor were excluded as "a reasonable follow-up once critical/serious is
// consistently clean" — see Phase 9's original reasoning in the README). Two real moderate
// findings surfaced and were fixed: the login page's left brand panel and right form panel had no
// landmark elements at all (axe's `region` rule — fixed by making them `<aside>`/`<main>`), and
// several pages' card-title headings were `<h3>` directly under the page's only `<h1>` (Header.tsx),
// skipping `<h2>` entirely (axe's `heading-order` rule — fixed by promoting them to `<h2>`; see the
// README's a11y section for the full file list).
test.describe.configure({ mode: "serial" });

function anyViolation(results: Awaited<ReturnType<AxeBuilder["analyze"]>>) {
  return results.violations;
}

// globals.css's card/list entrance animations (`animate-fade-in-up` et al, up to a 375ms stagger
// delay plus their own 400ms duration — see delay-0..delay-375) fade opacity 0 -> 1 on mount.
// Scanning immediately after navigation can catch elements mid-fade, which axe (correctly, for
// that instant) reports as a color-contrast violation even though the element's own steady-state
// colors are compliant — that's a real difference from what a user actually reads once the page
// settles, not a genuine accessibility bug. Wait past the longest stagger+duration before
// scanning so this suite asserts on the resting UI, not a transient animation frame.
const ANIMATION_SETTLE_MS = 900;

// This 900ms budget is measured from navigation, but a widget's entrance animation only starts
// once its own data query resolves and it actually mounts — e.g. home/page.tsx's dataLoading
// gates several widgets on BOTH the dashboard and accounts queries together (see that file's own
// comment on why), so under CI load the accounts query can still be in flight well past 900ms
// from goto(), and axe then catches those widgets' skeleton->content swap mid fade-in (reported as
// a false-positive color-contrast violation on still-transitioning near-transparent text).
// Waiting for every loading skeleton to be gone first anchors the settle window to when content
// actually mounted instead of to navigation time. A no-op on pages with no skeleton at scan time —
// toHaveCount(0) resolves immediately when nothing matches. Waits for the *count* to reach zero,
// not just the first match to disappear: a page with several independently-gated widgets (e.g.
// home's dataLoading-gated cards vs its own separately-mounted ones) can clear its skeletons in
// more than one batch, and resolving on the first batch alone left the fixed settle window too
// short for whichever widget's skeleton cleared last — observed as that widget's own text still
// mid fade-in (e.g. a hair under the 4.5:1 threshold) at scan time.
async function waitForSkeletonsGone(page: Page): Promise<void> {
  await expect(page.locator(".animate-pulse")).toHaveCount(0, { timeout: 15000 }).catch(() => {});
}

test.describe("Accessibility (axe)", () => {
  test("login page has no a11y violations @a11y", async ({ page }) => {
    await page.goto(ROUTES.login);
    await waitForSkeletonsGone(page);
    await page.waitForTimeout(ANIMATION_SETTLE_MS);
    const results = await new AxeBuilder({ page }).analyze();
    expect(anyViolation(results), JSON.stringify(anyViolation(results), null, 2)).toEqual([]);
  });

  for (const [name, route] of [
    ["home", ROUTES.home],
    ["accounts", ROUTES.accounts],
    ["transactions", ROUTES.transactions],
    ["investments", ROUTES.investments],
    ["budgets", ROUTES.budgets],
    ["goals", ROUTES.goals],
    ["debts", ROUTES.debts],
    ["family", ROUTES.family],
    ["reports", ROUTES.reports],
    ["notifications", ROUTES.notifications],
    ["settings", ROUTES.settings],
    ["vault", ROUTES.vault],
    ["analytics", ROUTES.analytics],
    ["net worth", ROUTES.netWorth],
  ] as const) {
    test(`${name} page has no a11y violations @a11y`, async ({ accountsPage }) => {
      await accountsPage.goto(route);
      await waitForSkeletonsGone(accountsPage.rawPage);
      await accountsPage.rawPage.waitForTimeout(ANIMATION_SETTLE_MS);
      const results = await new AxeBuilder({ page: accountsPage.rawPage }).analyze();
      expect(anyViolation(results), JSON.stringify(anyViolation(results), null, 2)).toEqual([]);
    });
  }
});
