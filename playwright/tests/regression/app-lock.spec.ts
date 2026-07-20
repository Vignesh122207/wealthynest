import {expect, test} from "../../fixtures";
import {provisionE2EUser} from "../../helpers/auth.helper";
import {api} from "../../helpers/api.helper";
import {toastLocator} from "../../helpers/wait.helper";
import {LoginPage} from "../../pages/auth/LoginPage";
import {AccountsPage} from "../../pages/AccountsPage";
import {AppLockScreen} from "../../pages/AppLockScreen";
import type {BrowserContext, Page} from "@playwright/test";

// Dedicated disposable user + own context, same rationale as security.spec.ts/webauthn.spec.ts:
// enabling PIN is account-security-mutating, and this file's own auth traffic (provision +
// password login + a PIN login on /login + several app-lock unlocks, each a real
// /auth/pin-login call) is exactly the kind of thing that tips a shared-user file over the
// /auth endpoint's 10 req/min limit if it shared regressionUser with everything else.
//
// The 5-minute idle-lock path (useAppLockTrigger's IDLE_LIMIT_MS) is deliberately NOT covered
// here — a real 5+ minute wait per test run is a bad trade for something already precisely
// covered by useAppLockTrigger.test.ts's fake-timer unit tests. What this file covers instead is
// what only a real browser can prove: the actual visibilitychange-driven background/foreground
// cycle, that the backend PIN round trip really works, and that unlocking leaves you on the exact
// page you were on with no reload — none of which the unit tests can see.
test.describe.configure({ mode: "serial" });

test.describe("App Lock & PIN", () => {
  let context: BrowserContext;
  let page: Page;
  let accessToken: string;
  let appLock: AppLockScreen;
  let accounts: AccountsPage;
  let login: LoginPage;

  test.beforeAll(async ({ browser }) => {
    const user = await provisionE2EUser({ fullName: "App Lock Test" });
    accessToken = user.auth.accessToken;
    await api.enablePin(accessToken, user.password, "1234");

    context = await browser.newContext();
    page = await context.newPage();
    appLock = new AppLockScreen(page);
    accounts = new AccountsPage(page);
    login = new LoginPage(page);

    await login.loginWithPassword(user.email, user.password);
    await login.expectRedirectedToHome();
  });

  test.afterAll(async () => {
    await api.closeAccount(accessToken).catch(() => {});
    await context.close();
  });

  test("backgrounding the tab past the grace period locks the app on whatever page you were on @regression", async () => {
    test.slow(); // real 31s wait to clear the grace period — needs more than the 30s default
    await accounts.gotoAccounts();
    await accounts.expectHeaderTitle(/Accounts/i);

    await appLock.goBackground();
    await page.waitForTimeout(31_000); // > useAppLockTrigger's 30s BACKGROUND_GRACE_MS
    await appLock.goForeground();

    await appLock.expectVisible();
    await expect(page).toHaveURL(/\/accounts$/); // still here — not bounced to /home or /login
  });

  test("a wrong PIN shows an error and leaves the lock in place @regression", async () => {
    await appLock.unlockWithPin("0000");
    await expect(toastLocator(page).first()).toBeVisible();
    await appLock.expectVisible();
  });

  test("the correct PIN clears the lock without losing the page or its data @regression", async () => {
    await appLock.unlockWithPin("1234");
    await appLock.expectNotVisible();
    await expect(page).toHaveURL(/\/accounts$/);
    // The header title surviving (not a blank/loading page) is the tell for "no reload happened" —
    // a real navigation or full remount would show a loading state here, not instant content.
    await accounts.expectHeaderTitle(/Accounts/i);
  });

  test("returning from background within the grace period does not lock @regression", async () => {
    await appLock.goBackground();
    await page.waitForTimeout(5_000); // well under the 30s grace period
    await appLock.goForeground();

    await appLock.expectNotVisible();
  });

  test("PIN quick-login also works from the /login page itself, while still signed in @regression", async () => {
    // (auth)/layout.tsx has no redirect-away-from-login guard for an already-authenticated
    // visitor — LoginForm decides what to show purely from the persisted auth store (pinEnabled +
    // a cached refreshToken), so navigating here directly, without a real sign-out first, is a
    // faithful stand-in for what a fresh app relaunch would show — confirmed by reading
    // LoginForm's pinCandidate logic and AuthLayout directly, not assumed.
    await login.goto();
    await expect(login.pinInput).toBeVisible();

    await login.loginWithPin("1234");
    await login.expectRedirectedToHome();
  });
});
