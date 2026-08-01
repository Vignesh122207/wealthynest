import {expect, test} from "../../fixtures";
import {TEST_IDS} from "../../constants/testIds";
import {DASHBOARD_ROUTES, ROUTES} from "../../constants/routes";
import {expectNoHorizontalOverflow} from "../../helpers/viewport.helper";

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
    await accountsPage.goto(ROUTES.home);
    await expect(accountsPage.navLink(ROUTES.accounts)).toBeHidden();

    await accountsPage.openMobileMenu();
    await expect(accountsPage.navLink(ROUTES.accounts).last()).toBeVisible();
  });

  test("mobile nav link navigates and the menu closes behind it @responsive", async ({ accountsPage }) => {
    await accountsPage.goto(ROUTES.home);
    await accountsPage.openMobileMenu();
    await accountsPage.navLink(ROUTES.accounts).last().click();

    await accountsPage.expectUrl(new RegExp(`${ROUTES.accounts}$`));
    await expect(accountsPage.navLink(ROUTES.accounts)).toBeHidden();
  });

  test("every dashboard page has no horizontal overflow at mobile width @responsive", async ({ accountsPage }) => {
    // netWorth (Net Worth banner + allocation donut) and debts (3-card summary) previously did
    // overflow at this width — a fixed-width chart/legend row and an unresponsive grid-cols-3
    // respectively — which is why this now checks every dashboard route instead of a handful.
    for (const route of DASHBOARD_ROUTES) {
      await accountsPage.goto(route);
      await accountsPage.expectNoHorizontalOverflow();
    }
  });

  // Pre-login pages have their own page objects (LoginPage/SignupPage) that don't extend
  // BasePage — they're never authenticated, so BasePage's nav/logout/etc. surface doesn't apply.
  // Uses the raw `page` fixture directly instead, same as visual.spec.ts does for these same two
  // routes.
  test("login and signup have no horizontal overflow at mobile width @responsive", async ({ page }) => {
    for (const route of [ROUTES.login, ROUTES.signup]) {
      await page.goto(route);
      await expectNoHorizontalOverflow(page);
    }
  });

  // LoginForm/SignupForm lock the outer page to one viewport height on mobile (overflow-hidden)
  // rather than letting the page scroll under a fixed card, like a native app's own login screen —
  // see either component's own top-of-JSX comment. That only stays safe if the *inner* form panel
  // (overflow-y-auto) can still scroll far enough to reach the submit button on a genuinely short
  // viewport/tall form — otherwise the button would be silently unreachable. Signup's full field
  // set is the tallest content on either auth screen (per SignupForm's own comment), so it's the
  // more meaningful of the two to check.
  test("login and signup lock to one viewport on mobile without hiding the submit button @responsive", async ({ page, loginPage, signupPage }) => {
    await loginPage.goto();
    await loginPage.continueWithEmail();
    await expect(loginPage.passwordSubmitButton).toBeVisible();
    let { scrollHeight, clientHeight } = await page.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
    }));
    expect(scrollHeight, "login's outer page scrolled instead of staying locked to one viewport").toBeLessThanOrEqual(clientHeight + 1);

    await signupPage.goto();
    await signupPage.continueWithEmailButton.click();
    await expect(signupPage.submitButton).toBeVisible();
    ({ scrollHeight, clientHeight } = await page.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
    })));
    expect(scrollHeight, "signup's outer page scrolled instead of staying locked to one viewport").toBeLessThanOrEqual(clientHeight + 1);
  });

  test("the FAB is reachable and opens its menu on a mobile viewport @responsive", async ({ accountsPage }) => {
    await accountsPage.goto(ROUTES.accounts);
    await accountsPage.byTestId(TEST_IDS.fab.toggle).click();
    await expect(accountsPage.byTestId(TEST_IDS.fab.addAccount)).toBeVisible();
  });
});
