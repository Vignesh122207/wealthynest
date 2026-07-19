import {expect, test} from "../../fixtures";
import {TEST_IDS} from "../../constants/testIds";
import {ROUTES} from "../../constants/routes";

// Runs only against --project=narrow-desktop (1152x720, plain desktop UA — see playwright.config.ts's
// own comment on why this is a non-touch viewport just above `lg`, distinct from both tablet
// projects). Deliberately read-only, same rationale as responsive.spec.ts/tablet.spec.ts: safe
// against the shared regressionUser, and shares that same unsuffixed storageState file (see
// config/env.ts's SHARED_STORAGE_PROJECTS) since this never runs tests/regression/'s mutating
// specs concurrently with anything else.
test.describe.configure({ mode: "serial" });

test.describe("Responsive (narrow-desktop viewport)", () => {
  // Same rationale as responsive.spec.ts's own skip guard — these assertions are only meaningful
  // at this specific width; an unscoped run picking this file up under another project would fail
  // for a reason that has nothing to do with a real regression.
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "narrow-desktop", "Only meaningful on --project=narrow-desktop — see test:narrow-desktop");
  });

  // Same assertion direction as tablet.spec.ts's own test — at 1152px (above `lg`), the desktop
  // sidebar should render and the mobile hamburger should not, proving the desktop layout holds up
  // at a genuinely narrow desktop/laptop width, not just a full-size monitor or tablet-landscape.
  test("dashboard shows the desktop sidebar, not the mobile menu toggle @responsive", async ({ accountsPage }) => {
    await accountsPage.goto(ROUTES.dashboard);
    await expect(accountsPage.navLink(ROUTES.accounts)).toBeVisible();
    await expect(accountsPage.byTestId(TEST_IDS.nav.mobileMenuToggle)).toBeHidden();
  });

  test("key pages have no horizontal overflow at narrow-desktop width @responsive", async ({ accountsPage }) => {
    for (const route of [ROUTES.dashboard, ROUTES.accounts, ROUTES.transactions, ROUTES.investments]) {
      await accountsPage.goto(route);
      await accountsPage.expectNoHorizontalOverflow();
    }
  });

  test("the FAB is reachable and opens its menu at narrow-desktop width @responsive", async ({ accountsPage }) => {
    await accountsPage.goto(ROUTES.accounts);
    await accountsPage.byTestId(TEST_IDS.fab.toggle).click();
    await expect(accountsPage.byTestId(TEST_IDS.fab.addAccount)).toBeVisible();
  });
});
