import {expect, test} from "../../fixtures";
import {TEST_IDS} from "../../constants/testIds";
import {ROUTES} from "../../constants/routes";

// Runs only against --project=mobile-chrome (see package.json's test:responsive script and
// README's "npm run test:* scripts run chromium only — on purpose" for why the other regression
// suites can't just add this project to their own run). Deliberately read-only — no account/
// budget/etc. creation — so it's safe to run against the shared regressionUser (via authedPage)
// without touching the backend-singleton collision risk that constraining regression specs to a
// single project sidesteps: this file makes no mutations at all, so there's nothing to collide.
test.describe.configure({ mode: "serial" });

test.describe("Responsive (mobile viewport)", () => {
  // Assertions here (sidebar hidden below `lg`, FAB reachable at a small viewport) are only
  // meaningful on a narrow viewport — running this file under the desktop `chromium` project
  // (e.g. an unscoped `npm test`) would fail every test here for a reason that has nothing to do
  // with a real regression. Only `npm run test:responsive` (--project=mobile-chrome) should run
  // this file in practice; this skip guard makes that safe even if it's picked up by accident.
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chrome", "Only meaningful on --project=mobile-chrome — see test:responsive");
  });

  // Sidebar.tsx renders the same nav content (and testids) inside both the always-in-DOM,
  // CSS-hidden-below-`lg` desktop <aside> and the conditionally-rendered mobile overlay <aside> —
  // once the overlay is open, navLink() matches both, so scope to `.last()` (the overlay's own
  // copy, mounted after the desktop one) for anything asserted while the overlay is expected open.
  test("dashboard shows the mobile menu toggle instead of the desktop sidebar @responsive", async ({ accountsPage }) => {
    await accountsPage.goto(ROUTES.dashboard);
    await expect(accountsPage.navLink(ROUTES.accounts)).toBeHidden();

    await accountsPage.openMobileMenu();
    await expect(accountsPage.navLink(ROUTES.accounts).last()).toBeVisible();
  });

  test("mobile nav link navigates and the menu closes behind it @responsive", async ({ accountsPage }) => {
    await accountsPage.goto(ROUTES.dashboard);
    await accountsPage.openMobileMenu();
    await accountsPage.navLink(ROUTES.accounts).last().click();

    await accountsPage.expectUrl(new RegExp(`${ROUTES.accounts}$`));
    await expect(accountsPage.navLink(ROUTES.accounts)).toBeHidden();
  });

  test("key pages have no horizontal overflow at mobile width @responsive", async ({ accountsPage }) => {
    for (const route of [ROUTES.dashboard, ROUTES.accounts, ROUTES.transactions, ROUTES.investments]) {
      await accountsPage.goto(route);
      await accountsPage.expectNoHorizontalOverflow();
    }
  });

  test("the FAB is reachable and opens its menu on a mobile viewport @responsive", async ({ accountsPage }) => {
    await accountsPage.goto(ROUTES.accounts);
    await accountsPage.byTestId(TEST_IDS.fab.toggle).click();
    await expect(accountsPage.byTestId(TEST_IDS.fab.addAccount)).toBeVisible();
  });
});
