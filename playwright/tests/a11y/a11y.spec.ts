import AxeBuilder from "@axe-core/playwright";
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

test.describe("Accessibility (axe)", () => {
  test("login page has no a11y violations @a11y", async ({ page }) => {
    await page.goto(ROUTES.login);
    await page.waitForTimeout(ANIMATION_SETTLE_MS);
    const results = await new AxeBuilder({ page }).analyze();
    expect(anyViolation(results), JSON.stringify(anyViolation(results), null, 2)).toEqual([]);
  });

  for (const [name, route] of [
    ["dashboard", ROUTES.dashboard],
    ["accounts", ROUTES.accounts],
    ["transactions", ROUTES.transactions],
    ["investments", ROUTES.investments],
    ["budgets", ROUTES.budgets],
  ] as const) {
    test(`${name} page has no a11y violations @a11y`, async ({ accountsPage }) => {
      await accountsPage.goto(route);
      await accountsPage.rawPage.waitForTimeout(ANIMATION_SETTLE_MS);
      const results = await new AxeBuilder({ page: accountsPage.rawPage }).analyze();
      expect(anyViolation(results), JSON.stringify(anyViolation(results), null, 2)).toEqual([]);
    });
  }
});
