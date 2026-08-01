import {expect, test} from "../../fixtures";
import {TEST_IDS} from "../../constants/testIds";
import {DASHBOARD_ROUTES, ROUTES} from "../../constants/routes";

// Runs only against --project=tablet-portrait (810x1080, iPad's own portrait dimensions — see
// playwright.config.ts's own comment on why this sits *below* Tailwind's default `lg` breakpoint,
// unlike tablet.spec.ts's landscape coverage). Deliberately read-only, same rationale as
// responsive.spec.ts/tablet.spec.ts: safe against the shared regressionUser, and shares that same
// unsuffixed storageState file (see config/env.ts's SHARED_STORAGE_PROJECTS) since this never runs
// tests/regression/'s mutating specs concurrently with anything else.
test.describe.configure({ mode: "serial" });

test.describe("Responsive (tablet-portrait viewport)", () => {
  // Same rationale as responsive.spec.ts's own skip guard — these assertions are only meaningful
  // at this specific width; an unscoped run picking this file up under another project would fail
  // for a reason that has nothing to do with a real regression.
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "tablet-portrait", "Only meaningful on --project=tablet-portrait — see test:tablet-portrait");
  });

  // Same shape as responsive.spec.ts's own "shows the mobile menu toggle" test — at 810px (below
  // `lg`), the mobile overlay nav should render, not the desktop sidebar, proving the mobile layout
  // holds up at a materially taller/wider viewport than mobile-chrome's phone width, not just phones.
  test("dashboard shows the mobile menu toggle instead of the desktop sidebar @responsive", async ({ accountsPage }) => {
    await accountsPage.goto(ROUTES.home);
    await expect(accountsPage.navLink(ROUTES.accounts)).toBeHidden();

    await accountsPage.openMobileMenu();
    await expect(accountsPage.navLink(ROUTES.accounts).last()).toBeVisible();
  });

  test("every dashboard page has no horizontal overflow at tablet-portrait width @responsive", async ({ accountsPage }) => {
    for (const route of DASHBOARD_ROUTES) {
      await accountsPage.goto(route);
      await accountsPage.expectNoHorizontalOverflow();
    }
  });

  test("the FAB is reachable and opens its menu at tablet-portrait width @responsive", async ({ accountsPage }) => {
    await accountsPage.goto(ROUTES.accounts);
    await accountsPage.byTestId(TEST_IDS.fab.toggle).click();
    await expect(accountsPage.byTestId(TEST_IDS.fab.addAccount)).toBeVisible();
  });
});
