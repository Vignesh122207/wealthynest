import {expect, test} from "../../fixtures";
import {provisionE2EUser} from "../../helpers/auth.helper";
import {api} from "../../helpers/api.helper";
import {LoginPage} from "../../pages/auth/LoginPage";
import {SettingsPage} from "../../pages/SettingsPage";
import {AppLockScreen} from "../../pages/AppLockScreen";
import type {BrowserContext, Page} from "@playwright/test";

// Own dedicated user + context, same rationale as security.spec.ts/webauthn.spec.ts — PIN
// enable/disable is account-security-mutating, and this file's own real pin-login round trips
// (proving the old PIN is dead and the new one works) are exactly the /auth traffic that
// shouldn't be sharing an account, or a file, with anything else. Serial for the same reason as
// app-lock.spec.ts (this file's single test builds on state the previous step left behind).
test.describe.configure({ mode: "serial" });

test.describe("Forgot PIN reset", () => {
  let context: BrowserContext;
  let page: Page;
  let accessToken: string;
  let password: string;
  let settings: SettingsPage;
  let appLock: AppLockScreen;

  test.beforeAll(async ({ browser }) => {
    const user = await provisionE2EUser({ fullName: "Forgot Pin Test" });
    accessToken = user.auth.accessToken;
    password = user.password;
    await api.enablePin(accessToken, user.password, "1111");

    context = await browser.newContext();
    page = await context.newPage();
    settings = new SettingsPage(page);
    appLock = new AppLockScreen(page);

    const login = new LoginPage(page);
    await login.loginWithPassword(user.email, user.password);
    await login.expectRedirectedToHome();
  });

  test.afterAll(async () => {
    await api.closeAccount(accessToken).catch(() => {});
    await context.close();
  });

  // Regression coverage for a real gap: turning PIN off (PinRow's toggle) only ever opened
  // PinVerifyModal, which requires re-entering the CURRENT pin — a dead end for anyone who
  // actually forgot it, with no other way in the product to reset one. "Forgot your PIN?" skips
  // that OLD-pin proof, but AuthServiceImpl#enablePin now requires the account PASSWORD instead
  // when replacing an already-set PIN (see its own comment) — PinSetupModal's password step-up
  // screen below is that check surfacing in the UI, not an extra hoop this test invented.
  test("Forgot your PIN? sets a new PIN without the old one, and the new PIN — not the old one — actually unlocks the app @regression", async () => {
    // useAppLockTrigger's actual BACKGROUND_GRACE_MS is 90s (see app-lock.spec.ts's own comment on
    // its identical wait) — test.slow()'s 3x multiplier isn't enough headroom on top of a 91s wait
    // alone, so set an explicit budget instead.
    test.setTimeout(150_000);

    await settings.gotoSecurity();
    // A real page.goto() (BasePage.goto, unlike an in-app <Link>/router.push transition) tears
    // down and reloads the document, which useAppLockTrigger's "was this a real close+reopen"
    // check (see its own comment on resolvePendingHiddenPeriod's zero-grace branch) can't tell
    // apart from an actual app close — it locks immediately, before this test ever gets a chance
    // to click anything. A real user hitting this same lock screen right after (re)opening the
    // app would unlock with their current PIN before doing anything else, so this does the same.
    if (await appLock.dialog.isVisible()) {
      await appLock.unlockWithPin("1111");
      await appLock.expectNotVisible();
    }
    await settings.openPinDisableVerify();
    await settings.clickForgotPin();
    await settings.confirmPasswordForPinReset(password);
    await settings.setNewPin("2222");

    // Back on Security with the modal closed, PIN still shown as enabled — this reset it in
    // place, it didn't turn PIN unlock off.
    await expect(page.getByTestId("security-pin-disable-toggle")).toBeVisible();

    await appLock.goBackground();
    await page.waitForTimeout(91_000); // > useAppLockTrigger's real 90s BACKGROUND_GRACE_MS
    await appLock.goForeground();
    await appLock.expectVisible();

    await appLock.unlockWithPin("1111"); // the old, forgotten PIN — must no longer work
    await expect(appLock.pinInput).toHaveValue("", { timeout: 10_000 });
    await appLock.expectVisible();

    await appLock.unlockWithPin("2222"); // the one just set via "Forgot your PIN?"
    await appLock.expectNotVisible();
  });
});
