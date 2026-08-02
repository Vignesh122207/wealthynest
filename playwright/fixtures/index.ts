import {type BrowserContext, type Page, test as base} from "@playwright/test";
import {storageStatePathFor} from "../config/env";
import {type E2EUserFixtureData, readE2EUser, readRegressionUser, storageStateFor} from "../helpers/auth.helper";
import {api} from "../helpers/api.helper";
import {LoginPage} from "../pages/auth/LoginPage";
import {SignupPage} from "../pages/auth/SignupPage";
import {HomePage} from "../pages/HomePage";
import {AccountsPage} from "../pages/AccountsPage";
import {TransactionsPage} from "../pages/TransactionsPage";
import {BudgetsPage} from "../pages/BudgetsPage";
import {GoalsPage} from "../pages/GoalsPage";
import {InvestmentsPage} from "../pages/InvestmentsPage";
import {DebtsPage} from "../pages/DebtsPage";
import {NetWorthPage} from "../pages/NetWorthPage";
import {AnalyticsPage} from "../pages/AnalyticsPage";
import {ReportsPage} from "../pages/ReportsPage";
import {FamilyPage} from "../pages/FamilyPage";
import {NotificationsPage} from "../pages/NotificationsPage";
import {SettingsPage} from "../pages/SettingsPage";
import {CategoriesPage} from "../pages/CategoriesPage";
import {RecurringRulesPage} from "../pages/RecurringRulesPage";
import {SupportPage} from "../pages/SupportPage";
import {VaultPage} from "../pages/VaultPage";
import {Modal} from "../components/Modal";
import {Toast} from "../components/Toast";

interface Fixtures {
  e2eUser: E2EUserFixtureData;
  /** A page whose context already has the global-setup E2E user's storageState loaded — skips a
   * real UI login for tests that aren't themselves verifying the login flow (tests/auth/ is for
   * that). Same user tests/smoke/ logs into via the UI, so don't mix this into tests/regression/. */
  authenticatedPage: Page;

  /** The dedicated tests/regression/ user global-setup provisioned — separate from e2eUser so
   * this suite's account/debt/budget/... data never coexists with what tests/auth/ + tests/smoke/
   * create against the same rows. */
  regressionUser: E2EUserFixtureData;
  /** A page pre-authenticated as regressionUser. Every regression-suite page object is built from
   * this, not `page` — see accountsPage/debtsPage/etc. below. */
  authedPage: Page;

  loginPage: LoginPage;
  signupPage: SignupPage;
  homePage: HomePage;
  accountsPage: AccountsPage;
  transactionsPage: TransactionsPage;
  budgetsPage: BudgetsPage;
  goalsPage: GoalsPage;
  investmentsPage: InvestmentsPage;
  debtsPage: DebtsPage;
  netWorthPage: NetWorthPage;
  analyticsPage: AnalyticsPage;
  reportsPage: ReportsPage;
  familyPage: FamilyPage;
  notificationsPage: NotificationsPage;
  settingsPage: SettingsPage;
  categoriesPage: CategoriesPage;
  recurringRulesPage: RecurringRulesPage;
  supportPage: SupportPage;
  vaultPage: VaultPage;
  modal: Modal;
  toast: Toast;
}

interface WorkerFixtures {
  /** One browser context per worker, logged in fresh as regressionUser — see its own comment
   * below (authedContext) for why this isn't a shared, disk-persisted storageState snapshot. */
  authedContext: BrowserContext;
}

export const test = base.extend<Fixtures, WorkerFixtures>({
  // Project-scoped (testInfo.project.name) so a project beyond "chromium" reads its own
  // provisioned user/storageState rather than colliding with chromium's — see config/env.ts's
  // storageStatePathFor and global-setup's PROJECTS_TO_PROVISION loop. Defaults to the original
  // unsuffixed "chromium" files, so every existing chromium-only run is unaffected.
  e2eUser: async ({}, use, testInfo) => {
    await use(readE2EUser(testInfo.project.name));
  },

  authenticatedPage: async ({ browser }, use, testInfo) => {
    const context = await browser.newContext({ storageState: storageStatePathFor(testInfo.project.name) });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  regressionUser: async ({}, use, testInfo) => {
    await use(readRegressionUser(testInfo.project.name));
  },

  // Worker-scoped, and logged in fresh here rather than loaded from a shared on-disk storageState
  // snapshot. That used to be safe because the access token also lived in localStorage (no refresh
  // ever needed for a 2-hour token's whole life); once auth.store.ts stopped persisting it, every
  // fresh context's first page load has to redeem the refresh-token cookie to get a working access
  // token. With every tests/regression/ file/worker replaying the exact same baked-in cookie, only
  // the very first redemption in a run was ever clean — every later one looked like reuse to
  // AuthServiceImpl's rotation-reuse detection and could revoke every session for the shared
  // regressionUser mid-run (confirmed live: "Refresh token reuse detected outside rotation grace
  // window" firing repeatedly, cascading into ~19 unrelated regression files failing in the same
  // run). One real login per worker means each worker's context owns a refresh-token cookie
  // nothing else has touched, and the context's own cookie jar keeps it correctly rotated — via
  // the app's normal 401-then-refresh flow — for that worker's whole lifetime.
  authedContext: [async ({ browser }, use, workerInfo) => {
    const user = readRegressionUser(workerInfo.project.name);
    const auth = await api.login({ email: user.email, password: user.password });
    const context = await browser.newContext({ storageState: storageStateFor(auth) });
    await use(context);
    await context.close();
  }, { scope: "worker" }],

  authedPage: async ({ authedContext }, use) => {
    const page = await authedContext.newPage();
    await use(page);
    await page.close();
  },

  loginPage:        async ({ page }, use) => { await use(new LoginPage(page)); },
  signupPage:       async ({ page }, use) => { await use(new SignupPage(page)); },
  homePage:    async ({ page }, use) => { await use(new HomePage(page)); },
  accountsPage:     async ({ authedPage }, use) => { await use(new AccountsPage(authedPage)); },
  transactionsPage: async ({ authedPage }, use) => { await use(new TransactionsPage(authedPage)); },
  budgetsPage:      async ({ authedPage }, use) => { await use(new BudgetsPage(authedPage)); },
  goalsPage:        async ({ authedPage }, use) => { await use(new GoalsPage(authedPage)); },
  investmentsPage:  async ({ authedPage }, use) => { await use(new InvestmentsPage(authedPage)); },
  debtsPage:        async ({ authedPage }, use) => { await use(new DebtsPage(authedPage)); },
  netWorthPage:     async ({ authedPage }, use) => { await use(new NetWorthPage(authedPage)); },
  analyticsPage:    async ({ authedPage }, use) => { await use(new AnalyticsPage(authedPage)); },
  reportsPage:      async ({ authedPage }, use) => { await use(new ReportsPage(authedPage)); },
  familyPage:       async ({ authedPage }, use) => { await use(new FamilyPage(authedPage)); },
  notificationsPage: async ({ authedPage }, use) => { await use(new NotificationsPage(authedPage)); },
  settingsPage:     async ({ authedPage }, use) => { await use(new SettingsPage(authedPage)); },
  categoriesPage:   async ({ authedPage }, use) => { await use(new CategoriesPage(authedPage)); },
  recurringRulesPage: async ({ authedPage }, use) => { await use(new RecurringRulesPage(authedPage)); },
  supportPage:      async ({ authedPage }, use) => { await use(new SupportPage(authedPage)); },
  vaultPage:        async ({ authedPage }, use) => { await use(new VaultPage(authedPage)); },
  modal:            async ({ page }, use) => { await use(new Modal(page)); },
  toast:            async ({ page }, use) => { await use(new Toast(page)); },
});

export { expect } from "@playwright/test";
