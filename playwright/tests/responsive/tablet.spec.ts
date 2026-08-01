import {expect, test} from "../../fixtures";
import {TEST_IDS} from "../../constants/testIds";
import {DASHBOARD_ROUTES, ROUTES} from "../../constants/routes";

// Runs only against --project=tablet (1080x810, landscape iPad-class — see playwright.config.ts's
// own comment on why this sits *above* Tailwind's default `lg` breakpoint, unlike mobile-chrome's
// phone-width coverage). Deliberately read-only, same rationale as responsive.spec.ts: safe
// against the shared regressionUser, and shares that same unsuffixed storageState file (see
// config/env.ts's SHARED_STORAGE_PROJECTS) since this never runs tests/regression/'s mutating
// specs concurrently with anything else.
test.describe.configure({ mode: "serial" });

test.describe("Responsive (tablet-landscape viewport)", () => {
  // Same rationale as responsive.spec.ts's own skip guard — these assertions are only meaningful
  // at this specific width; an unscoped run picking this file up under another project would fail
  // for a reason that has nothing to do with a real regression.
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "tablet", "Only meaningful on --project=tablet — see test:tablet");
  });

  // Opposite assertion from responsive.spec.ts's own "shows the mobile menu toggle" test: at
  // 1080px (above `lg`), the desktop sidebar should render and the mobile hamburger should not —
  // proving the app's desktop layout holds up at a narrower-than-typical desktop width, not just
  // full-size monitors.
  test("dashboard shows the desktop sidebar, not the mobile menu toggle @responsive", async ({ accountsPage }) => {
    await accountsPage.goto(ROUTES.home);
    await expect(accountsPage.navLink(ROUTES.accounts)).toBeVisible();
    await expect(accountsPage.byTestId(TEST_IDS.nav.mobileMenuToggle)).toBeHidden();
  });

  test("every dashboard page has no horizontal overflow at tablet-landscape width @responsive", async ({ accountsPage }) => {
    for (const route of DASHBOARD_ROUTES) {
      await accountsPage.goto(route);
      await accountsPage.expectNoHorizontalOverflow();
    }
  });

  test("the FAB is reachable and opens its menu at tablet-landscape width @responsive", async ({ accountsPage }) => {
    await accountsPage.goto(ROUTES.accounts);
    await accountsPage.byTestId(TEST_IDS.fab.toggle).click();
    await expect(accountsPage.byTestId(TEST_IDS.fab.addAccount)).toBeVisible();
  });
});
