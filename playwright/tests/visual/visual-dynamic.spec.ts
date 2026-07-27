import {expect, test} from "../../fixtures";
import type {BrowserContext, Page} from "@playwright/test";
import {provisionE2EUser} from "../../helpers/auth.helper";
import {api} from "../../helpers/api.helper";
import {LoginPage} from "../../pages/auth/LoginPage";
import {HomePage} from "../../pages/HomePage";
import {AccountsPage} from "../../pages/AccountsPage";
import {TransactionsPage} from "../../pages/TransactionsPage";

// visual.spec.ts stays deliberately limited to pages with zero per-run-dynamic content — this file
// covers the three pages that were the "Known gaps" note's whole reason that suite excludes them:
// Dashboard, Accounts, Transactions all render real user data that would diff on every run against
// regressionUser (its transaction history only grows). The fix here isn't masking a populated page —
// it's a dedicated, disposable, never-mutated-after-setup user that starts and stays at zero
// accounts/transactions/goals/etc, the same "fully-seeded deterministic empty state" the README
// named as the alternative to masking. A genuinely fresh user's dashboard/accounts/transactions
// pages turn out to be almost entirely static once you check every component's zero-data branch
// (GoalsSummary/SixMonthTrend/NetWorthTrend/SmartAlerts/etc. all only interpolate a date into
// visible text on their *non-empty* branch) — confirmed by reading each component directly, not
// assumed. The one exception is GreetingBanner, which always renders a time-of-day greeting
// ("Good morning/afternoon/evening") and the current month label regardless of data — masked via
// its own new `data-testid="greeting-banner"` rather than skipped, since the rest of the dashboard
// is worth pinning. Transactions defaults to "Month" mode, which renders the current month's label
// even with zero transactions in it — switched to "All" mode (Phase 12's `showAllDates()`) before
// screenshotting, matching that page's own established pattern for date-independent assertions
// rather than adding a second masked region for what a one-click mode switch already avoids.
test.describe.configure({ mode: "serial" });

test.describe("Visual regression (dynamic pages, fresh empty-state user)", () => {
  let context: BrowserContext;
  let page: Page;
  let accessToken: string;

  test.beforeAll(async ({ browser }) => {
    const user = await provisionE2EUser({ fullName: "Visual Test User" });
    accessToken = user.auth.accessToken;

    context = await browser.newContext();
    page = await context.newPage();
    const login = new LoginPage(page);
    await login.loginWithPassword(user.email, user.password);
    await login.expectRedirectedToHome();
  });

  test.afterAll(async () => {
    await api.closeAccount(accessToken).catch(() => {});
    await context.close();
  });

  test("dashboard (empty state) @visual", async () => {
    const home = new HomePage(page);
    await home.gotoHome();
    await home.expectLoaded();
    await home.rawPage.waitForTimeout(900);
    await expect(page).toHaveScreenshot("dashboard-empty.png", {
      mask: [page.getByTestId("greeting-banner")],
      maxDiffPixelRatio: 0.02,
    });
  });

  test("accounts (empty state) @visual", async () => {
    const accounts = new AccountsPage(page);
    await accounts.gotoAccounts();
    await accounts.rawPage.waitForTimeout(900);
    await expect(page).toHaveScreenshot("accounts-empty.png", { maxDiffPixelRatio: 0.02 });
  });

  test("transactions (empty state, all dates) @visual", async () => {
    const transactions = new TransactionsPage(page);
    await transactions.gotoTransactions();
    await transactions.showAllDates();
    await transactions.rawPage.waitForTimeout(900);
    await expect(page).toHaveScreenshot("transactions-empty.png", { maxDiffPixelRatio: 0.02 });
  });
});
